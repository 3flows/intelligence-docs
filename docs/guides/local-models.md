---
title: Local and alternative models
sidebar_label: Local models
---

# Local and alternative models

Every example in this documentation uses OpenAI, because it covers the most capabilities with one key. None of the code depends on it. This page shows the YAML for the alternatives.

## Local models

Local models run on your machine. No key, no cost per token, and no data leaves the laptop. They're smaller and slower than hosted models, which is fine for development and for many classification tasks.

### Ollama

```sh
ollama pull llama3.1
ollama serve               # http://localhost:11434
```

```yaml
ais:
  - name: DEFAULT
    provider: ollama
    model: llama3.1
    capabilities: [chat, streaming, structured, tools]
```

### LM Studio

Start the local server in LM Studio (default `http://localhost:1234`), then:

```yaml
ais:
  - name: DEFAULT
    provider: lmstudio
    model: qwen2.5-7b-instruct
    capabilities: [structured, tools]
```

For local providers, Intelligence infers only `chat` and `streaming`, because it can't know what the model you loaded supports. **Declare the rest** with `capabilities`, as above; otherwise `extract`, `choice` and tools report `No AI is defined with capability structured`.

**Pick a non-reasoning model for decisions.** Models that think before they answer spend output tokens on reasoning and can return empty or cut-off structured answers. In our runs of the tutorial against LM Studio, `qwen3-coder-next` answered every triage question, the tool loop and RAG correctly, while two reasoning models failed on structured output. Load the model before starting the app: LM Studio can reject parallel requests while it's loading, and only `retry` in `defaults` covers that.

For embeddings, LM Studio serves models like `text-embedding-nomic-embed-text-v1.5`:

```yaml
  - name: embeddings
    provider: lmstudio
    model: text-embedding-nomic-embed-text-v1.5
    capabilities: [embedding]
```

Use `connection.baseUrl` if the server runs elsewhere:

```yaml
    connection:
      baseUrl: http://gpu-box.internal:11434/v1
```

## Hosted alternatives

### Anthropic

```yaml
ais:
  - name: DEFAULT
    provider: anthropic
    model: claude-sonnet-4-5
    connection:
      apiKey: ${{ ANTHROPIC_API_KEY }}
    defaults:
      maxTokens: 1024
```

Chat, streaming, tools and structured output (through a forced tool call). Anthropic has no embedding models; add a second AI for `embedding`.

### Azure AI / Azure OpenAI

```yaml
ais:
  - name: DEFAULT
    provider: azureai
    model: gpt-4.1-mini
    connection:
      endpoint: https://my-resource.openai.azure.com
      deployment: gpt-4.1-mini
      apiVersion: 2024-10-21
      apiKey: ${{ AZUREAI_KEY }}   # omit to use Azure identity (RBAC)
```

Without `apiKey`, the provider authenticates with the Azure identity of the process (managed identity, `az login`, …).

### Groq, OpenRouter, xAI

```yaml
ais:
  - name: fast
    provider: groq
    model: llama-3.3-70b-versatile
    connection:
      apiKey: ${{ GROQ_API_KEY }}

  - name: router
    provider: openrouter
    model: anthropic/claude-sonnet-4.5
    connection:
      apiKey: ${{ OPENROUTER_API_KEY }}

  - name: grok
    provider: xai
    model: grok-4
    connection:
      apiKey: ${{ XAI_API_KEY }}
```

OpenRouter and xAI report capabilities through their model lists; Groq is inferred as `chat` and `streaming`.

### Any OpenAI-compatible server

vLLM, LiteLLM, a company gateway:

```yaml
ais:
  - name: DEFAULT
    provider: openai-compatible
    model: my-model
    connection:
      baseUrl: https://llm-gateway.internal/v1
      apiKey: ${{ GATEWAY_KEY }}
    capabilities: [streaming, structured, tools]
```

### Decision models

TypeSafe's `jev` models answer `choice`, `check` and `score` natively, with probabilities:

```yaml
ais:
  - name: decisions
    provider: typesafe
    model: jev-latest
    connection:
      apiKey: ${{ TYPESAFE_API_KEY }}
```

With this AI configured, `choice().oneOf(...)`, `check()` and `score()` prefer it over the structured fallback. `manyOf` and `extract` keep using a `structured` model.

## Switching per environment

YAML values come from environment variables, so one file can serve every environment, with different `.env` files. Or keep one YAML per environment: `intelligence.yml` for development with Ollama, `intelligence.production.yml` with the hosted model. The code doesn't change either way.
