const fs = require('fs-extra');
const os = require('os');
const path = require('path');

const DEFAULT_CONFIG_PATH = path.join(os.homedir(), '.openclaw', 'openclaw.json');

function resolveConfigPath(input) {
  const value = typeof input === 'string' ? input.trim() : '';
  return value ? value : DEFAULT_CONFIG_PATH;
}

function loadConfig(configPath = DEFAULT_CONFIG_PATH) {
  if (!fs.existsSync(configPath)) {
    return {};
  }

  const content = fs.readFileSync(configPath, 'utf8');
  return JSON.parse(content);
}

function saveConfig(configPath, config) {
  fs.ensureDirSync(path.dirname(configPath));
  fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
}

function ensureConfigShape(config) {
  const next = config && typeof config === 'object' ? config : {};
  next.models ??= {};
  next.models.providers ??= {};
  next.agents ??= {};
  next.agents.defaults ??= {};
  next.agents.defaults.models ??= {};
  next.agents.defaults.model ??= {};
  next.agents.defaults.model.fallback ??= [];
  return next;
}

function providerEntries(config) {
  return Object.entries(config.models?.providers || {}).sort(([a], [b]) => a.localeCompare(b));
}

function getProvider(config, providerName) {
  return config.models?.providers?.[providerName] || null;
}

function setProvider(config, providerName, providerData) {
  config.models ??= {};
  config.models.providers ??= {};
  config.models.providers[providerName] = providerData;
}

function removeProvider(config, providerName) {
  if (config.models?.providers?.[providerName]) {
    delete config.models.providers[providerName];
  }
}

function modelEntries(provider) {
  return (provider?.models || []).map((model, index) => ({ model, index })).sort((left, right) => {
    return String(left.model?.id || '').localeCompare(String(right.model?.id || ''));
  });
}

function getAvailableModelIds(config) {
  const ids = new Set();
  for (const [providerName, provider] of providerEntries(config)) {
    for (const model of provider.models || []) {
      if (model?.id) ids.add(model.id);
    }
  }
  return [...ids].sort((a, b) => a.localeCompare(b));
}

function setDefaultModels(config, modelIds) {
  config.agents ??= {};
  config.agents.defaults ??= {};
  config.agents.defaults.models = {};
  for (const modelId of modelIds) {
    if (modelId) {
      config.agents.defaults.models[modelId] = {};
    }
  }
}

function getDefaultModelIds(config) {
  return Object.keys(config.agents?.defaults?.models || {}).sort((a, b) => a.localeCompare(b));
}

function setDefaultModelChoice(config, kind, modelId) {
  config.agents ??= {};
  config.agents.defaults ??= {};
  config.agents.defaults.model ??= {};
  if (modelId) {
    config.agents.defaults.model[kind] = modelId;
  } else {
    delete config.agents.defaults.model[kind];
  }
}

function renameModelReferences(config, oldId, newId) {
  if (!oldId || !newId || oldId === newId) return;

  const defaults = config.agents?.defaults;
  if (!defaults) return;

  if (defaults.models && Object.prototype.hasOwnProperty.call(defaults.models, oldId)) {
    delete defaults.models[oldId];
    defaults.models[newId] = {};
  }
  if (defaults.model?.primary === oldId) {
    defaults.model.primary = newId;
  }
  if (Array.isArray(defaults.model?.fallback)) {
    defaults.model.fallback = defaults.model.fallback.map((item) => (item === oldId ? newId : item));
  } else if (defaults.model?.fallback === oldId) {
    defaults.model.fallback = newId;
  }
  if (defaults.models && Object.prototype.hasOwnProperty.call(defaults.models, oldId)) {
    delete defaults.models[oldId];
    defaults.models[newId] = {};
  }
}

function removeModelReferences(config, modelId) {
  if (!modelId) return;

  const defaults = config.agents?.defaults;
  if (!defaults) return;

  if (defaults.models && Object.prototype.hasOwnProperty.call(defaults.models, modelId)) {
    delete defaults.models[modelId];
  }
  if (defaults.model?.primary === modelId) {
    delete defaults.model.primary;
  }
  if (Array.isArray(defaults.model?.fallback)) {
    defaults.model.fallback = defaults.model.fallback.filter((item) => item !== modelId);
  } else if (defaults.model?.fallback === modelId) {
    delete defaults.model.fallback;
  }
  if (defaults.model?.fallback && typeof defaults.model.fallback === 'string' && defaults.model.fallback === modelId) {
    delete defaults.model.fallback;
  }
}

module.exports = {
  DEFAULT_CONFIG_PATH,
  resolveConfigPath,
  loadConfig,
  saveConfig,
  ensureConfigShape,
  providerEntries,
  getProvider,
  setProvider,
  removeProvider,
  modelEntries,
  getAvailableModelIds,
  setDefaultModels,
  getDefaultModelIds,
  setDefaultModelChoice,
  renameModelReferences,
  removeModelReferences,
};
