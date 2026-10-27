export type ZhipuToolCall = {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
};

export type ZhipuMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_call_id?: string;
  tool_calls?: ZhipuToolCall[];
};

export type ZhipuTool = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

export type ZhipuChatCompletion = {
  choices: Array<{
    message: {
      role: string;
      content: string | null;
      tool_calls?: ZhipuToolCall[];
    };
  }>;
};

export class ZhipuClient {
  constructor(
    private readonly apiKey: string,
    private readonly baseURL: string,
  ) {}

  async chatCompletions(body: {
    model: string;
    messages: ZhipuMessage[];
    tools?: ZhipuTool[];
  }): Promise<ZhipuChatCompletion> {
    const response = await fetch(
      `${this.baseURL.replace(/\/$/, "")}/chat/completions`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      },
    );

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`${response.status} ${text}`);
    }

    return (await response.json()) as ZhipuChatCompletion;
  }
}
