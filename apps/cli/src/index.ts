import {
  Box,
  InputRenderable,
  InputRenderableEvents,
  Text,
  TextRenderable,
  createCliRenderer,
} from "@opentui/core"

const renderer = await createCliRenderer({ exitOnCtrlC: true })
const output = new TextRenderable(renderer, {
  content: "Type /help to see available commands.",
})
const socket = new WebSocket("ws://127.0.0.1:8787")

function setOutput(content: string) {
  output.content = content
}

const commands = [
  {
    name: "/help",
    description: "show available commands",
    run: () => {
      setOutput(
        commands
          .map(({ name, description }) => `${name.padEnd(8)} ${description}`)
          .join("\n"),
      )
    },
  },
  {
    name: "/clear",
    description: "clear the output",
    run: () => setOutput(""),
  },
  {
    name: "/clear-tabs",
    description: "close empty tabs in the focused window",
    run: () => {
      if (socket.readyState !== WebSocket.OPEN) {
        setOutput("Harness is disconnected. Start it and try again.")
        return
      }

      socket.send(JSON.stringify({ type: "clear-tabs" }))
      setOutput("Empty tab cleanup requested.")
    },
  },
  {
    name: "/quit",
    description: "exit oh-my-tabs",
    run: () => {
      socket.close()
      renderer.destroy()
    },
  },
]

const input = new InputRenderable(renderer, {
  backgroundColor: "#262626",
  focusedBackgroundColor: "#333333",
  placeholder: "Type a message...",
  width: "100%",
})

input.on(InputRenderableEvents.ENTER, (submittedValue) => {
  const value = submittedValue.trim()
  input.value = ""

  if (!value) return

  if (!value.startsWith("/")) {
    setOutput(`You: ${value}`)
    return
  }

  const commandName = value.split(/\s+/, 1)[0]
  const command = commands.find(({ name }) => name === commandName)

  if (!command) {
    setOutput(
      `Unknown command: ${commandName}\nType /help to see available commands.`,
    )
    return
  }

  command.run()
})

input.focus()

renderer.root.add(
  Box(
    {
      border: true,
      borderStyle: "rounded",
      padding: 1,
      width: "100%",
      height: 12,
    },
    Text({ content: "oh-my-tabs\n" }),
    output,
    Text({ content: "\nEnter a message:" }),
    input,
    Text({ content: "\nCtrl+C to quit", fg: "#808080" }),
  ),
)
