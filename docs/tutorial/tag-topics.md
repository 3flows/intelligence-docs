---
title: 5. Tag topics
---

# 5. Tag topics

**Where we are:** tickets are stored and routed to one of three teams.

**The problem:** the shop owner asks, *"what do customers write about?"* The department doesn't say. A billing ticket can be about a refund, an invoice, or both.

## The solution: `choice().manyOf()`

A ticket can have several topics, or none. That's `manyOf`: any number of values from a fixed list.

```ts title="services.ts"
export const Topic = t.enum(['delivery', 'refund', 'invoice', 'defect', 'assembly', 'spare-parts', 'product-advice']);
export type Topic = t.infer<typeof Topic>;

export const StoredTicket = Ticket.extend({
    id: t.string(),
    department: Department,
    departmentReason: t.string().nullable(),
    // highlight-next-line
    topics: t.array(Topic)
});
```

```ts title="services.ts"
handler('createTicket', Ticket, StoredTicket, async (ticket, trigger) => {
    const ai = Intelligence.inference();
    const text = { subject: ticket.subject, body: ticket.body };

    const department = await ai.choice('department')
        .oneOf(departments)
        .with(text)
        .ask('Which team should handle this ticket?');

    // highlight-start
    const topics = await ai.choice('topics')
        .manyOf(Topic.options)
        .with(text)
        .ask('Which topics does this ticket mention?');
    // highlight-end

    const stored: StoredTicket = {
        id: randomUUID(),
        ...ticket,
        department: department.value,
        departmentReason: department.reason ?? null,
        topics: topics.value
    };
    await trigger.context.doc().collection('tickets').by(stored.id).set(stored);
    await trigger.ok(stored);
})
```

`topics.value` is typed `Topic[]`. `Topic.options` is the enum's list of values, so the schema and the choice share one definition. Add a topic in one place, and both the stored document and the question know it.

And a small report, which is ordinary platform code:

```ts title="services.ts"
handler('topicReport', t.object({}).optional(), t.record(t.string(), t.number()), async (_input, trigger) => {
    const tickets = await trigger.context.doc().collection('tickets').find({}).all<StoredTicket>();
    const counts: Record<string, number> = {};
    for (const topic of tickets.flatMap((ticket) => ticket.topics)) counts[topic] = (counts[topic] ?? 0) + 1;
    await trigger.ok(counts);
})
```

## Run it

```sh
yarn step:05
curl -X POST localhost:3000/createTicket -H 'Content-Type: application/json' -d '{
  "email": "grace@example.com",
  "subject": "Wrong part and no invoice",
  "body": "The brake pads you sent do not fit my bike, and I never got an invoice."
}'
curl -X POST localhost:3000/topicReport
```

```json
{ "department": "technical", "topics": ["spare-parts", "invoice"], … }
{ "spare-parts": 1, "invoice": 1 }
```

## oneOf or manyOf?

| Question | Use |
|---|---|
| *Who handles it?* There's exactly one answer. | `oneOf` |
| *What's it about?* Could be several, could be none. | `manyOf` |

Forcing `oneOf` on a multi-valued question makes the model pick arbitrarily. Forcing `manyOf` on a single-valued one gives you lists you then have to reduce.

## What you learned

- **`choice(name).manyOf(options)`** returns a list: zero, one or several values.
- **Share one definition** between your schema and your choice: `Topic.options`.
- Once text is data, reports are just code.

## Reviewer's view

> Tickets are tagged with topics from a fixed list of seven.

The list is a product decision: it determines what the shop can count. An empty list is a valid answer; the report should show how often it happens, because many untagged tickets mean a topic is missing.

[Sample: step 05](https://github.com/3flows/intelligence-samples/tree/main/support-desk/steps/05-tag-topics) · Next: [Flag urgent tickets](./flag-urgent-tickets.md)
