---
title: Tools
---

# Tools

A model can't look anything up. It only sees what's in the call. **Tools** let it ask your application for more: "call `lookupOrder` with `{ id: 'A-1042' }`", and your application answers.

This is also what people mean by **agents**: a model that decides, step by step, which tools to use to finish a task.

## The tool loop

```txt
         question + tool descriptions
  you ─────────────────────────────────▶ model
                                            │  "call lookupOrder({ id: 'A-1042' })"
  you ◀─────────────────────────────────────┘
   │  run lookupOrder, send the result
   └──────────────────────────────────▶ model
                                            │  "Your order A-1042 shipped yesterday."
  you ◀─────────────────────────────────────┘
```

The model never runs anything. It **requests** a call; Intelligence runs it, sends the result back, and repeats until the model answers in text, or the round limit is reached (`.maxToolRounds(n)`, default `3`).

## Services are tools

On the platform, your application logic already lives in service handlers, with names, descriptions and input schemas. That's everything a model needs to know about a tool. So a handler becomes a tool with one line:

```ts
await Intelligence.inference()
    .chat()
    .service('OrdersService', 'lookupOrder')
    .ask('Where is my order A-1042?');
```

```ts
handler(
    'lookupOrder',
    t.object({ id: t.string().describe('Order number, like A-1042') }),
    Order,
    async ({ id }, trigger) => { /* … */ },
    'Look up an order by its number: status, items and shipping date.'  // the model reads this
)
```

- The tool's **name** is `<Service>_<method>`, its **description** is the handler's description, its **parameters** are the handler's input schema.
- The call goes through `service(...).method(...).call()`, like any service-to-service call. If the service runs in another process, discovery finds it.
- The input is validated by the handler's schema, like any other call. The model can't bypass it.

## Inline tools

For small helpers that aren't worth a handler, pass a tool directly:

```ts
chat.tools({
    name: 'today',
    description: 'Today’s date in ISO format.',
    parameters: { type: 'object', properties: {}, additionalProperties: false },
    execute: async () => new Date().toISOString().slice(0, 10)
})
```

Prefer services for anything with business logic: they're tested, described and reusable.

## Skills

A **skill** is a registered group of tools, configured under `skills` in YAML and attached by name with `.skills('orders', 'shipping')`. Skills predate service tools; for new code, `.service(...)` is usually simpler.

## Tools and responsibility

Tools are where an AI feature stops *talking* and starts *acting*. That changes the review:

| Tool kind | Example | Review question |
|---|---|---|
| **Read** | look up an order, search the help center | Can the model reach data this user shouldn't see? |
| **Write, reversible** | add a note, tag a ticket | Is the change visible and easy to undo? |
| **Write, irreversible** | refund, cancel, send an email | Should a model decide this at all? |

Rules that keep this reviewable:

- **List tools explicitly per call.** Never "all handlers of a service". The chain shows exactly what the model may do.
- **Scope tools to the user.** A tool that takes an order id should check that the order belongs to the current customer. The model will pass whatever id the customer typed.
- **Keep irreversible actions out of the loop.** Let the model *propose* ("refund 20 €?") and let a human or a deterministic rule confirm. A [flow](https://3flows.github.io/platform-docs/docs/tutorial/flows) with a `waitFor` is a good shape for that.
- **Bound the loop.** `maxToolRounds` limits cost and runaway behavior.

## Reviewer's view

Read the `.service(...)` and `.tools(...)` lines of a chain as a permission list. Everything the model can do is on it; nothing else is possible.
