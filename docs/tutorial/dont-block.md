---
title: 23. Don't block, expect failure
---

# 23. Don't block, expect failure

**Where we are:** `createTicket` stores a fully triaged ticket, with each job on its own model.

**The problem:** creating a ticket takes several seconds, because five model calls run before the customer sees *"Thanks, we got your message."* And when the provider has a hiccup, the customer's ticket is lost with an error. In development nobody noticed; in production, providers have rate limits and bad minutes.

## The solution: store first, triage from a queue

The customer only needs the ticket to be **received**. Triage can happen a moment later. That's the platform's [`mq`](https://3flows.github.io/platform-docs/docs/tutorial/dont-block-booking), unchanged:

```ts title="services.ts"
export const StoredTicket = Ticket.omit({ attachments: true }).extend({
    // …
    // highlight-start
    triage: Triage.nullable(),             // null until the model has answered
    status: t.enum(['new', 'open', 'needs-routing', 'needs-human', 'triage-failed']),
    // highlight-end
    escalation: t.string().nullable()
});

handler('createTicket', Ticket, StoredTicket, async ({ attachments = [], ...ticket }, trigger) => {
    // … attachments into blobs, as before
    // Received is what the customer needs to know. Triage follows from the queue.
    const stored: StoredTicket = { id, ...ticket, attachments: attachments.map((a) => a.name), triage: null, status: 'new', escalation: null };
    await doc().collection('tickets').by(id).set(stored);
    // highlight-next-line
    await trigger.context.mq().queue('ticket-created').send({ id });
    await trigger.ok(stored);
})
```

```ts title="services.ts"
// Triage from the queue. A failed model call is a state, not a lost ticket.
route.mq().queue('ticket-created').do(async (message, trigger) => {
    const context = intelligence(trigger.context);
    const tickets = context.doc().collection('tickets');
    const ticket = await tickets.by((message as { id: string }).id).get<StoredTicket>();
    if (!ticket) return;

    try {
        // highlight-next-line
        const result = await triage(context, ticket);
        const status = result.departmentConfidence >= ROUTING_CONFIDENCE ? 'open' : 'needs-routing';
        await tickets.by(ticket.id).set({ ...ticket, triage: result, status });
    } catch (error) {
        context.log().stack(`triage of ${ticket.id} failed: ${(error as Error).message}`).error();
        await tickets.by(ticket.id).set({ ...ticket, status: 'triage-failed' });
    }
});
```

```yaml title="intelligence.yml"
mqs:
  - name: DEFAULT
    type: memory
    use:
      - SupportService
```

`triage` is `null` until the model has answered; everything that reads it (`topicReport`, `queue`, `routeTicket`) now handles the `null`. The queue only carries the id; the ticket itself stays in `docs`. The confidence gate from chapter 21 moves along into the queue route.

The general queue from chapter 21 shows every ticket that isn't `open`, so `new` and `triage-failed` tickets appear there without further changes.

## A failed model call is a state, not an exception

Model calls fail: rate limits, timeouts, an outage at the provider. Retries help with short blips:

```yaml title="intelligence.yml"
  - name: triage
    provider: openai
    model: gpt-4.1-nano
    connection:
      apiKey: ${{ OPENAI_API_KEY }}
    defaults:
      temperature: 0
      maxTokens: 300
      # highlight-next-line
      timeoutMs: 20000
      # highlight-next-line
      retry: { attempts: 3, backoffMs: 1000 }
```

The same for `DEFAULT`. Retryable are rate limits (except an exhausted quota), timeouts, `5xx` and connection resets.

For longer ones, the ticket gets status `triage-failed` and lands in the general queue, where a person routes it. The customer never noticed. That's the question for every AI feature: **what does the feature do without an answer?**

## Run it

```sh
yarn step:23
curl -X POST localhost:3000/createTicket -H 'Content-Type: application/json' -d '{
  "email": "ada@example.com", "subject": "Brake pads", "body": "The pads from A-1042 do not fit."
}'
```

```json
{ "id": "5f0c…", "status": "new", "triage": null, … }
```

A moment later:

```sh
curl -X POST localhost:3000/getTicket -H 'Content-Type: application/json' -d '{"id":"5f0c…"}'
```

```json
{ "id": "5f0c…", "status": "open", "triage": { "department": "technical", "orderNumber": "A-1042", … } }
```

## Test it

```ts title="step.test.ts"
test('the ticket is stored right away and triaged from the queue', async () => {
    const created = await createTicket();
    assert.deepEqual([created.status, created.triage], ['new', null]);

    const triaged = await settled(created.id);   // polls getTicket until the status changes
    assert.equal(triaged.status, 'open');
});

test('a failing model leaves the ticket in the general queue', async () => {
    ScriptedAI.reset(triageScript({ department: new Error('provider unavailable') }));

    const failed = await settled((await createTicket()).id);

    assert.equal(failed.status, 'triage-failed');
});
```

## What you learned

- **Model calls are slow remote calls.** Keep them off the path where a person waits, unless the person is waiting *for* the answer.
- **Retries in `defaults`**, for every call to that AI.
- **Failure is a state.** Decide what the feature does without the model.

## Reviewer's view

> Tickets are stored immediately; triage runs from the `ticket-created` queue, with three retries. Tickets whose triage fails get status `triage-failed` and wait in the general queue.

The new question: who looks at `triage-failed` tickets? If nobody does, they're lost in a different way. The queue and the retry settings are YAML; the rest is the platform's `mq`, which a reviewer already knows.

[Sample: step 23](https://github.com/3flows/intelligence-samples/tree/main/support-desk/steps/23-dont-block) · Next: [See what it did](./see-what-it-did.md)
