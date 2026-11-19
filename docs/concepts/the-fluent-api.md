---
title: The fluent API
---

# The fluent API

Every capability in Intelligence reads the same way: **start with what you want, add what it needs, finish with a verb.**

```ts
trigger.context.inference()
    .choice('department')                               // 1. the capability
    .oneOf(['billing', 'technical', 'sales'])           // 2. capability-specific shape
    .model('fast')                                      // 3. optional: which AI
    .instructions('Which team should handle this?')     // 4. guidance: the question
    .state(ticket.body)                                 // 5. what it's about
    .decide();                                          // 6. the terminal verb
```

Once you can read one chain, you can read all of them.

## Entry points in the trigger context

An **intelligent service** (a service that extends `IntelligenceService`) finds the Intelligence entry points in its trigger context, next to the platform's `doc()`, `mq()`, `blob()` and `service()`:

| Entry point | For |
|---|---|
| `inference()` | Every model capability: `chat`, `extract`, `choice`, `check`, `score`, `embedding`, `reranker`, `transcriber`, `speech`, `image`, `video`, `ocr`, `moderation`, and `collection` for many items |
| `prompts()` | The prompt catalog from YAML |
| `agent(name)` | An [agent](./agents.md): a model working on a task in several steps |
| `workflow(name)` | A [workflow](./workflows.md): a process of named steps |
| `skill(name)`, `ai(name)` | The configured skills and AIs, for inspection |

```ts
const { inference, agent, workflow, doc } = trigger.context;
```

One context, one vocabulary: the model is reached like the database. Outside a service (in scripts, evaluations and tests), `Intelligence.inference()` and `Intelligence.chatbots()` are static.

## The shared vocabulary

These methods mean the same thing on every chain that supports them:

| Method | Meaning |
|---|---|
| `.model(name)` | Use the AI with this name from `ais`. Without it, the capability picks one. |
| `.instructions(...text)` | System guidance: who the model is, how to behave. Several calls add up. |
| `.prompt(name, variables?, version?)` | Instructions from the `prompts` catalog, rendered with variables. |
| `.with(input, meta?)` | Add input: text, an object, an array, a `Buffer` or a stream. |
| `.withFile(source, meta?)` | Add a file: a path, `Buffer`, stream, or platform blob file. |
| `.withBlob(container, path)` | Add a file from the platform's `blobs`. |
| `.options({...})` | Per-call settings: `temperature`, `maxTokens`, `retry`, `providerOptions`, `raw`, … |
| `.timeout(ms)`, `.signal(abortSignal)` | A deadline, and cancellation with the caller. |
| `.metadata({...})`, `.labels(...)` | Tags for traces and records. `subjectType`, `subjectId` and `purpose` link a call to your domain. |
| `.trace(id)` | Correlate this call with a trace. |

## Terminal verbs

A chain does nothing until its terminal verb. The verb says what kind of answer you get.

| Capability | The task goes in | Verb | Returns |
|---|---|---|---|
| `chat()` | `.question(q)` | `.answer()` / `.stream()` | text / an `InferenceStream` |
| `extract(name)` | `.schema(s)`, `.from(data)` | `.extract()` | a value of your schema's type |
| `choice(name)` | `.oneOf(…)` / `.manyOf(…)`, `.state(data)` | `.decide()` | `{ value, confidence, reason }` with `value` one of the options, or a list for `manyOf` |
| `check(name)` | `.state(data)` | `.decide()` | `{ value: boolean, confidence, reason }` |
| `score(name)` | `.between(…)`, `.criteria(…)`, `.state(data)` | `.decide()` | `{ value: number, confidence, reason }` |
| `embedding()` | `.with(text)` | `.embed()` | `{ vector, vectors }` |
| `reranker()` | `.query(q)`, `.with(documents)` | `.rerank()` | `{ results: [{ index, score, document }] }` |
| `transcriber()` | `.withFile(audio)` | `.transcribe()` | `{ text, segments? }` |
| `speech()` | `.text(t)` | `.speak()` | `{ audio: Buffer, mimeType }` |
| `image()`, `video()` | `.description(d)` | `.generate()` | `{ images }` / `{ videos }` |
| `ocr()` | `.withFile(document)` | `.read()` | `{ text, pages? }` |
| `moderation()` | `.input(text)` | `.moderate()` | `{ flagged, results }` |

The verb is named after what happens: a chat is *answered*, a decision is *decided*, a record is *extracted*. For the three decisions, the question itself is guidance (`.instructions(...)`), and `.state(...)` is what the question is about.

## Chains are immutable

Every method returns a **new** chain. The one you called it on is unchanged. That makes chains safe to build once and reuse:

```ts
const support = inference()
    .chat()
    .prompt('support.reply')
    .options({ temperature: 0.3 });

// Two independent calls. Neither sees the other's input.
await support.with(ticketA).question('Draft a reply.').answer();
await support.with(ticketB).question('Draft a reply.').answer();
```

A shared chain carries **configuration**, never history. History is data: it's passed to `chat()` with `.messages(...)`, by the application that owns it, or kept by a [chatbot](./chatbots.md).

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
                .instructions('Which team should handle this ticket?')
                .state(ticket.body)
                .decide();

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
