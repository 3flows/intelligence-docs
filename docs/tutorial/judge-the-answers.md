---
title: 18. Judge the answers
---

# 18. Judge the answers

**Where we are:** triage is measured and improved. The chat assistant isn't measured at all.

**The problem:** a department is right or wrong; you compare it with an expected value. A reply to a customer isn't. *"You can return unused items within 30 days of delivery"* and *"Returns are possible for 30 days"* are both right, and no string comparison will say so. How do we measure free text?

## The solution: the model as judge

We ask a model to review the answer against **written rules**, with the same capabilities as everywhere else: a `check` for yes or no, a `score` for a scale.

```ts title="judges.ts"
import { IntelligenceContext } from '../_shared/intelligence-service.js';

// Judges: the model reviewing an answer against written rules. The same judges run in evaluations and,
// from step 20, on every reply before it's sent.

export type Source = { title: string; text: string };

/** Is every statement of fact in the reply backed by the sources the assistant was given? */
export const grounded = (context: Pick<IntelligenceContext, 'inference'>, reply: string, sources: Source[]) =>
    context.inference()
        .check('grounded')
        .with({ reply, sources })
        .ask('Is every statement of fact in the reply supported by the sources? Greetings, questions to the customer and offers to hand over to a colleague need no support.');

/** How well does the reply follow the tone rules of support.reply? 1 to 5. */
export const tone = (context: Pick<IntelligenceContext, 'inference'>, reply: string) =>
    context.inference()
        .score('tone')
        .between(1, 5)
        .criteria(
            '1: long, vague, pushy, or it promises refunds, discounts or delivery dates',
            '3: acceptable, but could be shorter or more concrete',
            '5: brief, friendly and concrete, with no promises'
        )
        .with({ reply })
        .ask('How well does this support reply follow the rules?');
```

A judge only sees what it needs: `grounded` gets the reply and the sources the assistant had; `tone` gets only the reply. Judging with the full context would let the judge "know" things the assistant didn't have.

## An evaluation of the real chat path

Ten customer questions, each with the help center article that answers it, and one that no article answers:

```json title="evals/questions.json (excerpt)"
{ "id": "q02", "input": { "question": "How long does it take until I get my money back after a return?", "article": "returns" } },
{ "id": "q10", "input": { "question": "Do you have a shop in Berlin where I can test ride?", "article": null } }
```

The evaluation goes through the real feature: it creates a ticket, sends the question to `chat` over HTTP, and judges what comes back. Three expectations per answer:

```ts title="eval.ts (excerpt)"
const outcomes = await run(expectations, async ({ question, article }) => {
    const ticket = await post('http://127.0.0.1:3000/createTicket', { email: 'eval@example.com', subject: 'Question', body: question });
    const { answer, sources } = await post('http://127.0.0.1:3000/chat', { ticketId: ticket.id, message: question });
    const used = sources.map((id) => passages.get(id)).filter(Boolean);

    const [isGrounded, toneScore] = await Promise.all([grounded(context, answer, used), tone(context, answer)]);
    return {
        actual: {
            ...(article ? { retrieved: sources.some((id) => id.startsWith(`${article}#`)) } : {}),  // search found the article
            grounded: isGrounded.value,                                                            // answer backed by it
            goodTone: toneScore.value >= 4                                                          // answer follows the rules
        },
        reasons: { grounded: isGrounded.reason, goodTone: `${toneScore.value}/5 ${toneScore.reason}` }
    };
});
```

## Run it

```sh
LOCAL_MODEL=qwen/qwen3-coder-next yarn eval:18
```

```txt
Answer evaluation: 10 cases
  ai DEFAULT: qwen/qwen3-coder-next (LM Studio)
  ai reranker: scripted (no local equivalent)

  retrieved      100%    9/9
  grounded        90%    9/10
  goodTone        80%    8/10

  Mismatches:
  - q02 goodTone: expected true, got false
      3/5 … It states that a colleague will get back with details about the refund timeline …
  - q07 grounded: expected true, got false
      The reply claims that batteries lose up to 30% of their range below 5 °C … this exact statement
      is supported by the fourth source … However, the reply omits the important context …
  - q08 goodTone: expected true, got false
      2/5 … it incorrectly associates the error with "E-bike batteries" …
```

(Without a local reranker, the run used the scripted one. Retrieval still found the right article every time.)

## Judges need judging too

Read the three mismatches. They aren't the same kind:

- **q02 is a real finding.** The help center says refunds take 14 days; the assistant handed over to a colleague instead of answering. The tone judge caught it, for a slightly different reason. It's worth a look at the retrieval and the prompt.
- **q07 is a judge error.** The judge agrees that every statement is supported, then fails the answer for *leaving things out*. That's not what we asked, but the question didn't exclude it either.
- **q08 is a judge error as well.** Error 503 is described in the article titled *E-bike batteries*; the judge punished the reply for naming that article.

A judge is a model with a prompt, so it gets everything wrong that models get wrong. Before a judge becomes a gate (and in [chapter 20](./guard-the-output.md) `grounded` becomes one), read its reasons on a set of answers you've checked yourself. A judge that's too strict blocks good answers; one that's too lenient waves bad ones through. Chapter 20 sharpens `grounded` with exactly the lesson from q07.

## Test it

```ts title="step.test.ts"
test('grounded: the judge gets the reply and exactly the sources it may rely on', async () => {
    ScriptedAI.reset(() => ({ value: false, confidence: 0.9, reason: 'The 60-day period is not in the sources.' }));
    const sources = [{ title: 'Returns and refunds', text: 'You can return any unused item within 30 days of delivery.' }];

    const verdict = await grounded(context, 'You can return it within 60 days.', sources);

    assert.equal(verdict.value, false);
    assert.deepEqual(JSON.parse(String(ScriptedAI.requests[0].messages[0].content)).state.inputs[0],
        { reply: 'You can return it within 60 days.', sources });
});
```

## What you learned

- **Free text is measured by judges**: `check` and `score` against written rules.
- **Evaluate the real path**, end to end, and measure each stage: retrieval, grounding, tone.
- **Judges are models too.** Read their reasons before you trust them, and before you make them gates.

## Reviewer's view

> Two judges, `grounded` and `tone`, and an answer evaluation over ten questions: retrieval 100%, grounded 90%, tone 80%.

The judges' questions are policy, like any prompt. Review them for what they *don't* say: q07 failed because *"leaving things out is fine"* wasn't written down.

[Sample: step 18](https://github.com/3flows/intelligence-samples/tree/main/support-desk/steps/18-judge-the-answers) · Next: [Guard the input](./guard-the-input.md)
