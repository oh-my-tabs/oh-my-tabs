export const DEFAULT_DAEMON_HOST = '127.0.0.1';
export const DEFAULT_DAEMON_PORT = 8787;

type Environment = Record<string, string | undefined>;

export function resolveDaemonEndpoint(environment: Environment = {}) {
  const host = environment.OH_MY_TABS_DAEMON_HOST || DEFAULT_DAEMON_HOST;
  const port = Number(environment.OH_MY_TABS_DAEMON_PORT || DEFAULT_DAEMON_PORT);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error('OH_MY_TABS_DAEMON_PORT must be an integer between 1 and 65535.');
  }
  return { host, port, url: `ws://${host}:${port}` };
}
