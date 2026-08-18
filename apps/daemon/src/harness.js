import { AppError } from './errors.js';

export const countTabsTool = {
  type: 'function',
  function: {
    name: 'browser.tabs.count_active_window',
    description: 'Returns the number of open tabs in the active browser window.',
    parameters: { type: 'object', properties: {}, additionalProperties: false },
  },
};

export class Harness {
  constructor({ llm, browser }) { this.llm = llm; this.browser = browser; }

  async run(userMessage) {
    if (typeof userMessage !== 'string' || !userMessage.trim()) {
      throw new AppError('invalid_request', 'Enter a non-empty question.');
    }

    const messages = [{ role: 'user', content: userMessage }];
    const assistant = await this.llm.chat(messages, [countTabsTool]);
    messages.push(assistant);
    const calls = assistant.tool_calls ?? [];
    if (calls.length === 0) return assistant.content;
    if (calls.length !== 1) throw new AppError('invalid_tool_call', 'The model returned an invalid tool call.');

    const call = calls[0];
    if (
      call?.function?.name !== countTabsTool.function.name ||
      !call.function.arguments ||
      typeof call.function.arguments !== 'object' ||
      Array.isArray(call.function.arguments) ||
      Object.keys(call.function.arguments).length > 0
    ) {
      throw new AppError('invalid_tool_call', 'The model returned an invalid tool call.');
    }

    const result = await this.browser.countTabsInActiveWindow();
    messages.push({ role: 'tool', tool_name: call.function.name, content: JSON.stringify(result) });
    const final = await this.llm.chat(messages, [countTabsTool]);
    if (final.tool_calls?.length || !final.content.trim()) {
      throw new AppError('invalid_model_response', 'The model did not return a final answer.');
    }
    return final.content;
  }
}
