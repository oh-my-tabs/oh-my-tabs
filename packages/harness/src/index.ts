export type ToolCall = {
  function: {
    name: string;
    arguments: unknown;
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

export type ToolArguments = Record<string, unknown>;

export type ToolDefinition = {
  definition: LlmTool;
  validateArguments(arguments_: unknown): arguments_ is ToolArguments;
  execute(arguments_: ToolArguments): Promise<unknown>;
};

export type ToolRegistry = ReadonlyMap<string, ToolDefinition>;

export class HarnessError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
    this.name = 'HarnessError';
  }
}

type HarnessDependencies = {
  llm: LLMProvider;
  tools: ToolRegistry;
};

export class Harness {
  private readonly llm: LLMProvider;
  private readonly tools: ToolRegistry;
  private readonly toolDefinitions: LlmTool[];

  constructor({ llm, tools }: HarnessDependencies) {
    this.llm = llm;
    this.tools = new Map(tools);
    this.toolDefinitions = [...this.tools.entries()].map(([name, tool]) => {
      if (name !== tool.definition.function.name) {
        throw new HarnessError('invalid_tool_registry', 'A tool registry key does not match its definition.');
      }
      return tool.definition;
    });
  }

  async run(userMessage: string) {
    if (typeof userMessage !== 'string' || !userMessage.trim()) {
      throw new HarnessError('invalid_request', 'Enter a non-empty question.');
    }

    const messages: ChatMessage[] = [{ role: 'user', content: userMessage }];
    const assistant = await this.llm.chat(messages, this.toolDefinitions);
    messages.push(assistant);
    const calls = assistant.tool_calls ?? [];
    if (calls.length === 0) return assistant.content;
    if (calls.length !== 1) {
      throw new HarnessError('invalid_tool_call', 'The model returned an invalid tool call.');
    }

    const call = calls[0];
    const tool = call?.function?.name ? this.tools.get(call.function.name) : undefined;
    if (!tool || !tool.validateArguments(call.function.arguments)) {
      throw new HarnessError('invalid_tool_call', 'The model returned an invalid tool call.');
    }

    const result = await tool.execute(call.function.arguments);
    messages.push({ role: 'tool', tool_name: call.function.name, content: JSON.stringify(result) });
    const final = await this.llm.chat(messages, this.toolDefinitions);
    if (final.tool_calls?.length || !final.content.trim()) {
      throw new HarnessError('invalid_model_response', 'The model did not return a final answer.');
    }
    return final.content;
  }
}

export { createCountTabsTool } from './tools/count-tabs.js';
export type { BrowserGateway, BrowserTabCount } from './tools/count-tabs.js';
