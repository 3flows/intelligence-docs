---
title: Fluent API overview
sidebar_label: Overview
---

# Fluent API overview

In an intelligent service, the entry points are in the trigger context:

```ts
const { inference, prompts, agent, workflow } = trigger.context;
```

Outside a service (scripts, evaluations, tests), `Intelligence` has static ones:

```ts
import { Intelligence } from '@3flows/intelligence';

Intelligence.inference();   // the same as trigger.context.inference()
Intelligence.chatbots();    // the configured chatbots
```

The examples below use `Intelligence.inference()`; inside a service, read it as `trigger.context.inference()`.

The grammar and the reasoning behind it are explained in [The fluent API](../concepts/the-fluent-api.md). This section is the reference.

## Entry points and terminal verbs

Every chain starts with a capability and ends with a verb. Nothing is sent before the verb.

| Chain | Terminal verb | Resolves with | |
|---|---|---|---|
| `inference().chat()` | `.answer()` / `.stream()` | `AIChatResponse` / `InferenceStream` | [chat](./chat.md) |
| `inference().extract(name)` | `.extract()` | a value of your schema's type | [extract](./extract.md) |
| `inference().choice(name)` | `.decide()` | `OneOfDecision` / `ManyOfDecision` | [decisions](./decisions.md) |
| `inference().check(name)` | `.decide()` | `CheckDecision` | [decisions](./decisions.md) |
| `inference().score(name)` | `.decide()` | `ScoreDecision` | [decisions](./decisions.md) |
| `inference().embedding()` | `.embed()` | `{ vector, vectors }` | [embeddings](./embeddings-and-reranking.md) |
| `inference().reranker()` | `.rerank()` | `{ results }` | [reranking](./embeddings-and-reranking.md) |
| `inference().transcriber()` | `.transcribe()` | `{ text, segments? }` | [audio](./audio-and-media.md) |
| `inference().speech()` | `.speak()` | `{ audio, mimeType }` | [audio](./audio-and-media.md) |
| `inference().image()` / `.video()` | `.generate()` | `{ images }` / `{ videos }` | [media](./audio-and-media.md) |
| `inference().ocr()` | `.read()` | `{ text, pages? }` | [OCR](./audio-and-media.md#ocr) |
| `inference().moderation()` | `.moderate()` | `{ flagged, results }` | [moderation](./moderation.md) |
| `inference().collection(items)` | `.all()` / `.settled()` / `.reduce(…)`, after `.map(…)`, `.filter(…)`, `.batch(n)` | the results, per item | [collections](../concepts/collections.md) |

Beyond single calls, the trigger context has:

| Entry point | For | |
|---|---|---|
| `prompts().prompt(name).variables({…}).render()` | The prompt catalog from YAML | [prompts](../configuration/prompts.md) |
| `agent(name).using(context).task(…).run()` / `.stream()` | Agents | [Agents](../concepts/agents.md) |
| `workflow(name).input(…).run()` / `.report()` | Workflows | [Workflows](../concepts/workflows.md) |
| `Intelligence.chatbots().chatbot(name).session(id?)` | Chatbots, from code | [Chatbots](../concepts/chatbots.md) |

`inference()` also exposes the configured AIs, for inspection:

```ts
Intelligence.inference().ai('DEFAULT').describe();   // { name, provider, model, capabilities, … }
Intelligence.inference().select('embedding');        // the AI a chain would use for a capability
Intelligence.inspect();                              // version, AIs, prompts, chatbots, configuration findings
```

## Methods shared by all chains

| Method | Description |
|---|---|
| `.model(name: string)` | Use the AI with this name from `ais` |
| `.instructions(...instructions: string[])` | Add system instructions. Repeated calls add up |
| `.prompt(name: string, variables?, version?)` | Add instructions rendered from the prompt catalog. On `transcriber()`, `prompt(text)` is the transcription hint instead |
| `.with(input, meta?)` | Add input. See [Inputs and files](./inputs-and-files.md) |
| `.withFile(source, meta?)` | Add a file from a path, `Buffer`, `Readable` or blob file |
| `.withBlob(container, path, meta?)` / `.withBlob({ blob?, container, path }, meta?)` | Add a file from `blobs` |
| `.options(options: AIRequestOptions)` | Per-call settings, merged over the AI's `defaults` |
| `.timeout(ms: number)` | A deadline for this call |
| `.signal(signal?: AbortSignal)` | Cancel the call with the caller: `.signal(trigger.signal)` |
| `.metadata(metadata: Record<string, unknown>)` | Stored with the trace records and passed to the tracer. `subjectType`, `subjectId`, `purpose` and `correlationId` link a call to your domain |
| `.labels(...labels: string[])` | Tags for the request |
| `.context(context)`, `.chatContext(context)` | Free-form context passed to the provider and tracer |
| `.trace(traceId: string)` | Correlate the call with an existing trace |
| `.observabilityTag(tag: string)` | Tag for the tracer |

`embedding()` and `reranker()` support the subset that makes sense for them (`model`, `options`, `timeout`, `signal`, `metadata`, `labels`, `context`, `trace`, `observabilityTag`).

### Policy: metadata and timeouts as a rule

An application can require that every call is tagged and bounded:

```yaml
intelligence:
  inference:
    require:
      metadata: true
      timeout: true
    onViolation: warn   # warn, error or off
```

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
await triage.with(ticketA).question('Summarize.').answer();
await triage.with(ticketB).question('Summarize.').answer();   // does not see ticketA
```

## Errors

Terminal verbs reject with an `Error` when:

- no AI has the capability: `No AI is defined with capability embedding`,
- the named AI lacks it: `AI fast does not support capability structured`,
- a required part is missing, like the options of a `choice` or the schema of an `extract`,
- the provider fails after all retries,
- a structured answer doesn't match its schema: `Structured response from DEFAULT did not match schema: …`.

Treat model calls like any remote call: expect failures, and decide what the feature does without an answer.
