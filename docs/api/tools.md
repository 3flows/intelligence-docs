---
title: Tools
---

# Tools

Attach tools to [`chat()`](./chat.md), chatbots, and agents. When the model requests a call, Intelligence runs it, sends the result back and calls the model again, up to `.maxToolRounds(n)` rounds (default `3`). Concepts: [Tools](../concepts/tools.md).

Tools require an AI with the `tools` capability. They work with `.answer()` and with `.stream()`.

## Service handlers as tools

A handler becomes a tool with `tool(...)`: it's `handler(...)` with a description for the model.

```ts
import { IntelligenceService, tool } from '@3flows/intelligence';

class OrdersService extends IntelligenceService {
  handlers = () => [
    tool('lookupOrder', Input, Output, async (params, trigger) => {
      await trigger.ok(await lookup(params.number));
    }, { description: 'Find an order by number.', readOnly: true, tags: ['orders'] })
  ];
}
```

| Option | Description |
|---|---|
| `name` | Tool name the model sees. Default: derived from service and method |
| `description` | What the tool does and when to use it. Written for the model |
| `readOnly` | The tool doesn't change anything |
| `destructive` | The tool changes or deletes data. Policies can keep such tools out, or ask for a confirmation |
| `requiresConfirmation` | A person must confirm before the tool runs |
| `tags` | For selecting tools: `tags: [public]` |
| `expose` | `false` hides the handler from tool discovery |

A chain gets every tool of a service, or a selection:

```ts
chat.toolsFrom('OrdersService')
chat.toolsFrom('HelpCenterService', { tags: ['public'] })
chat.toolsFrom('OrdersService', { include: ['lookupOrder'] })
```

Any handler can also be offered as a tool directly, whether it's marked or not:

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

## Tools for chatbots and agents

Chatbots and agents get their tools in YAML, by service and tag, from handlers marked with `tool(...)`:

```yaml
chatbots:
  - name: shop
    tools:
      - service: HelpCenterService
        tags: [public]
    toolPolicy:
      allowDestructive: false
```

`include` and `exclude` narrow by handler name. A [skill](../concepts/skills.md) bundles such tool references with instructions, for agents. `toolPolicy` (chatbots) and `policy` (agents) filter by `allowTags` / `denyTags`, keep out tools marked `destructive`, and can require a confirmation before a tool runs.

## Results

The final `AIChatResponse` is the model's last answer. Errors thrown by a tool don't fail the call: they're sent to the model as `{ "error": "…" }`, so it can react, for example by asking for a correct order number.

With the `IntelligenceTrace` domain registered, tool executions are recorded with the run they belong to. See [Observability](../guides/observability.md).

## Limits

- Every round sends the history so far: the chain's text and JSON inputs, the question, and all tool calls and results. File inputs are only sent with the first round.
- After `maxToolRounds`, the last response is returned as is. It may still contain `toolCalls` and no text; check `response.text`.
