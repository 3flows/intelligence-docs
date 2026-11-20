---
title: 32. Many at once
---

# 32. Many at once

**Where we are:** every new ticket goes through the intake, one at a time, as it arrives.

**The problem:** in [chapter 17](./improve-with-evidence.md), the routing policy changed: placed orders now belong to billing. New tickets follow the new policy. The few hundred tickets already in the queues were routed by the old one, and some of them now sit with the wrong team. Somebody has to triage them all again.

A loop with `await` takes an hour. `Promise.all` over five hundred tickets starts 2,500 model calls at once, runs into the provider's rate limit, and one failure rejects everything.

## The solution: `collection()`

`inference().collection(items)` runs the same work over many items, with the three things a batch needs: a limit on how much runs at once, a retry per item, and a result for every item.

```ts title="services.ts"
/** What a retriage of all tickets did: how many, which moved to another team, and which failed. */
export const Retriage = t.object({
    total: t.number(),
    moved: t.array(t.object({ id: t.string(), from: Department.nullable(), to: Department })),
    failed: t.array(t.string())
});
export type Retriage = t.infer<typeof Retriage>;

// After a change to the triage policy: triage every routed ticket again, a few at a time, and say what changed.
handler('retriage', t.object({}).optional(), Retriage, async (_input, trigger) => {
    const { doc, inference } = trigger.context;
    const tickets = await doc().collection('tickets').find({ status: { $in: ['open', 'needs-routing'] } }).all<StoredTicket>();

    // highlight-start
    const results = await inference()
        .collection(tickets)
        .name('retriage')
        .concurrency(3)              // at most three tickets at the same time
        .retry({ attempts: 2 })      // a ticket whose triage fails gets a second attempt
        .map(async (ticket) => ({ ticket, triage: await triage(trigger.context, ticket) }))
        .settled();                  // every ticket gets a result: fulfilled or rejected
    // highlight-end

    const report: Retriage = { total: tickets.length, moved: [], failed: [] };
    for (const result of results) {
        if (result.status === 'rejected') {
            report.failed.push((result.item as StoredTicket).id);
            continue;
        }
        const { ticket, triage: next } = result.value;
        if (next.department !== ticket.triage?.department) report.moved.push({ id: ticket.id, from: ticket.triage?.department ?? null, to: next.department });
        await doc().collection('tickets').by(ticket.id).set({ ...ticket, triage: next, status: statusAfterTriage(next) });
    }
    await trigger.ok(report);
}),
```

- **`collection(tickets)`** starts with the items. Nothing runs yet.
- **`concurrency(3)`** is the limit. Three tickets are in work at any time; the fourth starts when one is done. Each ticket's triage makes five calls, so that's up to fifteen calls at once. The default is 4.
- **`retry({ attempts: 2 })`** is per item. One ticket's second attempt doesn't repeat the others.
- **`map(fn)`** is the work: the same `triage()` as in the intake. The collection doesn't care what happens inside; it can be one call, several, or none.
- **`settled()`** is the terminal verb that never throws for an item. It returns one result per ticket, `fulfilled` with the value or `rejected` with the error and the item.

The meaning of the text is the model's; what happens with it is ours, as in [chapter 8](./meaning-and-action.md): the handler compares, stores, and reports which tickets moved.

### The other verbs

| | |
|---|---|
| `.all()` | The values. Rejects when an item fails |
| `.settled()` | A result per item, never rejects for an item |
| `.reduce(initial, fn)` | One value from all of them |

Before the verb, a collection can be shaped like an array:

| | |
|---|---|
| `.map(fn)` | One result per item |
| `.filter(fn)`, `.filterWith(run, keep)` | Keep some items. `filterWith` runs a call per item, and decides with its result |
| `.flatMap(fn)`, `.filterMap(fn)` | Several results per item, or none |
| `.batch(n)` | Groups of `n` items, for calls that take several at once, like embeddings |
| `.signal(abortSignal)` | Stops what hasn't started when the caller gives up |
| `.metadata({…})`, `.name(…)` | Tags every item's calls with the same run of the collection |

The third argument of every function is the item's context. `context.subject('ticket', ticket.id)` gives metadata for a call inside it, so each item's calls are linked to their ticket **and** to this run of the collection.

## Collection, workflow, or queue?

| | Use |
|---|---|
| The same work for many items, now, with a result at the end | a collection |
| One process with different steps | a [workflow](./workflows.md) |
| Work that arrives over time, and must survive a restart | a queue, as in [chapter 23](./dont-block.md) |

A collection runs in the request that started it. For five hundred tickets that's fine. For fifty thousand, put the ticket ids on a queue, and let the intake workflow do each one.

## Run it

```sh
yarn step:32
curl -X POST localhost:3000/retriage
```

```json
{ "total": 5, "moved": [{ "id": "5f0c…", "from": "technical", "to": "billing" }], "failed": ["81ab…"] }
```

## Test it

```ts title="step.test.ts"
/** The new policy: invoices go to billing. One ticket breaks the model every time. */
const newPolicy = (request: AIChatRequest) => {
    const text = JSON.stringify(request.messages);
    if (request.responseSchemaName === 'department') {
        if (text.includes('Broken')) throw new Error('provider unavailable');
        if (text.includes('Invoice')) return { value: 'billing', confidence: 0.9, reason: 'Asks for an invoice.' };
    }
    return triageScript()(request);
};

test('every ticket is triaged again; the report says which moved and which failed', async () => {
    ScriptedAI.reset(newPolicy);

    const report = await post(`${API}/retriage`);

    assert.equal(report.total, 5);
    assert.deepEqual(report.failed, [ids['Broken message']]);
    // … the two invoice tickets moved from technical to billing
});

test('one failing ticket does not stop the others, and it got its second attempt', async () => {
    ScriptedAI.reset(newPolicy);
    await post(`${API}/retriage`);

    const broken = ScriptedAI.requests.filter((request) => request.responseSchemaName === 'department' && JSON.stringify(request.messages).includes('Broken'));
    // highlight-next-line
    assert.equal(broken.length, 2);
    assert.equal((await post(`${API}/getTicket`, { id: ids['Broken message'] })).triage.department, 'technical');   // unchanged
});
```

## What you learned

- **`inference().collection(items)`** runs work over many items with **`concurrency`**, a **`retry`** per item, and cancellation.
- **`settled()`** returns a result for every item; **`all()`** returns the values or fails.
- **The work inside `map` is ordinary code**: one call, the whole triage, or a service.
- **A collection is for now; a queue is for later.**

## Reviewer's view

> `retriage` triages all routed tickets again, three at a time, and reports which moved to another team and which failed.

This is a bulk change to live data, started by one request. Who may call it? What does it cost: tickets times five calls? And it changes routing without a person in between: after a policy change, run the evaluation of [chapter 16](./measure.md) first, and look at the `moved` list before the teams do.

[Sample: step 32](https://github.com/3flows/intelligence-samples/tree/main/support-desk/steps/32-many-at-once) · Next: [What's next](./whats-next.md)
