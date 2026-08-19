import assert from 'node:assert/strict';
import test from 'node:test';
import { Harness } from '../dist/index.js';

test('executes the count-tabs tool and returns the model final answer', async () => {
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
  const harness = new Harness({
    llm,
    browser: { async countTabsInActiveWindow() { return { windowId: 7, count: 12 }; } },
  });

  assert.equal(await harness.run('How many tabs are currently open?'), 'There are 12 tabs open in the active window.');
  assert.deepEqual(JSON.parse(calls[1].messages.at(-1).content), { windowId: 7, count: 12 });
  assert.equal(calls[0].tools[0].function.name, 'browser.tabs.count_active_window');
});

test('returns a model answer that does not require a tool', async () => {
  const harness = new Harness({
    llm: { async chat() { return { role: 'assistant', content: 'No browser needed.' }; } },
    browser: { async countTabsInActiveWindow() { throw new Error('Browser should not run.'); } },
  });

  assert.equal(await harness.run('hello'), 'No browser needed.');
});

test('rejects malformed tool calls without invoking the browser', async () => {
  let invoked = false;
  const harness = new Harness({
    llm: { async chat() { return { role: 'assistant', content: '', tool_calls: [{ function: { name: 'unknown', arguments: {} } }] }; } },
    browser: { async countTabsInActiveWindow() { invoked = true; return { windowId: 1, count: 1 }; } },
  });

  await assert.rejects(harness.run('count'), { code: 'invalid_tool_call' });
  assert.equal(invoked, false);
});

test('rejects empty user messages', async () => {
  const harness = new Harness({
    llm: { async chat() { throw new Error('LLM should not run.'); } },
    browser: { async countTabsInActiveWindow() { throw new Error('Browser should not run.'); } },
  });

  await assert.rejects(harness.run('  '), { code: 'invalid_request' });
});
