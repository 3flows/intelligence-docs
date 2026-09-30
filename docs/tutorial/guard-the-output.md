---
title: 20. Guard the output
---

# 20. Guard the output

**Where we are:** messages are screened before they reach the assistant.

**The problem:** the assistant itself can still say the wrong thing. The prompt says *never promise refunds or delivery dates*, and almost always it doesn't. Almost. And the answer evaluation found replies that weren't fully backed by the help center. Instructions reduce these; they can't rule them out.

## The solution: review every reply before it's sent

The judges from [chapter 18](./judge-the-answers.md) measured answers after the fact. The same kind of judge can **gate** each reply:

```ts title="guardrails.ts"
import { Source, grounded } from './judges.js';

/** After the model: may the customer see this reply? */
export async function review(context: Pick<IntelligenceContext, 'inference'>, reply: string, sources: Source[]): Promise<Verdict> {
    const [promises, isGrounded] = await Promise.all([
        context.inference()
            .check('promises')
            .with({ reply })
            .ask('Does the reply promise a refund, a discount, a replacement or a delivery date?'),
        grounded(context, reply, sources)
    ]);
    if (promises.value) return { allowed: false, reason: 'reply-promises' };
    if (!isGrounded.value) return { allowed: false, reason: 'reply-not-grounded' };
    return { allowed: true };
}
```

```ts title="services.ts"
const answer = await assistant(trigger.context, ticket)
    .tools(ordersOf(ticket, trigger.context))
    .with({ articles })
    .ask(message);

// highlight-start
// After the model: the reply is checked before the customer sees it.
const checked = await review(trigger.context, answer.text ?? '', articles);
if (!checked.allowed) {
    await tickets.by(ticketId).set({ ...ticket, status: 'needs-human', escalation: checked.reason });
    return trigger.ok({ answer: HANDOVER, sources: [] });
}
// highlight-end

await trigger.ok({ answer: answer.text ?? '', sources: articles.map((article) => article.id) });
```

A reply that fails the review isn't sent. The customer gets the hand-over; a person gets the ticket, and the reason.

## A gate must not be too strict

In chapter 18, `grounded` failed a correct answer for *leaving things out*. As a measurement, that was a wrong number. As a gate, it would be a good reply the customer never sees, and a ticket for a person that didn't need one. So before it becomes a gate, the judge's question gets the missing sentence:

```ts title="judges.ts"
// Sharpened after step 18's evaluation: the judge had punished replies for leaving things out.
.ask('Is every statement of fact in the reply supported by the sources? Leaving out information is fine. Greetings, questions to the customer and offers to hand over to a colleague need no support.');
```

Run `yarn eval:18` against the new judge before you rely on it. Every gate trades two errors against each other: letting a bad reply through, and stopping a good one. The evaluation tells you where you are.

## Output guards and streaming

A streamed reply is on the customer's screen before anyone could review it. So `/chat/stream` screens the input, but can't review the output:

```ts title="services.ts"
// The same assistant, streamed: the text is sent while it's generated.
// A streamed reply can't be reviewed before it's sent: stream only where that's acceptable.
```

Stream where a wrong sentence is cheap: drafts for agents, answers without policy. Use `chat` with the review where it isn't.

## Cost and latency

The review adds two calls per turn, in parallel: the reply takes a second longer and costs a bit more. [Chapter 22](./the-right-model-for-each-job.md) moves the checks to a small, fast model.

## Test it

```ts title="step.test.ts"
test('a reply that promises a refund is replaced by the hand-over', async () => {
    const { id } = await createTicket();
    ScriptedAI.reset(triageScript({ ...safe, promises: { value: true, confidence: 0.9, reason: 'Promises a refund by Friday.' } }, 'You will get your refund by Friday!'));

    const { answer } = await chat(id, 'When do I get my money?');

    assert.equal(answer, 'Thanks. A colleague will take it from here.');
    assert.equal((await getTicket(id)).escalation, 'reply-promises');
});

test('an ungrounded reply is replaced too, and the judge saw the reply and the sources', async () => { /* … */ });
```

## What you learned

- **Review before sending**: a `check` for your rules, a judge for grounding.
- **A gate is a judge with consequences**: evaluate it first, and make it only as strict as it has to be.
- **Streaming and output review don't mix.** Choose per use.

## Reviewer's view

> Every chat reply is checked for promises and grounding before it's sent; failing replies are replaced by the hand-over and the ticket goes to a person.

Ask for the numbers: how many good replies does the gate stop? `yarn eval:18` with the gate's judges answers that. And check the escalation reasons in production: a spike in `reply-not-grounded` usually means the help center is missing an article.

[Sample: step 20](https://github.com/3flows/intelligence-samples/tree/main/support-desk/steps/20-guard-the-output) · Next: [Humans in the loop](./humans-in-the-loop.md)
