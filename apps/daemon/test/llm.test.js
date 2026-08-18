import assert from 'node:assert/strict';
import test from 'node:test';
import { OllamaProvider } from '../src/llm.js';

test('reports a missing model when a request is made', async () => {
  const provider = new OllamaProvider({});
  await assert.rejects(provider.chat([], []), { code: 'model_not_configured' });
});

test('sends Ollama a non-streaming tool-enabled chat request', async () => {
  let request;
  const provider = new OllamaProvider({
    baseUrl: 'http://ollama.test/',
    model: 'qwen3',
    fetchImpl: async (url, init) => {
      request = { url, ...init, body: JSON.parse(init.body) };
      return new Response(JSON.stringify({ message: { role: 'assistant', content: 'done' } }));
    },
  });
  assert.equal((await provider.chat([{ role: 'user', content: 'hi' }], [{ type: 'function' }])).content, 'done');
  assert.equal(request.url, 'http://ollama.test/api/chat');
  assert.equal(request.body.stream, false);
  assert.equal(request.body.model, 'qwen3');
  assert.deepEqual(request.body.tools, [{ type: 'function' }]);
});

test('maps model tool support errors to a clear application error', async () => {
  const provider = new OllamaProvider({ model: 'old-model', fetchImpl: async () => new Response('does not support tools', { status: 400 }) });
  await assert.rejects(provider.chat([], []), { code: 'tool_calling_unsupported' });
});
