import { ZhipuClient } from "./zhipu";

const apiKey = process.env.ZHIPU_API_KEY;
const model = process.env.ZHIPU_MODEL;
const baseURL =
  process.env.ZHIPU_BASE_URL ?? "https://open.bigmodel.cn/api/paas/v4/";

if (!apiKey || !model) {
  throw new Error("请配置 ZHIPU_API_KEY 和 ZHIPU_MODEL");
}

const zhipu = new ZhipuClient(apiKey, baseURL);

async function main() {
  const response = await zhipu.chatCompletions({
    model,
    messages: [
      {
        role: "user",
        content: "用三句话解释什么是 AI Agent，并举一个例子。",
      },
    ],
  });

  console.log(response.choices[0]?.message?.content ?? "");
}

main().catch((error) => {
  console.error("智谱模型调用失败：", error.message);
  process.exitCode = 1;
});
