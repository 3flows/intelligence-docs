---
title: Fluent API overview
sidebar_label: Overview
---

# Fluent API overview

Everything is imported from one package:

```ts
import { Intelligence } from '@3flows/intelligence';
```

The grammar and the reasoning behind it are explained in [The fluent API](../concepts/the-fluent-api.md). This section is the reference.

## Entry points

```ts
Intelligence.inference().chat()                 // text in, text out           → chat.md
Intelligence.inference().extract(name)          // structured output           → extract.md
Intelligence.inference().choice(name)           // one or many of a fixed list → decisions.md
Intelligence.inference().check(name)            // yes or no                   → decisions.md
Intelligence.inference().score(name)            // a number on a scale         → decisions.md
Intelligence.inference().embedding()            // text to vectors             → embeddings-and-reranking.md
Intelligence.inference().reranker()             // sort by relevance           → embeddings-and-reranking.md
Intelligence.inference().transcriber()          // audio to text               → audio-and-media.md
Intelligence.inference().speech()               // text to audio               → audio-and-media.md
Intelligence.inference().image()                // text to image               → audio-and-media.md
Intelligence.inference().video()                // text to video               → audio-and-media.md
Intelligence.inference().ocr()                  // document to text            → audio-and-media.md
Intelligence.inference().moderation()           // safety check                → moderation.md

Intelligence.conversations().conversation(id?)  // chat with history           → conversations.md
Intelligence.prompts()                          // the prompt catalog          → ../configuration/prompts.md
```

`Intelligence.inference()` also exposes the configured AIs directly, for inspection:

```ts
Intelligence.inference().ai('DEFAULT').describe();   // { name, provider, model, capabilities, … }
Intelligence.inference().select('embedding');        // the AI a chain would use for a capability
```

## Methods shared by all chains

| Method | Description |
|---|---|
| `.model(name: string)` | Use the AI with this name from `ais` |
| `.instructions(...instructions: string[])` | Add system instructions. Repeated calls add up |
| `.prompt(name: string, variables?: Record<string, unknown>)` | Add instructions rendered from the prompt catalog. On `transcriber()`, `prompt(text)` is the transcription hint instead |
| `.with(input, meta?)` | Add input. See [Inputs and files](./inputs-and-files.md) |
| `.withFile(source, meta?)` | Add a file from a path, `Buffer`, `Readable` or blob file |
| `.withBlob(container, path, meta?)` / `.withBlob({ blob?, container, path }, meta?)` | Add a file from `blobs` |
| `.options(options: AIRequestOptions)` | Per-call settings, merged over the AI's `defaults` |
| `.metadata(metadata: Record<string, unknown>)` | Stored with the inference run and passed to the tracer |
| `.labels(...labels: string[])` | Tags for the request |
| `.context(context)`, `.chatContext(context)` | Free-form context passed to the provider and tracer |
| `.trace(traceId: string)` | Correlate the call with an existing trace |
| `.observabilityTag(tag: string)` | Tag for the tracer |

`embedding()` and `reranker()` support the subset that makes sense for them (`model`, `with`, `options`, `metadata`, `labels`, `context`, `trace`, `observabilityTag`).

## `AIRequestOptions`

| Option | Type | Description |
|---|---|---|
| `temperature` | `number` | Randomness. `0` for decisions and extraction |
| `topP` | `number` | Nucleus sampling |
| `seed` | `number` | Best-effort reproducibility, where supported |
| `maxTokens` / `maxCompletionTokens` | `number` | Limit the answer's length |
| `timeoutMs` | `number` | Request timeout |
| `retry` | `{ attempts?, backoffMs?, escalation? }` | Retry retryable failures |
| `providerOptions` | `Record<string, unknown>` | Provider-specific settings |
| `raw` | `Record<string, unknown>` | Merged into the provider's request body as is |

## Immutability

Every method returns a new chain. Build shared parts once and branch from them:

```ts
const triage = Intelligence.inference().chat().prompt('support.triage').options({ temperature: 0 });
await triage.with(ticketA).ask('Summarize.');
await triage.with(ticketB).ask('Summarize.');   // does not see ticketA
```

## Errors

Terminal verbs reject with an `Error` when:

- no AI has the capability: `No AI is defined with capability embedding`,
- the named AI lacks it: `AI fast does not support capability structured`,
- a required part is missing: `Choice options are not defined; call oneOf(...) or manyOf(...) before ask(...)`,
- the provider fails after all retries,
- a structured answer doesn't match its schema: `Structured response from DEFAULT did not match schema: …`.

Treat model calls like any remote call: expect failures, and decide what the feature does without an answer.
