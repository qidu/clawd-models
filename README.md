# clawd-models

TUI (Text User Interface) tool to manage OpenClaw model configurations.

## Quick Start

![TUI Interface](https://raw.githubusercontent.com/qidu/clawd-models/refs/heads/main/docs/setup-flow.svg)

## Prerequisite
Install and Setup `openclaw` firstly
```
# setup openclaw
openclaw setup

# or configure it interactively

openclaw configure
```
Refer to https://github.com/openclaw/openclaw

## Installation

```bash
npm i -g clawd-models
```

## Usage

```bash
clawd-models
```

The TUI (Text User Interface) will start automatically. Navigate using arrow keys and Enter.

## Features

### 📋 Providers Management
- **Add Provider**: Configure new model providers (OpenAI-compatible, Anthropic-compatible)
- **Edit Provider**: Modify existing provider configurations
- **Remove Provider**: Delete providers and their models
- **List Providers**: View all configured providers with details

### 🤖 Models Management
- **Add Model**: Add models to providers with detailed configuration
- **Edit Model**: Modify model parameters (cost, context window, input types, etc.)
- **Remove Model**: Delete models from providers
- **List Models**: View all configured models across providers

### 👥 Agents Configuration
- **Configure Defaults**: Set workspace, concurrency limits for main agent
- **Select Models**: Choose primary and fallback models for agents
- **Manage Agents**: Add, edit, and remove custom agents
- **Test Configuration**: Test API connectivity for selected models

### 🧪 API Testing
- **Test Default Model**: Test the currently configured default model
- **Test Specific Model**: Test any configured model
- **Test Provider**: Validate provider configuration and connectivity
- **Detailed Results**: View request/response headers and bodies

## Configuration Location

The TUI manages the OpenClaw configuration at:
`~/.openclaw/openclaw.json`

## Navigation

- **Arrow Keys**: Navigate menus and options
- **Enter**: Select option
- **Space**: Toggle checkboxes
- **Ctrl+C**: Exit the application
- **?**: Context-sensitive help (planned)

## Architecture

The TUI is built with a modular architecture:

```
clawd-models/
├── bin/
│   └── clawd-models.js          # TUI entry point
├── src/
│   ├── core/                    # Core business logic
│   │   ├── config-manager.js   # Configuration I/O
│   │   ├── provider-manager.js  # Provider CRUD operations
│   │   ├── model-manager.js     # Model CRUD operations
│   │   ├── agent-manager.js    # Agent configuration
│   │   ├── api-tester.js        # API testing logic
│   │   └── constants.js        # Constants and enums
│   └── tui/                     # TUI interface
│       ├── index.js             # Main controller
│       ├── screens/             # Screen implementations
│       │   ├── providers/       # Provider management screens
│       │   ├── models/         # Model management screens
│       │   ├── agents/         # Agent configuration screens
│       │   └── test/           # API testing screens
│       └── entry.js             # TUI entry point
└── package.json
```

## Migration from CLI

The previous CLI version (1.0.7) has been replaced with this TUI version (1.1.0). All existing configurations are compatible and will be automatically loaded.

The TUI provides an interactive menu-driven interface replacing the old command-line flags:
- `providers:add -n <name> -u <url>` → Use **Providers Management** menu
- `models:add -p <provider> -i <model-id>` → Use **Models Management** menu
- `models:test` → Use **Test API Connection** menu

## Dependencies

- `inquirer`: Interactive command line interface
- `chalk`: Terminal string styling
- `ora`: Elegant terminal spinners
- `cli-table3`: Unicode tables for terminal
- `boxen`: Create boxes in the terminal
- `axios`: HTTP client for API testing
- `fs-extra`: Enhanced file system operations

## Development

```bash
# Install dependencies
npm install

# Run the TUI
npm start
```

## License

MIT