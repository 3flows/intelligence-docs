---
title: Capabilities and providers
---

# Capabilities and providers

Application code never names a vendor. It names a **capability**, and Intelligence finds a configured model that has it.

## Three words

| Word | Meaning | Where it lives |
|---|---|---|
| **AI** | One configured model, with a name. `DEFAULT`, `fast`, `embeddings`, `local`. | YAML, under `ais` |
| **Provider** | The adapter that talks to a vendor's API: `openai`, `anthropic`, `azureai`, `typesafe`, … | The `provider` field of an AI |
| **Capability** | Something an AI can do: `chat`, `structured`, `embedding`, … | Inferred from the model, or declared in YAML |

```yaml
ais:
  - name: DEFAULT
    provider: openai
    model: gpt-4.1-mini
    connection:
      apiKey: ${{ OPENAI_API_KEY }}

  - name: embeddings
    provider: openai
    model: text-embedding-3-small
    connection:
      apiKey: ${{ OPENAI_API_KEY }}
```

## Capabilities

| Capability | Used by | What it does |
|---|---|---|
| `chat` | `chat()`, `conversation()` | Text in, text out |
| `streaming` | `.stream(...)` | Text out, token by token |
| `structured` | `extract()`, and the fallback for `choice`, `check`, `score` | Output that matches a schema |
| `tools` | `chat()` with `.tools(...)`, `.service(...)`, `.skills(...)` | The model may request function calls |
| `vision` | (image input) | The model understands images |
| `embedding` | `embedding()` | Text to vectors |
| `reranking` | `reranker()` | Sort documents by relevance to a query |
| `transcription` | `transcriber()` | Audio to text |
| `speech` | `speech()` | Text to audio |
| `image` | `image()` | Text to images |
| `video` | `video()` | Text to video |
| `ocr` | `ocr()` | Documents and images to text |
| `moderation` | `moderation()` | Safety classification |
| `choice`, `score`, `noul` | `choice()`, `score()`, `check()` | Native decision models (e.g. TypeSafe `jev`) |

## How a call finds its AI

When a chain runs, it asks for a capability. The rules are short:

1. **`.model(name)` given:** use that AI. If it lacks the capability, fail with a clear error.
2. **Otherwise:** use the AI named `DEFAULT` if it has the capability.
3. **Otherwise:** use the first configured AI that has it.
4. **Nothing has it:** fail with `No AI is defined with capability …`.

So with the YAML above, `chat().ask(...)` goes to `DEFAULT`, and `embedding().embed()` goes to `embeddings`, without either call naming a model. Name a model with `.model(...)` only when the choice is a business decision, like "use the cheap one for tagging".

Some capabilities have a preferred and a fallback path:

| Chain | Prefers | Falls back to |
|---|---|---|
| `choice().oneOf(...)` | `choice` | `structured` |
| `check()` | `noul` | `structured` |
| `score()` | `score` | `structured` |
| `choice().manyOf(...)`, `extract()` | `structured` | — |

That's why one ordinary chat model can serve every decision in the tutorial, and why adding a specialized decision model later is a YAML change.

## Where capabilities come from

Intelligence merges three sources, in this order:

1. **Inferred** from provider and model name. `text-embedding-3-small` is an embedding model; `whisper-1` transcribes; `gpt-4.1` chats, streams, calls tools and returns structured output.
2. **Discovered** from the provider's model list, where the provider offers one (OpenRouter, LM Studio, xAI, TypeSafe).
3. **Declared** in YAML. This is the one you control:

```yaml
ais:
  - name: local
    provider: ollama
    model: llama3.1
    capabilities: [chat, streaming, structured, tools]
```

A list **adds** to what was inferred. To switch single capabilities off, use the map form:

```yaml
    capabilities:
      tools: false
      structured: true
```

Declare capabilities whenever the inference guesses wrong, typically for local or very new models.

## Providers

| `provider` | Adapter | Notes |
|---|---|---|
| `openai` | OpenAI-compatible | Chat, streaming, structured, tools, embedding, reranking, transcription, speech, image, moderation |
| `openai-compatible`, `generic-openai` | OpenAI-compatible | Any server with the OpenAI API. Set `connection.baseUrl`. |
| `groq`, `openrouter`, `xai` / `grok` | OpenAI-compatible | Base URLs preset |
| `lmstudio`, `ollama`, `local-openai` | OpenAI-compatible | Local servers, base URLs preset (`localhost:1234`, `localhost:11434`) |
| `azureai`, `azure-openai` | Azure AI | API key or Azure identity (RBAC) |
| `anthropic` | Anthropic | Chat, streaming, structured (via forced tool), tools |
| `typesafe`, `jev` | TypeSafe | Native `choice`, `score`, `noul` decisions |

Providers are ordinary registered classes (`ai::<provider>`). You can [write your own](../guides/custom-provider.md), which is exactly what the tutorial's tests do.

## Defaults per AI

Settings that belong to a model, not to a call, go into `defaults`:

```yaml
ais:
  - name: DEFAULT
    provider: openai
    model: gpt-4.1-mini
    defaults:
      temperature: 0
      maxTokens: 800
      timeoutMs: 30000
      retry:
        attempts: 3
        backoffMs: 500
```

A call can override them with `.options({ temperature: 0.7 })`. See [`ais`](../configuration/ais.md) for every field.

## Reviewer's view

The `ais` section is where the reviewer answers: *which vendors see our data?* Every AI with a remote `provider` sends the context of its calls to that vendor. Local providers (`ollama`, `lmstudio`) keep it on the machine. That's a decision for configuration, and it's visible in one place.
