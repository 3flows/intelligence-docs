---
title: 9. Triage in the background
---

# 9. Triage in the background

**Where we are:** `createTicket` stores a fully triaged ticket.

**The problem:** creating a ticket takes several seconds, because five model calls run before the customer sees *"Thanks, we got your message."* And when the provider has a hiccup, the customer's ticket is lost with an error.

## The solution: store first, triage from a queue

The customer only needs the ticket to be **received**. Triage can happen a moment later. That's the platform's [`mq`](https://3flows.github.io/platform-docs/docs/tutorial/dont-block-booking), unchanged:

```ts title="services.ts"
export const StoredTicket = Ticket.extend({
    id: t.string(),
    // highlight-next-line
    status: t.enum(['new', 'triaged', 'triage-failed']),
    triage: Triage.nullable()
});

handler('createTicket', Ticket, StoredTicket, async (ticket, trigger) => {
    const { doc, mq } = trigger.context;
    const stored: StoredTicket = { id: randomUUID(), ...ticket, status: 'new', triage: null };

    await doc().collection('tickets').by(stored.id).set(stored);
    // highlight-next-line
    await mq().queue('ticket-created').send({ id: stored.id });
    await trigger.ok(stored);
})
```

```ts title="services.ts"
routes(): Route {
    const route = super.routes();
    route.mq().queue('ticket-created').do(async (message, trigger) => {
        const { doc, log } = trigger.context;
        const tickets = doc().collection('tickets');
        const ticket = await tickets.by((message as { id: string }).id).get<StoredTicket>();
        if (!ticket) return;

        try {
            // highlight-next-line
            await tickets.by(ticket.id).set({ ...ticket, status: 'triaged', triage: await triage(ticket) });
        } catch (error) {
            log().stack(`triage of ${ticket.id} failed: ${(error as Error).message}`).error();
            await tickets.by(ticket.id).set({ ...ticket, status: 'triage-failed' });
        }
    });
    return route;
}
```

```yaml title="intelligence.yml"
mqs:
  - name: DEFAULT
    type: memory
    use:
      - SupportService
```

The triage fields move under `triage`, which is `null` until the model has answered. The queue only carries the id; the ticket itself stays in `docs`.

The agents' queue follows the new shape. Untriaged tickets don't have a department yet; they wait in the general queue, which a person works through:

```ts title="services.ts"
handler('queue', t.object({ department: Department }), t.array(StoredTicket), async ({ department }, trigger) => {
    const tickets = await trigger.context.doc().collection('tickets')
        // highlight-next-line
        .find({ status: 'triaged', 'triage.department': department })
        .all<StoredTicket>();
    await trigger.ok(tickets.sort((a, b) => Number(b.triage?.priority === 'high') - Number(a.triage?.priority === 'high')));
}),

handler('generalQueue', t.object({}).optional(), t.array(StoredTicket), async (_input, trigger) => {
    await trigger.ok(await trigger.context.doc().collection('tickets').find({ status: { $ne: 'triaged' } }).all<StoredTicket>());
})
```

## A failed model call is a state, not an exception

Model calls fail: rate limits, timeouts, an outage at the provider. Retries help with short blips:

```yaml title="intelligence.yml"
ais:
  - name: DEFAULT
    provider: openai
    model: gpt-4.1-mini
    connection:
      apiKey: ${{ OPENAI_API_KEY }}
    # highlight-start
    defaults:
      timeoutMs: 20000
      retry:
        attempts: 3
        backoffMs: 1000
    # highlight-end
```

For longer ones, the ticket gets status `triage-failed` and lands in the general queue, where a person routes it. The customer never noticed. That's the question for every AI feature: **what does the feature do without an answer?**

## Run it

```sh
yarn step:09
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
{ "id": "5f0c…", "status": "triaged", "triage": { "department": "technical", "orderNumber": "A-1042", … } }
```

## What you learned

- **Model calls are slow remote calls.** Keep them off the path where a person waits, unless the person is waiting *for* the answer.
- **Retries in `defaults`**, for every call to that AI.
- **Failure is a state.** Decide what the feature does without the model.

## Reviewer's view

> Tickets are stored immediately; triage runs from the `ticket-created` queue, with three retries. Tickets whose triage fails get status `triage-failed`.

The new question: who looks at `triage-failed` tickets? If nobody does, they're lost in a different way. The queue and the retry settings are YAML; the rest is the platform's `mq`, which a reviewer already knows.

[Sample: step 09](https://github.com/3flows/intelligence-samples/tree/main/support-desk/steps/09-background-triage) · Next: [Remember the conversation](./remember-the-conversation.md)
