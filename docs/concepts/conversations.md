---
title: Conversations (legacy term)
---

# Conversations (legacy term)

In Intelligence 0.9, **chatbots** are the supported high-level conversation surface. This page remains to explain terminology and migration from older documentation.

The old internal `conversations:` configuration, `context.conversations().conversation(id)`, and entity-backed `AIConversation*` storage model belonged to the 0.8 line. They have been replaced by configured chatbots and separate chatbot domain records.

## What to use now

Use [Chatbots](./chatbots.md) when you need remembered multi-turn interaction:

```yaml
chatbots:
  - name: support
    type: conversation
    model: DEFAULT
    instructions:
      - Help customers with short, factual answers.
    history:
      maxMessages: 20
    http:
      path: /support
```

The HTTP compatibility API may still use paths containing `/conversation`, but those paths operate on chatbot sessions. Internally, durable records are:

| 0.9 record | Purpose |
| --- | --- |
| `ChatbotSession` | One durable chatbot session/thread |
| `ChatbotMessage` | User/model/tool messages in the session |
| `ChatbotFile` | Files associated with chatbot interaction |
| `ChatbotReaction` | Feedback/reactions |
| `InferenceRun` / trace records | Technical model/tool evidence, separate from session records |

## Why the change?

0.9 separates concerns:

- Your application owns business state such as tickets, orders, cases, and decisions.
- Chatbot domain records own interactive session state.
- Agent domain records own task/run state.
- Trace domain records own technical inference evidence.

The old conversation entities mixed interactive history, tool details, and inference tracing too closely. The new model makes retention, auditing, and product behavior easier to reason about.

## Migrating old code

### Before

```ts
const conversation = trigger.context.conversations().conversation(`ticket-${ticket.id}`);
const answer = await conversation.instructions('Help the customer.').ask(message);
```

### After

Configure a chatbot and route requests through its session API or HTTP surface. For direct service code that does not need durable session records, use Fluent chat explicitly:

```ts
const answer = await trigger.context
  .inference()
  .chat()
  .instructions('Help the customer.')
  .metadata({ purpose: 'ticket-reply', subjectType: 'ticket', subjectId: ticket.id })
  .timeout(10_000)
  .ask(message);
```

If you need one remembered history per ticket, use a chatbot session id derived from the ticket id and clear that session according to your retention policy.

See the [0.8 to 0.9 migration guide](../migration-0.8-to-0.9.md) for the full mapping.
