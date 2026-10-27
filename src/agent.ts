import { ZhipuClient, type ZhipuMessage, type ZhipuTool } from "./zhipu";

const apiKey = process.env.ZHIPU_API_KEY;
const model = process.env.ZHIPU_MODEL;
const baseURL =
  process.env.ZHIPU_BASE_URL ?? "https://open.bigmodel.cn/api/paas/v4/";

if (!apiKey || !model) {
  throw new Error("请配置 ZHIPU_API_KEY 和 ZHIPU_MODEL");
}

const zhipu = new ZhipuClient(apiKey, baseURL);

const tools: ZhipuTool[] = [
  {
    type: "function",
    function: {
      name: "calculate",
      description: "计算两个数字的加、减、乘、除",
      parameters: {
        type: "object",
        properties: {
          a: { type: "number" },
          b: { type: "number" },
          op: {
            type: "string",
            enum: ["add", "subtract", "multiply", "divide"],
          },
        },
        required: ["a", "b", "op"],
        additionalProperties: false,
      },
    },
  },
];

type Calculation = {
  a: number;
  b: number;
  op: "add" | "subtract" | "multiply" | "divide";
};

function calculate(args: Calculation): number {
  const { a, b, op } = args;

  switch (op) {
    case "add":
      return a + b;
    case "subtract":
      return a - b;
    case "multiply":
      return a * b;
    case "divide":
      if (b === 0) throw new Error("不能除以零");
      return a / b;
  }
}

async function runAgent(question: string): Promise<string> {
  const messages: ZhipuMessage[] = [
    {
      role: "system",
      content:
        "你是一个可靠的助手。涉及算术运算时必须使用 calculate 工具，不要自行猜测计算结果。",
    },
    { role: "user", content: question },
  ];

  const maxSteps = 5;

  for (let step = 0; step < maxSteps; step++) {
    const response = await zhipu.chatCompletions({
      model,
      messages,
      tools,
    });

    const message = response.choices[0]?.message;
    if (!message) {
      throw new Error("模型未返回消息");
    }

    messages.push({
      role: "assistant",
      content: message.content,
      tool_calls: message.tool_calls,
    });

    const calls = message.tool_calls ?? [];
    if (calls.length === 0) {
      return message.content ?? "";
    }

    for (const call of calls) {
      if (call.function.name !== "calculate") {
        throw new Error(`不允许调用工具：${call.function.name}`);
      }

      let result: number | string;

      try {
        const args = JSON.parse(call.function.arguments) as Calculation;
        result = calculate(args);
      } catch (error) {
        result =
          error instanceof Error
            ? `工具执行失败：${error.message}`
            : "未知工具错误";
      }

      messages.push({
        role: "tool",
        tool_call_id: call.id,
        content: String(result),
      });
    }
  }

  throw new Error("Agent 超过最大执行步数");
}

const question = process.argv.slice(2).join(" ");

if (!question) {
  console.error('用法：npm run dev -- "计算 128 乘以 37"');
  process.exitCode = 1;
} else {
  runAgent(question)
    .then(console.log)
    .catch((error: unknown) => {
      console.error("Agent 执行失败：", error);
      process.exitCode = 1;
    });
}
