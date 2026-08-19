import { describe, expect, test } from "bun:test"
import { DaemonClient, type DaemonSocket } from "./daemon-client.js"

class FakeSocket extends EventTarget implements DaemonSocket {
  readyState = WebSocket.OPEN
  sent: string[] = []
  send(data: string) {
    this.sent.push(data)
  }
  close() {
    this.dispatchEvent(new Event("close"))
  }
  receive(data: object) {
    this.dispatchEvent(new MessageEvent("message", { data: JSON.stringify(data) }))
  }
  receiveRaw(data: string) {
    this.dispatchEvent(new MessageEvent("message", { data }))
  }
}

function lastSent(socket: FakeSocket) {
  const message = socket.sent.at(-1)
  if (!message) throw new Error("Expected the socket to send a message.")
  return JSON.parse(message)
}

describe("DaemonClient", () => {
  test("identifies itself before sending requests", () => {
    const socket = new FakeSocket()
    new DaemonClient("ws://test", () => socket)

    expect(JSON.parse(socket.sent[0])).toEqual({ type: "hello", role: "cli", protocolVersion: 1 })
  })

  test("correlates an agent response", async () => {
    const socket = new FakeSocket()
    const client = new DaemonClient("ws://test", () => socket)
    const answer = client.ask("How many tabs?")
    const request = lastSent(socket)
    socket.receive({ type: "agent-response", requestId: request.requestId, content: "There are 12 tabs." })
    expect(await answer).toBe("There are 12 tabs.")
  })

  test("surfaces daemon errors", async () => {
    const socket = new FakeSocket()
    const client = new DaemonClient("ws://test", () => socket)
    const answer = client.ask("How many tabs?")
    const request = lastSent(socket)
    socket.receive({
      type: "agent-error",
      requestId: request.requestId,
      error: { code: "extension_disconnected", message: "Extension missing." },
    })
    expect(answer).rejects.toThrow("Extension missing.")
  })

  test("rejects pending requests when the socket closes", async () => {
    const socket = new FakeSocket()
    const client = new DaemonClient("ws://test", () => socket)
    const answer = client.ask("How many tabs?")

    socket.close()

    expect(answer).rejects.toThrow("The daemon connection closed.")
  })

  test("times out when the daemon does not respond", async () => {
    const socket = new FakeSocket()
    let runTimeout = () => {}
    let timeoutDelay = 0
    const cleared: unknown[] = []
    const client = new DaemonClient("ws://test", () => socket, undefined, {
      set(callback, delay) {
        runTimeout = callback
        timeoutDelay = delay
        return 1 as unknown as ReturnType<typeof setTimeout>
      },
      clear(timer) {
        cleared.push(timer)
      },
    })

    const answer = client.ask("How many tabs?")
    expect(timeoutDelay).toBe(30_000)
    runTimeout()

    await expect(answer).rejects.toThrow("The daemon did not respond in time.")
    expect((client as unknown as { pending: Map<string, unknown> }).pending.size).toBe(0)
    expect(cleared).toHaveLength(1)
  })

  test("rejects malformed responses explicitly", async () => {
    const socket = new FakeSocket()
    const client = new DaemonClient("ws://test", () => socket, 5)
    const answer = client.ask("How many tabs?")

    socket.receiveRaw("not-json")

    expect(answer).rejects.toThrow("The daemon returned an invalid response.")
  })

  test("rejects unknown response types explicitly", async () => {
    const socket = new FakeSocket()
    const client = new DaemonClient("ws://test", () => socket, 5)
    const answer = client.ask("How many tabs?")
    const request = lastSent(socket)

    socket.receive({ type: "unknown", requestId: request.requestId })

    expect(answer).rejects.toThrow("The daemon returned an invalid response.")
  })
})
