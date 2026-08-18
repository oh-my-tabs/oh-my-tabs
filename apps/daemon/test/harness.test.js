import assert from 'node:assert/strict';
import test from 'node:test';
import { Harness } from '../src/harness.js';

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
  const harness = new Harness({ llm, browser: { async countTabsInActiveWindow() { return { windowId: 7, count: 12 }; } } });

  assert.equal(await harness.run('How many tabs are currently open?'), 'There are 12 tabs open in the active window.');
  assert.deepEqual(JSON.parse(calls[1].messages.at(-1).content), { windowId: 7, count: 12 });
  assert.equal(calls[0].tools[0].function.name, 'browser.tabs.count_active_window');
});

test('rejects malformed tool calls without invoking the browser', async () => {
  let invoked = false;
  const harness = new Harness({
    llm: { async chat() { return { role: 'assistant', content: '', tool_calls: [{ function: { name: 'unknown', arguments: {} } }] }; } },
    browser: { async countTabsInActiveWindow() { invoked = true; } },
  });
  await assert.rejects(harness.run('count'), { code: 'invalid_tool_call' });
  assert.equal(invoked, false);
});
