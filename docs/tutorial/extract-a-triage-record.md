---
title: 8. Extract a triage record
---

# 8. Extract a triage record

**Where we are:** four decisions per ticket: department, topics, urgent, frustration.

**The problem:** agents still open every ticket to copy the order number and the product into the shop system, and to write a one-line summary for the queue. And `createTicket` has grown into a wall of calls.

## The solution: `extract()`, and one `triage` function

Several fields at once are a schema. Describe it with `t`, and `extract` fills it in:

```ts title="triage.ts"
import { t } from '@3flows/platform';
import { Intelligence } from '@3flows/intelligence';

// highlight-start
export const Facts = t.object({
    orderNumber: t.string().nullable().describe('Order number like A-1042, if the customer mentions one'),
    product: t.string().nullable().describe('The product the ticket is about, if any'),
    summary: t.string().describe('One sentence in English, for the agents’ queue')
});
// highlight-end
```

```ts title="triage.ts"
export const Triage = Facts.extend({
    department: Department,
    departmentReason: t.string().nullable(),
    topics: t.array(Topic),
    urgent: t.boolean(),
    urgentReason: t.string().nullable(),
    frustration: t.number(),
    priority: Priority
});
export type Triage = t.infer<typeof Triage>;

/** Everything the desk wants to know about a ticket, decided by the model. */
export async function triage(ticket: { subject: string; body: string }): Promise<Triage> {
    const ai = Intelligence.inference();
    const text = { subject: ticket.subject, body: ticket.body };

    // Independent questions about the same text: ask them in parallel.
    const [department, topics, urgent, frustration, facts] = await Promise.all([
        ai.choice('department').oneOf(departments).with(text)
            .ask('Which team should handle this ticket?'),
        ai.choice('topics').manyOf(Topic.options).with(text)
            .ask('Which topics does this ticket mention?'),
        ai.check('urgent').with(text)
            .ask('Does the customer need an answer today, for example because of a deadline, a safety issue or a bike they cannot ride?'),
        ai.score('frustration').between(0, 10).criteria(...frustrationScale).with(text)
            .ask('How frustrated is the customer?'),
        // highlight-next-line
        ai.extract('facts').schema(Facts).with(text).ask('Extract the facts of this ticket.')
    ]);

    return {
        ...facts,
        department: department.value,
        departmentReason: department.reason ?? null,
        topics: topics.value,
        urgent: urgent.value,
        urgentReason: urgent.reason ?? null,
        frustration: frustration.value,
        priority: priorityOf(urgent.value, frustration.value)
    };
}
```

`extract` returns the value itself, typed by the schema: `facts.orderNumber` is a `string | null`. `Promise.all` keeps the types: `department.value` is a `Department`, `topics.value` a `Topic[]`. The handler becomes short again:

```ts title="services.ts"
export const StoredTicket = Ticket.extend({ id: t.string(), ...Triage.shape });

handler('createTicket', Ticket, StoredTicket, async (ticket, trigger) => {
    const stored: StoredTicket = { id: randomUUID(), ...ticket, ...(await triage(ticket)) };
    await trigger.context.doc().collection('tickets').by(stored.id).set(stored);
    await trigger.ok(stored);
})
```

`departments`, `Topic`, `frustrationScale` and `priorityOf` move to `triage.ts` too. It's now the one file that holds the desk's triage policy.

## Nullable means "may be missing"

`orderNumber` is `nullable()`. That's not a detail. A required string field forces the model to produce a string, and when the ticket has no order number, it will produce a plausible one. `null` gives it a correct way to say *not there*. `.describe(...)` is part of the prompt: say what the field is and what it looks like.

## Why not one big extraction?

We could put all nine fields into one schema. Separate calls are often better:

- **Each question is small**, so each answer is more reliable.
- **Each has its own name** (`department`, `urgent`, …) in traces and records, so a wrong answer is easy to locate.
- **Native decision models can take over** `choice`, `check` and `score` later, while `extract` stays on a chat model.

The cost is more calls. They run in parallel, so latency is the slowest call, not the sum. When cost matters more, merge.

## Run it

```sh
yarn step:08
curl -X POST localhost:3000/createTicket -H 'Content-Type: application/json' -d '{
  "email": "ada@example.com",
  "subject": "Brake pads do not fit",
  "body": "Hi, the brake pads from order A-1042 do not fit my Velo City 3. Can you send the right ones?"
}'
```

```json
{
  "orderNumber": "A-1042",
  "product": "brake pads for Velo City 3",
  "summary": "Customer received brake pads that do not fit their Velo City 3 and asks for the correct ones.",
  "department": "technical",
  "topics": ["spare-parts"],
  "urgent": false,
  "frustration": 2,
  "priority": "normal",
  …
}
```

## What you learned

- **`extract(name).schema(zod)`** returns a typed record.
- **`nullable()` for missing information**, `.describe()` for every non-obvious field.
- **Small, parallel questions** beat one big one, until cost says otherwise.

## Reviewer's view

> `triage.ts` defines everything the model decides about a ticket: five questions, asked in parallel.

This file is the AI policy of the desk, in one place. The reviewer reads it top to bottom: options, definitions, scales, fields. Everything else in the service is storage.

[Sample: step 08](https://github.com/3flows/intelligence-samples/tree/main/support-desk/steps/08-extract-triage) · Next: [Triage in the background](./triage-in-the-background.md)
