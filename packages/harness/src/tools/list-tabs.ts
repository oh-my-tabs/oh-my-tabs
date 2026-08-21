import type { ToolArguments, ToolDefinition } from '../index.js';

export type BrowserTab = {
  id: number;
  title: string;
  url: string;
  active: boolean;
  pinned: boolean;
};

export type BrowserTabList = {
  windowId: number;
  tabs: BrowserTab[];
};

export interface BrowserTabListGateway {
  listTabsInActiveWindow(): Promise<BrowserTabList>;
}

function hasNoArguments(arguments_: unknown): arguments_ is ToolArguments {
  return Boolean(
    arguments_ && typeof arguments_ === 'object' && !Array.isArray(arguments_) && Object.keys(arguments_).length === 0,
  );
}

export function createListTabsTool(browser: BrowserTabListGateway): ToolDefinition {
  return {
    definition: {
      type: 'function',
      function: {
        name: 'browser.tabs.list_active_window',
        description: 'Lists the open tabs in the active browser window with their titles, URLs, and state.',
        parameters: { type: 'object', properties: {}, additionalProperties: false },
      },
    },
    validateArguments: hasNoArguments,
    execute: () => browser.listTabsInActiveWindow(),
  };
}
