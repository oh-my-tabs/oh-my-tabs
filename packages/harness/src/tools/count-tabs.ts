import type { ToolArguments, ToolDefinition } from '../index.js';

export type BrowserTabCount = {
  windowId: number;
  count: number;
};

export interface BrowserGateway {
  countTabsInActiveWindow(): Promise<BrowserTabCount>;
}

function hasNoArguments(arguments_: unknown): arguments_ is ToolArguments {
  return Boolean(
    arguments_ && typeof arguments_ === 'object' && !Array.isArray(arguments_) && Object.keys(arguments_).length === 0,
  );
}

export function createCountTabsTool(browser: BrowserGateway): ToolDefinition {
  return {
    definition: {
      type: 'function',
      function: {
        name: 'browser.tabs.count_active_window',
        description: 'Returns the number of open tabs in the active browser window.',
        parameters: { type: 'object', properties: {}, additionalProperties: false },
      },
    },
    validateArguments: hasNoArguments,
    execute: () => browser.countTabsInActiveWindow(),
  };
}
