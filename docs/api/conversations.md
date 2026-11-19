---
title: Chatbot conversation compatibility
---

# Chatbot conversation compatibility

The old `conversations().conversation(id)` Fluent-style API is no longer the primary 0.9 surface. Use configured `chatbots:` for durable multi-turn interaction and Fluent `chat()` for direct one-off model calls.

The word `conversation` still appears in HTTP compatibility routes for chatbots. That is route compatibility, not the old internal conversation store.

## Configure a chatbot

```yaml
chatbots:
  - name: support
    type: conversation
    model: DEFAULT
    instructions:
      - Help customers with concise, factual answers.
    history:
      maxMessages: 20
    http:
      path: /support
```

A typical HTTP surface includes compatibility routes shaped like:

```text
POST /support/conversation
POST /support/conversation/:id/stream
POST /support/conversation/:id/file
```

Internally these routes create or continue `ChatbotSession` records and write `ChatbotMessage` records.

## Direct calls without memory

If you do not need chatbot session records, call Fluent chat directly:

```ts
const response = await trigger.context
  .inference()
  .chat()
  .instructions('Help the customer.')
  .metadata({ purpose: 'support-reply', subjectType: 'ticket', subjectId: ticket.id })
  .timeout(10_000)
  .ask(message);
```

## Migration mapping

| Old API | 0.9 replacement |
| --- | --- |
| `conversations:` YAML | `chatbots:` YAML |
| `conversations().conversation(id).ask(...)` | chatbot session call, chatbot HTTP route, or direct `inference().chat()` |
| `conversation.clear()` | delete/expire the relevant chatbot session and files according to retention policy |
| `AIConversation*` entities | `ChatbotSession`, `ChatbotMessage`, `ChatbotFile`, `ChatbotReaction` |
| conversation tool-call records | trace domain model/tool records plus chatbot messages |

See [Chatbots](../concepts/chatbots.md) and the [0.8 to 0.9 migration guide](../migration-0.8-to-0.9.md).
