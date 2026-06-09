# clawd-models

Terminal UI for managing the model configuration used by [OpenClaw](https://github.com/openclaw/openclaw).

The TUI is built on [@mariozechner/pi-tui](https://www.npmjs.com/package/@mariozechner/pi-tui) and reads/writes a single JSON file at `~/.openclaw/openclaw.json`.

![TUI Interface](https://raw.githubusercontent.com/qidu/clawd-models/refs/heads/main/docs/setup-flow.svg)

## Prerequisite

Install and configure `openclaw` first:

```bash
openclaw setup
# or
openclaw configure
```

## Installation

```bash
npm i -g clawd-models
```

## Usage

```bash
clawd-models            # launch the interactive TUI
clawd-models --tui      # launch the interactive TUI
clawd-models --list-providers   # print configured providers
clawd-models --list-models      # print configured models
clawd-models --view-config      # dump the full config JSON
clawd-models --test             # run a sample prompt + tool call against the primary model
clawd-models --help             # show CLI usage
```

The TUI requires a real terminal.

## Key Bindings

| Key | Action |
| --- | --- |
| `Enter` / `E` | edit the current row |
| `A` | add a provider |
| `M` | add a model to the current provider |
| `T` | test the current model |
| `R` | reload config from disk |
| `↑` / `↓` / `j` / `k` | move the cursor |
| `q` / `Ctrl+C` | quit |

In picker overlays:

- `Enter` — confirm selection
- `Esc` — cancel
- `Space` — toggle the current item (only in the multi-select pickers described below)

In the agent-defaults submenu (press `D` to open):

- `Enter` to edit the highlighted field
- `Space` to toggle items inside the **models** and **fallbacks** multi-select pickers
- `P` / `B` / `O` on a model row in the primary picker to set as primary, push to fallback, or unset

## Features

### Providers

- Add a new provider (`A` at the root).
- Edit a provider's `apiSchema`, `baseUrl`, and `apiKey`.
- Browse the providers list with their base URLs.

### Models

- Add a model to the current provider (`M` with a provider row highlighted).
- Edit model `id`, `name`, `contextWindow`, `maxTokens`, and `reasoning` flag.
- Run a sample prompt + tool call against a model to verify connectivity (`T`).
- Token counts in the model list are displayed in a compact form: `ctx 262k  max 8k`.

### Agents Defaults (press `D`)

The default editor exposes three fields:

- **models** — multi-select picker over all provider models. Use `Space` to toggle, `Enter` to save. Drives the list of models exposed to OpenClaw agents.
- **primary** — single-select picker; pick the model used as the default for agents.
- **fallbacks** — multi-select picker; choose one or more models used when the primary is unavailable. The `fallback` value accepts an array, so the picker lets you pick more than one in a single pass.

If a provider's model list is empty, the multi-select pickers fall back to a comma-separated text prompt.

## Configuration Location

The TUI manages the OpenClaw configuration at:

```
~/.openclaw/openclaw.json
```

Override the path with `OPENCLAW_CONFIG_PATH=/some/other/path`.

## Architecture

```
clawd-models/
├── bin/
│   └── clawd-models.js        # CLI entry; dispatches to the TUI or non-interactive commands
├── src/
│   ├── openclaw-tui.js        # Main TUI (renderer, overlays, input handling)
│   ├── openclaw-config.js     # Config load/save + ensureConfigShape helpers
│   ├── core/                  # Business logic (provider/model/agent managers, API tester)
│   └── tui/                   # Legacy / auxiliary TUI scaffolding
├── docs/
│   ├── openclaw.example.json
│   ├── setup-flow.svg
│   └── uni-example.md
└── package.json
```

`openclaw-tui.js` is the runtime heart of the tool: it owns the `AppView` (the main list), the `ListOverlay` / `PromptOverlay` widgets, and the input dispatch table.

## Migration from CLI (1.0.7 → 1.1.0)

The pre-1.0.7 flag-style CLI was replaced by the TUI. The old commands map to TUI flows as follows:

- `providers:add -n <name> -u <url>` → `A` at the root, then edit `baseUrl` / `apiKey` / `apiSchema`.
- `models:add -p <provider> -i <model-id>` → select a provider row, press `M`.
- `models:test` → select a model row, press `T`.
- `agents:primary` / `agents:fallback` → press `D` for the agent-defaults editor.

Existing configurations are loaded without modification.

## Development

```bash
npm install
npm start          # alias for: node bin/clawd-models.js
npm run tui        # same
```

Debug log is written to `/tmp/clawd-models.log`.

## License

MIT
