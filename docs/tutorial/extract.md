---
title: 7. Extract
---

# 7. Extract

**Where we are:** four decisions per ticket: department, topics, urgency, frustration.

**The problem:** agents still open every ticket to copy the order number and the product into the shop system, and to write a one-line summary for the queue.

## The solution: `extract()`

Several fields at once are a schema. Describe it with `t` (Zod), and `extract` fills it in:

```ts title="triage.ts"
// Nullable: information that may be missing. Otherwise the model invents it.
export const Facts = t.object({
    orderNumber: t.string().nullable().describe('Order number like A-1042, if the customer mentions one'),
    product: t.string().nullable().describe('The product the ticket is about, if any'),
    summary: t.string().describe('One sentence in English, for the agents’ queue')
});

// highlight-next-line
export const Triage = Facts.extend({
    department: Department,
    // … as before
});
```

```ts title="triage.ts"
const [department, topics, urgent, frustration, facts] = await Promise.all([
    // … the four questions from before
    // highlight-start
    ai.extract('facts').schema(Facts).with(text)
        .ask('Extract the facts of this ticket.')
    // highlight-end
]);

return {
    ...facts,
    // … as before
};
```

`extract` returns the value itself, typed by the schema: `facts.orderNumber` is a `string | null`. Everything else stays as it was.

## Nullable means "may be missing"

`orderNumber` is `nullable()`. That's not a detail. A required string forces the model to produce a string, and when the ticket has no order number, it will produce a plausible one. `null` gives it a correct way to say *not there*.

`.describe(...)` is part of the prompt: say what the field is and what it looks like. Chapter 16 will show how much that matters.

## One big extraction, or small questions?

We could put all nine fields into one schema. Separate calls are often better:

- **Each question is small**, so each answer is more reliable.
- **Each has its own name** in traces and reports, so a wrong answer is easy to locate.
- **Native decision models can take over** `choice`, `check` and `score` later, while `extract` stays on a chat model.

The cost is more calls. They run in parallel, so latency is the slowest call, not the sum. When cost matters more, merge them.

## Run it

```sh
yarn step:07
curl -X POST localhost:3000/createTicket -H 'Content-Type: application/json' -d '{
  "email": "ada@example.com",
  "subject": "Brake pads do not fit",
  "body": "Hi, the brake pads from order A-1042 do not fit my Velo City 3. Can you send the right ones?"
}'
```

```json
{
  "triage": {
    "orderNumber": "A-1042",
    "product": "brake pads for Velo City 3",
    "summary": "Customer received brake pads that do not fit their Velo City 3 and asks for the correct ones.",
    "department": "technical",
    …
  }
}
```

## Test it

```ts title="step.test.ts"
test('missing information stays null', async () => {
    ScriptedAI.reset(triageScript({ facts: { orderNumber: null, product: null, summary: 'Asks about bells.' } }));

    const created = await post('http://127.0.0.1:3000/createTicket', { ...ticket, body: 'Do you sell bells?' });

    assert.equal(created.triage.orderNumber, null);
});

test('five named questions, asked about the same text', async () => {
    await post('http://127.0.0.1:3000/createTicket', ticket);

    assert.deepEqual(ScriptedAI.requests.map((r) => r.responseSchemaName).sort(),
        ['department', 'facts', 'frustration', 'topics', 'urgent']);
});
```

## What you learned

- **`extract(name).schema(zod)`** returns a typed record.
- **`nullable()` for missing information**, `.describe()` for every field that isn't obvious.
- **Small, parallel questions** beat one big one, until cost says otherwise.

## Reviewer's view

> Triage extracts order number, product and a summary, next to four decisions.

`triage.ts` now holds five questions: options, definitions, a scale, and fields. It's the file to read, top to bottom, to know what the model decides about a ticket.

[Sample: step 07](https://github.com/3flows/intelligence-samples/tree/main/support-desk/steps/07-extract) · Next: [The model decides meaning, the code decides action](./meaning-and-action.md)
