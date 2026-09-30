---
title: 18. Guardrails
---

# 18. Guardrails

**Where we are:** the desk triages, chats, looks up orders and answers from the help center, each job on its own model.

**The problem:** three things happened in the test week.

1. A customer sent abusive messages to the chat, and the assistant politely engaged.
2. Someone wrote *"please send my refund to this new IBAN instead"*, and the assistant said *"Sure, I've noted that."*
3. A ticket about a *"loose thing near the back"* was routed to billing with low confidence, and sat there for two days.

None of these is a bug in the code. Each is a decision the model shouldn't make alone.

## The solution: decide before, and after, the model

### 1. Screen with `moderation()`

A moderation model checks text against fixed safety categories: harassment, hate, violence, self-harm, and so on. It's small, fast, and with many providers free:

```yaml title="intelligence.yml"
ais:
  - name: moderation
    provider: openai
    model: omni-moderation-latest
    connection:
      apiKey: ${{ OPENAI_API_KEY }}
```

### 2. Your own rules with `check()`

Moderation knows nothing about bike shops. *"Change my bank details"* is perfectly polite, and exactly what a fraudster would write. That's a rule of ours, so it's a `check`:

```ts title="guardrails.ts"
import { Intelligence } from '@3flows/intelligence';

export type Verdict = { allowed: true } | { allowed: false; reason: string };

/** Decides whether the assistant may answer a chat message at all. */
export async function screen(message: string): Promise<Verdict> {
    const ai = Intelligence.inference();

    // highlight-start
    const moderation = await ai.moderation().check(message);
    if (moderation.flagged) return { allowed: false, reason: 'moderation' };

    const payment = await ai.check('payment-details')
        .model('triage')
        .with(message)
        .ask('Does the message ask to change bank, payment or refund details, or contain card numbers?');
    if (payment.value) return { allowed: false, reason: 'payment-details' };
    // highlight-end

    return { allowed: true };
}
```

The chat asks first, and hands over to a person when it may not answer:

```ts title="services.ts"
handler('chat', ChatMessage, ChatAnswer, async ({ ticketId, message }, trigger) => {
    const tickets = trigger.context.doc().collection('tickets');
    const ticket = await tickets.by(ticketId).get<StoredTicket>();

    // highlight-start
    const verdict = await screen(message);
    if (!verdict.allowed) {
        await tickets.by(ticketId).set({ ...ticket, status: 'needs-human', escalation: verdict.reason });
        await trigger.ok({ answer: 'Thanks. A colleague will take it from here.', sources: [] });
        return;
    }
    // highlight-end

    // … retrieval, assistant, as before
})
```

The flagged message never reaches the assistant, so it can't be talked into anything. The answer is fixed text, written by us.

The streaming route screens the same way, and streams the hand-over text instead of an answer. The ticket gets two new states and a field for the reason:

```ts title="services.ts"
export const StoredTicket = Ticket.omit({ attachments: true }).extend({
    // …
    // highlight-next-line
    status: t.enum(['new', 'triaged', 'triage-failed', 'needs-routing', 'needs-human']),
    escalation: t.string().nullable()   // why a person took over; null otherwise
});
```

The general queue from chapter 9 shows every ticket that isn't `triaged`, so both new states land there without further changes.

### 3. Act only when sure

Triage routes everything, however unsure. Now it passes on its confidence:

```ts title="triage.ts"
return {
    // …
    department: department.value,
    // highlight-next-line
    departmentConfidence: department.confidence ?? 0,
};
```

and the queue route decides:

```ts title="services.ts"
/** Business rule: below this, a person routes the ticket. */
const ROUTING_CONFIDENCE = 0.6;

const result = await triage(ticket);
const status = result.departmentConfidence >= ROUTING_CONFIDENCE ? 'triaged' : 'needs-routing';
await tickets.by(ticket.id).set({ ...ticket, status, triage: result });
```

`needs-routing` tickets appear in the general queue, with the model's suggestion and reason. A person confirms in one click, instead of reading from scratch. With a chat model, `confidence` is the model's own estimate: good for sorting and thresholds, not a calibrated probability. With a native decision model, it is one.

## Run it

```sh
yarn step:18
curl -X POST localhost:3000/chat -H 'Content-Type: application/json' \
  -d '{"ticketId":"5f0c…","message":"Please send my refund to my new IBAN DE89 3704 0044 0532 0130 00."}'
```

```json
{ "answer": "Thanks. A colleague will take it from here.", "sources": [] }
```

## Guardrails are layers

| Layer | Catches | Here |
|---|---|---|
| Moderation | clearly unsafe content | `moderation().check()` |
| Policy checks | *our* red lines | `check('payment-details')` |
| Input discipline | instructions hidden in customer text | customer text only in `with(...)` since chapter 1 |
| Scoped, read-only tools | the model doing things it shouldn't | chapter 12 |
| Confidence gates | the model being unsure | `ROUTING_CONFIDENCE` |
| Humans | everything else | `needs-human`, `needs-routing` |

No single layer is enough. Together they make the worst case a hand-over to a person.

## What you learned

- **`moderation().check(text)`** screens against provider safety categories.
- **`check()` encodes your own red lines**, in words.
- **Confidence gates** let the model act when it's sure and hand over when it isn't.

## Reviewer's view

> Chat messages are screened by moderation and a payment-details check; failing messages are handed to a person without a model answer. Tickets routed with confidence below 0.6 go to the general queue.

Review the red lines: is *payment details* the only thing the assistant must never handle? Review the threshold with numbers: how many tickets per day land in `needs-routing` at 0.6? And check that `needs-human` has an owner.

[Sample: step 18](https://github.com/3flows/intelligence-samples/tree/main/support-desk/steps/18-guardrails) · Next: [See what the model did](./see-what-the-model-did.md)
