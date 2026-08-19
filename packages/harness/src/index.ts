export type BrowserTabCount = {
  windowId: number;
  count: number;
};

export interface BrowserGateway {
  countTabsInActiveWindow(): Promise<BrowserTabCount>;
}

export type ToolCall = {
  function: {
    name: string;
    arguments: Record<string, unknown>;
  };
};

export type AssistantMessage = {
  role: string;
  content: string;
  tool_calls?: ToolCall[];
};

export type ChatMessage =
  | { role: 'user'; content: string }
  | AssistantMessage
  | { role: 'tool'; tool_name: string; content: string };

export type LlmTool = {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

export interface LLMProvider {
  chat(messages: ChatMessage[], tools: LlmTool[]): Promise<AssistantMessage>;
}

export class HarnessError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
    this.name = 'HarnessError';
  }
}

export const countTabsTool: LlmTool = {
  type: 'function',
  function: {
    name: 'browser.tabs.count_active_window',
    description: 'Returns the number of open tabs in the active browser window.',
    parameters: { type: 'object', properties: {}, additionalProperties: false },
  },
};

type HarnessDependencies = {
  llm: LLMProvider;
  browser: BrowserGateway;
};

export class Harness {
  private readonly llm: LLMProvider;
  private readonly browser: BrowserGateway;

  constructor({ llm, browser }: HarnessDependencies) {
    this.llm = llm;
    this.browser = browser;
  }

  async run(userMessage: string) {
    if (typeof userMessage !== 'string' || !userMessage.trim()) {
      throw new HarnessError('invalid_request', 'Enter a non-empty question.');
    }

    const messages: ChatMessage[] = [{ role: 'user', content: userMessage }];
    const assistant = await this.llm.chat(messages, [countTabsTool]);
    messages.push(assistant);
    const calls = assistant.tool_calls ?? [];
    if (calls.length === 0) return assistant.content;
    if (calls.length !== 1) {
      throw new HarnessError('invalid_tool_call', 'The model returned an invalid tool call.');
    }

    const call = calls[0];
    if (
      call?.function?.name !== countTabsTool.function.name ||
      !call.function.arguments ||
      typeof call.function.arguments !== 'object' ||
      Array.isArray(call.function.arguments) ||
      Object.keys(call.function.arguments).length > 0
    ) {
      throw new HarnessError('invalid_tool_call', 'The model returned an invalid tool call.');
    }

    const result = await this.browser.countTabsInActiveWindow();
    messages.push({ role: 'tool', tool_name: call.function.name, content: JSON.stringify(result) });
    const final = await this.llm.chat(messages, [countTabsTool]);
    if (final.tool_calls?.length || !final.content.trim()) {
      throw new HarnessError('invalid_model_response', 'The model did not return a final answer.');
    }
    return final.content;
  }
}
