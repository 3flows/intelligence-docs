---
title: 16. Measure before you improve
---

# 16. Measure before you improve

**Where we are:** a complete desk. Tickets are triaged, customers chat with an assistant that looks up orders and answers from the help center. Every step is tested.

**The problem:** the tests prove that our code sends the right things and handles the answers. They say nothing about whether the answers are *right*. How often does the desk route a ticket to the wrong team? Nobody knows. And without knowing, every prompt change is a guess.

## Tests and evaluations

| | Tests | Evaluations |
|---|---|---|
| **Check** | our code | the model's quality, with our prompts |
| **Model** | scripted | real |
| **Result** | pass or fail | a number: how often it's right |
| **Run** | on every commit, `yarn test` | deliberately: after a prompt, model or provider change |

An evaluation is simple: **real cases, the answer a human gave, and a count of how often the model agrees.**

## The solution: an evaluation set

Thirty tickets that look like the ones Velo receives, each with what the team decided:

```json title="evals/tickets.json (excerpt)"
{
  "cases": [
    { "id": "t03", "input": { "subject": "Where is my bike?", "body": "Order A-2003 was supposed to arrive last week. The tracking link hasn't changed in 6 days." },
      "expected": { "department": "billing", "urgent": false, "orderNumber": "A-2003" } },
    { "id": "t11", "input": { "subject": "Frame cracked", "body": "There's a crack in the frame near the bottom bracket. The bike is 2 years old. Is that covered by warranty?" },
      "expected": { "department": "technical", "urgent": true, "orderNumber": null } },
    { "id": "t18", "input": { "subject": "Price of the pannier bag", "body": "How much does the rear pannier bag cost, and is it in stock?" },
      "expected": { "department": "sales", "urgent": false, "orderNumber": null } }
  ]
}
```

The expected values follow **what the team actually does**, not the option descriptions. Velo's billing team handles everything about orders already placed, delivery status included. Warranty claims go to technical, even when the customer wants money back. That practice is the truth the model is measured against.

A good set:
- **comes from real tickets**, anonymized, not from what you imagine customers write,
- **covers the hard cases**: the ones colleagues disagree on, or new colleagues get wrong,
- **is small enough to read**: 30 cases you know beat 3000 you don't,
- **has the reason for every expected value** in someone's head, or better, in a comment.

## The harness

The evaluation runs the step's real `triage()` over every case, with a real model, and counts per field. It's plain code in the samples' `_shared` folder:

```ts title="_shared/triage-eval.ts (excerpt)"
export async function evaluateTriage(datasetPath: string, triage: Triage, models: string[] = []): Promise<Report> {
    const { cases } = await load<{ cases: Case<TicketText>[] }>(datasetPath);
    const context = { inference: () => Intelligence.inference() };

    const outcomes = await run(cases, async (input) => {
        const result = await triage(context, { id: 'evaluation', attachments: [], ...input });
        return {
            actual: { department: result.department, urgent: result.urgent, orderNumber: result.orderNumber },
            reasons: { department: result.departmentReason, urgent: result.urgentReason }
        };
    });

    return score('Triage evaluation', cases, outcomes, { models, prompts });
}
```

- `run` calls the function for every case, a few at a time. A case that fails counts as wrong.
- `score` compares field by field, and keeps every mismatch **with the model's reason**. The reasons are the most useful part of the report.

The step's `eval.ts` starts the platform with the real YAML and runs it:

```ts title="eval.ts"
// An evaluation, not a test: real model, real tickets, the team's decisions. Run it deliberately.
const step = './steps/16-measure';
const models = await runReal(`${step}/intelligence.yml`);
await main(`${step}/evals/tickets.json`, triage, models, `${step}/evals/report.json`);
```

## Run it

```sh
OPENAI_API_KEY=<key> yarn eval:16
# or with a local model in LM Studio:
LOCAL_MODEL=qwen/qwen3-coder-next yarn eval:16
```

This is the report from a run against `qwen3-coder-next` in LM Studio:

```txt
Triage evaluation: 30 cases
  ai DEFAULT: qwen/qwen3-coder-next (LM Studio)
  prompt support.reply@v1
  prompt support.chat@v3

  department      83%   25/30
  urgent          83%   25/30
  orderNumber     80%   24/30

  Mismatches:
  - t03 department: expected "billing", got "technical"
      The tracking link not updating after 6 days strongly suggests a logistics/fulfillment problem …
  - t05 department: expected "billing", got "sales"
      The ticket involves canceling a recent order that hasn't shipped yet … responsibilities of the Sales team
  - t27 department: expected "billing", got "sales"
      Changing the delivery address for an order that has not yet shipped … related to sales operations
  - t28 department: expected "sales", got "technical"
      Identifying the correct spare inner tube size … 'technical' explicitly includes 'spare parts'
  - t01 urgent: expected false, got true
      Double-charging is an urgent billing issue that typically warrants same-day resolution …
  - t11 urgent: expected true, got false
      The customer hasn't explicitly stated they can't or shouldn't ride it …
  - t08 orderNumber: expected null, got "Velo City 3"
  - t16 orderNumber: expected null, got "Winter battery range"
  - t29 orderNumber: expected null, got "LOOSE_THING_BACK"
  …
```

Your numbers will differ with another model, and a little between runs.

## Read the mismatches, not the percentages

The numbers say *how much*; the reasons say *why*. Grouped, the mismatches tell a clear story:

| Pattern | Cases | Cause |
|---|---|---|
| Placed orders (delivery, cancellation, address) go to technical or sales | t03, t04, t05, t27 | The descriptions never say who handles orders that already exist |
| Buying a spare part goes to technical | t28 | *"spare parts"* is in technical's description |
| Payment trouble is urgent, a cracked frame isn't | t01, t03, t07, t11, t12 | The urgency question doesn't say what *isn't* urgent, and "safety issue" is too abstract |
| Invented order numbers | t08, t12, t14, t16, t28, t29 | The field description doesn't say what an order number looks like |

None of these is the model being "bad". In each case, **we didn't say what we meant.** That's good news, because it's fixable. It's the next chapter.

## Test it

The harness itself is code, so it has tests, with the scripted model:

```ts title="step.test.ts"
test('the evaluation runs the real triage over all 30 tickets', async () => {
    // A model that always says billing, never urgent, no order number.
    ScriptedAI.reset(triageScript({
        department: { value: 'billing', confidence: 0.9, reason: null },
        urgent: { value: false, confidence: 0.9, reason: null },
        facts: { orderNumber: null, product: null, summary: '…' }
    }));

    const report = await evaluateTriage('./steps/16-measure/evals/tickets.json', triage);

    assert.equal(report.metrics.department.correct, 10);   // the billing tickets
    assert.equal(report.metrics.urgent.correct, 24);       // the tickets that aren't urgent
    assert.equal(report.metrics.orderNumber.correct, 20);  // the tickets without an order number
});

test('a failed case counts as wrong', () => { /* … */ });
```

## What you learned

- **Tests check code; evaluations check quality.** Both are needed, and they're different.
- **An evaluation set is real cases with a human's answer.** Thirty good ones are enough to start.
- **Read the reasons.** Mismatches grouped by cause tell you what to change.

## Reviewer's view

> An evaluation set of 30 tickets, with the team's routing, urgency and order numbers. Baseline: 83%, 83%, 80%.

The set is the new contract. Review it like a specification: are the expected values really the team's practice? Does it contain the cases people argue about? From now on, **a change to `triage.ts` or its prompts comes with an evaluation run**, and the reviewer compares the numbers.

[Sample: step 16](https://github.com/3flows/intelligence-samples/tree/main/support-desk/steps/16-measure) · Next: [Improve with evidence](./improve-with-evidence.md)
