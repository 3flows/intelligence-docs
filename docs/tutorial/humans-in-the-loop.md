---
title: 21. Humans in the loop
---

# 21. Humans in the loop

**Where we are:** the desk measures its quality, and hands some messages and replies to a person.

**The problem:** a ticket about *"a loose thing near the back"* was routed to billing, with low confidence, and sat there for two days. The model was unsure and acted anyway. And when an agent re-routes a ticket like that, the knowledge disappears: the evaluation never learns about it.

## The solution: act when sure, learn from corrections

### Act only when sure

Triage passes on the model's confidence:

```ts title="triage.ts"
return {
    // …
    department: department.value,
    departmentReason: department.reason ?? null,
    // highlight-next-line
    departmentConfidence: department.confidence ?? 0,
    // …
};
```

and a rule decides:

```ts title="services.ts"
/** Business rule: below this, a person routes the ticket. */
const ROUTING_CONFIDENCE = 0.6;

const result = await triage(trigger.context, received);
// Act only when sure: below the threshold, a person confirms the model's suggestion.
const status = result.departmentConfidence >= ROUTING_CONFIDENCE ? 'open' : 'needs-routing';
```

`needs-routing` tickets wait in the general queue, with the model's suggestion and reason. A person confirms in one click, instead of reading from scratch:

```ts title="services.ts"
// Everything a person has to look at: unsure routing, and messages or replies the guardrails stopped.
handler('generalQueue', t.object({}).optional(), t.array(StoredTicket), async (_input, trigger) => {
    await trigger.ok(await trigger.context.doc().collection('tickets').find({ status: { $ne: 'open' } }).all<StoredTicket>());
})
```

With a chat model, `confidence` is the model's own estimate: good for sorting and thresholds, not a calibrated probability. Pick the threshold with the evaluation: run it, and look at the confidence of the cases the model got wrong.

### Every correction is an evaluation case

When an agent routes a ticket differently from the model, that's the most valuable data the desk produces: a real ticket, and the right answer.

```ts title="services.ts"
// An agent routes a ticket. Where that differs from the model, it's recorded as a correction.
handler('routeTicket', t.object({ ticketId: t.string(), department: Department }), StoredTicket, async ({ ticketId, department }, trigger) => {
    const { doc } = trigger.context;
    const ticket = await doc().collection('tickets').by(ticketId).get<StoredTicket>();
    if (!ticket) return trigger.notFound(`Ticket ${ticketId} not found`);

    if (department !== ticket.triage.department) {
        const correction: Correction = {
            ticketId, subject: ticket.subject, body: ticket.body,
            suggested: ticket.triage.department, chosen: department, at: new Date().toISOString()
        };
        await doc().collection('corrections').by(ticketId).set(correction);
    }

    const routed: StoredTicket = { ...ticket, status: 'open', escalation: null, triage: { ...ticket.triage, department } };
    await doc().collection('tickets').by(ticketId).set(routed);
    await trigger.ok(routed);
})
```

And the corrections come out in the format of the evaluation set:

```ts title="services.ts"
// Corrections in the format of evals/tickets.json: the evaluation set grows with real cases.
handler('evaluationCases', t.object({}).optional(), t.object({ cases: t.array(t.any()) }), async (_input, trigger) => {
    const corrections = await trigger.context.doc().collection('corrections').find({}).all<Correction>();
    await trigger.ok({
        cases: corrections.map((c) => ({ id: `correction-${c.ticketId}`, input: { subject: c.subject, body: c.body }, expected: { department: c.chosen } }))
    });
})
```

That closes the loop of Part 5: **measure → improve → guard → learn from people → measure again.** The set grows with exactly the tickets the desk found hard, which is what keeps [chapter 17](./improve-with-evidence.md) from tuning against a fixed set forever. Review new cases before adding them: an agent's quick re-route isn't always the team's policy.

## Shapes of human involvement

From lightest to strongest:

| Shape | Here |
|---|---|
| **Suggest, don't act** | `draftReply`: the model drafts, the agent sends |
| **Act when sure** | routing above `ROUTING_CONFIDENCE` |
| **Act reversibly** | tagging and priority: easy to change |
| **Stop and hand over** | the guardrails of chapters 19 and 20 |
| **Wait for approval** | for anything irreversible, like refunds: a platform [flow](https://3flows.github.io/platform-docs/docs/tutorial/flows) that waits for a person |

## Run it

```sh
yarn step:21
curl -X POST localhost:3000/generalQueue
curl -X POST localhost:3000/routeTicket -H 'Content-Type: application/json' -d '{"ticketId":"5f0c…","department":"technical"}'
curl -X POST localhost:3000/evaluationCases
```

## Test it

```ts title="step.test.ts"
test('an unsure routing waits for a person, with the model’s suggestion', async () => {
    ScriptedAI.reset(triageScript({ department: { value: 'billing', confidence: 0.4, reason: 'A loose thing? Unclear.' } }));
    const { id } = await createTicket();

    const ticket = await getTicket(id);
    assert.equal(ticket.status, 'needs-routing');
    assert.equal(ticket.triage.department, 'billing');
});

test('the agent’s decision routes the ticket and becomes an evaluation case', async () => {
    // … create an unsure ticket, then:
    await post('http://127.0.0.1:3000/routeTicket', { ticketId: id, department: 'technical' });

    const { cases } = await post('http://127.0.0.1:3000/evaluationCases');
    assert.deepEqual(cases.find((c: any) => c.id === `correction-${id}`).expected, { department: 'technical' });
});
```

## What you learned

- **Confidence gates** let the model act when it's sure and hand over when it isn't.
- **Corrections are evaluation cases**: the people who fix the model's mistakes improve its measurement.
- Choose the **shape of involvement** by what a wrong decision costs.

## Reviewer's view

> Tickets routed with confidence below 0.6 wait for a person. Agents' re-routings are recorded and exported as evaluation cases.

Review the threshold with numbers: how many tickets per day land in `needs-routing` at 0.6, and how many of the auto-routed ones are wrong? Both come from the evaluation and the corrections. And agree who reviews new cases before they join the set.

[Sample: step 21](https://github.com/3flows/intelligence-samples/tree/main/support-desk/steps/21-humans-in-the-loop) · Next: [The right model for each job](./the-right-model-for-each-job.md)
