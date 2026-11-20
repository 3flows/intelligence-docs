---
title: Collections
---

# Collections: the same work for many items

One ticket is a call. Five hundred tickets are a batch, and a batch has problems of its own: too many calls at once hit the provider's rate limit, one failure shouldn't lose the other 499 results, and when the caller gives up, the rest should stop.

`inference().collection(items)` runs work over many items with a limit, a retry per item and a result per item:

```ts
const results = await trigger.context.inference()
    .collection(tickets)
    .name('retriage')
    .concurrency(3)
    .retry({ attempts: 2, backoffMs: 500 })
    .map((ticket, _index, context) =>
        trigger.context.inference()
            .choice('department')
            .oneOf(departments)
            .instructions('Which team should handle this ticket?')
            .state({ subject: ticket.subject, body: ticket.body })
            .metadata(context.subject('ticket', ticket.id))
            .signal(context.signal)
            .decide()
    )
    .settled();
```

## Shaping

A collection is shaped like an array. Nothing runs before the terminal verb.

| Method | |
|---|---|
| `.map(fn)` | One result per item |
| `.filter(fn)` | Keep the items for which `fn` returns true |
| `.filterWith(run, keep)` | Run something per item (a `check`, say), and keep the item depending on its result |
| `.filterMap(fn)` | Map, and drop `null` and `undefined` |
| `.flatMap(fn)` | Several results per item |
| `.batch(n)` | Groups of `n`, for calls that take several items at once |

Every function gets the item, its index, and a **context**:

| | |
|---|---|
| `context.subject(type, id)` | Metadata for a call inside the function: links it to the item's subject and to this run of the collection |
| `context.metadata({…})` | The same, without a subject |
| `context.signal` | Aborted when the collection is cancelled: pass it to the calls inside |
| `context.attempt` | Which attempt this is |
| `context.collectionRunId` | The id all calls of this run share |

## Controlling

| Method | Default | |
|---|---|---|
| `.concurrency(n)` | `4` | How many items are in work at the same time |
| `.retry({ attempts, backoffMs, shouldRetry })` | no retry | Per item |
| `.signal(abortSignal)` | | Cancels what hasn't started |
| `.name(name)`, `.metadata({…})` | | For traces and records |

## Terminal verbs

| Verb | Resolves with | When an item fails |
|---|---|---|
| `.all()` | The values | Rejects |
| `.settled()` | One result per item: `{ status: 'fulfilled', value }` or `{ status: 'rejected', error, item }` | Never rejects for an item |
| `.reduce(initial, fn)` | One value | Rejects |

Use `settled()` whenever a partial result is worth having, which for model calls is almost always.

## What the work is

The function inside `map` is ordinary code. It can be one fluent call, as above, several, or a call to a service. The collection limits and retries *items*, whatever an item's work is: three items in work, each making five calls, are fifteen calls at once.

## Collection, workflow, or queue?

| | Use |
|---|---|
| The same work for many items, now, with a result at the end | a collection |
| One process with different steps | a [workflow](./workflows.md) |
| Work that arrives over time, or must survive a restart | a queue, with a handler or a workflow per message |

A collection runs inside the request that started it, in memory.

## Reviewer's view

A collection multiplies: cost, load on the provider, and the effect of a mistake. Check the limit, what a failed item leaves behind, and what happens to the results. A batch that writes its results back changes many records in one request.

The tutorial uses one in [Many at once](../tutorial/many-at-once.md).
