---
title: 17. Improve with evidence
---

# 17. Improve with evidence

**Where we are:** an evaluation says triage is right 83% (department), 83% (urgent) and 80% (order number) of the time, and the mismatches point at four causes.

**The problem:** it's tempting to rewrite the whole prompt. Don't. A big rewrite fixes some cases, breaks others, and nobody knows which change did what.

## The solution: one targeted change per cause, then measure

Each change answers one pattern from [chapter 16](./measure.md), and each is small enough to review on its own.

### 1. Say who handles placed orders, and buying

The descriptions are the routing policy. They get the practice the team actually has:

```ts title="triage.ts"
// What each team handles. This is what a new colleague would need to know, too.
// v2, after the evaluation in step 16: placed orders belong to billing, buying anything belongs to sales.
const departments: Record<Department, string> = {
    billing: 'Payments, invoices, refunds of unused returns, and orders already placed: delivery status, cancellations, address changes',
    technical: 'Defects, repairs, assembly, and warranty claims, including returns of defective items',
    sales: 'Advice before buying: sizes, prices, availability and discounts, also for spare parts and accessories'
};
```

### 2. Tie-breaking rules, as a versioned prompt

Some tickets fit two descriptions: a defective light the customer wants to return is *a return* and *a defect*. The order of precedence is policy, so it goes into a prompt:

```yaml title="intelligence.yml"
prompts:
  - name: support.routing
    version: v1
    description: Tie-breaking rules for routing tickets to a team
    template: |
      You route tickets for the support team of a bike shop.
      Rules, in this order:
      - A defect, whether the customer wants a repair, a replacement or their money back, goes to technical.
      - Anything about an order that has already been placed and isn't a defect goes to billing.
      - Questions before buying, including prices of spare parts, go to sales.
```

```ts title="triage.ts"
ai.choice('department').prompt('support.routing').oneOf(departments).with(text)
```

### 3. Say what isn't urgent

```ts title="triage.ts"
ai.check('urgent').with(text)
    .ask('Does the customer need an answer today? Only if there is a deadline in the next days, a safety issue (for example a cracked frame or failing brakes), or a bike they cannot ride. Payment problems and late refunds alone are not urgent.')
```

### 4. Describe the format, and check it in code

A better description helps the model:

```ts title="triage.ts"
orderNumber: t.string().nullable().describe('The customer’s order number, the letter A, a dash and four digits (A-1042). null if the ticket contains none. Never a product name.'),
```

But the format of an order number is a fact, not a judgment, so a rule enforces it. The model decides meaning, the code decides action, as in [chapter 8](./meaning-and-action.md):

```ts title="triage.ts"
export const isOrderNumber = (value: string | null): value is string => value !== null && /^A-\d{4}$/.test(value);

return {
    ...facts,
    // A rule, not a prompt: whatever doesn't look like an order number isn't one.
    orderNumber: isOrderNumber(facts.orderNumber) ? facts.orderNumber : null,
    // …
};
```

## Run it, and compare

`yarn eval:17` runs the same 30 cases and compares with step 16's report:

```sh
LOCAL_MODEL=qwen/qwen3-coder-next yarn eval:16    # the baseline, if you haven't run it
LOCAL_MODEL=qwen/qwen3-coder-next yarn eval:17
```

```txt
Triage evaluation: 30 cases
  ai DEFAULT: qwen/qwen3-coder-next (LM Studio)
  prompt support.reply@v1
  prompt support.routing@v1
  prompt support.chat@v3

  department      97%   29/30   (was 83%)
  urgent         100%   30/30   (was 83%)
  orderNumber    100%   30/30   (was 80%)

  Mismatches:
  - t10 department: expected "technical", got "sales"
      The customer is asking which brake pads they need because the ones from order A-2010 don't fit …
      indicating a pre-purchase advice or product fitment question
```

Three causes fixed. And look at t10: it was **right before, and is wrong now**. The new *"prices of spare parts go to sales"* pulled a fitment question over. That's why the full set runs after every change: improvements move other cases too. Whether t10 is worth another rule is a team decision; the report makes it a visible one.

## Don't tune forever

Every change in this chapter was made *looking at* these 30 cases. Keep tuning against them, and the prompts will fit these tickets and nothing else. Three habits keep an evaluation honest:

- **Keep adding real cases**, especially new kinds of tickets and the ones the desk got wrong. [Chapter 21](./humans-in-the-loop.md) turns agents' corrections into cases automatically.
- **Hold some back.** Put a few cases aside that nobody tunes against, and check them before a release.
- **Change one cause at a time**, so a number moves for a reason you know.

## Test it

```ts title="step.test.ts"
test('routing uses the support.routing prompt and the v2 descriptions', async () => {
    await post('http://127.0.0.1:3000/createTicket', ticket);

    const request = ScriptedAI.requests.find((r) => r.responseSchemaName === 'department')!;
    assert.match(String(request.instructions), /A defect, whether the customer wants a repair/);
    assert.deepEqual(request.options?.metadata?.prompts, [{ name: 'support.routing', version: 'v1' }]);
});

test('an invented order number is dropped by our rule', async () => {
    ScriptedAI.reset(triageScript({ facts: { orderNumber: 'LOOSE_THING_BACK', product: null, summary: 'Rattle.' } }));

    const created = await post('http://127.0.0.1:3000/createTicket', ticket);

    assert.equal(created.triage.orderNumber, null);
});
```

## What you learned

- **One targeted change per cause**, each reviewable on its own.
- **Compare with the baseline**, and look for cases that got worse, not only better.
- **Formats are facts**: enforce them in code, not in prompts.

## Reviewer's view

> Routing descriptions v2, a new `support.routing@v1` prompt, a sharper urgency question and an order-number rule. Evaluation: 83/83/80% → 97/100/100%, one case regressed (t10).

This is what an AI change should look like in review: small diffs, the numbers before and after, and the regressions named. Ask for the evaluation report with every change to triage policy, the same way you'd ask for tests with every code change.

[Sample: step 17](https://github.com/3flows/intelligence-samples/tree/main/support-desk/steps/17-improve-with-evidence) · Next: [Judge the answers](./judge-the-answers.md)
