import assert from 'node:assert/strict';
import test from 'node:test';
import { createCountTabsTool } from '../dist/index.js';

test('defines and executes the count-tabs browser tool', async () => {
  const tool = createCountTabsTool({
    async countTabsInActiveWindow() {
      return { windowId: 7, count: 12 };
    },
  });

  assert.equal(tool.definition.function.name, 'browser.tabs.count_active_window');
  assert.equal(tool.validateArguments({}), true);
  assert.deepEqual(await tool.execute({}), { windowId: 7, count: 12 });
});

test('rejects non-empty and non-object arguments', () => {
  const tool = createCountTabsTool({
    async countTabsInActiveWindow() {
      return { windowId: 7, count: 12 };
    },
  });

  assert.equal(tool.validateArguments({ unexpected: true }), false);
  assert.equal(tool.validateArguments([]), false);
  assert.equal(tool.validateArguments(null), false);
});
