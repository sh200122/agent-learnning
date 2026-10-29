import "dotenv/config";
import OpenAI from "openai";
import { z } from "zod";

const client = new OpenAI({
  apiKey: process.env.ZHIPU_API_KEY,
  baseURL: process.env.ZHIPU_BASE_URL,
});

// 1. 模拟数据库
const orders = {
  A100: {
    status: "shipped",
    trackingNumber: "SF123",
  },
};

const tracking = {
  SF123: {
    status: "运输中",
    location: "上海分拨中心",
  },
};

// 2. 工具函数
function getOrderStatus(orderId: string) {
  return orders[orderId as keyof typeof orders] ?? { error: "订单不存在" };
}

function getTracking(trackingNumber: string) {
  return (
    tracking[trackingNumber as keyof typeof tracking] ?? {
      error: "物流信息不存在",
    }
  );
}

// 3. 告诉 LLM 有哪些工具（Chat Completions 格式）
const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "get_order_status",
      description: "根据订单号查询订单状态",
      parameters: {
        type: "object",
        properties: {
          orderId: { type: "string" },
        },
        required: ["orderId"],
        additionalProperties: false,
      },
      strict: true,
    },
  },
  {
    type: "function",
    function: {
      name: "get_tracking",
      description: "根据快递单号查询物流信息",
      parameters: {
        type: "object",
        properties: {
          trackingNumber: { type: "string" },
        },
        required: ["trackingNumber"],
        additionalProperties: false,
      },
      strict: true,
    },
  },
];

const systemPrompt = `
你是订单查询助手。
根据用户需求选择工具。
如果订单已发货且用户需要物流信息，
继续查询物流。
只根据工具返回的数据回答。
`.trim();

// 4. 执行工具，并验证参数
function executeTool(name: string, rawArgs: string) {
  const args: unknown = JSON.parse(rawArgs);

  if (name === "get_order_status") {
    const data = z
      .object({
        orderId: z.string(),
      })
      .parse(args);

    return getOrderStatus(data.orderId);
  }

  if (name === "get_tracking") {
    const data = z
      .object({
        trackingNumber: z.string(),
      })
      .parse(args);

    return getTracking(data.trackingNumber);
  }

  throw new Error(`未知工具: ${name}`);
}

// 5. Agent Loop 核心（智谱兼容 Chat Completions）
async function runAgent(task: string) {
  const MAX_STEPS = 6;
  const model = process.env.ZHIPU_MODEL || "glm-4-flash";

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: task },
  ];

  for (let step = 1; step <= MAX_STEPS; step++) {
    console.log(`\n=== Agent Loop 第 ${step} 轮 ===`);

    const response = await client.chat.completions.create({
      model,
      messages,
      tools,
    });

    const message = response.choices[0].message;
    messages.push(message);

    const calls = message.tool_calls ?? [];

    // 6. 没有工具调用，任务结束
    if (calls.length === 0) {
      if (!message.content) {
        throw new Error("未收到最终回答");
      }

      return message.content;
    }

    // 7. 执行所有工具调用，把结果写回 messages
    for (const call of calls) {
      if (call.type !== "function") continue;

      console.log("调用工具:", call.function.name);
      console.log("参数:", call.function.arguments);

      let result: unknown;

      try {
        result = executeTool(call.function.name, call.function.arguments);
      } catch (error) {
        result = {
          error: error instanceof Error ? error.message : "工具执行失败",
        };
      }

      console.log("工具结果:", result);

      messages.push({
        role: "tool",
        tool_call_id: call.id,
        content: JSON.stringify(result),
      });
    }
  }

  throw new Error("Agent 超过最大执行轮数");
}

// 8. 启动 Agent
runAgent("查询订单 A100 的状态，如果已发货，再查询物流信息。")
  .then((result) => console.log("\n最终回答:", result))
  .catch(console.error);
