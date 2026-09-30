---
title: The fluent API
---

# The fluent API

Every capability in Intelligence reads the same way: **start with what you want, add what it needs, finish with a verb.**

```ts
trigger.context.inference()
    .choice('department')                        // 1. the capability
    .oneOf(['billing', 'technical', 'sales'])    // 2. capability-specific shape
    .model('fast')                               // 3. optional: which AI
    .instructions('Route support tickets.')      // 4. guidance
    .with(ticket.body)                           // 5. input
    .ask('Which team should handle this?');      // 6. the terminal verb
```

Once you can read one chain, you can read all of them.

## Three entry points, in the trigger context

An **intelligent service** (a service that extends `IntelligenceService`) finds three more members in its trigger context, next to the platform's `doc()`, `mq()`, `blob()` and `service()`:

| Entry point | For |
|---|---|
| `inference()` | Every stateless capability: `chat`, `extract`, `choice`, `check`, `score`, `embedding`, `reranker`, `transcriber`, `speech`, `image`, `video`, `ocr`, `moderation` |
| `conversations()` | Stateful chat: `.conversation(id)` remembers the history |
| `prompts()` | The prompt catalog from YAML: `has`, `get`, `render` |

```ts
const { inference, conversations, doc } = trigger.context;
```

One context, one vocabulary: the model is reached like the database. Outside a service (in scripts, evaluations and tests), the same entry points are static: `Intelligence.inference()`, `Intelligence.conversations()`, `Intelligence.prompts()`.

:::note Preview
Putting `inference()`, `conversations()` and `prompts()` into the trigger context is a change proposed for `@3flows/intelligence`. Until it ships, the [samples](https://github.com/3flows/intelligence-samples) carry it in `_shared/intelligence-service.ts`. The static entry points work today.
:::

## The shared vocabulary

These methods mean the same thing on every chain that supports them:

| Method | Meaning |
|---|---|
| `.model(name)` | Use the AI with this name from `ais`. Without it, the capability picks one. |
| `.instructions(...text)` | System guidance: who the model is, how to behave. Several calls add up. |
| `.prompt(name, variables?)` | Instructions from the `prompts` catalog, rendered with variables. |
| `.with(input, meta?)` | Add input: text, an object, an array, a `Buffer` or a stream. |
| `.withFile(source, meta?)` | Add a file: a path, `Buffer`, stream, or platform blob file. |
| `.withBlob(container, path)` | Add a file from the platform's `blobs`. |
| `.options({...})` | Per-call settings: `temperature`, `maxTokens`, `timeoutMs`, `retry`, `providerOptions`, `raw`, … |
| `.labels(...)`, `.metadata({...})` | Tags for tracing and usage records. |
| `.trace(id)` | Correlate this call with a trace. |

## Terminal verbs

A chain does nothing until its terminal verb. The verb says what kind of answer you get.

| Capability | Verb | Returns |
|---|---|---|
| `chat()`, `conversation(id)` | `.ask(prompt)` / `.stream(prompt)` | text / a stream of events |
| `extract(name)` | `.ask(prompt)` | a value of your schema's type |
| `choice(name)` | `.ask(prompt)` | `{ value, confidence, reason }` with `value` one of the options, or a list for `manyOf` |
| `check(name)` | `.ask(prompt)` | `{ value: boolean, confidence, reason }` |
| `score(name)` | `.ask(prompt)` | `{ value: number, confidence, reason }` |
| `embedding()` | `.embed()` | `{ vector, vectors }` |
| `reranker()` | `.rank()` | `{ results: [{ index, score, document }] }` |
| `transcriber()` | `.transcribe()` | `{ text, segments? }` |
| `speech()` | `.speak(text?)` | `{ audio: Buffer, mimeType }` |
| `image()`, `video()` | `.generate(prompt?)` | `{ images }` / `{ videos }` |
| `ocr()` | `.read(prompt?)` | `{ text, pages? }` |
| `moderation()` | `.check(input?)` | `{ flagged, results }` |

`ask` is for anything you'd phrase as a question to the model. The other verbs are for operations that aren't questions.

## Chains are immutable

Every method returns a **new** chain. The one you called it on is unchanged. That makes chains safe to build once and reuse:

```ts
const support = inference()
    .chat()
    .prompt('support.reply')
    .options({ temperature: 0.3 });

// Two independent calls. Neither sees the other's input.
await support.with(ticketA).ask('Draft a reply.');
await support.with(ticketB).ask('Draft a reply.');
```

A shared chain carries **configuration**, never history. History is what [conversations](./conversations.md) are for.

## Names are for people

`choice('department')`, `check('urgent')`, `score('frustration')` and `extract('triage')` take a name. It isn't a key into anything. It's the name of the question: it becomes the schema name the model sees, the span name in traces (`choice:department`), and the label in usage records. Name it the way the business would.

## Inside a service

Use the fluent API from handlers and routes like any other platform primitive:

```ts
@Register()
export class TicketsService extends IntelligenceService {
    handlers = () => [
        handler('triage', Ticket, Triage, async (ticket, trigger) => {
            const { inference, doc } = trigger.context;
            const department = await inference()
                .choice('department')
                .oneOf(['billing', 'technical', 'sales'])
                .with(ticket.body)
                .ask('Which team should handle this ticket?');

            await doc().collection('tickets').by(ticket.id).set({ ...ticket, department: department.value });
            await trigger.ok({ department: department.value });
        })
    ];
}
```

The model decides what the ticket means. The service decides what happens: it stores the ticket with its department. That split is the most important design rule in this documentation.

## See also

- [Fluent API reference](../api/overview.md): every chain and method.
- [Context and prompts](./context-and-prompts.md): what goes into instructions, input and question.
- [Turning language into data](./language-into-data.md): when to use which decision.
