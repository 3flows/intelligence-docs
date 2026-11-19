---
title: 25. Going live
---

# 25. Going live

**Where we are:** everything works, on memory providers.

**The problem:** memory providers lose tickets, chats, vectors and queued work on every restart, and share nothing between two instances. And a few things that were fine for a demo aren't fine with real customers: who may call the API, and how long do we keep what customers wrote?

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

Chats are documents and inference runs are entities on `docs`, so both move to MongoDB with it. `dimensions` must match the embedding model: changing the model means re-importing the help center.

### The startup validation

Since chapter 1, the log has shown a few warnings at every start, like `ai-timeout-missing: AI embeddings has no default timeoutMs`. Intelligence validates its configuration when it starts: AIs without a timeout, prompts without a version, references to AIs that don't exist, keys written into the YAML. In development, those are warnings.

Going live is the moment to clear them. The three small AIs get the timeout they were missing, in both files:

```yaml title="intelligence.yml"
  - name: embeddings
    provider: openai
    model: text-embedding-3-small
    connection:
      apiKey: ${{ OPENAI_API_KEY }}
    # highlight-start
    defaults:
      timeoutMs: 10000
    # highlight-end
```

And in production, a finding is no longer a warning:

```yaml title="intelligence.production.yml"
# In production, a finding of the startup validation stops the start instead of printing a warning.
intelligence:
  strict: true
```

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
    assert.deepEqual(production.entities, development.entities);
});

test('both configurations pass the startup validation without a finding, production in strict mode', async () => {
    for (const file of ['intelligence.yml', 'intelligence.production.yml']) {
        const configuration = Configuration.parse(await readFile(`./steps/25-going-live/${file}`, 'utf8'));
        assert.deepEqual(validateIntelligenceConfiguration(configuration), []);
    }
    assert.equal((await yaml('intelligence.production.yml')).intelligence.strict, true);
});
```

The prompts and models that were evaluated in Part 5 are exactly the ones that run in production.

## Retention

The desk stores what customers typed in two places: the **chat** of a ticket, and the **trace records** of the model calls made for it, which keep the inputs and outputs of each call. Both are personal data, with a retention period. The simplest rule that works: **when a ticket is closed, both go.**

```ts title="services.ts"
/** Retention for the trace domain: the runs made for a subject, with their calls and the inputs and outputs recorded for them. */
async function forgetCallsOf(subjectType: string, subjectId: string): Promise<void> {
    const { InferenceRun, ModelCall, InferenceArtifact, ToolExecution } = IntelligenceTraceDomain;
    for (const run of await InferenceRun.find({ subjectType, subjectId }).limit(0).all()) {
        const of = { run: run.reference() };
        const records = [
            ...(await ToolExecution.find(of).limit(0).all()),
            ...(await InferenceArtifact.find(of).limit(0).all()),
            ...(await ModelCall.find(of).limit(0).all())
        ];
        for (const record of records) await record.delete();
        await run.delete();
    }
}

// Retention: when a ticket is closed, what the customer wrote goes: the chat, and what was recorded of the model calls.
handler('closeTicket', t.object({ ticketId: t.string() }), t.object({ closed: t.boolean() }), async ({ ticketId }, trigger) => {
    const { doc } = trigger.context;
    const ticket = await doc().collection('tickets').by(ticketId).get<StoredTicket>();
    if (!ticket) return trigger.notFound(`Ticket ${ticketId} not found`);

    // highlight-start
    await doc().collection('chats').by(ticketId).remove();
    await forgetCallsOf('ticket', ticketId);
    // highlight-end
    await trigger.ok({ closed: true });
})
```

The `subjectType` and `subjectId` from [chapter 24](./see-what-it-did.md) pay off a second time: what was tagged with the ticket can be found, and deleted, with the ticket. Traces in the tracing backend have their own retention; set it there.

## The checklist

| | Where |
|---|---|
| Durable providers for `docs`, `blobs`, `vectors`, `mqs` | `intelligence.production.yml` |
| Prompts and models identical to the evaluated ones | the parity test |
| No findings in the startup validation, and `strict` in production | the validation test |
| Keys from the environment, never in YAML | `${{ … }}` |
| Authentication on the API: customers may only reach their own tickets | the platform's `https` `auth` and identity providers |
| Retention of chats and trace records | `closeTicket` |
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
test('closing a ticket deletes its chat and the records of its model calls', async () => {
    const { id } = await createTicket();
    await settled(id);
    await post('http://127.0.0.1:3000/chat', { ticketId: id, message: 'Thanks!' });
    assert.equal((await post('http://127.0.0.1:3000/transcript', { ticketId: id })).length, 2);
    assert.ok((await post('http://127.0.0.1:3000/ticketUsage', { ticketId: id })).calls > 0);

    await post('http://127.0.0.1:3000/closeTicket', { ticketId: id });

    assert.deepEqual(await post('http://127.0.0.1:3000/transcript', { ticketId: id }), []);
    assert.equal((await post('http://127.0.0.1:3000/ticketUsage', { ticketId: id })).calls, 0);
});
```

## What you learned

- **Production is a YAML file**, with the same code.
- **A parity test** keeps the evaluated prompts and models identical in production.
- **`intelligence.strict: true`** turns the startup validation's warnings into errors.
- **Retention is a feature**: closing a ticket deletes its chat and the trace records tagged with it.

## Reviewer's view

> A production configuration on MongoDB, Azure Blob Storage and RabbitMQ, identical in services, prompts and AIs; chats and trace records are deleted when a ticket closes.

Go through the checklist. The two items no configuration solves: which vendors may receive customer data, and who owns the general queue.

[Sample: step 25](https://github.com/3flows/intelligence-samples/tree/main/support-desk/steps/25-going-live) · Next: [A chatbot](./a-chatbot.md)
