---
title: Conversations
---

# Conversations

A model is [stateless](./models-for-developers.md#1-its-stateless). A conversation is your application remembering on its behalf: it keeps the messages and sends them along with every new question.

## Stateless and stateful, side by side

```ts
// One call. Nothing is remembered.
await Intelligence.inference().chat().ask('My name is Ada.');
await Intelligence.inference().chat().ask('What is my name?');   // doesn't know

// A conversation. The history is kept under the id.
const conversation = Intelligence.conversations().conversation('ticket-42');
await conversation.ask('My name is Ada.');
await conversation.ask('What is my name?');                      // "Ada"
```

The id is yours. Use something from your domain: a ticket id, a chat session, a customer and a channel. The same id, in any request, on any instance with the same store, continues the same conversation.

## What a turn does

Every `ask` on a conversation is one **turn**:

1. Load the history for the id.
2. Build a chat call: history, then instructions, prompts, input and the new question.
3. Call the model, and run tools if it asks for them.
4. Store the user message, the tool calls and results, and the answer.

The conversation chain has the same methods as `chat()`: `.prompt(...)`, `.instructions(...)`, `.with(...)`, `.service(...)`, `.stream(...)`. Instructions and prompts are sent with every turn, but not stored as messages. So a prompt can be improved, and existing conversations use the new version from their next turn.

## Where the history lives

YAML decides:

```yaml
conversations:
  store:
    type: entities   # or memory, the default
```

| Store | History lives | Survives restarts | Shared between instances |
|---|---|---|---|
| `memory` | in the process | no | no |
| `entities` | in platform entities, backed by `docs` | yes | yes |

With `entities`, Intelligence brings its own ontology, `IntelligenceConversationsOntology`. Register it next to your own:

```yaml
docs:
  - name: DEFAULT
    type: memory   # or mongo, postgres

entities:
  backend: docs
  ontologies:
    - IntelligenceConversationsOntology
```

Then every conversation is queryable data:

| Entity | One per |
|---|---|
| `AIConversation` | conversation, with token totals |
| `AIConversationTurn` | `ask`, with status `pending`, `completed` or `failed`, and token totals |
| `AIConversationMessage` | message: `user`, `assistant`, `tool` |
| `AIConversationToolCall`, `AIConversationToolResult` | tool call the model made, and what came back |
| `AIConversationAttachment` | file sent with a turn |
| `AIInferenceRun` | model call, with tokens, latency and prompt versions |

Your code can read them like any other entity, for example to show a support agent the whole thread.

## Memory is a product decision

Keeping everything forever is the default, and rarely what you want:

- **Cost and limits.** Every turn resends the history. Long conversations get slow, expensive and eventually exceed the context window.
- **Privacy.** A conversation stores what customers typed. That's personal data with a retention period.
- **Relevance.** Old turns can mislead the model about the current question.

Today, the history is sent in full. `conversation.clear()` removes it. For long-running threads, start a new conversation id per topic, or summarize old turns into input. See [Known gaps](../guides/known-gaps.md) for memory windows and compaction.

## Chat with history you already have

If the history lives in another system, like an email thread, you don't need a conversation. Pass it explicitly:

```ts
await Intelligence.inference().chat().messages(threadAsMessages).ask('Draft the next reply.');
```

## Reviewer's view

- **Which id?** It decides who shares a history. A conversation id derived from user input without a check is a data leak between customers.
- **Which store?** `memory` in production means conversations disappear on every deploy.
- **What's the retention?** Who deletes conversations, and when?
