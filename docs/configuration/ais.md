---
title: ais
---

# `ais`

The `ais` section lists the models the application may use. Concepts: [Capabilities and providers](../concepts/capabilities-and-providers.md).

```yaml
ais:
  - name: DEFAULT
    provider: openai
    model: gpt-4.1-mini
    description: Replies and decisions
    connection:
      apiKey: ${{ OPENAI_API_KEY }}
    defaults:
      temperature: 0
      maxTokens: 800
      timeoutMs: 30000
      retry:
        attempts: 3
        backoffMs: 500

  - name: embeddings
    provider: openai
    model: text-embedding-3-small
    connection:
      apiKey: ${{ OPENAI_API_KEY }}

  - name: local
    provider: ollama
    model: llama3.1
    capabilities: [structured, tools]
```

## Fields

| Field | Required | Description |
|---|---:|---|
| `name` | no | The name for `.model(name)`. Defaults to `DEFAULT` |
| `provider` | no | The adapter. Defaults to `openai-compatible`. See below |
| `model` | yes | The vendor's model id |
| `connection` | no | How to reach the vendor |
| `capabilities` | no | Capabilities to add (list) or switch on and off (map) |
| `defaults` | no | Request defaults for every call to this AI |
| `providerOptions` | no | Provider-specific settings |
| `labels` | no | Free-form tags, reported by `describe()` |
| `description` | no | What this AI is for |

## `connection`

| Field | Used by | Description |
|---|---|---|
| `apiKey` | all hosted providers | The key. Use `${{ … }}` |
| `baseUrl` | OpenAI-compatible | Override the API base URL |
| `endpoint`, `deployment`, `apiVersion` | `azureai` | Azure resource endpoint, deployment name, API version |
| `scope` | `azureai` | Token scope for identity-based authentication |

## `defaults`

| Field | Description |
|---|---|
| `temperature`, `topP`, `seed` | Sampling |
| `maxTokens`, `maxCompletionTokens` | Answer length |
| `timeoutMs` | Request timeout |
| `retry.attempts`, `retry.backoffMs` | Retries for retryable failures: 408, 409, 425, 429 (except exhausted quota), 5xx, connection resets and timeouts |
| `retry.escalation` | Wait times in seconds per retry, instead of a fixed `backoffMs`: `[1, 5, 15]` |

Every call can override them with `.options({...})`.

## `capabilities`

```yaml
capabilities: [structured, tools]      # add to the inferred ones
capabilities:                          # switch individually
  tools: false
  vision: true
```

Capabilities: `chat`, `streaming`, `structured`, `tools`, `vision`, `embedding`, `reranking`, `transcription`, `speech`, `image`, `video`, `ocr`, `moderation`, `choice`, `score`, `noul`.

## Providers

| `provider` | Base URL preset | Inferred capabilities |
|---|---|---|
| `openai` | `https://api.openai.com/v1` | chat, streaming, structured, tools (vision for vision models); by model name: embedding, reranking, transcription, speech, image, moderation |
| `groq` | `https://api.groq.com/openai/v1` | chat, streaming |
| `openrouter` | `https://openrouter.ai/api/v1` | chat, streaming, plus the model list |
| `xai`, `grok` | `https://api.x.ai/v1` | chat, streaming, structured, tools |
| `lmstudio`, `lm-studio`, `local-openai` | `http://localhost:1234/v1` | chat, streaming |
| `ollama` | `http://localhost:11434/v1` | chat |
| `openai-compatible`, `generic-openai` | set `baseUrl` | chat |
| `azureai`, `azure-openai` | set `endpoint` | as `openai` |
| `anthropic` | `https://api.anthropic.com/v1` | chat, streaming, structured, tools |
| `typesafe`, `jev` | `https://api.typesafe.ai/v1` | choice, score, noul |

Any other value `x` looks for a class registered as `@Register('x', 'ai')`. See [Writing a provider](../guides/custom-provider.md).

## Selection

Without `.model(name)`, a chain uses `DEFAULT` if it has the capability, otherwise the first AI in this list that has it.
