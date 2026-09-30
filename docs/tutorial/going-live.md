---
title: 25. Going live
---

# 25. Going live

**Where we are:** everything works, on memory providers.

**The problem:** memory providers lose tickets, conversations, vectors and queued work on every restart, and share nothing between two instances. And a few things that were fine for a demo aren't fine with real customers: who may call the API, and how long do we keep what customers wrote?

## The solution: a production YAML, and a test that keeps it honest

The code doesn't change. The production configuration names durable providers for the same sections:

```yaml title="intelligence.production.yml (excerpt)"
# Production: the same services, prompts and AIs as intelligence.yml; durable providers underneath.
# The parity test in step.test.ts fails if the two drift apart.

docs:
  - name: DEFAULT
    type: mongo
    parameters:
      connectionString: ${{ MONGO_URL }}

blobs:
  - name: DEFAULT
    type: azure
    parameters:
      connectionString: ${{ AZURE_STORAGE_CONNECTION_STRING }}

vectors:
  - name: DEFAULT
    type: mongo
    parameters:
      connectionString: ${{ MONGO_URL }}
      database: support-desk
      dimensions: 1536        # text-embedding-3-small

mqs:
  - name: DEFAULT
    type: rabbitmq
    parameters:
      connectionString: ${{ AMQP_URL }}

tracers:
  - name: DEFAULT
    enabled: true
    provider: mlflow
    # …
```

Conversations and inference runs are entities on `docs`, so they move to MongoDB with it. `dimensions` must match the embedding model: changing the model means re-importing the help center.

### Two YAML files, one truth

Two files drift. A prompt fixed in development and forgotten in production is a behavior difference nobody sees in review. A test prevents it:

```ts title="step.test.ts"
test('production runs the same services, prompts and AIs, on durable providers', async () => {
    const [development, production] = await Promise.all([yaml('intelligence.yml'), yaml('intelligence.production.yml')]);

    const names = (list: any[]) => list.map((item) => item.name);
    assert.deepEqual(names(production.services), names(development.services));
    // highlight-start
    assert.deepEqual(production.prompts, development.prompts);
    assert.deepEqual(production.ais, development.ais);
    // highlight-end
    assert.deepEqual([production.docs[0].type, production.vectors[0].type, production.blobs[0].type, production.mqs[0].type],
        ['mongo', 'mongo', 'azure', 'rabbitmq']);
});
```

The prompts and models that were evaluated in Part 5 are exactly the ones that run in production.

## Retention

A conversation stores what customers typed: personal data, with a retention period. The simplest rule that works: **when a ticket is closed, its conversation goes.**

```ts title="services.ts"
// Retention: a closed ticket's conversation is deleted, with its turns, messages, tool calls and runs.
handler('closeTicket', t.object({ ticketId: t.string() }), t.object({ closed: t.boolean() }), async ({ ticketId }, trigger) => {
    const { doc, conversations } = trigger.context;
    const ticket = await doc().collection('tickets').by(ticketId).get<StoredTicket>();
    if (!ticket) return trigger.notFound(`Ticket ${ticketId} not found`);

    // highlight-next-line
    await conversations().conversation(`ticket-${ticketId}`).clear();
    await trigger.ok({ closed: true });
})
```

`clear()` deletes the history and, with the entity store, the conversation's turns, messages, tool calls, attachment records and inference runs. Traces in the tracing backend have their own retention; set it there.

## The checklist

| | Where |
|---|---|
| Durable providers for `docs`, `blobs`, `vectors`, `mqs` | `intelligence.production.yml` |
| Prompts and models identical to the evaluated ones | the parity test |
| Keys from the environment, never in YAML | `${{ … }}` |
| Authentication on the API: customers may only reach their own tickets | the platform's `https` `auth` and identity providers |
| Retention of conversations | `closeTicket` |
| Retention and access control of traces | the tracing backend |
| Which vendors receive customer data | the `ais` section: OpenAI, Jina, and the moderation provider |
| An evaluation run with the production models | `yarn eval:17`, `yarn eval:18` with production keys |
| Someone who owns `generalQueue` | the team |

## Run it

```sh
yarn step:25                                                # development, memory providers
export MONGO_URL=… AZURE_STORAGE_CONNECTION_STRING=… AMQP_URL=… OPENAI_API_KEY=… JINA_API_KEY=…
node dist/steps/25-going-live/main.production.js            # production
```

## Test it

```ts title="step.test.ts"
test('closing a ticket deletes its conversation', async () => {
    const { id } = await createTicket();
    await settled(id);
    await post('http://127.0.0.1:3000/chat', { ticketId: id, message: 'Thanks!' });

    await post('http://127.0.0.1:3000/closeTicket', { ticketId: id });

    assert.equal((await ConversationMessageEntity.find({ conversationKey: `ticket-${id}` }).all()).length, 0);
});
```

## What you learned

- **Production is a YAML file**, with the same code.
- **A parity test** keeps the evaluated prompts and models identical in production.
- **Retention is a feature**: closing a ticket clears its conversation.

## Reviewer's view

> A production configuration on MongoDB, Azure Blob Storage and RabbitMQ, identical in services, prompts and AIs; conversations are deleted when a ticket closes.

Go through the checklist. The two items no configuration solves: which vendors may receive customer data, and who owns the general queue.

[Sample: step 25](https://github.com/3flows/intelligence-samples/tree/main/support-desk/steps/25-going-live) · Next: [What's next](./whats-next.md)
