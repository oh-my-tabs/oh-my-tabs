import { Box, Input, Text, createCliRenderer } from "@opentui/core"

const renderer = await createCliRenderer({ exitOnCtrlC: true })
const input = Input({
  backgroundColor: "#262626",
  focusedBackgroundColor: "#333333",
  placeholder: "Type a message...",
  width: 30,
})

input.focus()

renderer.root.add(
  Box(
    {
      border: true,
      borderStyle: "rounded",
      padding: 1,
      width: 36,
      height: 8,
    },
    Text({ content: "oh-my-tabs\n\nEnter a message:" }),
    input,
    Text({ content: "\nCtrl+C to quit", fg: "#808080" }),
  ),
)
