# clawd-models

CLI tool to manage OpenClaw model configurations.

## Prerequisite
Install and Setup `openclaw` firstly, refer to https://github.com/openclaw/openclaw
```
# setup openclaw
openclaw setup 

# or configure it interactively 

openclaw configure
```

## Installation

```bash
npm i -g clawd-models
```

## Usage

```bash
node bin/clawd-models.js <command>
```

## Commands

### Core
| Command | Description |
|---------|-------------|
| `init` | Initialize OpenClaw configuration with defaults |
| `view` | View current configuration file and path |
| `edit` | Edit configuration in default editor |
| `import -f <file>` | Import configuration from a JSON config file of `openclaw` |
| `export` | Export configuration to stdout |

### Provider Management
| Command | Description |
|---------|-------------|
| `providers:add -n <name> -u <url>` | Add a new model provider |
| `providers:remove -n <name>` | Remove a model provider |
| `providers:list` | List all configured providers |

### Model Management
| Command | Description |
|---------|-------------|
| `models:add -p <provider> -i <model-id> --name <name>` | Add a model to a provider |
| `models:remove -p <provider> -i <model-id>` | Remove a model from a provider |
| `model:list [--provider <name>]` | List all configured models |

Use `agents:set-default` in next section or refer to `openclaw models set` to set a default model for 'main' and all agents.

Refer to `openclaw agent --agent main -m <message>` to test the default model and agent.

### Agent Management
| Command | Description |
|---------|-------------|
| `agents:add -i <id>` | Add a new agent |
| `agents:remove -i <id>` | Remove an agent |
| `agents:list` | List all configured agents |
| `agents:set-default -a <agent> -m <provider>/<model-id>` | Set default model for an agent type |
Refer to `openclaw agents` and `openclaw agent --help` for more.

### Gateway Management
| Command | Description |
|---------|-------------|
| `gateway:view` | View the Gateway |
| `gateway:refresh-token` | Refresh(regenerate) gateway auth token |
Refer to `openclaw gateway status` for more.

### Auth Profile Management
| Command | Description |
|---------|-------------|
| `auth:add-profile -n <name>` | Add an auth profile |
| `auth:profiles` | List auth profiles configured |

## Configuration Location

`~/.openclaw/openclaw.json`