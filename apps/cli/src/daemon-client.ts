export type DaemonSocket = Pick<WebSocket, "readyState" | "send" | "addEventListener" | "close">

export class DaemonClient {
  private socket: DaemonSocket
  private pending = new Map<string, { resolve: (value: string) => void; reject: (error: Error) => void }>()

  constructor(url = "ws://127.0.0.1:8787", createSocket: (url: string) => DaemonSocket = (value) => new WebSocket(value)) {
    this.socket = createSocket(url)
    this.socket.addEventListener("message", (event) => this.handleMessage(String(event.data)))
    this.socket.addEventListener("close", () => this.rejectAll("The daemon connection closed."))
    this.socket.addEventListener("error", () => this.rejectAll("Cannot connect to the daemon. Start it and try again."))
  }

  ask(message: string): Promise<string> {
    if (this.socket.readyState !== WebSocket.OPEN) {
      return Promise.reject(new Error("Cannot connect to the daemon. Start it and try again."))
    }

    const requestId = crypto.randomUUID()
    return new Promise((resolve, reject) => {
      this.pending.set(requestId, { resolve, reject })
      this.socket.send(JSON.stringify({ type: "agent-request", requestId, message }))
    })
  }

  close() { this.socket.close() }

  private handleMessage(data: string) {
    let message: { type?: string; requestId?: string; content?: string; error?: { message?: string } }
    try { message = JSON.parse(data) } catch { return }
    if (!message.requestId) return
    const pending = this.pending.get(message.requestId)
    if (!pending) return
    this.pending.delete(message.requestId)

    if (message.type === "agent-response" && typeof message.content === "string") pending.resolve(message.content)
    else if (message.type === "agent-error") pending.reject(new Error(message.error?.message ?? "The daemon returned an error."))
  }

  private rejectAll(message: string) {
    for (const pending of this.pending.values()) pending.reject(new Error(message))
    this.pending.clear()
  }
}
