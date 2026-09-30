---
title: Tools
---

# Tools

Attach tools to [`chat()`](./chat.md) or a [conversation](./conversations.md). When the model requests a call, Intelligence runs it, sends the result back and calls the model again, up to `.maxToolRounds(n)` rounds (default `3`). Concepts: [Tools](../concepts/tools.md).

Tools require an AI with the `tools` capability. `.stream(...)` doesn't run tools.

## Service handlers as tools

```ts
chat.service('OrdersService', 'lookupOrder')
chat.service('OrdersService', 'lookupOrder', { name: 'lookup_order', description: 'Find an order by number.' })
chat.service({ service: 'OrdersService', method: 'lookupOrder', timeout: 5000 })
chat.services([
    ['OrdersService', 'lookupOrder'],
    ['ShippingService', 'trackParcel']
])
```

| Option | Default | Description |
|---|---|---|
| `name` | `<Service>_<method>` | Tool name the model sees |
| `description` | the handler's description | What the tool does and when to use it |
| `input` / `parameters` | the handler's input schema | A Zod schema or JSON schema. Needed when the schema can't be discovered |
| `prefer`, `timeout`, `headers` | | Service call options |

The description and schema come from the handler, locally or, for remote services, through their `rpc.schema`. Write handler descriptions for the model: what the handler returns, and when to use it.

## Inline tools

```ts
chat.tools({
    name: 'today',
    description: 'Today’s date in ISO format.',
    parameters: { type: 'object', properties: {}, additionalProperties: false },
    execute: async () => new Date().toISOString().slice(0, 10)
})
```

| Field | Description |
|---|---|
| `name` | Tool name |
| `description` | What it does |
| `parameters` | JSON schema of the arguments |
| `execute(args, context?)` | Runs the tool. The return value is sent to the model as JSON |

## Skills

```ts
chat.skills('orders')
```

Attaches every tool of the configured skill `orders` (YAML `skills`). See [Tools and skills](../concepts/tools.md#skills).

## Results

The final `AIChatResponse` is the model's last answer. Errors thrown by a tool don't fail the call: they're sent to the model as `{ "error": "…" }`, so it can react, for example by asking for a correct order number.

With a conversation and the entity store, every call is recorded as `AIConversationToolCall` (name, arguments, status, latency) and `AIConversationToolResult`.

## Limits

- Every round sends the history so far: the chain's text and JSON inputs, the question, and all tool calls and results. File inputs are only sent with the first round.
- After `maxToolRounds`, the last response is returned as is. It may still contain `toolCalls` and no text; check `response.text`.
