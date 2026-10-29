
import "dotenv/config";
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.ZHIPU_API_KEY,
  baseURL: process.env.ZHIPU_BASE_URL,
});

// 1. 真正执行计算的 TypeScript 函数
function add(a: number, b: number): number {
  return a + b;
}

// 2. 定义模型可以使用的工具
const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "add",
      description: "计算两个数字的和",
      parameters: {
        type: "object",
        properties: {
          a: { type: "number" },
          b: { type: "number" }
        },
        required: ["a", "b"],
        additionalProperties: false
      },
      strict: true
    }
  }
];

async function main() {
  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    {
      role: "user",
      content: "帮我计算 111 + 222"
    }
  ];

  // 3. 让 LLM 决定是否调用工具
  const response = await client.chat.completions.create({
    model: process.env.ZHIPU_MODEL || "glm-4-flash",
    messages,
    tools
  });

  const message = response.choices[0].message;
  messages.push(message);

  // 4. 处理模型发出的工具调用请求
  for (const call of message.tool_calls ?? []) {
    if (call.type !== "function") continue;

    let result: string;

    try {
      if (call.function.name !== "add") {
        throw new Error("不支持的工具");
      }

      const args: unknown = JSON.parse(
        call.function.arguments
      );

      if (
        typeof args !== "object" ||
        args === null ||
        !("a" in args) ||
        !("b" in args) ||
        typeof args.a !== "number" ||
        typeof args.b !== "number"
      ) {
        throw new Error("参数无效");
      }

      result = String(add(args.a, args.b));
      console.log("工具执行结果:", result);
    } catch (error) {
      result = JSON.stringify({
        error: error instanceof Error
          ? error.message
          : "工具执行失败"
      });
    }

    // 5. 把执行结果送回 LLM
    messages.push({
      role: "tool",
      tool_call_id: call.id,
      content: result
    });
  }

  // 6. LLM 根据工具结果生成最终回答
  const finalResponse =
    await client.chat.completions.create({
      model: process.env.ZHIPU_MODEL || "glm-4-flash",
      messages,
      tools,
      tool_choice: "none"
    });

  console.log(
    "AI 回答:",
    finalResponse.choices[0].message.content
  );
}

main().catch(console.error);
