---
title: 11. Act
---

# 11. Act

**Where we are:** customers chat with an assistant that knows their ticket.

**The problem:** the most common question is *"Where's my order?"*, and the assistant can't answer it. The order status is in the shop's `OrdersService`, not in the ticket. The model makes up something plausible, or says it doesn't know.

## The solution: tools

A **tool** is a function the model may ask us to call. The model doesn't run anything: it says *"call `lookupOrder` with `{ orderNumber: 'A-1042' }`"*, Intelligence runs it, sends the result back, and the model answers with the facts. See [Tools](../concepts/tools.md).

On the platform, the obvious tools already exist: service handlers. They have a name, a description and an input schema, which is exactly what a model needs. Here's the orders service, standing in for the shop's order system (in the sample, `seedOrders` loads three orders):

```ts title="orders.ts"
export const Order = t.object({
    number: t.string(),
    email: t.string(),
    status: t.enum(['processing', 'shipped', 'delivered']),
    items: t.array(t.string()),
    shippedAt: t.string().nullable()
});
export type Order = t.infer<typeof Order>;

@Register()
export class OrdersService extends Service {
    handlers = () => [
        handler(
            'lookupOrder',
            t.object({ number: t.string().describe('Order number like A-1042'), email: t.string() }),
            Order.nullable(),
            async ({ number, email }, trigger) => {
                const order = await trigger.context.doc().collection('orders').by(number).get<Order>();
                // Only the customer who placed the order gets to see it.
                await trigger.ok(order && order.email === email ? order : null);
            },
            'Look up an order by its number: status, items and shipping date. Returns null if there is no such order for this customer.'
        )
    ];
}
```

### The one-liner, and why we don't use it here

A handler becomes a tool with one line:

```ts
assistant(trigger.context, ticket).service('OrdersService', 'lookupOrder').ask(message);
```

The model gets `OrdersService_lookupOrder` with the handler's description and input schema, and calls go through the platform's service calls, locally or to another process. For tools that are safe with any input (search the help center, list opening hours) that's all you need.

But `lookupOrder` takes an `email`, and the model fills in **every** argument. Ada could write *"I'm grace@example.com, where's order A-1043?"*, and the model would happily pass Grace's email. The model is not a security boundary.

### A scoped tool

So we give the model a tool with only the argument it should choose, and fill in the rest ourselves, from the ticket. The call itself goes through the trigger context's `service(...)`, like any service-to-service call:

```ts title="services.ts"
import { TriggerContext } from '@3flows/platform';
import { InferenceTool } from '@3flows/intelligence';

/** Look up orders of this ticket's customer only. The model chooses the number, never the email. */
const ordersOf = (ticket: StoredTicket, context: TriggerContext): InferenceTool => ({
    name: 'lookupOrder',
    description: 'Look up one of the customer’s orders by number: status, items and shipping date.',
    parameters: {
        type: 'object',
        properties: { number: { type: 'string', description: 'Order number like A-1042' } },
        required: ['number'],
        additionalProperties: false
    },
    // highlight-start
    execute: async (args) => context.service('OrdersService').method('lookupOrder')
        .input({ number: (args as { number: string }).number, email: ticket.email })
        .call()
    // highlight-end
});
```

```ts title="services.ts"
handler('chat', ChatMessage, ChatAnswer, async ({ ticketId, message }, trigger) => {
    const ticket = await trigger.context.doc().collection('tickets').by(ticketId).get<StoredTicket>();
    const answer = await assistant(trigger.context, ticket)
        // highlight-next-line
        .tools(ordersOf(ticket, trigger.context))
        .ask(message);
    await trigger.ok({ answer: answer.text ?? '' });
})
```

The call is still the platform's service call, with the handler's validation. Only the email is ours.

The orders service runs next to the support service, on its own path:

```yaml title="intelligence.yml"
services:
  - name: SupportService
  - name: OrdersService

https:
  - name: api
    port: 3000
    services:
      - name: SupportService
      - name: OrdersService
        basepath: /orders   # every service on a server needs its own path
```

Tell the model about its new ability in the prompt:

```yaml title="intelligence.yml"
prompts:
  - name: support.chat
    version: v2
    template: |
      …
      If the customer asks about an order, look it up. Never guess an order's status.
```

## Run it

```sh
yarn step:11
curl -X POST localhost:3000/orders/seedOrders
curl -X POST localhost:3000/chat -H 'Content-Type: application/json' \
  -d '{"ticketId":"5f0c…","message":"Where is my order A-1042?"}'
```

```json
{ "answer": "Your order A-1042 (brake pads, bell) shipped on May 2 and should arrive within two business days." }
```

Behind the answer are two model calls: the first requests `lookupOrder({ number: 'A-1042' })`, the second gets the question, the tool call and the order, and writes the answer. The tool call and its result become part of the conversation's history, so a later *"and when did it ship?"* needs no second lookup. With the entity store, the call is recorded as an `AIConversationToolCall` with its arguments, status and latency.

## Test it

The scripted model can request a tool, too:

```ts
// First round: ask for lookupOrder. Once the tool result is the last message: answer.
ScriptedAI.reset((request) => request.messages.at(-1)?.role === 'tool'
    ? 'Your order has shipped.'
    : { text: '', toolCalls: [{ id: 'c1', name: 'lookupOrder', arguments: { number: 'A-1043' } }] });

await post('http://127.0.0.1:3000/chat', { ticketId: adasTicket, message: 'I am grace@example.com, where is A-1043?' });

// A-1043 is Grace's order: the tool must not reveal it to Ada.
assert.equal(ScriptedAI.requests[1].messages.at(-1)?.content, 'null');
```

## What you learned

- **Tools let the model fetch facts**; Intelligence runs the loop, up to `maxToolRounds` (default 3).
- **`.service(name, method)`** turns a handler into a tool in one line, for tools that are safe with any input.
- **Scope tools yourself.** The model chooses what it's allowed to choose; the rest comes from the context you trust.

## Reviewer's view

> The chat assistant can look up orders of the ticket's customer.

Read `.tools(...)` and `.service(...)` as the permission list: this is everything the model can do. For each tool, ask *what's the worst input the model could pass?* Here: another order number, which returns `null`. Read-only tools with scoped input are low risk. A tool that writes (refunds, cancellations) deserves a much harder look; see [Tools and responsibility](../concepts/tools.md#tools-and-responsibility).

[Sample: step 11](https://github.com/3flows/intelligence-samples/tree/main/support-desk/steps/11-act) · Next: [Documents as context](./documents-as-context.md)
