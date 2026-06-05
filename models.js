const BASE = "https://opencode.ai/zen/go/v1";

const MODEL_CONFIG = {
  // OpenAI-compatible
  "glm-5.1":           { url: `${BASE}/chat/completions`, provider: "openai" },
  "glm-5":             { url: `${BASE}/chat/completions`, provider: "openai" },
  "kimi-k2.5":         { url: `${BASE}/chat/completions`, provider: "openai" },
  "kimi-k2.6":         { url: `${BASE}/chat/completions`, provider: "openai" },
  "deepseek-v4-pro":   { url: `${BASE}/chat/completions`, provider: "openai" },
  "deepseek-v4-flash": { url: `${BASE}/chat/completions`, provider: "openai" },
  "mimo-v2.5":         { url: `${BASE}/chat/completions`, provider: "openai" },
  "mimo-v2.5-pro":     { url: `${BASE}/chat/completions`, provider: "openai" },

  // Anthropic-compatible
  "minimax-m3":        { url: `${BASE}/messages`, provider: "anthropic" },
  "minimax-m2.7":      { url: `${BASE}/messages`, provider: "anthropic" },
  "minimax-m2.5":      { url: `${BASE}/messages`, provider: "anthropic" },
  "qwen3.7-max":       { url: `${BASE}/messages`, provider: "anthropic" },
  "qwen3.7-plus":      { url: `${BASE}/messages`, provider: "anthropic" },
  "qwen3.6-plus":      { url: `${BASE}/messages`, provider: "anthropic" },
};

const DEFAULT_MODEL = "deepseek-v4-flash";

export const ALL_MODELS = Object.keys(MODEL_CONFIG);

export function resolveModel(model) {
  if (MODEL_CONFIG[model]) return model;
  console.warn(`⚠️  Unknown model "${model}", falling back to ${DEFAULT_MODEL}`);
  return DEFAULT_MODEL;
}

export function getProvider(model) {
  return MODEL_CONFIG[model]?.provider ?? "openai";
}

export function getModelUrl(model) {
  return MODEL_CONFIG[model]?.url ?? `${BASE}/chat/completions`;
}

