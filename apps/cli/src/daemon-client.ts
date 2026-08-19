export type DaemonSocket = Pick<WebSocket, "readyState" | "send" | "addEventListener" | "close">

type PendingRequest = {
  resolve: (value: string) => void
  reject: (error: Error) => void
  timer: ReturnType<typeof setTimeout>
}

export class DaemonClient {
  private socket: DaemonSocket
  private pending = new Map<string, PendingRequest>()

  constructor(
    url = "ws://127.0.0.1:8787",
    createSocket: (url: string) => DaemonSocket = (value) => new WebSocket(value),
    private requestTimeoutMs = 5_000,
  ) {
    this.socket = createSocket(url)
    if (this.socket.readyState === WebSocket.OPEN) this.sendHandshake()
    else this.socket.addEventListener("open", () => this.sendHandshake())
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
      const timer = setTimeout(() => {
        this.rejectRequest(requestId, "The daemon did not respond in time.")
      }, this.requestTimeoutMs)
      this.pending.set(requestId, { resolve, reject, timer })
      this.socket.send(JSON.stringify({ type: "agent-request", requestId, message }))
    })
  }

  close() { this.socket.close() }

  private sendHandshake() {
    this.socket.send(JSON.stringify({ type: "hello", role: "cli", protocolVersion: 1 }))
  }

  private handleMessage(data: string) {
    let message: { type?: string; requestId?: string; content?: string; error?: { message?: string } }
    try { message = JSON.parse(data) } catch { return }
    if (!message.requestId) return
    const pending = this.pending.get(message.requestId)
    if (!pending) return
    const isResponse = message.type === "agent-response" && typeof message.content === "string"
    const isError = message.type === "agent-error"
    if (!isResponse && !isError) return

    this.pending.delete(message.requestId)
    clearTimeout(pending.timer)

    if (message.type === "agent-response" && typeof message.content === "string") pending.resolve(message.content)
    else pending.reject(new Error(message.error?.message ?? "The daemon returned an error."))
  }

  private rejectRequest(requestId: string, message: string) {
    const pending = this.pending.get(requestId)
    if (!pending) return
    clearTimeout(pending.timer)
    this.pending.delete(requestId)
    pending.reject(new Error(message))
  }

  private rejectAll(message: string) {
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer)
      pending.reject(new Error(message))
    }
    this.pending.clear()
  }
}
