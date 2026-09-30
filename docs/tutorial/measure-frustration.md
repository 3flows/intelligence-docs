---
title: 7. Measure frustration
---

# 7. Measure frustration

**Where we are:** tickets are routed, tagged and flagged urgent.

**The problem:** a customer writing for the third time about the same broken derailleur isn't *urgent* by our definition, but they're about to leave. The team wants to see how the customer feels, on a scale.

## The solution: `score()`

A number on a scale, with the scale defined:

```ts title="services.ts"
// highlight-start
const frustration = await ai.score('frustration')
    .between(0, 10)
    .criteria(
        '0: calm and friendly',
        '5: annoyed, but patient',
        '10: angry, feels ignored or threatens to leave'
    )
    .with(text)
    .ask('How frustrated is the customer?');
// highlight-end
```

- **`between(0, 10)`** sets the range.
- **`criteria(...)`** anchors it. Without anchors, one model's 6 is another model's 8, and the same model's 6 today is its 8 next month.

The score feeds a priority, computed by our code, not by the model:

```ts title="services.ts"
export const Priority = t.enum(['normal', 'high']);

/** Business rule: urgent tickets and very frustrated customers go first. */
export function priorityOf(urgent: boolean, frustration: number): t.infer<typeof Priority> {
    return urgent || frustration >= 7 ? 'high' : 'normal';
}
```

```ts
const stored: StoredTicket = {
    // …
    frustration: frustration.value,
    priority: priorityOf(urgent.value, frustration.value)
};
```

`priorityOf` is a pure function with a unit test. The threshold `7` is a business rule, in code, where it's reviewed and changed like any other rule.

## Run it

```sh
yarn step:07
curl -X POST localhost:3000/createTicket -H 'Content-Type: application/json' -d '{
  "email": "linus@example.com",
  "subject": "THIRD TIME",
  "body": "This is the third time I am writing about my derailleur. Nobody answers. I want my money back."
}'
```

```json
{ "urgent": false, "frustration": 9, "priority": "high", "topics": ["defect", "refund"], … }
```

## Scores are relative

Treat scores as a way to **sort and threshold**, not as measurements. *"Frustration above 7 goes first"* is a good use. *"Average frustration rose from 4.1 to 4.3"* is noise unless you've checked it with an evaluation.

## What you learned

- **`score(name).between(min, max).criteria(...)`** returns a number on a defined scale.
- **Anchor the scale**, or the numbers mean nothing.
- **Let the model measure, let code decide**: the priority rule is ours.

## Reviewer's view

> Tickets get a frustration score from 0 to 10; urgent tickets and those at 7 or above get priority *high*.

Two things to review, and they're in different places: the anchors (what the model measures) and `priorityOf` (what we do with it). Changing one doesn't require changing the other.

[Sample: step 07](https://github.com/3flows/intelligence-samples/tree/main/support-desk/steps/07-measure-frustration) · Next: [Extract a triage record](./extract-a-triage-record.md)
