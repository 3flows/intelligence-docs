---
title: Configuration overview
---

# Configuration overview

Intelligence runs on the [3flows Platform](https://3flows.github.io/platform-docs/docs/configuration/overview), and uses the same YAML file. It adds a few top-level sections; everything else (services, HTTP, docs, blobs, queues, entities) is platform configuration.

```yaml
name: support-desk

services:
  - name: TicketsService

https:
  - name: api
    port: 3000
    services:
      - name: TicketsService

ais:
  - name: DEFAULT
    provider: openai
    model: gpt-4.1-mini
    connection:
      apiKey: ${{ OPENAI_API_KEY }}

prompts:
  - name: support.reply
    version: v1
    template: |
      You draft replies for the support team of {{ shop }}.
```

## Intelligence sections

| Section | Purpose |
|---|---|
| [`ais`](./ais.md) | The models: provider, model, connection, capabilities, defaults |
| [`prompts`](./prompts.md) | The prompt catalog |
| [`conversations`](./conversations.md) | Where conversation history is stored |
| [`tracers`](./tracers.md) | Where traces go |

## Platform sections Intelligence uses

| Section | Used for |
|---|---|
| `docs` + `entities` | Conversations, turns, messages, tool calls and inference runs, with `IntelligenceConversationsOntology` |
| `blobs` | `withBlob(...)` inputs, prompts with a blob `source`, generated audio and images you store |
| `vectors` | Retrieval, with `embedding()` as the embedding function |
| `mqs` | Running model calls in the background |

## Starting

Import the package before starting, so its sections are registered:

```ts title="main.ts"
import { Intelligence } from '@3flows/intelligence';
import './services.js';

await Intelligence.run('./intelligence.yml');
```

`Intelligence.run(path)` is `Platform.run(path)` plus a log line; `Intelligence.shutdown()` stops the platform. Starting with `Platform.run` works too, as long as `@3flows/intelligence` is imported.

## Secrets

Keys come from environment variables with `${{ NAME }}`, like every platform secret. An unset variable becomes `null`, so a missing `OPENAI_API_KEY` shows up as an authentication error on the first call, not at startup.
