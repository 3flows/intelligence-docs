---
title: conversations()
---

# `conversations().conversation(id)`

A chat that remembers. Every `ask` loads the history for `id`, sends it with the new question, and stores the question and the answer. Concepts: [Conversations](../concepts/conversations.md).

```ts
const conversation = Intelligence.conversations().conversation(`ticket-${ticket.id}`);

await conversation.prompt('support.reply').ask('My order A-1042 is late.');
await conversation.prompt('support.reply').ask('Can you check it again?');   // sees the first turn

conversation.messages();   // the history, in memory
```

`conversation()` without an id creates a new conversation with a random id; read it from `conversation.id`.

## Methods

All methods of [`chat()`](./chat.md), except `messages(...)` and `inputs(...)`:

`model`, `instructions`, `prompt`, `with`, `withFile`, `withBlob`, `tools`, `service`, `services`, `skills`, `maxToolRounds`, `options`, `metadata`, `labels`, `context`, `chatContext`, `trace`, `observabilityTag`.

Like every chain, the conversation chain is immutable: `conversation.prompt(...)` returns a new chain **for the same id**. Configuration isn't stored with the conversation, so attach it on every turn, typically from one helper:

```ts
const assistant = (ticketId: string) => Intelligence.conversations()
    .conversation(`ticket-${ticketId}`)
    .prompt('support.reply')
    .service('OrdersService', 'lookupOrder');

await assistant(ticket.id).ask(message);
```

| Member | Description |
|---|---|
| `.id` | The conversation id |
| `.ask(prompt)` | One turn. Resolves with the `AIChatResponse` |
| `.stream(prompt)` | One turn, streamed. The answer is stored when the `done` event arrives |
| `.messages(): AIMessage[]` | The history known to this process |
| `.clear(): Promise<void>` | Delete the history, and with the entity store all turns, messages, tool calls, attachments and runs |

## Stores

```yaml
conversations:
  store:
    type: entities   # memory (default) or entities
```

With `entities`, register the ontology and give it a `docs` backend. See [`conversations`](../configuration/conversations.md).

## Turn lifecycle

1. A turn is created with status `pending`.
2. The user message is stored.
3. The chat call runs, including tools.
4. The answer is stored and the turn becomes `completed`, or `failed` if the call throws.

With the entity store, tool calls, tool results and attachments of the turn are stored as their own entities, and every model call becomes an `AIInferenceRun` linked to the conversation and turn.
