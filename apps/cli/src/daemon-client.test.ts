import { describe, expect, test } from "bun:test"
import { DaemonClient, type DaemonSocket } from "./daemon-client.js"

class FakeSocket extends EventTarget implements DaemonSocket {
  readyState = WebSocket.OPEN
  sent: string[] = []
  send(data: string) { this.sent.push(data) }
  close() { this.dispatchEvent(new Event("close")) }
  receive(data: object) { this.dispatchEvent(new MessageEvent("message", { data: JSON.stringify(data) })) }
}

describe("DaemonClient", () => {
  test("correlates an agent response", async () => {
    const socket = new FakeSocket()
    const client = new DaemonClient("ws://test", () => socket)
    const answer = client.ask("How many tabs?")
    const request = JSON.parse(socket.sent[0])
    socket.receive({ type: "agent-response", requestId: request.requestId, content: "There are 12 tabs." })
    expect(await answer).toBe("There are 12 tabs.")
  })

  test("surfaces daemon errors", async () => {
    const socket = new FakeSocket()
    const client = new DaemonClient("ws://test", () => socket)
    const answer = client.ask("How many tabs?")
    const request = JSON.parse(socket.sent[0])
    socket.receive({ type: "agent-error", requestId: request.requestId, error: { message: "Extension missing." } })
    expect(answer).rejects.toThrow("Extension missing.")
  })
})
