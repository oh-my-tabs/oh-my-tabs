import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('does not import local infrastructure', async () => {
  const source = await readFile(new URL('../src/index.ts', import.meta.url), 'utf8');
  const forbidden = [
    "from 'ws'",
    'chrome.',
    'process.env',
    'OllamaProvider',
    'browser.tabs.count_active_window',
    'countTabsInActiveWindow',
  ];

  for (const dependency of forbidden) {
    assert.equal(source.includes(dependency), false, `Harness must not contain ${dependency}`);
  }
});
