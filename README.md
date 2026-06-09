# clawd-models

Terminal UI for managing the model configuration used by [OpenClaw](https://github.com/openclaw/openclaw).

The TUI is built on [@earendil-works/pi-tui](https://www.npmjs.com/package/@earendil-works/pi-tui) and reads/writes a single JSON file at `~/.openclaw/openclaw.json`.

![TUI Interface](https://raw.githubusercontent.com/qidu/clawd-models/refs/heads/main/docs/setup-flow.svg)

## Prerequisite

Install and initialize `openclaw`'s config firstly:

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
clawd-models --list-models      # print configured models (compact: provider/model  ctx 128k  max 8k)
clawd-models --view-config      # dump the full config JSON
clawd-models --test             # run a sample prompt + tool call against the primary model
clawd-models --help             # show CLI usage
```

The TUI requires a real terminal. Use `H` to open the built-in setup guide.

## Key Bindings

| Key | Action |
| --- | --- |
| `P` | add a provider |
| `M` | add a model to the current provider |
| `T` | test the current model |
| `D` | delete the current provider or model |
| `A` | open agents.defaults editor |
| `R` | reload config from disk |
| `H` | show setup guide |
| `↑` / `↓` / `j` / `k` | move the cursor |
| `Enter` / `E` | edit the current row |
| `q` / `Ctrl+C` | quit |

In picker overlays:

- `Enter` — confirm selection
- `Esc` — cancel
- `Space` — toggle the current item (only in the multi-select pickers)

In the agents.defaults submenu (`A`):

- `Enter` to edit the highlighted field
- `Space` to toggle items inside the **models** and **fallbacks** multi-select pickers

## Screen Layout

The main screen is divided into two sections:

**Agents Defaults** — always visible at the top. Three navigable rows:

- `primary` — the model used by default
- `fallbacks` — ordered list of models tried when the primary is unavailable
- `models` — the active model pool; only models listed here can be chosen as primary or fallbacks

**Providers** — scrollable list below Agents Defaults. Each provider expands to show its models with `ctx N` and `max N` token counts. A green `●` marks models that last passed a connectivity test.

The `▶` cursor indicates the currently selected row. Navigation order follows the visual order: `primary` → `fallbacks` → `models` → provider 1 → model 1 → … → provider N → model N.

## Features

### Providers

- Add a new provider (`P`).
- Edit a provider's `baseUrl`, `api`, `auth`, and `apiKey`.
- Browse the providers list with their base URLs.
- Delete a provider (`D` with a provider row selected — requires typing the provider name to confirm).

### Provider Schema

```json
{
  "models": {
    "providers": {
      "<provider-name>": {
        "baseUrl": "https://api.example.com/v1",
        "api": "openai-completions",
        "auth": "api-key",
        "apiKey": "sk-..."
      }
    }
  }
}
```

**Provider fields:**

| Field | Type | Description | Default |
| --- | --- | --- | --- |
| `baseUrl` | string | API base URL | required |
| `api` | string | API type: `openai-completions` or `anthropic-messages` | `openai-completions` |
| `auth` | string | Auth method: `api-key` or `bearer` | `api-key` |
| `apiKey` | string | API key or bearer token | (optional) |

### Models

- Add a model to the current provider (`M` with a provider row highlighted).
- Edit model `id`, `name`, `api`, `input` types, `reasoning` flag, `cost`, `contextWindow`, and `maxTokens`.
- Run a sample prompt + tool call against a model to verify connectivity (`T`). A green `●` marks successful models; the marker is cleared when a new test starts and reappears on success.
- Delete a model (`D` with a model row selected — type "yes" to confirm).
- Token counts are shown compactly: `ctx 262k  max 8k` (≥1K → `Nk`, ≥1M → `Nm`).

### Model Schema

When adding or editing a model, the following fields are saved to the config:

```json
{
  "models": {
    "providers": {
      "<provider-name>": {
        "models": [
          {
            "id": "model-id",
            "name": "Display Name",
            "api": "openai-completions",
            "reasoning": false,
            "input": ["text"],
            "cost": {
              "input": 0,
              "output": 0,
              "cacheRead": 0,
              "cacheWrite": 0
            },
            "contextWindow": 200000,
            "maxTokens": 8192
          }
        ]
      }
    }
  }
}
```

**Model fields:**

| Field | Type | Description | Default |
| --- | --- | --- | --- |
| `id` | string | Model identifier used in API calls | required |
| `name` | string | Display name shown in TUI | required |
| `api` | string | API type: `openai-completions` or `anthropic-messages` | `openai-completions` |
| `reasoning` | boolean | Whether the model has reasoning capability | `false` |
| `input` | array | Supported input types: `text`, `image`, `audio`, `video` | `["text"]` |
| `cost.input` | number | Input cost per 1M tokens | `0` |
| `cost.output` | number | Output cost per 1M tokens | `0` |
| `cost.cacheRead` | number | Cache read cost per 1M tokens | `0` |
| `cost.cacheWrite` | number | Cache write cost per 1M tokens | `0` |
| `contextWindow` | number | Maximum context window size in tokens | `200000` |
| `maxTokens` | number | Maximum output tokens | `8192` |

### Agents Defaults (`A`)

Three fields, each navigable with `↑↓`:

- **models** — multi-select picker over all provider models. `Space` toggles, `Enter` saves. Only these models are available for primary and fallbacks.
- **primary** — single-select picker from the active models list.
- **fallbacks** — multi-select picker from the active models list; select one or more in any order.

If no provider models are configured, the pickers fall back to a comma-separated text prompt.

### Setup Guide (`H`)

A framed overlay listing the six configuration steps:

1. Add a provider  (`P`)
2. Add models to the provider  (`M` with provider selected)
3. Test a model  (`T` with model selected)
4. Choose active models in agents.defaults.models  (`A`, then `models`)
5. Set the primary model  (`A`, then `primary`)
6. Choose fallback models  (`A`, then `fallbacks`)

## Configuration Location

The TUI manages the OpenClaw configuration at:

```
~/.openclaw/openclaw.json
```

Override the path with `OPENCLAW_CONFIG_PATH=/some/other/path`.

## Config Schema

The full config file structure managed by the TUI:

```json
{
  "meta": {
    "lastTouchedVersion": "2026.2.10",
    "lastTouchedAt": "2026-02-09T04:36:41.216Z"
  },
  "models": {
    "mode": "merge",
    "providers": {
      "<provider-name>": {
        "baseUrl": "https://api.example.com/v1",
        "api": "openai-completions",
        "auth": "api-key",
        "apiKey": "sk-...",
        "models": [
          {
            "id": "model-id",
            "name": "Display Name",
            "api": "openai-completions",
            "reasoning": false,
            "input": ["text"],
            "cost": {
              "input": 0,
              "output": 0,
              "cacheRead": 0,
              "cacheWrite": 0
            },
            "contextWindow": 200000,
            "maxTokens": 8192
          }
        ]
      }
    }
  },
  "agents": {
    "defaults": {
      "model": {
        "primary": "provider/model-id"
      },
      "models": {}
    },
    "list": []
  }
}
```

**Fields modified by the TUI:**

| Section | Fields |
| --- | --- |
| `models.providers` | Add/Edit/Remove providers with `baseUrl`, `api`, `auth`, `apiKey` |
| `models.providers[].models` | Add/Edit/Remove models with all model fields |
| `agents.defaults.model.primary` | Set primary model |
| `agents.defaults.models` | Set active model pool |
| `meta` | Auto-updated on every save |

## Architecture

```
clawd-models/
├── bin/
│   └── clawd-models.js        # CLI entry; dispatches to the TUI or non-interactive commands
├── src/
│   ├── openclaw-tui.js        # Main TUI (renderer, overlays, input handling)
│   ├── openclaw-config.js     # Config load/save + ensureConfigShape + qualifyModelId helpers
│   ├── core/                  # Business logic (provider/model/agent managers, API tester)
│   └── tui/                   # Legacy / auxiliary TUI scaffolding
├── docs/
│   ├── openclaw.example.json
│   ├── setup-flow.svg
│   └── uni-example.md
└── package.json
```

`openclaw-tui.js` is the runtime heart of the tool: it owns the `AppView` (the main list), the `ListOverlay` / `PromptOverlay` / `HelpOverlay` widgets, and the input dispatch table. `openclaw-config.js` handles load/save, the `qualifyModelId` resolver (which turns bare model ids like `code-small` into `provider/model-id` format), and pruning stale defaults when models are removed.

## Migration from CLI (1.0.7 → 1.1.0)

The pre-1.1.0 flag-style CLI was replaced by the TUI. The old commands map to TUI flows as follows:

- `providers:add -n <name> -u <url>` → `P`, then edit `baseUrl` / `apiKey` / `apiSchema`
- `models:add -p <provider> -i <model-id>` → select a provider row, press `M`
- `models:test` → select a model row, press `T`
- `agents:primary` / `agents:fallback` → press `A` for the agents.defaults editor

Existing configurations are loaded without modification. Model ids stored as bare names (`code-small`) are automatically qualified to `provider/code-small` on first display.

## Development

```bash
npm install
npm start          # alias for: node bin/clawd-models.js
npm run tui        # same
```

Debug log is written to `/tmp/clawd-models.log`.

## License

MIT
