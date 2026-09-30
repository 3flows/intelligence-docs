---
title: 4. Route tickets
---

# 4. Route tickets

**Where we are:** the desk drafts replies. Tickets themselves aren't stored anywhere.

**The problem:** Velo has three teams: billing, technical and sales. Today every ticket lands in one inbox, and somebody reads each one just to forward it.

## The solution: `choice().oneOf()`

Tickets become documents in `docs`, and on the way in, the model decides which team gets them. Not as text we'd have to parse, but as one of three values:

```ts title="services.ts"
import { randomUUID } from 'node:crypto';
import { Intelligence } from '@3flows/intelligence';

export const Department = t.enum(['billing', 'technical', 'sales']);
export type Department = t.infer<typeof Department>;

// What each team handles. This is what a new colleague would need to know, too.
const departments: Record<Department, string> = {
    billing: 'Payments, invoices, refunds and prices',
    technical: 'Defects, repairs, assembly and spare parts',
    sales: 'Product advice and orders that have not been placed yet'
};

export const StoredTicket = Ticket.extend({
    id: t.string(),
    department: Department,
    departmentReason: t.string().nullable()
});
export type StoredTicket = t.infer<typeof StoredTicket>;
```

```ts title="services.ts"
handler('createTicket', Ticket, StoredTicket, async (ticket, trigger) => {
    // highlight-start
    const department = await Intelligence.inference()
        .choice('department')
        .oneOf(departments)
        .with({ subject: ticket.subject, body: ticket.body })
        .ask('Which team should handle this ticket?');
    // highlight-end

    const stored: StoredTicket = {
        id: randomUUID(),
        ...ticket,
        department: department.value,
        departmentReason: department.reason ?? null
    };
    await trigger.context.doc().collection('tickets').by(stored.id).set(stored);
    await trigger.ok(stored);
}),

handler('getTicket', t.object({ id: t.string() }), StoredTicket, async ({ id }, trigger) => {
    await trigger.ok(await trigger.context.doc().collection('tickets').by(id).get<StoredTicket>());
})
```

- **`choice('department')`** names the question. The name shows up in traces and usage records.
- **`oneOf(departments)`** is the closed set. A list of strings works too (`oneOf(['billing', 'technical', 'sales'])`), but descriptions make the decision better and explain it to the next reader.
- **The result** is `{ value, confidence, reason }`, and `value` is guaranteed to be one of the three. No parsing, no `includes('billing')`.
- **`value` is typed** `Department`: the options' keys flow into the result type.

We only send subject and body. The customer's email isn't needed to route a ticket, so it doesn't leave our system.

```yaml title="intelligence.yml"
docs:
  - name: DEFAULT
    type: memory
```

## Run it

```sh
yarn step:04
curl -X POST localhost:3000/createTicket -H 'Content-Type: application/json' -d '{
  "email": "ada@example.com",
  "subject": "Charged twice",
  "body": "I ordered a helmet last week and my card was charged twice."
}'
```

```json
{
  "id": "5f0c…",
  "email": "ada@example.com",
  "subject": "Charged twice",
  "body": "I ordered a helmet last week and my card was charged twice.",
  "department": "billing",
  "departmentReason": "The customer reports a duplicate card charge, which is a payment issue."
}
```

## The model decides what it means; the code decides what happens

The model reads the text and says *billing*. Everything that follows (storing, assigning, notifying) is ordinary service code, with an ordinary value. That split is the single most useful design rule for AI features: it keeps the part that can be wrong small, visible and testable.

## Test it

```ts
test('stores the ticket with the department the model chose', async () => {
    ScriptedAI.reset((request) => request.responseSchemaName === 'department'
        ? { value: 'billing', confidence: 0.9, reason: 'Duplicate charge.' }
        : 'OK');

    const created = await post('http://127.0.0.1:3000/createTicket', ticket);
    const stored = await post('http://127.0.0.1:3000/getTicket', { id: created.id });

    assert.equal(stored.department, 'billing');
    assert.equal(stored.departmentReason, 'Duplicate charge.');
});
```

`responseSchemaName` is the decision's name, so a script can answer each question separately.

## What you learned

- **`choice(name).oneOf(options)`** turns text into one value from a fixed set.
- **Describe the options.** The descriptions are the routing policy.
- Store the **`reason`** with the decision, so it can be explained later.

## Reviewer's view

> New tickets are stored with a department chosen by the model from billing, technical and sales.

Review the three descriptions: they *are* the routing rules. Then ask what happens to a ticket that fits none. Right now it gets the closest match. That may be fine; if not, add an `other` option and route it to a person.

[Sample: step 04](https://github.com/3flows/intelligence-samples/tree/main/support-desk/steps/04-route-tickets) · Next: [Tag topics](./tag-topics.md)
