---
title: 19. Guard the input
---

# 19. Guard the input

**Where we are:** the desk is measured: triage and answers have numbers.

**The problem:** two messages from the test week.

1. A customer sent abusive messages to the chat, and the assistant politely engaged.
2. Someone wrote *"please send my refund to this new IBAN instead"*, and the assistant said *"Sure, I've noted that."*

Neither is a quality problem an evaluation would find. Both are decisions the model shouldn't be making at all.

## The solution: decide before the model

Some messages must not reach the assistant. A small screen runs first, and hands those to a person:

```ts title="guardrails.ts"
import { IntelligenceContext } from '../_shared/intelligence-service.js';

/** What the customer reads when the assistant may not answer. Written by us, not by a model. */
export const HANDOVER = 'Thanks. A colleague will take it from here.';

export type Verdict = { allowed: true } | { allowed: false; reason: string };

/** Before the model: may the assistant answer this message at all? */
export async function screen(context: Pick<IntelligenceContext, 'inference'>, message: string): Promise<Verdict> {
    const ai = context.inference();

    // highlight-start
    // The provider's safety categories: abuse, hate, violence, self-harm, …
    const moderation = await ai.moderation().check(message);
    if (moderation.flagged) return { allowed: false, reason: 'moderation' };

    // Our own red line: payment details are handled by people only.
    const payment = await ai.check('payment-details')
        .with(message)
        .ask('Does the message ask to change bank, payment or refund details, or contain card numbers?');
    if (payment.value) return { allowed: false, reason: 'payment-details' };
    // highlight-end

    return { allowed: true };
}
```

Two layers, for two kinds of rules:

| | `moderation()` | `check('payment-details')` |
|---|---|---|
| Policy | the provider's, fixed categories | ours, in words |
| Model | small, dedicated, often free | any chat model |
| Catches | clearly unsafe content | polite messages that cross *our* line |

*"Change my bank details"* is perfectly polite, and exactly what a fraudster would write. Moderation can't know that it matters to a bike shop; a `check` can.

```yaml title="intelligence.yml"
ais:
  # Moderation: the provider's safety screen, small and fast.
  - name: moderation
    provider: openai
    model: omni-moderation-latest
    connection:
      apiKey: ${{ OPENAI_API_KEY }}
```

## Hand over, with a reason

The chat screens first. When the assistant may not answer, the customer gets a fixed text, written by us, and the ticket gets a person:

```ts title="services.ts"
handler('chat', ChatMessage, ChatAnswer, async ({ ticketId, message }, trigger) => {
    const tickets = trigger.context.doc().collection('tickets');
    const ticket = await tickets.by(ticketId).get<StoredTicket>();
    if (!ticket) return trigger.notFound(`Ticket ${ticketId} not found`);

    // highlight-start
    // Before the model: some messages must not reach the assistant at all.
    const verdict = await screen(trigger.context, message);
    if (!verdict.allowed) {
        await tickets.by(ticketId).set({ ...ticket, status: 'needs-human', escalation: verdict.reason });
        return trigger.ok({ answer: HANDOVER, sources: [] });
    }
    // highlight-end

    // … retrieval and the assistant, as before
})
```

The ticket gets a status and a reason:

```ts title="services.ts"
export const StoredTicket = Ticket.omit({ attachments: true }).extend({
    // …
    status: t.enum(['open', 'needs-human']),
    escalation: t.string().nullable()      // why a person took over; null otherwise
});
```

The flagged message never reaches the assistant, so it can't be talked into anything. The streaming route screens the same way, and streams the hand-over text instead of an answer.

## Run it

```sh
yarn step:19
curl -X POST localhost:3000/chat -H 'Content-Type: application/json' \
  -d '{"ticketId":"5f0c…","message":"Please send my refund to my new IBAN DE89 3704 0044 0532 0130 00."}'
```

```json
{ "answer": "Thanks. A colleague will take it from here.", "sources": [] }
```

## Test it

```ts title="step.test.ts"
test('a flagged message never reaches the assistant', async () => {
    const { id } = await createTicket();
    ScriptedAI.flagged = (text) => text.includes('idiots');
    ScriptedAI.requests = [];

    const { answer } = await chat(id, 'You idiots!');

    assert.equal(answer, 'Thanks. A colleague will take it from here.');
    assert.equal(ScriptedAI.requests.length, 0);
    assert.deepEqual([(await getTicket(id)).status, (await getTicket(id)).escalation], ['needs-human', 'moderation']);
});

test('payment details are handed to a person, the assistant never answers', async () => {
    const { id } = await createTicket();
    ScriptedAI.reset(triageScript({ ...safe, 'payment-details': { value: true, confidence: 0.95, reason: 'Asks to change the IBAN.' } }, 'Sure, noted!'));

    await chat(id, 'Please send my refund to my new IBAN DE89 3704 0044 0532 0130 00.');

    assert.deepEqual(ScriptedAI.requests.map((r) => r.responseSchemaName), ['payment-details']);   // no reply was generated
});
```

## Input guardrails are layers

| Layer | Since | Catches |
|---|---|---|
| Customer text only as input | chapter 2 | instructions hidden in customer text |
| Tools scoped to the customer | chapter 11 | the model reaching other customers' data |
| Moderation | here | clearly unsafe content |
| Policy checks | here | *our* red lines |

No single layer is enough; together they make the worst case a hand-over to a person.

## What you learned

- **`moderation().check(text)`** screens against the provider's safety categories.
- **`check()` encodes your own red lines**, in words.
- **Some messages get no model answer at all**: a fixed hand-over and a person.

## Reviewer's view

> Chat messages are screened by moderation and a payment-details check; failing messages get a fixed answer and status `needs-human`.

Review the red lines: is *payment details* the only thing the assistant must never handle? Legal threats, data deletion requests and complaints about staff are candidates. And check that `needs-human` has an owner, which is [chapter 21](./humans-in-the-loop.md).

[Sample: step 19](https://github.com/3flows/intelligence-samples/tree/main/support-desk/steps/19-guard-the-input) · Next: [Guard the output](./guard-the-output.md)
