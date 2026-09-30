---
title: 6. Flag urgent tickets
---

# 6. Flag urgent tickets

**Where we are:** tickets are routed and tagged.

**The problem:** *"My race is on Saturday and the wheel still hasn't arrived"* waits in the queue behind *"Do you sell bells?"*. Some tickets need an answer today.

## The solution: `check()`

A yes-or-no question gets a boolean:

```ts title="services.ts"
// highlight-start
const urgent = await ai.check('urgent')
    .with(text)
    .ask('Does the customer need an answer today, for example because of a deadline, a safety issue or a bike they cannot ride?');
// highlight-end
```

```ts title="services.ts"
export const StoredTicket = Ticket.extend({
    id: t.string(),
    department: Department,
    departmentReason: t.string().nullable(),
    topics: t.array(Topic),
    // highlight-start
    urgent: t.boolean(),
    urgentReason: t.string().nullable()
    // highlight-end
});
```

```ts
const stored: StoredTicket = {
    // …
    urgent: urgent.value,
    urgentReason: urgent.reason ?? null
};
```

The question defines *urgent*. That's the policy, and it's in plain words, where the team can read and argue about it. Three concrete reasons are better than "is this urgent?", which leaves the definition to the model.

And the agents' queue, urgent first:

```ts title="services.ts"
handler('queue', t.object({ department: Department }), t.array(StoredTicket), async ({ department }, trigger) => {
    const tickets = await trigger.context.doc().collection('tickets').find({ department }).all<StoredTicket>();
    await trigger.ok(tickets.sort((a, b) => Number(b.urgent) - Number(a.urgent)));
})
```

## Run it

```sh
yarn step:06
curl -X POST localhost:3000/createTicket -H 'Content-Type: application/json' -d '{
  "email": "ada@example.com",
  "subject": "Wheel not here",
  "body": "My race is on Saturday and the wheel I ordered still has not arrived!"
}'
```

```json
{ "urgent": true, "urgentReason": "The customer has a race on Saturday and needs the part before then.", … }
```

## Checks and thresholds

With a chat model, `check` asks for a boolean and a reason. With a native decision model (like TypeSafe's `jev`, see [Local and alternative models](../guides/local-models.md#decision-models)), it gets a probability instead, and you decide where *yes* begins:

```ts
ai.check('urgent').threshold(0.8).with(text).ask('…');
```

`threshold` makes *urgent* rarer and surer. The code that reads `urgent.value` doesn't change when the model does.

## What you learned

- **`check(name)`** turns a yes-or-no question into a boolean with a reason.
- **The question is the definition.** Make it concrete.
- Decisions compose into ordinary logic: here, sorting a queue.

## Reviewer's view

> Tickets are flagged urgent when the model finds a deadline, a safety issue or an unusable bike.

Ask what a false *urgent* costs (an agent answers a normal ticket sooner) and what a false *not urgent* costs (a customer misses a race). Here the first is cheap, so a generous definition is right. For other checks, like *"is this a legal complaint?"*, the balance may be the other way round.

[Sample: step 06](https://github.com/3flows/intelligence-samples/tree/main/support-desk/steps/06-flag-urgent) · Next: [Measure frustration](./measure-frustration.md)
