---
title: 6. Judge
---

# 6. Judge

**Where we are:** tickets are routed and tagged.

**The problem:** *"My race is on Saturday and the wheel still hasn't arrived"* waits behind *"Do you sell bells?"*. And a customer writing for the third time about the same derailleur isn't in a hurry by any deadline, but is about to leave. The team needs to know two more things: **is it urgent?** and **how does the customer feel?**

## The solution: `check()` and `score()`

A yes-or-no question gets a boolean. A question on a scale gets a number. Both are new lines in `triage.ts`:

```ts title="triage.ts"
// What the ends and the middle of the frustration scale mean.
const frustrationScale = [
    '0: calm and friendly',
    '5: annoyed, but patient',
    '10: angry, feels ignored or threatens to leave'
];

export const Triage = t.object({
    department: Department,
    departmentReason: t.string().nullable(),
    topics: t.array(Topic),
    // highlight-start
    urgent: t.boolean(),
    urgentReason: t.string().nullable(),
    frustration: t.number()
    // highlight-end
});
```

```ts title="triage.ts"
const [department, topics, urgent, frustration] = await Promise.all([
    ai.choice('department').oneOf(departments).with(text).ask('Which team should handle this ticket?'),
    ai.choice('topics').manyOf(Topic.options).with(text).ask('Which topics does this ticket mention?'),
    // highlight-start
    ai.check('urgent').with(text)
        .ask('Does the customer need an answer today, for example because of a deadline, a safety issue or a bike they cannot ride?'),
    ai.score('frustration').between(0, 10).criteria(...frustrationScale).with(text)
        .ask('How frustrated is the customer?')
    // highlight-end
]);
```

```ts
return {
    // …
    urgent: urgent.value,
    urgentReason: urgent.reason ?? null,
    frustration: frustration.value
};
```

**`check(name)`** returns `{ value: boolean, reason }`. **The question is the definition.** *"Is this urgent?"* leaves the definition to the model; three concrete reasons put it in words the team can read and argue about.

**`score(name)`** returns `{ value: number, reason }`, and needs a scale:
- **`between(0, 10)`** sets the range.
- **`criteria(...)`** anchors it. Without anchors, one model's 6 is another model's 8, and the same model's 6 today is its 8 next month.

Nothing else changes. `createTicket`, the ticket's shape and the storage are as in chapter 5.

## Decisions are relative

Use scores to **sort and threshold**, not as measurements. *"Frustration of 7 and more goes first"* is a good use. *"Average frustration rose from 4.1 to 4.3"* is noise, unless an evaluation says otherwise.

With a native decision model (like TypeSafe's `jev`, see [Local and alternative models](../guides/local-models.md#decision-models)), `check` gets a calibrated probability instead of a generated answer, and `.threshold(0.8)` sets where *yes* begins. The code that reads `urgent.value` doesn't change.

## Run it

```sh
yarn step:06
curl -X POST localhost:3000/createTicket -H 'Content-Type: application/json' -d '{
  "email": "ada@example.com",
  "subject": "Wheel not here",
  "body": "My race is on Saturday and the wheel I ordered still has not arrived! Third time I write."
}'
```

```json
{ "triage": { "urgent": true, "urgentReason": "The customer has a race on Saturday.", "frustration": 8, … } }
```

## Test it

```ts title="step.test.ts"
test('the check defines urgent in concrete terms', async () => {
    await post('http://127.0.0.1:3000/createTicket', wheel);

    const request = ScriptedAI.requests.find((r) => r.responseSchemaName === 'urgent')!;
    assert.match(JSON.stringify(request.messages), /deadline, a safety issue or a bike they cannot ride/);
});

test('the score is sent with its range and anchors', async () => {
    await post('http://127.0.0.1:3000/createTicket', wheel);

    const request = ScriptedAI.requests.find((r) => r.responseSchemaName === 'frustration')!;
    assert.deepEqual(JSON.parse(String(request.messages[0].content)).criteria, {
        min: 0, max: 10,
        criteria: ['0: calm and friendly', '5: annoyed, but patient', '10: angry, feels ignored or threatens to leave']
    });
});
```

## What you learned

- **`check(name)`** turns a yes-or-no question into a boolean with a reason. The question is the definition.
- **`score(name).between(min, max).criteria(...)`** returns a number on a defined scale. Anchor it.
- Scores are for sorting and thresholds.

## Reviewer's view

> Tickets are flagged urgent (deadline, safety issue, unusable bike) and get a frustration score from 0 to 10.

Ask what a wrong answer costs. A false *urgent*: an agent answers a normal ticket sooner. A false *not urgent*: a customer misses a race. Here, a generous definition is right. For other checks, like *"is this a legal complaint?"*, the balance may be the other way round.

[Sample: step 06](https://github.com/3flows/intelligence-samples/tree/main/support-desk/steps/06-judge) · Next: [Extract](./extract.md)
