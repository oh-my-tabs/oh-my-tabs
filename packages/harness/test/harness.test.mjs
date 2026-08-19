import assert from 'node:assert/strict';
import test from 'node:test';
import { Harness, createCountTabsTool } from '../dist/index.js';

function registry(...tools) {
  return new Map(tools.map((tool) => [tool.definition.function.name, tool]));
}

test('executes a registered tool and returns the model final answer', async () => {
  const calls = [];
  const llm = {
    async chat(messages, tools) {
      calls.push({ messages: structuredClone(messages), tools });
      if (calls.length === 1) {
        return { role: 'assistant', content: '', tool_calls: [{ function: { name: 'browser.tabs.count_active_window', arguments: {} } }] };
      }
      return { role: 'assistant', content: 'There are 12 tabs open in the active window.' };
    },
  };
  const countTabs = createCountTabsTool({
    async countTabsInActiveWindow() { return { windowId: 7, count: 12 }; },
  });
  const harness = new Harness({ llm, tools: registry(countTabs) });

  assert.equal(await harness.run('How many tabs are currently open?'), 'There are 12 tabs open in the active window.');
  assert.deepEqual(JSON.parse(calls[1].messages.at(-1).content), { windowId: 7, count: 12 });
  assert.equal(calls[0].tools[0].function.name, 'browser.tabs.count_active_window');
});

test('returns a model answer that does not require a tool', async () => {
  const harness = new Harness({
    llm: { async chat() { return { role: 'assistant', content: 'No browser needed.' }; } },
    tools: new Map(),
  });

  assert.equal(await harness.run('hello'), 'No browser needed.');
});

test('rejects unknown tools without executing a registered tool', async () => {
  let invoked = false;
  const countTabs = createCountTabsTool({
    async countTabsInActiveWindow() { invoked = true; return { windowId: 1, count: 1 }; },
  });
  const harness = new Harness({
    llm: { async chat() { return { role: 'assistant', content: '', tool_calls: [{ function: { name: 'unknown', arguments: {} } }] }; } },
    tools: registry(countTabs),
  });

  await assert.rejects(harness.run('count'), { code: 'invalid_tool_call' });
  assert.equal(invoked, false);
});

test('rejects invalid arguments without executing the tool', async () => {
  let invoked = false;
  const countTabs = createCountTabsTool({
    async countTabsInActiveWindow() { invoked = true; return { windowId: 1, count: 1 }; },
  });
  const harness = new Harness({
    llm: { async chat() { return { role: 'assistant', content: '', tool_calls: [{ function: { name: 'browser.tabs.count_active_window', arguments: { unexpected: true } } }] }; } },
    tools: registry(countTabs),
  });

  await assert.rejects(harness.run('count'), { code: 'invalid_tool_call' });
  assert.equal(invoked, false);
});

test('executes a second tool without changing the agent loop', async () => {
  let turn = 0;
  const echo = {
    definition: {
      type: 'function',
      function: {
        name: 'test.echo',
        description: 'Echoes text.',
        parameters: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] },
      },
    },
    validateArguments(arguments_) {
      return Boolean(arguments_ && typeof arguments_ === 'object' && typeof arguments_.text === 'string');
    },
    async execute(arguments_) { return { text: arguments_.text }; },
  };
  const harness = new Harness({
    llm: {
      async chat(messages) {
        turn += 1;
        if (turn === 1) {
          return { role: 'assistant', content: '', tool_calls: [{ function: { name: 'test.echo', arguments: { text: 'hello' } } }] };
        }
        assert.deepEqual(JSON.parse(messages.at(-1).content), { text: 'hello' });
        return { role: 'assistant', content: 'hello' };
      },
    },
    tools: registry(echo),
  });

  assert.equal(await harness.run('echo hello'), 'hello');
});

test('rejects registry entries whose key differs from the tool name', () => {
  const countTabs = createCountTabsTool({
    async countTabsInActiveWindow() { return { windowId: 1, count: 1 }; },
  });

  assert.throws(
    () => new Harness({ llm: { async chat() { throw new Error(); } }, tools: new Map([['wrong-name', countTabs]]) }),
    { code: 'invalid_tool_registry' },
  );
});

test('rejects empty user messages', async () => {
  const harness = new Harness({
    llm: { async chat() { throw new Error('LLM should not run.'); } },
    tools: new Map(),
  });

  await assert.rejects(harness.run('  '), { code: 'invalid_request' });
});
