import { Box, InputRenderable, InputRenderableEvents, Text, TextRenderable, createCliRenderer } from "@opentui/core"
import { DaemonClient } from "./daemon-client.js"
import { resolveDaemonEndpoint } from "@oh-my-tabs/config"

const renderer = await createCliRenderer({ exitOnCtrlC: true })
const output = new TextRenderable(renderer, {
  content: "Type /help to see available commands.",
})
const daemon = new DaemonClient(resolveDaemonEndpoint(process.env).url)

function setOutput(content: string) {
  output.content = content
}

const commands = [
  {
    name: "/help",
    description: "show available commands",
    run: () => {
      setOutput(commands.map(({ name, description }) => `${name.padEnd(8)} ${description}`).join("\n"))
    },
  },
  {
    name: "/clear",
    description: "clear the output",
    run: () => setOutput(""),
  },
  {
    name: "/quit",
    description: "exit oh-my-tabs",
    run: () => {
      daemon.close()
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

input.on(InputRenderableEvents.ENTER, async (submittedValue) => {
  const value = submittedValue.trim()
  input.value = ""

  if (!value) return

  if (!value.startsWith("/")) {
    setOutput("Thinking…")
    try {
      setOutput(await daemon.ask(value))
    } catch (error) {
      setOutput(error instanceof Error ? error.message : "The request failed.")
    }
    return
  }

  const commandName = value.split(/\s+/, 1)[0]
  const command = commands.find(({ name }) => name === commandName)

  if (!command) {
    setOutput(`Unknown command: ${commandName}\nType /help to see available commands.`)
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
