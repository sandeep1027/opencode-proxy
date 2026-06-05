# OpenCode Proxy

A lightweight Node.js proxy that bridges [OpenCode AI](https://opencode.ai) models to the OpenAI-compatible API format, enabling seamless integration with VS Code Copilot, Cursor, and any BYOK (Bring Your Own Key) client.

## Features

- ✅ OpenAI-compatible API (`/v1/chat/completions`, `/v1/completions`, `/v1/models`)
- ✅ Supports all OpenCode models (DeepSeek, Kimi, GLM, MiMo, Qwen, MiniMax)
- ✅ Real-time streaming for all models
- ✅ Automatic routing (OpenAI-compatible vs Anthropic-compatible endpoints)
- ✅ Full tool/function calling support
- ✅ Anthropic SSE → OpenAI SSE conversion in real time
- ✅ Thinking block filtering (Qwen extended thinking)
- ✅ VS Code Copilot BYOK ready
- ✅ Autocomplete / inline suggestions support

---

## Supported Models

| Model | ID | Endpoint Type |
|---|---|---|
| DeepSeek V4 Flash | `deepseek-v4-flash` | OpenAI |
| DeepSeek V4 Pro | `deepseek-v4-pro` | OpenAI |
| Kimi K2.5 | `kimi-k2.5` | OpenAI |
| Kimi K2.6 | `kimi-k2.6` | OpenAI |
| GLM 5 | `glm-5` | OpenAI |
| GLM 5.1 | `glm-5.1` | OpenAI |
| MiMo V2.5 | `mimo-v2.5` | OpenAI |
| MiMo V2.5 Pro | `mimo-v2.5-pro` | OpenAI |
| Qwen 3.7 Max | `qwen3.7-max` | Anthropic |
| Qwen 3.7 Plus | `qwen3.7-plus` | Anthropic |
| Qwen 3.6 Plus | `qwen3.6-plus` | Anthropic |
| MiniMax M2.5 | `minimax-m2.5` | Anthropic |
| MiniMax M2.7 | `minimax-m2.7` | Anthropic |
| MiniMax M3 | `minimax-m3` | Anthropic |

---

## Requirements

- Node.js 18+
- An [OpenCode AI](https://opencode.ai) API key
- VS Code with GitHub Copilot extension (for Copilot integration)

---

## Installation

```bash
# Clone the repo
git clone https://github.com/yourusername/opencode-proxy.git
cd opencode-proxy

# Install dependencies
npm install
```

---

## Configuration

Create a `.env` file in the root directory:

```env
PORT=4000
OPENCODE_API_KEY=your_opencode_api_key_here
OPENCODE_BASE=https://opencode.ai/zen/go/v1
```

---

## Usage

```bash
# Start the proxy
node server.js

# Or with auto-restart on changes
npx nodemon index.js
```

The proxy will be running at `http://localhost:4000`.

---
## VS Code Copilot Integration

### 1. Create language model config

Create `.vscode/languageModels.json` in your workspace:

```json
{
  "name": "opencode",
  "vendor": "customendpoint",
  "apiKey": "${input:chat.lm.secret.531c4cb2}",
  "apiType": "chat-completions",
  "models": [
    {
      "id": "deepseek-v4-flash",
      "name": "DeepSeek V4 Flash (Fast)",
      "url": "http://localhost:4000/v1",
      "toolCalling": true,
      "vision": false,
      "maxInputTokens": 128000,
      "maxOutputTokens": 16000
    },
    {
      "id": "deepseek-v4-pro",
      "name": "DeepSeek V4 Pro (Strong)",
      "url": "http://localhost:4000/v1",
      "toolCalling": true,
      "vision": false,
      "maxInputTokens": 128000,
      "maxOutputTokens": 16000
    },
    {
      "id": "kimi-k2.6",
      "name": "Kimi K2.6 (Reasoning)",
      "url": "http://localhost:4000/v1",
      "toolCalling": true,
      "vision": false,
      "maxInputTokens": 200000,
      "maxOutputTokens": 20000
    },
    {
      "id": "glm-5.1",
      "name": "GLM 5.1 (Balanced)",
      "url": "http://localhost:4000/v1",
      "toolCalling": true,
      "vision": false,
      "maxInputTokens": 128000,
      "maxOutputTokens": 16000
    },
    {
      "id": "mimo-v2.5",
      "name": "MiMo V2.5 (Cheap)",
      "url": "http://localhost:4000/v1",
      "toolCalling": false,
      "vision": false,
      "maxInputTokens": 64000,
      "maxOutputTokens": 8000
    },
    {
      "id": "mimo-v2.5-pro",
      "name": "MiMo V2.5 Pro",
      "url": "http://localhost:4000/v1",
      "toolCalling": true,
      "vision": false,
      "maxInputTokens": 64000,
      "maxOutputTokens": 8000
    },
    {
      "id": "qwen3.7-max",
      "name": "Qwen 3.7 Max (Best Coding)",
      "url": "http://localhost:4000/v1",
      "toolCalling": true,
      "vision": false,
      "maxInputTokens": 128000,
      "maxOutputTokens": 16000
    },
    {
      "id": "qwen3.7-plus",
      "name": "Qwen 3.7 Plus",
      "url": "http://localhost:4000/v1",
      "toolCalling": true,
      "vision": false,
      "maxInputTokens": 128000,
      "maxOutputTokens": 16000
    },
    {
      "id": "qwen3.6-plus",
      "name": "Qwen 3.6 Plus",
      "url": "http://localhost:4000/v1",
      "toolCalling": true,
      "vision": false,
      "maxInputTokens": 128000,
      "maxOutputTokens": 16000
    },
    {
      "id": "minimax-m3",
      "name": "MiniMax M3",
      "url": "http://localhost:4000/v1",
      "toolCalling": true,
      "vision": false,
      "maxInputTokens": 128000,
      "maxOutputTokens": 16000
    },
    {
      "id": "minimax-m2.7",
      "name": "MiniMax M2.7",
      "url": "http://localhost:4000/v1",
      "toolCalling": true,
      "vision": false,
      "maxInputTokens": 128000,
      "maxOutputTokens": 16000
    }
  ]
}
```

> **Note:** VS Code will prompt you to enter your OpenCode API key securely the first time — it won't be stored in plain text.


Open Copilot Chat in VS Code (`Ctrl+Alt+I`) and select any OpenCode model from the model picker.


### 2. Start chatting

Open Copilot Chat in VS Code and select any OpenCode model from the model picker.

---

## API Reference

### Chat Completions

```bash
curl -X POST http://localhost:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer any-value" \
  -d '{
    "model": "qwen3.7-max",
    "messages": [
      { "role": "user", "content": "Write a binary search in Python" }
    ],
    "stream": true
  }'
```

### List Models

```bash
curl http://localhost:4000/v1/models
```

### Health Check

```bash
curl http://localhost:4000/health
```

---
