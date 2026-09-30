---
title: 5. Choose
---

# 5. Choose

**Where we are:** an intelligent service drafts replies. Tickets themselves aren't stored anywhere.

**The problem:** Velo has three teams: billing, technical and sales. Every ticket lands in one inbox, and somebody reads each one just to forward it. The shop owner also asks: *what do customers write about?*

## The shape for all of Part 2

Tickets become documents in `docs`. What the model finds out about a ticket lives under one field, `triage`, and the ticket keeps this shape for the rest of Part 2:

```ts title="services.ts"
export const Ticket = t.object({
    email: t.string(),
    subject: t.string(),
    body: t.string()
});

export const StoredTicket = Ticket.extend({ id: t.string(), triage: Triage });

handler('createTicket', Ticket, StoredTicket, async (ticket, trigger) => {
    // The model decides what the ticket means ...
    const stored: StoredTicket = { id: randomUUID(), ...ticket, triage: await triage(trigger.context, ticket) };
    // ... the code decides what happens with it.
    await trigger.context.doc().collection('tickets').by(stored.id).set(stored);
    await trigger.ok(stored);
})
```

`triage(...)` lives in its own file, `triage.ts`. In this part, **each chapter changes only that file.** It becomes the desk's AI policy: everything the model decides about a ticket, in one place.

```yaml title="intelligence.yml"
docs:
  - name: DEFAULT
    type: memory
```

## The solution: `choice()`

Routing isn't a question for free text. It has exactly one answer from a fixed set. That's `choice().oneOf()`:

```ts title="triage.ts"
export const Department = t.enum(['billing', 'technical', 'sales']);
export type Department = t.infer<typeof Department>;

// What each team handles. This is what a new colleague would need to know, too.
const departments: Record<Department, string> = {
    billing: 'Payments, invoices, refunds and prices',
    technical: 'Defects, repairs, assembly and spare parts',
    sales: 'Product advice and orders that have not been placed yet'
};

export const Topic = t.enum(['delivery', 'refund', 'invoice', 'defect', 'assembly', 'spare-parts', 'product-advice']);
export type Topic = t.infer<typeof Topic>;

export const Triage = t.object({
    department: Department,
    departmentReason: t.string().nullable(),
    topics: t.array(Topic)
});
export type Triage = t.infer<typeof Triage>;

export async function triage(context: Pick<IntelligenceContext, 'inference'>, ticket: { subject: string; body: string }): Promise<Triage> {
    const ai = context.inference();
    const text = { subject: ticket.subject, body: ticket.body };

    // Independent questions about the same text: ask them in parallel.
    const [department, topics] = await Promise.all([
        // highlight-start
        ai.choice('department').oneOf(departments).with(text)
            .ask('Which team should handle this ticket?'),
        ai.choice('topics').manyOf(Topic.options).with(text)
            .ask('Which topics does this ticket mention?')
        // highlight-end
    ]);

    return {
        department: department.value,
        departmentReason: department.reason ?? null,
        topics: topics.value
    };
}
```

- **`choice('department')`** names the question. The name shows up in traces, usage records and evaluation reports.
- **`oneOf(departments)`** is the closed set. `value` is typed `Department` and is guaranteed to be one of the three. No parsing, no `includes('billing')`.
- **The descriptions** are the routing policy. A list of names would work too, but descriptions make the decision better and explain it to the next reader.
- **`manyOf(Topic.options)`** returns a list: zero, one or several topics. `Topic.options` is the enum's list of values, so the schema and the question share one definition.
- **`reason`** comes with the decision. We store it, so "why billing?" has an answer.

We only send subject and body. The customer's email isn't needed to route a ticket, so it doesn't leave our system.

| The question… | Use |
|---|---|
| has exactly one answer from a list: *who handles it?* | `oneOf` |
| has any number of answers from a list: *what is it about?* | `manyOf` |

And once text is data, a report is ordinary code:

```ts title="services.ts"
handler('topicReport', t.object({}).optional(), t.record(t.string(), t.number()), async (_input, trigger) => {
    const tickets = await trigger.context.doc().collection('tickets').find({}).all<StoredTicket>();
    const counts: Record<string, number> = {};
    for (const topic of tickets.flatMap((ticket) => ticket.triage.topics)) counts[topic] = (counts[topic] ?? 0) + 1;
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
{
  "id": "5f0c…",
  "triage": {
    "department": "technical",
    "departmentReason": "The main issue is a spare part that does not fit.",
    "topics": ["spare-parts", "invoice"]
  },
  …
}
```

## Test it

A script can answer each question by name: `request.responseSchemaName` is the decision's name. The samples have a helper for that, `triageScript(answers)`.

```ts title="step.test.ts"
test('oneOf: stores the department the model chose, with its reason', async () => {
    ScriptedAI.reset(triageScript({ department: { value: 'billing', confidence: 0.9, reason: 'Missing invoice.' } }));

    const created = await post('http://127.0.0.1:3000/createTicket', ticket);

    assert.equal(created.triage.department, 'billing');
    assert.equal(created.triage.departmentReason, 'Missing invoice.');
});

test('oneOf: exactly the three departments are offered, and no email address is sent', async () => {
    await post('http://127.0.0.1:3000/createTicket', ticket);

    const request = ScriptedAI.requests.find((r) => r.responseSchemaName === 'department')!;
    assert.deepEqual((request.responseSchema as any).shape.value.options, ['billing', 'technical', 'sales']);
    assert.doesNotMatch(JSON.stringify(request.messages), /grace@example\.com/);
});

test('an answer outside the options is rejected, not stored', async () => {
    ScriptedAI.reset(triageScript({ department: { value: 'marketing', confidence: 0.9, reason: null } }));

    await assert.rejects(post('http://127.0.0.1:3000/createTicket', ticket));
});
```

## What you learned

- **`choice(name).oneOf(options)`** turns text into one value from a fixed set; **`.manyOf(options)`** into a list.
- **Describe the options.** The descriptions are the policy.
- **Store the `reason`** with the decision.

## Reviewer's view

> New tickets are stored with a department (one of three) and topics (from a list of seven), chosen by the model.

Review the descriptions: they *are* the routing rules. Ask what happens to a ticket that fits none; right now it gets the closest match. And keep the descriptions in mind: in [chapter 16](./measure.md), we'll measure how well they work.

[Sample: step 05](https://github.com/3flows/intelligence-samples/tree/main/support-desk/steps/05-choose) · Next: [Judge](./judge.md)
