export const PROTOCOL_VERSION = 1 as const;

export const MESSAGE_TYPES = {
  hello: 'hello',
  agentRequest: 'agent-request',
  agentResponse: 'agent-response',
  agentError: 'agent-error',
  countActiveWindowTabs: 'count-active-window-tabs',
  activeWindowTabsCounted: 'active-window-tabs-counted',
  activeWindowTabsFailed: 'active-window-tabs-failed',
  listActiveWindowTabs: 'list-active-window-tabs',
  activeWindowTabsListed: 'active-window-tabs-listed',
  activeWindowTabsListFailed: 'active-window-tabs-list-failed',
} as const;

export type ClientRole = 'cli' | 'extension';

export type PublicError = {
  code: string;
  message: string;
};

type HelloMessageBase = {
  type: typeof MESSAGE_TYPES.hello;
  protocolVersion: typeof PROTOCOL_VERSION;
};

export type HelloMessage = HelloMessageBase & ({ role: 'cli' } | { role: 'extension'; sessionId: string });

export type AgentRequest = {
  type: typeof MESSAGE_TYPES.agentRequest;
  requestId: string;
  message: string;
};

export type AgentResponse = {
  type: typeof MESSAGE_TYPES.agentResponse;
  requestId: string;
  content: string;
};

export type AgentError = {
  type: typeof MESSAGE_TYPES.agentError;
  requestId?: string;
  error: PublicError;
};

export type CountActiveWindowTabs = {
  type: typeof MESSAGE_TYPES.countActiveWindowTabs;
  requestId: string;
};

export type ActiveWindowTabsCounted = {
  type: typeof MESSAGE_TYPES.activeWindowTabsCounted;
  requestId: string;
  windowId: number;
  count: number;
};

export type ActiveWindowTabsFailed = {
  type: typeof MESSAGE_TYPES.activeWindowTabsFailed;
  requestId: string;
};

export type BrowserTab = {
  id: number;
  title: string;
  url: string;
  active: boolean;
  pinned: boolean;
};

export type ListActiveWindowTabs = {
  type: typeof MESSAGE_TYPES.listActiveWindowTabs;
  requestId: string;
};

export type ActiveWindowTabsListed = {
  type: typeof MESSAGE_TYPES.activeWindowTabsListed;
  requestId: string;
  windowId: number;
  tabs: BrowserTab[];
};

export type ActiveWindowTabsListFailed = {
  type: typeof MESSAGE_TYPES.activeWindowTabsListFailed;
  requestId: string;
};

export type ClientToDaemonMessage =
  | HelloMessage
  | AgentRequest
  | ActiveWindowTabsCounted
  | ActiveWindowTabsFailed
  | ActiveWindowTabsListed
  | ActiveWindowTabsListFailed;

export type DaemonToCliMessage = AgentResponse | AgentError;
export type DaemonToExtensionMessage = CountActiveWindowTabs | ListActiveWindowTabs | AgentError;

export class ProtocolValidationError extends Error {
  constructor(
    readonly code = 'invalid_message',
    message = 'Received an invalid WebSocket message.',
  ) {
    super(message);
    this.name = 'ProtocolValidationError';
  }
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ProtocolValidationError();
  return value as Record<string, unknown>;
}

function string(value: unknown): string {
  if (typeof value !== 'string') throw new ProtocolValidationError();
  return value;
}

function boolean(value: unknown): boolean {
  if (typeof value !== 'boolean') throw new ProtocolValidationError();
  return value;
}

function browserTab(value: unknown): BrowserTab {
  const tab = record(value);
  if (!Number.isInteger(tab.id)) throw new ProtocolValidationError();
  return {
    id: Number(tab.id),
    title: string(tab.title),
    url: string(tab.url),
    active: boolean(tab.active),
    pinned: boolean(tab.pinned),
  };
}

function requestId(value: Record<string, unknown>) {
  return string(value.requestId);
}

function publicError(value: unknown): PublicError {
  const error = record(value);
  return { code: string(error.code), message: string(error.message) };
}

export function parseJsonMessage(data: string): unknown {
  try {
    return JSON.parse(data);
  } catch {
    throw new ProtocolValidationError();
  }
}

export function parseClientToDaemonMessage(input: unknown): ClientToDaemonMessage {
  const value = record(input);
  switch (value.type) {
    case MESSAGE_TYPES.hello:
      if (value.role !== 'cli' && value.role !== 'extension') {
        throw new ProtocolValidationError('invalid_handshake', 'The first message must identify a valid client role.');
      }
      if (value.protocolVersion !== PROTOCOL_VERSION) {
        throw new ProtocolValidationError(
          'unsupported_protocol_version',
          'The client protocol version is not supported.',
        );
      }
      if (value.role === 'extension') {
        return {
          type: value.type,
          role: value.role,
          protocolVersion: value.protocolVersion,
          sessionId: string(value.sessionId),
        };
      }
      return { type: value.type, role: value.role, protocolVersion: value.protocolVersion };
    case MESSAGE_TYPES.agentRequest:
      return { type: value.type, requestId: requestId(value), message: string(value.message) };
    case MESSAGE_TYPES.activeWindowTabsCounted: {
      if (!Number.isInteger(value.windowId) || !Number.isInteger(value.count) || Number(value.count) < 0) {
        throw new ProtocolValidationError();
      }
      return {
        type: value.type,
        requestId: requestId(value),
        windowId: Number(value.windowId),
        count: Number(value.count),
      };
    }
    case MESSAGE_TYPES.activeWindowTabsFailed:
      return { type: value.type, requestId: requestId(value) };
    case MESSAGE_TYPES.activeWindowTabsListed:
      if (!Number.isInteger(value.windowId) || !Array.isArray(value.tabs)) throw new ProtocolValidationError();
      return {
        type: value.type,
        requestId: requestId(value),
        windowId: Number(value.windowId),
        tabs: value.tabs.map(browserTab),
      };
    case MESSAGE_TYPES.activeWindowTabsListFailed:
      return { type: value.type, requestId: requestId(value) };
    default:
      throw new ProtocolValidationError();
  }
}

export function parseDaemonToCliMessage(input: unknown): DaemonToCliMessage {
  const value = record(input);
  if (value.type === MESSAGE_TYPES.agentResponse) {
    return { type: value.type, requestId: requestId(value), content: string(value.content) };
  }
  if (value.type === MESSAGE_TYPES.agentError) {
    return {
      type: value.type,
      ...(value.requestId === undefined ? {} : { requestId: string(value.requestId) }),
      error: publicError(value.error),
    };
  }
  throw new ProtocolValidationError();
}

export function parseDaemonToExtensionMessage(input: unknown): DaemonToExtensionMessage {
  const value = record(input);
  if (value.type === MESSAGE_TYPES.countActiveWindowTabs) {
    return { type: value.type, requestId: requestId(value) };
  }
  if (value.type === MESSAGE_TYPES.listActiveWindowTabs) {
    return { type: value.type, requestId: requestId(value) };
  }
  if (value.type === MESSAGE_TYPES.agentError) {
    return {
      type: value.type,
      ...(value.requestId === undefined ? {} : { requestId: string(value.requestId) }),
      error: publicError(value.error),
    };
  }
  throw new ProtocolValidationError();
}

export function createHelloMessage(role: 'cli'): HelloMessage;
export function createHelloMessage(role: 'extension', sessionId: string): HelloMessage;
export function createHelloMessage(role: ClientRole, sessionId?: string): HelloMessage {
  if (role === 'extension') {
    if (!sessionId) throw new ProtocolValidationError('invalid_handshake', 'Extension session ID is required.');
    return { type: MESSAGE_TYPES.hello, role, protocolVersion: PROTOCOL_VERSION, sessionId };
  }
  return { type: MESSAGE_TYPES.hello, role, protocolVersion: PROTOCOL_VERSION };
}

export function createAgentRequest(requestId: string, message: string): AgentRequest {
  return { type: MESSAGE_TYPES.agentRequest, requestId, message };
}

export function createAgentResponse(requestId: string, content: string): AgentResponse {
  return { type: MESSAGE_TYPES.agentResponse, requestId, content };
}

export function createAgentError(error: PublicError, requestId?: string): AgentError {
  return { type: MESSAGE_TYPES.agentError, ...(requestId === undefined ? {} : { requestId }), error };
}

export function createCountActiveWindowTabs(requestId: string): CountActiveWindowTabs {
  return { type: MESSAGE_TYPES.countActiveWindowTabs, requestId };
}

export function createActiveWindowTabsCounted(
  requestId: string,
  windowId: number,
  count: number,
): ActiveWindowTabsCounted {
  return { type: MESSAGE_TYPES.activeWindowTabsCounted, requestId, windowId, count };
}

export function createActiveWindowTabsFailed(requestId: string): ActiveWindowTabsFailed {
  return { type: MESSAGE_TYPES.activeWindowTabsFailed, requestId };
}

export function createListActiveWindowTabs(requestId: string): ListActiveWindowTabs {
  return { type: MESSAGE_TYPES.listActiveWindowTabs, requestId };
}

export function createActiveWindowTabsListed(
  requestId: string,
  windowId: number,
  tabs: BrowserTab[],
): ActiveWindowTabsListed {
  return { type: MESSAGE_TYPES.activeWindowTabsListed, requestId, windowId, tabs };
}

export function createActiveWindowTabsListFailed(requestId: string): ActiveWindowTabsListFailed {
  return { type: MESSAGE_TYPES.activeWindowTabsListFailed, requestId };
}
