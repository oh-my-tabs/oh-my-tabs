import assert from 'node:assert/strict';
import test from 'node:test';
import { createListTabsTool } from '../dist/index.js';

test('defines and executes the list-tabs browser tool', async () => {
  const result = {
    windowId: 7,
    tabs: [{ id: 1, title: 'Example', url: 'https://example.com', active: true, pinned: false }],
  };
  const tool = createListTabsTool({
    async listTabsInActiveWindow() {
      return result;
    },
  });

  assert.equal(tool.definition.function.name, 'browser.tabs.list_active_window');
  assert.equal(tool.validateArguments({}), true);
  assert.deepEqual(await tool.execute({}), result);
});

test('rejects non-empty and non-object arguments', () => {
  const tool = createListTabsTool({
    async listTabsInActiveWindow() {
      return { windowId: 7, tabs: [] };
    },
  });

  assert.equal(tool.validateArguments({ unexpected: true }), false);
  assert.equal(tool.validateArguments([]), false);
  assert.equal(tool.validateArguments(null), false);
});
