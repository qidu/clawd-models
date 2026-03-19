/**
 * Constants for the clawd-models TUI
 */

// API Types
const API_TYPES = {
  OPENAI_COMPLETIONS: 'openai-completions',
  ANTHROPIC_MESSAGES: 'anthropic-messages'
};

// Auth Methods
const AUTH_METHODS = {
  API_KEY: 'api-key',
  BEARER: 'bearer'
};

// Input Types
const INPUT_TYPES = {
  TEXT: 'text',
  IMAGE: 'image',
  AUDIO: 'audio',
  VIDEO: 'video'
};

// Default Values
const DEFAULT_VALUES = {
  CONTEXT_WINDOW: 200000,
  MAX_TOKENS: 8192,
  INPUT_COST: 0,
  OUTPUT_COST: 0,
  CACHE_READ_COST: 0,
  CACHE_WRITE_COST: 0,
  MAX_CONCURRENT_AGENTS: 4,
  MAX_CONCURRENT_SUBAGENTS: 8
};

// Configuration Paths
const CONFIG_PATHS = {
  OPENCLAW: '~/.openclaw/openclaw.json',
  CLAWDBOT: '~/.clawdbot/clawdbot.json',
  MOLTBOT: '~/.moltbot/moltbot.json'
};

// Agent Types
const AGENT_TYPES = {
  MAIN: 'main',
  CODE: 'code',
  OTHER: 'other'
};

// Gateway Modes
const GATEWAY_MODES = {
  LOCAL: 'local',
  REMOTE: 'remote'
};

// Gateway Bind Options
const GATEWAY_BIND_OPTIONS = {
  LAN: 'lan',
  PUBLIC: 'public'
};

// Gateway Auth Modes
const GATEWAY_AUTH_MODES = {
  TOKEN: 'token',
  NONE: 'none'
};

// Tailscale Modes
const TAILSCALE_MODES = {
  ON: 'on',
  OFF: 'off'
};

// TUI Screen IDs
const SCREEN_IDS = {
  MAIN_MENU: 'main-menu',
  PROVIDERS_LIST: 'providers-list',
  PROVIDERS_ADD: 'providers-add',
  PROVIDERS_EDIT: 'providers-edit',
  PROVIDERS_REMOVE: 'providers-remove',
  MODELS_LIST: 'models-list',
  MODELS_ADD: 'models-add',
  MODELS_EDIT: 'models-edit',
  MODELS_REMOVE: 'models-remove',
  AGENTS_LIST: 'agents-list',
  AGENTS_CONFIG: 'agents-config',
  AGENTS_MODEL_SELECT: 'agents-model-select',
  TEST_API: 'test-api'
};

// TUI Colors
const TUI_COLORS = {
  SUCCESS: 'green',
  WARNING: 'yellow',
  ERROR: 'red',
  INFO: 'blue',
  PRIMARY: 'cyan',
  SECONDARY: 'magenta'
};

// Validation Patterns
const VALIDATION_PATTERNS = {
  PROVIDER_NAME: /^[a-zA-Z0-9_-]+$/,
  MODEL_ID: /^[a-zA-Z0-9_\-/]+$/,
  AGENT_ID: /^[a-zA-Z0-9_-]+$/,
  URL: /^https?:\/\/[^\s]+$/,
  TOKEN: /^[a-f0-9]{40}$/
};

module.exports = {
  API_TYPES,
  AUTH_METHODS,
  INPUT_TYPES,
  DEFAULT_VALUES,
  CONFIG_PATHS,
  AGENT_TYPES,
  GATEWAY_MODES,
  GATEWAY_BIND_OPTIONS,
  GATEWAY_AUTH_MODES,
  TAILSCALE_MODES,
  SCREEN_IDS,
  TUI_COLORS,
  VALIDATION_PATTERNS
};