const fs = require('fs');
const { DEFAULT_CONFIG_PATH, ensureConfigShape, getAvailableModelIds, getDefaultModelIds, loadConfig, qualifyModelId, qualifyModelIds, removeModelReferences, removeProvider, renameModelReferences, saveConfig, setDefaultModelChoice, setDefaultModels, setProvider } = require('./openclaw-config');
const { ApiTester } = require('./core');

const DEBUG_LOG_PATH = '/tmp/clawd-models.log';
function writeDebugLog(...parts) {
  fs.appendFileSync(DEBUG_LOG_PATH, `${parts.map((part) => (typeof part === 'string' ? part : JSON.stringify(part, null, 2))).join(' ')}\n`);
}

let piTuiPromise = null;
async function loadPiTui() {
  if (!piTuiPromise) {
    piTuiPromise = import('@earendil-works/pi-tui');
  }
  return piTuiPromise;
}

function fg(code, text) {
  return `\u001b[${code}m${text}\u001b[0m`;
}
function bold(text) { return fg(1, text); }
function dim(text) { return fg(2, text); }
function green(text) { return fg(32, text); }
function yellow(text) { return fg(33, text); }
function red(text) { return fg(31, text); }
function clip(truncateToWidth, text, width) {
  return width <= 0 ? '' : truncateToWidth(text, width, '');
}
function pad(visibleWidth, clipFn, text, width) {
  const current = visibleWidth(text);
  if (current >= width) return clipFn(text, width);
  return text + ' '.repeat(width - current);
}
function formatList(values) {
  return (values || []).join(', ');
}
function fallbackList(config) {
  const value = config?.agents?.defaults?.model?.fallback;
  if (Array.isArray(value)) return value;
  if (value) return [value];
  return [];
}
function kbdItem(key, desc) {
  return desc ? `${key} ${dim(desc)}` : key;
}
function splitList(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}
function parseNumberOrBlank(value) {
  const trimmed = String(value || '').trim();
  if (!trimmed) return undefined;
  const num = Number(trimmed);
  if (Number.isNaN(num)) {
    throw new Error('Value must be a number or blank');
  }
  return num;
}
function providerNames(config) {
  return Object.keys(config.models?.providers || {}).sort((a, b) => a.localeCompare(b));
}
function providerModels(provider) {
  return Array.isArray(provider?.models) ? provider.models : [];
}
function ensureProvider(config, providerName) {
  config.models ??= {};
  config.models.providers ??= {};
  config.models.providers[providerName] ??= { baseUrl: '', apiKey: '', apiSchema: 'anthropic-messages', models: [] };
  const provider = config.models.providers[providerName];
  provider.models ??= [];
  return provider;
}
function findModel(provider, modelId) {
  return providerModels(provider).find((model) => model.id === modelId) || null;
}
function ensureDefaults(config) {
  config.agents ??= {};
  config.agents.defaults ??= {};
  config.agents.defaults.models ??= {};
  config.agents.defaults.model ??= {};
  return config.agents.defaults;
}
function availableModelList(config) {
  return getAvailableModelIds(config);
}
function formatProviderSummary(provider) {
  return [provider.baseUrl || 'no baseUrl'].filter(Boolean).join('  ');
}
function formatTokenCount(value) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(value % 1_000_000 === 0 ? 0 : 1)}m`;
  if (value >= 1_000) return `${Math.round(value / 1_000)}k`;
  return String(value);
}
function formatModelSummary(model) {
  return [
//    model.name || '-',
    model.contextWindow !== undefined ? `ctx ${formatTokenCount(model.contextWindow)}` : '',
    model.maxTokens !== undefined ? `max ${formatTokenCount(model.maxTokens)}` : '',
//    model.reasoning === true ? 'reasoning' : model.reasoning === false ? 'no reasoning' : '',
  ].filter(Boolean).join('  ');
}
function createModelIdSet(config) {
  const ids = new Set();
  for (const providerName of providerNames(config)) {
    const provider = config.models.providers[providerName];
    for (const model of providerModels(provider)) {
      if (model.id) ids.add(model.id);
    }
  }
  return ids;
}

async function testModelDirect(config, providerName, modelId, prompt = 'say hi') {
  const provider = config.models?.providers?.[providerName];
  if (!provider) throw new Error(`Provider "${providerName}" not found`);
  const model = findModel(provider, modelId);
  if (!model) throw new Error(`Model "${modelId}" not found in provider "${providerName}"`);
  if (!provider.baseUrl) throw new Error(`Provider "${providerName}" has no baseUrl`);

  const apiSchema = provider.apiSchema || 'anthropic-messages';
  const apiKey = provider.apiKey || '';
  const sampleTool = {
    name: 'say_hi',
    description: 'Return hi as a tool result',
    parameters: { type: 'object', properties: {}, additionalProperties: false },
  };

  const runOpenAI = async () => {
    const endpoint = `${provider.baseUrl.replace(/\/$/, '')}/chat/completions`;
    const headers = { 'Content-Type': 'application/json' };
    if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
    const firstBody = {
      model: model.id,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: model.maxTokens || 128,
      stream: false,
      tools: [{ type: 'function', function: sampleTool }],
      tool_choice: { type: 'function', function: { name: 'say_hi' } },
    };
    writeDebugLog('[testModelDirect] first request', {
      providerName,
      modelId,
      endpoint,
      headers: { ...headers, Authorization: headers.Authorization ? '********************************' : undefined },
      body: firstBody,
    });
    const firstResponse = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify(firstBody) });
    const firstJson = await firstResponse.json().catch(async () => ({ raw: await firstResponse.text() }));
    writeDebugLog('[testModelDirect] first response body', {
      status: firstResponse.status,
      body: firstJson,
    });
    if (!firstResponse.ok) {
      writeDebugLog('[testModelDirect] first response error', {
        status: firstResponse.status,
        body: firstJson,
      });
    }
    const message = firstJson?.choices?.[0]?.message;
    const toolCalls = message?.tool_calls || [];

    if (toolCalls.length > 0) {
      const secondBody = {
        model: model.id,
        messages: [
          { role: 'user', content: prompt },
          { role: 'assistant', content: message.content || null, tool_calls: toolCalls },
          ...toolCalls.map((call) => ({ role: 'tool', tool_call_id: call.id, content: 'hi' })),
        ],
        max_tokens: model.maxTokens || 128,
      };
      const secondResponse = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify(secondBody) });
      const secondJson = await secondResponse.json().catch(async () => ({ raw: await secondResponse.text() }));
      return {
        providerName,
        modelId,
        apiSchema,
        endpoint,
        firstStatus: firstResponse.status,
        firstResponse: firstJson,
        toolCalls,
        toolResult: 'hi',
        finalStatus: secondResponse.status,
        finalResponse: secondJson,
      };
    }

    return {
      providerName,
      modelId,
      apiSchema,
      endpoint,
      firstStatus: firstResponse.status,
      firstResponse: firstJson,
      toolCalls: [],
      toolResult: null,
      finalStatus: firstResponse.status,
      finalResponse: firstJson,
    };
  };

  const runAnthropic = async () => {
    const endpoint = `${provider.baseUrl.replace(/\/$/, '')}/v1/messages`;
    const headers = {
      'Content-Type': 'application/json',
      'anthropic-version': '2023-06-01',
    };
    if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
    const firstBody = {
      model: model.id,
      messages: [
        {
          role: 'user',
          content: [{ type: 'text', text: prompt, cache_control: { type: 'ephemeral' } }],
        },
      ],
      max_tokens: model.maxTokens || 128,
      stream: false,
      system: [{ type: 'text', text: 'You are a helpful assistant that uses tools when asked.', cache_control: { type: 'ephemeral' } }],
      tools: [{ name: sampleTool.name, description: sampleTool.description, input_schema: sampleTool.parameters }],
      tool_choice: { type: 'tool', name: sampleTool.name },
    };
    writeDebugLog('[testModelDirect] first request', {
      providerName,
      modelId,
      endpoint,
      headers: { ...headers, Authorization: headers.Authorization ? '********************************' : undefined },
      body: firstBody,
    });
    const firstResponse = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify(firstBody) });
    const firstJson = await firstResponse.json().catch(async () => ({ raw: await firstResponse.text() }));
    writeDebugLog('[testModelDirect] first response body', {
      status: firstResponse.status,
      body: firstJson,
    });
    if (!firstResponse.ok) {
      writeDebugLog('[testModelDirect] first response error', {
        status: firstResponse.status,
        body: firstJson,
      });
    }
    const toolUseBlocks = Array.isArray(firstJson?.content) ? firstJson.content.filter((block) => block && block.type === 'tool_use') : [];

    if (toolUseBlocks.length > 0) {
      const secondBody = {
        model: model.id,
        messages: [
          {
            role: 'user',
            content: [{ type: 'text', text: prompt, cache_control: { type: 'ephemeral' } }],
          },
          { role: 'assistant', content: toolUseBlocks },
          {
            role: 'user',
            content: toolUseBlocks.map((block) => ({ type: 'tool_result', tool_use_id: block.id, content: 'hi' })),
          },
        ],
        max_tokens: model.maxTokens || 128,
        stream: false,
        system: [{ type: 'text', text: 'You are a helpful assistant that uses tools when asked.', cache_control: { type: 'ephemeral' } }],
        tools: [{ name: sampleTool.name, description: sampleTool.description, input_schema: sampleTool.parameters }],
      };
      const secondResponse = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify(secondBody) });
      const secondJson = await secondResponse.json().catch(async () => ({ raw: await secondResponse.text() }));
      return {
        providerName,
        modelId,
        apiSchema,
        endpoint,
        firstStatus: firstResponse.status,
        firstResponse: firstJson,
        toolCalls: toolUseBlocks,
        toolResult: 'hi',
        finalStatus: secondResponse.status,
        finalResponse: secondJson,
      };
    }

    return {
      providerName,
      modelId,
      apiSchema,
      endpoint,
      firstStatus: firstResponse.status,
      firstResponse: firstJson,
      toolCalls: [],
      toolResult: null,
      finalStatus: firstResponse.status,
      finalResponse: firstJson,
    };
  };

  return apiSchema === 'openai-completions' ? runOpenAI() : runAnthropic();
}

async function startOpenClawTUI(options = {}) {
  const configPath = options.configPath || DEFAULT_CONFIG_PATH;
  const { ProcessTerminal, TUI, Input, SelectList, matchesKey, truncateToWidth, visibleWidth } = await loadPiTui();

  class PromptOverlay {
    constructor(title, prompt, initialValue, onSubmit, onCancel) {
      this.focused = false;
      this.input = new Input();
      this.title = title;
      this.prompt = prompt;
      this.onSubmit = onSubmit;
      this.onCancel = onCancel;
      this.input.setValue(initialValue);
      this.input.onSubmit = (value) => this.onSubmit(value);
      this.input.onEscape = () => this.onCancel();
    }
    handleInput(data) { this.input.handleInput(data); }
    invalidate() { this.input.invalidate(); }
    render(width) {
      this.input.focused = this.focused;
      const innerWidth = Math.max(1, Math.min(width - 2, 76));
      const bodyWidth = Math.max(1, innerWidth - 2);
      const inputLine = this.input.render(bodyWidth)[0] || '';
      return frame(this.title, [clip(truncateToWidth, this.prompt, bodyWidth), clip(truncateToWidth, inputLine, bodyWidth), dim('Enter submit  Esc cancel')], innerWidth);
    }
  }

  class ListOverlay {
    constructor(title, subtitle, items, onSelect, onCancel, onKey, maxVisible = 8) {
      this.title = title;
      this.subtitle = subtitle;
      this.onKey = onKey;
      this.list = new SelectList(items, maxVisible, {
        selectedPrefix: (text) => green(text),
        selectedText: (text) => green(text),
        description: (text) => dim(text),
        scrollInfo: (text) => dim(text),
        noMatch: (text) => dim(text),
      }, { truncatePrimary: ({ text, maxWidth }) => clip(truncateToWidth, text, maxWidth) });
      this.list.onSelect = onSelect;
      this.list.onCancel = onCancel;
    }
    handleInput(data) {
      if (this.onKey && this.onKey(data, this.list.getSelectedItem()) === true) return;
      this.list.handleInput(data);
    }
    invalidate() { this.list.invalidate(); }
    render(width) {
      const innerWidth = Math.max(1, Math.min(width - 2, 76));
      const bodyWidth = Math.max(1, innerWidth - 2);
      const listLines = this.list.render(bodyWidth).map((line) => clip(truncateToWidth, line, bodyWidth));
      return frame(this.title, [clip(truncateToWidth, this.subtitle, bodyWidth), ...listLines], innerWidth);
    }
  }

  function frame(title, body, width) {
    const boxWidth = Math.min(Math.max(width, 10), 88);
    const inner = Math.max(1, boxWidth - 2);
    const lines = [];
    lines.push(`┌${'─'.repeat(inner)}┐`);
    lines.push(`│${pad(visibleWidth, (text, w) => clip(truncateToWidth, text, w), title, inner)}│`);
    for (const line of body) lines.push(`│${pad(visibleWidth, (text, w) => clip(truncateToWidth, text, w), line, inner)}│`);
    lines.push(`└${'─'.repeat(inner)}┘`);
    return lines;
  }

  class HelpOverlay {
    constructor(onClose) {
      this.focused = false;
      this.onClose = onClose;
    }
    handleInput(data) {
      if (matchesKey(data, 'escape') || matchesKey(data, 'enter') || matchesKey(data, 'return') || matchesKey(data, 'ctrl+c') || matchesKey(data, 'q')) {
        this.onClose();
      }
    }
    invalidate() {}
    render(width) {
      const steps = [
        '1) Add a provider  (P)',
        '2) Add models (' + kbdItem('M', 'add models to provider') + ')',
        '3) Test the model  (' + kbdItem('T', 'test a selected model') + ')',
        '4) Set models for agents (' + kbdItem('A', 'choose active models') + ')',
        '5) Set the primary model  (' + kbdItem('A', 'choose primary') + ')',
        '6) Choose fallback models  (' + kbdItem('A', 'choose fallbacks') + ')',
      ];
      const header = bold(' Setup Guide ');
      const footer = dim('Enter/Esc/q to close');
      const body = steps.map((step) => {
        const [num, rest] = step.match(/^(\d+\))/) ? [step.slice(0, 3), step.slice(3)] : ['', step];
        return `  ${bold(num)} ${rest}`;
      });
      return frame(header, [...body, '', footer], Math.min(width - 2, 62));
    }
  }

  class AppView {
    constructor(app) {
      this.app = app;
      this.config = null;
      this.message = 'Ready';
      this.selectionIndex = 0;
      this._initialized = false;
    }
    setConfig(config) {
      this.config = config;
      const total = this.selectionCount();
      if (!this._initialized) {
        // Always start at the first Agents Defaults item on first load
        this.selectionIndex = 0;
        this._initialized = true;
      } else if (this.selectionIndex >= total) {
        this.selectionIndex = 0;
      }
    }
    setMessage(message) { this.message = message; }
    focusSelection(predicate) {
      const index = this.selections().findIndex((selection) => selection !== null && predicate(selection));
      if (index >= 0) this.selectionIndex = index;
    }
    bumpSelection(delta) {
      const total = this.selectionCount();
      if (total === 0) return;
      this.selectionIndex = Math.max(0, Math.min(total - 1, this.selectionIndex + delta));
    }
    selectCurrent() { return this.selections()[this.selectionIndex] || null; }
    invalidate() {}
    handleInput(data) {
      if (matchesKey(data, 'ctrl+c') || matchesKey(data, 'q')) {
        this.app.stopAndExit();
        return;
      }
      if (matchesKey(data, 'r')) { void this.app.refresh(); return; }
      if (matchesKey(data, 'h')) { this.app.openHelp(); return; }
      if (matchesKey(data, 'down') || matchesKey(data, 'j')) { this.bumpSelection(1); this.app.requestRender(); return; }
      if (matchesKey(data, 'up') || matchesKey(data, 'k')) { this.bumpSelection(-1); this.app.requestRender(); return; }
      if (matchesKey(data, 'p')) { this.app.openAddProviderPrompt(); return; }
      if (matchesKey(data, 'A')) { this.app.openAgentDefaultsEditor(); return; }
      if (matchesKey(data, 'D')) {
        const selected = this.selectCurrent();
        if (selected && (selected.kind === 'provider' || selected.kind === 'model')) {
          this.app.deleteSelection(selected);
        } else {
          this.setMessage('Select a provider or model to delete');
          this.app.requestRender();
        }
        return;
      }
      if (matchesKey(data, 'm')) {
        const selected = this.selectCurrent();
        if (selected && selected.kind === 'provider') { this.app.openAddModelPrompt(selected.providerName); return; }
        this.setMessage('Select a provider first');
        this.app.requestRender();
        return;
      }
      const selected = this.selectCurrent();
      if (selected && (matchesKey(data, 'enter') || matchesKey(data, 'return') || matchesKey(data, 'e'))) {
        this.app.openEditor(selected);
        return;
      }
      if (selected && matchesKey(data, 't') && selected.kind === 'model') {
        this.app.runModelTest(selected.providerName, selected.modelId);
      }
    }
    render(width) {
      const lines = [];
      const pathLabel = configPath === DEFAULT_CONFIG_PATH ? `${configPath} (default)` : configPath;
      lines.push(bold('OpenClaw Models TUI') + dim(`  ${new Date().toLocaleTimeString()}`));
      lines.push(dim(`Config: ${pathLabel}`));
      lines.push('');
      if (!this.config) {
        lines.push('Loading…');
        return lines.map((line) => clip(truncateToWidth, line, width));
      }
      const selections = this.selections();
      const selected = selections[this.selectionIndex] || null;
      lines.push(bold('Agents Defaults') + dim(' | ') + kbdItem('A', 'to edit'));
      const defaults = this.config.agents?.defaults || {};
      const dPrimary = selected?.kind === 'defaults-primary';
      const dFallback = selected?.kind === 'defaults-fallback';
      const dModels = selected?.kind === 'defaults-models';
      const dm = (prefix, text) => lines.push(`  ${prefix ? green('▶ ') : '  '}${text}`);
      dm(dPrimary, `primary: ${qualifyModelId(this.config, defaults.model?.primary) || dim('(empty)')}`);
      dm(dFallback, `fallbacks: ${dim(formatList(qualifyModelIds(this.config, fallbackList(this.config)))) || dim('(empty)')}`);
      dm(dModels, `models: ${dim(formatList(qualifyModelIds(this.config, getDefaultModelIds(this.config)))) || dim('(empty)')}`);
      lines.push('');
      lines.push(bold('Providers') + dim(' | ') + kbdItem('↑↓/j/k', 'to move') + ' ' + kbdItem('Enter', 'to edit'));
      const names = providerNames(this.config);
      if (names.length === 0) lines.push(dim('  none'));
      for (const providerName of names) {
        const provider = this.config.models.providers[providerName];
        const providerSelected = selected?.kind === 'provider' && selected.providerName === providerName;
        const prefix = providerSelected ? green('▶') : dim('│');
        lines.push(`  ${prefix} ${bold(providerName)} ${dim(formatProviderSummary(provider))}`);
        const models = providerModels(provider);
        if (models.length === 0) lines.push(`    ${dim('(no models)')}`);
        for (const model of models) {
          const modelSelected = selected?.kind === 'model' && selected.providerName === providerName && selected.modelId === model.id;
          const mark = modelSelected ? green('>') : dim('·');
          const testStatus = this.app.getModelTestStatus(providerName, model.id);
          const testMark = testStatus === 200 ? ` ${green('●')}` : '';
          lines.push(`  ${dim('│')} ${mark} ${model.id || 'model'} ${dim(formatModelSummary(model))}${testMark}`);
        }
      }
      lines.push('');
      lines.push(bold('Help'));
      lines.push('  ' + [
        kbdItem('P', 'add provider'),
        kbdItem('M', 'add model'),
        kbdItem('T', 'test model'),
        kbdItem('D', 'delete'),
        kbdItem('A', 'agents.defaults'),
        kbdItem('R', 'reload'),
        kbdItem('H', 'help'),
        kbdItem('q', 'quit'),
      ].join(' '));
      lines.push(this.message ? yellow(this.message) : dim('Ready'));
      return lines.map((line) => clip(truncateToWidth, line, width));
    }
    selections() {
      const config = this.config;
      if (!config) return [];
      const out = [];
      for (const providerName of providerNames(config)) {
        out.push({ kind: 'provider', providerName });
        for (const model of providerModels(config.models.providers[providerName])) {
          out.push({ kind: 'model', providerName, modelId: model.id });
        }
      }
      const defaultsItems = [
        { kind: 'defaults-primary' },
        { kind: 'defaults-fallback' },
        { kind: 'defaults-models' },
      ];
      return [...defaultsItems, ...out];
    }
    selectionCount() { return this.selections().length; }
  }

  class App {
    constructor() {
      this.terminal = new ProcessTerminal();
      this.tui = new TUI(this.terminal);
      this.view = new AppView(this);
      this.overlay = null;
      this.refreshTimer = null;
      this.stopped = false;
      this.config = ensureConfigShape(loadConfig(configPath));
      this.apiTester = new ApiTester({
        loadConfig: () => this.config,
      }, null, null);
      this.testStatuses = new Map();
    }
    testStatusKey(providerName, modelId) {
      return `${providerName}/${modelId}`;
    }
    setModelTestStatus(providerName, modelId, status) {
      if (status === undefined || status === null) {
        this.testStatuses.delete(this.testStatusKey(providerName, modelId));
      } else {
        this.testStatuses.set(this.testStatusKey(providerName, modelId), status);
      }
    }
    getModelTestStatus(providerName, modelId) {
      return this.testStatuses.get(this.testStatusKey(providerName, modelId));
    }
    clearModelTestStatus(providerName, modelId) {
      this.testStatuses.delete(this.testStatusKey(providerName, modelId));
    }
    async start() {
      this.tui.addChild(this.view);
      this.tui.setFocus(this.view);
      this.tui.addInputListener((data) => {
        if (matchesKey(data, 'ctrl+c')) {
          this.stopAndExit();
          return { consume: true };
        }
        return undefined;
      });
      this.terminal.write('\x1b[2J\x1b[H');
      this.tui.start();
      await this.refresh();
      this.refreshTimer = setInterval(() => { void this.refresh(); }, 15000);
      return () => this.stop();
    }
    requestRender() { this.tui.requestRender(); }
    async refresh() {
      try {
        this.config = ensureConfigShape(loadConfig(configPath));
        this.view.setConfig(this.config);
        this.tui.requestRender();
      } catch (error) {
        this.view.setMessage(error.message);
        this.tui.requestRender();
      }
    }
    openEditor(selection) {
      if (!selection) return;
      if (selection.kind === 'provider') return this.openProviderEditor(selection.providerName);
      if (selection.kind === 'model') return this.openModelEditor(selection.providerName, selection.modelId);
      if (selection.kind === 'defaults-models') return this.openAgentDefaultsEditor();
      if (selection.kind === 'defaults-primary') return this.openAgentDefaultsEditor();
      if (selection.kind === 'defaults-fallback') return this.openAgentDefaultsEditor();
    }
    openHelp() {
      this.closeOverlay();
      const overlay = new HelpOverlay(() => {
        this.closeOverlay();
        this.requestRender();
      });
      this.overlay = this.tui.showOverlay(overlay, { width: '60%', maxHeight: '50%', anchor: 'center' });
      this.overlay.focus();
    }

    openAgentDefaultsEditor() {
      ensureDefaults(this.config);
      const items = [
        { value: 'models', label: 'models', description: formatList(qualifyModelIds(this.config, getDefaultModelIds(this.config))) || '(empty)' },
        { value: 'primary', label: 'primary', description: qualifyModelId(this.config, this.config.agents.defaults.model?.primary) || '(empty)' },
        { value: 'fallback', label: 'fallback', description: formatList(qualifyModelIds(this.config, fallbackList(this.config))) || '(empty)' },
      ];
      this.openSelect('Agent defaults', `Pick a field; ${kbdItem('Enter', 'to edit')}`, items, (field) => {
        if (field === 'models') return this.openDefaultListEditor('models');
        if (field === 'primary') return this.openDefaultChoiceEditor('primary');
        if (field === 'fallback') return this.openDefaultListEditor('fallback');
      });
    }
    openAddProviderPrompt() {
      this.openPrompt('Add provider', 'Enter provider name', '', async (value) => {
        const name = value.trim();
        if (!name) return;
        ensureProvider(this.config, name);
        await this.saveAndRefresh(`added provider ${name}`);
        this.view.focusSelection((selection) => selection.kind === 'provider' && selection.providerName === name);
      });
    }
    async deleteSelection(selection) {
      if (!selection) return;
      if (selection.kind === 'provider') {
        const provider = this.config.models?.providers?.[selection.providerName];
        const modelCount = Array.isArray(provider?.models) ? provider.models.length : 0;
        const confirmText = `Delete provider "${selection.providerName}" and its ${modelCount} model${modelCount === 1 ? '' : 's'}? (type provider name to confirm)`;
        this.openPrompt(`Delete provider ${selection.providerName}`, confirmText, '', async (value) => {
          if (value.trim() !== selection.providerName) {
            this.view.setMessage('Delete cancelled (name did not match)');
            this.requestRender();
            return;
          }
          this.removeProviderAndCleanup(selection.providerName);
          await this.saveAndRefresh(`deleted provider ${selection.providerName}`);
        });
        return;
      }
      if (selection.kind === 'model') {
        const ref = `${selection.providerName}/${selection.modelId}`;
        this.openPrompt(`Delete model ${ref}`, 'Type "yes" to confirm', '', async (value) => {
          if (value.trim().toLowerCase() !== 'yes') {
            this.view.setMessage('Delete cancelled');
            this.requestRender();
            return;
          }
          this.removeModelAndCleanup(selection.providerName, selection.modelId);
          await this.saveAndRefresh(`deleted model ${ref}`);
        });
      }
    }
    removeProviderAndCleanup(providerName) {
      removeProvider(this.config, providerName);
      const defaults = this.config.agents?.defaults;
      if (!defaults) return;
      const prefix = `${providerName}/`;
      if (defaults.models) {
        for (const key of Object.keys(defaults.models)) {
          if (key.startsWith(prefix)) delete defaults.models[key];
        }
      }
      if (typeof defaults.model?.primary === 'string' && defaults.model.primary.startsWith(prefix)) {
        delete defaults.model.primary;
      }
      if (Array.isArray(defaults.model?.fallback)) {
        defaults.model.fallback = defaults.model.fallback.filter((id) => !id.startsWith(prefix));
      } else if (typeof defaults.model?.fallback === 'string' && defaults.model.fallback.startsWith(prefix)) {
        delete defaults.model.fallback;
      }
    }
    removeModelAndCleanup(providerName, modelId) {
      const provider = this.config.models?.providers?.[providerName];
      if (!provider) return;
      provider.models = (provider.models || []).filter((m) => m.id !== modelId);
      removeModelReferences(this.config, `${providerName}/${modelId}`);
    }
    pruneDefaultsToModels() {
      const active = new Set(getDefaultModelIds(this.config));
      const model = this.config.agents?.defaults?.model;
      if (!model) return;
      if (typeof model.primary === 'string' && !active.has(model.primary)) {
        delete model.primary;
      }
      if (Array.isArray(model.fallback)) {
        model.fallback = model.fallback.filter((id) => active.has(id));
      } else if (typeof model.fallback === 'string' && !active.has(model.fallback)) {
        delete model.fallback;
      }
    }
    openAddModelPrompt(providerName) {
      const provider = ensureProvider(this.config, providerName);
      this.openPrompt(`Add model to ${providerName}`, 'Enter model id', '', async (value) => {
        const id = value.trim();
        if (!id) return;
        provider.models.push({ id, name: '', reasoning: false });
        await this.saveAndRefresh(`added model ${id}`);
        this.view.focusSelection((selection) => selection.kind === 'model' && selection.providerName === providerName && selection.modelId === id);
      });
    }
    openProviderEditor(providerName) {
      const renderProviderEditor = () => {
        const provider = ensureProvider(this.config, providerName);
        const items = [
          { value: 'apiSchema', label: 'apiSchema', description: provider.apiSchema || 'anthropic-messages' },
          { value: 'baseUrl', label: 'baseUrl', description: provider.baseUrl || '(empty)' },
          { value: 'apiKey', label: 'apiKey', description: provider.apiKey ? '(set)' : '(empty)' },
        ];
        this.openSelect(`Provider ${providerName}`, 'Choose a field', items, (field) => {
          const currentProvider = ensureProvider(this.config, providerName);
          if (field === 'apiSchema') {
            this.openSelect('Select apiSchema', `Press ${kbdItem('Enter', 'to choose and save it for this provider')}`, [
              { value: 'anthropic-messages', label: 'anthropic-messages', description: 'Anthropic messages' },
              { value: 'openai-completions', label: 'openai-completions', description: 'OpenAI completions' },
            ], async (value) => {
              currentProvider.apiSchema = value;
              saveConfig(configPath, this.config);
              this.view.setMessage(`saved ${providerName} apiSchema = ${value}`);
              this.requestRender();
              setTimeout(renderProviderEditor, 0);
            });
            return;
          }
          if (field === 'baseUrl') {
            this.openPrompt('Edit baseUrl', 'Enter baseUrl', currentProvider.baseUrl || '', async (value) => {
              currentProvider.baseUrl = value.trim();
              await this.saveAndRefresh(`updated ${providerName} baseUrl`);
            });
            return;
          }
          if (field === 'apiKey') {
            this.openPrompt('Edit apiKey', 'Enter apiKey', currentProvider.apiKey || '', async (value) => {
              currentProvider.apiKey = value.trim();
              await this.saveAndRefresh(`updated ${providerName} apiKey`);
            });
            return;
          }
        });
      };
      renderProviderEditor();
    }
    openModelEditor(providerName, modelId) {
      const provider = ensureProvider(this.config, providerName);
      const model = findModel(provider, modelId);
      if (!model) throw new Error(`Model "${modelId}" not found in provider "${providerName}"`);
      const items = [
        { value: 'test', label: 'test model', description: 'Run sample prompt + tool call' },
        { value: 'id', label: 'id', description: model.id || '(empty)' },
        { value: 'name', label: 'name', description: model.name || '(empty)' },
        { value: 'contextWindow', label: 'contextWindow', description: model.contextWindow !== undefined ? String(model.contextWindow) : '(empty)' },
        { value: 'maxTokens', label: 'maxTokens', description: model.maxTokens !== undefined ? String(model.maxTokens) : '(empty)' },
        { value: 'reasoning', label: 'reasoning', description: model.reasoning === true ? 'true' : model.reasoning === false ? 'false' : '(empty)' },
      ];
      this.openSelect(`Model ${providerName}/${modelId}`, 'Choose a field', items, (field) => {
        if (field === 'id') {
          this.openPrompt('Edit model id', 'Enter model id', model.id || '', async (value) => {
            const nextId = value.trim();
            if (!nextId) throw new Error('Model id is required');
            const existing = provider.models.find((item) => item !== model && item.id === nextId);
            if (existing) throw new Error(`Model "${nextId}" already exists in provider "${providerName}"`);
            const oldId = model.id;
            model.id = nextId;
            renameModelReferences(this.config, oldId, nextId);
            await this.saveAndRefresh(`updated ${providerName}/${nextId} id`);
            this.view.focusSelection((selection) => selection.kind === 'model' && selection.providerName === providerName && selection.modelId === nextId);
          });
          return;
        }
        if (field === 'name') {
          this.openPrompt('Edit model name', 'Enter display name', model.name || '', async (value) => {
            const next = value.trim();
            model.name = next;
            await this.saveAndRefresh(`updated ${providerName}/${model.id} name`);
          });
          return;
        }
        if (field === 'contextWindow') {
          this.openPrompt('Edit contextWindow', 'Enter number or blank', model.contextWindow !== undefined ? String(model.contextWindow) : '', async (value) => {
            const next = parseNumberOrBlank(value);
            if (next === undefined) delete model.contextWindow;
            else model.contextWindow = next;
            await this.saveAndRefresh(`updated ${providerName}/${model.id} contextWindow`);
          });
          return;
        }
        if (field === 'maxTokens') {
          this.openPrompt('Edit maxTokens', 'Enter number or blank', model.maxTokens !== undefined ? String(model.maxTokens) : '', async (value) => {
            const next = parseNumberOrBlank(value);
            if (next === undefined) delete model.maxTokens;
            else model.maxTokens = next;
            await this.saveAndRefresh(`updated ${providerName}/${model.id} maxTokens`);
          });
          return;
        }
        if (field === 'reasoning') {
          this.openSelect('Edit reasoning', 'Choose value', [
            { value: 'true', label: 'true', description: 'Enable reasoning' },
            { value: 'false', label: 'false', description: 'Disable reasoning' },
            { value: 'unset', label: 'unset', description: 'Remove the field' },
          ], async (value) => {
            if (value === 'unset') delete model.reasoning;
            else model.reasoning = value === 'true';
            await this.saveAndRefresh(`updated ${providerName}/${model.id} reasoning`);
          });
          return;
        }
        if (field === 'test') {
          void this.runModelTest(providerName, model.id);
        }
      });
    }
    openDefaultsModelsEditor() {
      ensureDefaults(this.config);
      this.openPrompt('Edit agents.defaults.models', 'Comma-separated model ids', formatList(qualifyModelIds(this.config, getDefaultModelIds(this.config))), async (value) => {
        const ids = splitList(value).map((id) => qualifyModelId(this.config, id));
        setDefaultModels(this.config, ids);
        await this.saveAndRefresh('updated agents.defaults.models');
      });
    }
    openDefaultChoiceEditor(kind) {
      ensureDefaults(this.config);
      const current = kind === 'fallback'
        ? new Set(qualifyModelIds(this.config, fallbackList(this.config)))
        : new Set([qualifyModelId(this.config, this.config.agents.defaults.model?.[kind] || '')]);
      const allProviderModels = availableModelList(this.config);
      const choices = kind === 'fallback' ? allProviderModels : getDefaultModelIds(this.config);
      if (choices.length === 0) {
        const promptText = kind === 'fallback'
          ? 'Enter model id'
          : (getDefaultModelIds(this.config).length === 0
              ? 'No active models. Add models first. Enter model id'
              : 'Enter model id — must be in agents.defaults.models');
        this.openPrompt(`Edit agents.defaults.model.${kind}`, promptText, [...current][0] || '', async (value) => {
          setDefaultModelChoice(this.config, kind, value.trim());
          await this.saveAndRefresh(`updated agents.defaults.model.${kind}`);
        });
        return;
      }
      this.openSelect(
        `Select agents.defaults.model.${kind}`,
        'Choose model id',
        choices.map((modelId) => {
          const qualified = qualifyModelId(this.config, modelId);
          return {
            value: qualified,
            label: qualified,
            description: current.has(qualified) ? 'current' : '',
          };
        }),
        async (value) => {
          setDefaultModelChoice(this.config, kind, value);
          await this.saveAndRefresh(`updated agents.defaults.model.${kind}`);
        },
        async (data, selectedItem) => {
          if (!selectedItem) return false;
          const modelId = String(selectedItem.value);

          if (matchesKey(data, 'P')) {
            this.config.agents.defaults.model.primary = modelId;
            this.config.agents.defaults.model.fallback = Array.isArray(this.config.agents.defaults.model.fallback)
              ? this.config.agents.defaults.model.fallback.filter((item) => item !== modelId)
              : [];
            await this.saveAndRefresh('updated agents.defaults.model.primary');
            return true;
          }
          if (matchesKey(data, 'B')) {
            const fallback = Array.isArray(this.config.agents.defaults.model.fallback) ? this.config.agents.defaults.model.fallback : [];
            if (!fallback.includes(modelId)) fallback.push(modelId);
            this.config.agents.defaults.model.fallback = fallback;
            if (this.config.agents.defaults.model.primary === modelId) delete this.config.agents.defaults.model.primary;
            await this.saveAndRefresh('updated agents.defaults.model.fallback');
            return true;
          }
          if (matchesKey(data, 'O')) {
            setDefaultModelChoice(this.config, kind, '');
            this.config.agents.defaults.model.fallback = Array.isArray(this.config.agents.defaults.model.fallback)
              ? this.config.agents.defaults.model.fallback.filter((item) => item !== modelId)
              : [];
            await this.saveAndRefresh(`updated agents.defaults.model.${kind}`);
            return true;
          }
          return false;
        }
      );
    }
    openDefaultFallbackEditor() {
      ensureDefaults(this.config);
      const current = qualifyModelIds(this.config, fallbackList(this.config));
      this.openPrompt('Edit agents.defaults.model.fallback', 'Comma-separated fallback model ids (ordered)', formatList(current), async (value) => {
        const ids = splitList(value).map((id) => qualifyModelId(this.config, id));
        this.config.agents.defaults.model.fallback = ids;
        await this.saveAndRefresh('updated agents.defaults.model.fallback');
      });
    }
    openDefaultListEditor(field) {
      ensureDefaults(this.config);
      const isFallback = field === 'fallback';
      const initialIds = isFallback ? fallbackList(this.config) : getDefaultModelIds(this.config);
      const allProviderModels = availableModelList(this.config);
      const choices = isFallback
        ? getDefaultModelIds(this.config)
        : allProviderModels;
      if (choices.length === 0) {
        const title = isFallback ? 'Edit agents.defaults.model.fallback' : 'Edit agents.defaults.models';
        const promptText = isFallback
          ? (getDefaultModelIds(this.config).length === 0
              ? 'No active models. Add models first. Comma-separated fallback model ids (ordered)'
              : 'Comma-separated fallback model ids (ordered) — must be in agents.defaults.models')
          : 'Comma-separated model ids';
        this.openPrompt(title, promptText, formatList(initialIds), async (value) => {
          const ids = splitList(value).map((id) => qualifyModelId(this.config, id));
          if (isFallback) {
            this.config.agents.defaults.model.fallback = ids;
            await this.saveAndRefresh('updated agents.defaults.model.fallback');
          } else {
            setDefaultModels(this.config, ids);
            await this.saveAndRefresh('updated agents.defaults.models');
          }
        });
        return;
      }
      const selected = new Set(qualifyModelIds(this.config, initialIds));
      const title = isFallback ? 'Select agents.defaults.model.fallback' : 'Select agents.defaults.models';
      const tag = isFallback ? 'in fallback' : 'in models';
      const items = choices.map((modelId) => {
        const qualified = qualifyModelId(this.config, modelId);
        return {
          value: qualified,
          label: qualified,
          description: selected.has(qualified) ? `[x] ${tag}` : '[ ] add',
        };
      });
      this.openSelect(
        title,
        `${kbdItem('Space', 'to toggle,')} ${kbdItem('Enter', 'to save')}`,
        items,
        async () => {
          const ids = choices.map((modelId) => qualifyModelId(this.config, modelId)).filter((qualified) => selected.has(qualified));
          if (isFallback) {
            this.config.agents.defaults.model.fallback = ids;
            await this.saveAndRefresh('updated agents.defaults.model.fallback');
          } else {
            setDefaultModels(this.config, ids);
            this.pruneDefaultsToModels();
            await this.saveAndRefresh('updated agents.defaults.models');
          }
        },
        async (data, selectedItem) => {
          if (!selectedItem) return false;
          if (matchesKey(data, 'space')) {
            const modelId = String(selectedItem.value);
            if (selected.has(modelId)) selected.delete(modelId);
            else selected.add(modelId);
            selectedItem.description = selected.has(modelId) ? `[x] ${tag}` : '[ ] add';
            this.requestRender();
            return true;
          }
          return false;
        }
      );
    }
    openSelect(title, subtitle, items, onSelect, onKey) {
      this.closeOverlay();
      const overlay = new ListOverlay(title, subtitle, items, (item) => {
        this.closeOverlay();
        void Promise.resolve(onSelect(String(item.value))).catch(async (error) => {
          this.view.setMessage(error.message);
          await this.refresh();
        });
      }, () => {
        this.closeOverlay();
        this.view.setMessage('cancelled');
        this.requestRender();
      }, onKey, Math.max(2, Math.min(8, items.length)));
      this.overlay = this.tui.showOverlay(overlay, { width: '70%', maxHeight: '45%', anchor: 'center' });
      this.overlay.focus();
    }
    openPrompt(title, prompt, initialValue, onSubmit) {
      this.closeOverlay();
      const overlay = new PromptOverlay(title, prompt, initialValue, (value) => {
        void (async () => {
          try {
            this.closeOverlay();
            await onSubmit(value);
          } catch (error) {
            this.view.setMessage(error.message);
            await this.refresh();
          }
        })();
      }, () => {
        this.closeOverlay();
        this.view.setMessage('cancelled');
        this.requestRender();
      });
      this.overlay = this.tui.showOverlay(overlay, { width: '60%', maxHeight: '40%', anchor: 'center' });
      this.overlay.focus();
    }
    async runModelTest(providerName, modelId) {
      const prompt = 'say hi';
      this.clearModelTestStatus(providerName, modelId);
      this.view.setMessage(`testing ${providerName}/${modelId}...`);
      this.requestRender();
      try {
        const result = await testModelDirect(this.config, providerName, modelId, prompt);
        const toolCount = Array.isArray(result.toolCalls) ? result.toolCalls.length : 0;
        const hasUsage = Boolean(result.finalResponse && typeof result.finalResponse === 'object' && result.finalResponse.usage);
        const colorStatus = (status) => (status === 200 ? green(String(status)) : String(status));
        const usage = result.finalResponse?.usage? result.finalResponse.usage : ' no-usage ';
        const responseDetail = result.apiSchema === 'anthropic-messages'
          ? {
              stop_reason: result.finalResponse?.stop_reason,
              usage,
            }
          : {
              finish_reason: result.finalResponse?.choices?.[0]?.finish_reason,
              usage,
            };
        if (hasUsage && result.finalStatus === 200) {
          this.markModelTestSuccess(providerName, modelId);
        }
        const details = [
          `${result.endpoint}`,
          `${colorStatus(hasUsage ? 200 : result.finalStatus)} ${green(JSON.stringify(usage))} ${green('tool_calls=')}${dim(toolCount)}`,
        ];
        if (responseDetail.stop_reason !== undefined || responseDetail.finish_reason !== undefined) {
          details.push(`${green(JSON.stringify(responseDetail))}`);
        }
        this.view.setMessage(details.join('\n'));
      } catch (error) {
        this.view.setMessage(error.message);
      }
      this.requestRender();
    }
    markModelTestSuccess(providerName, modelId) {
      this.setModelTestStatus(providerName, modelId, 200);
      const provider = this.config.models?.providers?.[providerName];
      if (!provider) return;
      const model = providerModels(provider).find((item) => item.id === modelId);
      if (!model) return;
      model.testStatus = 200;
    }
    async saveAndRefresh(message) {
      saveConfig(configPath, this.config);
      this.view.setMessage(message);
      this.requestRender();
    }
    stop() {
      if (this.stopped) return;
      this.stopped = true;
      if (this.refreshTimer) clearInterval(this.refreshTimer);
      this.refreshTimer = null;
      this.closeOverlay();
      this.tui.stop();
    }
    stopAndExit() {
      this.stop();
      process.exit(0);
    }
    closeOverlay() {
      this.overlay?.hide();
      this.overlay = null;
      this.tui.setFocus(this.view);
    }
  }

  const app = new App();
  if (!process.stdin.isTTY || !process.stdout.isTTY) return () => {};
  void app.start();
  return () => app.stop();
}

module.exports = {
  startOpenClawTUI,
  testModelDirect,
};
