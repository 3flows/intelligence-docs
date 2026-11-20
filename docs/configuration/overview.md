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
| [`chatbots`](./chatbots.md) | Configured assistants with their own sessions |
| [`skills` and `agents`](./skills-and-agents.md) | Agents, and the instructions and tools they work with |
| [`tracers`](./tracers.md) | Where traces go |
| `intelligence` | Validation and policy, see below |

Workflows have no section: they're defined in code.

## Platform sections Intelligence uses

| Section | Used for |
|---|---|
| `docs` + `entities` | The Intelligence domains: `IntelligenceTrace` (every model call), `IntelligenceChatbot` (sessions), `IntelligenceAgent` (runs) |
| `blobs` | `withBlob(...)` inputs, prompts with a blob `source`, files of chatbots and agents, generated audio and images you store |
| `vectors` | Retrieval, with `embedding()` as the embedding function |
| `mqs` | Running model calls in the background |

```yaml
entities:
  backend: docs
  domains:
    - IntelligenceTrace
    - IntelligenceChatbot   # with chatbots
    - IntelligenceAgent     # with agents
```

## Validation and policy

Intelligence validates its configuration at startup, and logs what it finds: an AI without `defaults` or without a `timeoutMs`, a prompt without a `version`, a chatbot or agent that refers to an AI, prompt or skill that doesn't exist, a chatbot with unbounded history, an API key written into the YAML, a missing domain.

```yaml
intelligence:
  strict: true            # findings stop the start instead of being logged as warnings
  inference:
    require:
      metadata: true      # every call must carry .metadata(...)
      timeout: true       # every call must be bounded, by .timeout(...) or the AI's defaults
    onViolation: warn     # warn, error or off
```

`Intelligence.inspect()` returns the version, the configured AIs, prompts and chatbots, and the findings of the last validation.

## Starting

Import the package before starting, so its sections are registered:

```ts title="main.ts"
import { Intelligence } from '@3flows/intelligence';
import './services.js';

await Intelligence.run('./intelligence.yml');
```

`Intelligence.run(path)` starts the platform with the Intelligence sections prepared: it validates them, and mounts chatbots and agents on their HTTP servers. `Intelligence.shutdown()` stops it. Always start an Intelligence application with `Intelligence.run`, not with `Platform.run`.

## More than one runtime

`Intelligence.run` starts the current platform runtime, and the static entry points (`Intelligence.inference()`, `Intelligence.chatbots()`, `Intelligence.inspect()`) use it. For tests that need a runtime of their own, or two applications in one process, the runtime can be chosen. These are the platform's functions, under the same names:

| | |
|---|---|
| `Intelligence.create()` | A new, empty runtime |
| `Intelligence.use(runtime)` | Make it the current one |
| `Intelligence.runtime()` | The current one |
| `Intelligence.withRuntime(runtime, fn)` | Run `fn` with `runtime` as the current one |
| `Intelligence.shutdown(runtime?)` | Stop a runtime; by default the current one |

Inside a service, none of this is needed: `trigger.context` belongs to the runtime the service runs in.

## Secrets

Keys come from environment variables with `${{ NAME }}`, like every platform secret. An unset variable becomes `null`, so a missing `OPENAI_API_KEY` shows up as an authentication error on the first call, not at startup.
