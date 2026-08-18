import { AppError } from './errors.js';

export class OllamaProvider {
  constructor({ baseUrl = 'http://127.0.0.1:11434', model, fetchImpl = fetch }) {
    this.url = `${baseUrl.replace(/\/$/, '')}/api/chat`;
    this.model = model;
    this.fetch = fetchImpl;
  }

  async chat(messages, tools) {
    if (!this.model) throw new AppError('model_not_configured', 'Set OLLAMA_MODEL before asking the agent.');
    let response;
    try {
      response = await this.fetch(this.url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ model: this.model, messages, tools, stream: false }),
      });
    } catch (cause) {
      throw new AppError('llm_unavailable', 'The Ollama provider is unavailable.', { cause });
    }

    if (!response.ok) {
      const detail = await response.text();
      const unsupported = /tool|function/i.test(detail);
      throw new AppError(
        unsupported ? 'tool_calling_unsupported' : 'llm_unavailable',
        unsupported ? 'The configured model does not support tool calling.' : `Ollama request failed (${response.status}).`,
      );
    }

    const body = await response.json();
    if (!body?.message || typeof body.message.content !== 'string') {
      throw new AppError('invalid_model_response', 'The model returned an invalid response.');
    }
    return body.message;
  }
}
