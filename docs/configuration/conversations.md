---
title: conversations
---

# `conversations`

Where conversation history is kept. Concepts: [Conversations](../concepts/conversations.md).

```yaml
conversations:
  store:
    type: entities   # memory (default) or entities
```

| Field | Description |
|---|---|
| `store.type` | `memory`: in the process, lost on restart. `entities`: as platform entities |

## The entity store

`entities` needs the conversations ontology and a `docs` backend:

```yaml
docs:
  - name: DEFAULT
    type: memory   # or mongo, postgres

entities:
  backend: docs
  ontologies:
    - AppOntology                         # your own, if any
    - IntelligenceConversationsOntology
```

The ontology also enables [inference run](../guides/observability.md#inference-runs) recording, independently of the store type.

## Entities

| Entity | Key fields |
|---|---|
| `AIConversation` | `key` (the conversation id), `status`, token totals, `modelCallCount`, `toolCallCount` |
| `AIConversationTurn` | `conversationKey`, `index`, `status`, token totals |
| `AIConversationMessage` | `conversationKey`, `turnIndex`, `index`, `role`, `content`, `toolCallId`, `toolCalls` |
| `AIConversationAttachment` | `conversationKey`, `turnIndex`, file name, type and source |
| `AIConversationToolCall` | `callId`, `name`, `kind`, `service`, `method`, `arguments`, `status`, `latencyMs`, `resultPreview` |
| `AIConversationToolResult` | the result of a tool call |
| `AIInferenceRun` | `operation`, `ai`, `provider`, `model`, tokens, `latencyMs`, `status`, `metadata` |

They're exported for queries:

```ts
import { ConversationMessageEntity, InferenceRunEntity } from '@3flows/intelligence';

const messages = await ConversationMessageEntity.find({ conversationKey: 'ticket-42' }).sort({ index: 1 }).all();
```
