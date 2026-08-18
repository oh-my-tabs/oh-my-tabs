# Oh My Tabs local slice

## Run

1. Start Ollama and ensure the selected model supports tool calling.
2. From this directory, start the daemon:

   ```sh
   pnpm start:daemon
   ```

   The daemon uses the already-installed `llama3.1:latest` model by default. Set `OLLAMA_MODEL` to override it. `OLLAMA_BASE_URL` defaults to `http://127.0.0.1:11434`, and the WebSocket daemon defaults to `ws://127.0.0.1:8787`.

3. Build the sibling `browser-extension` project with `pnpm build`, load its `.output/chrome-mv3` directory as an unpacked Chrome extension, and confirm its popup reports a connected state.
4. In a second terminal, run `pnpm start:cli` and enter a question such as `How many tabs are currently open in the active window?`.

## Verify

```sh
pnpm test
pnpm typecheck
```
