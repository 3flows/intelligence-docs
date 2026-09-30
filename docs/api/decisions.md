---
title: choice(), check(), score()
sidebar_label: choice, check, score
---

# `choice()`, `check()`, `score()`

Decisions about text, returned as typed values. When to use which is explained in [Turning language into data](../concepts/language-into-data.md).

All three take a **name** (`choice('department')`), accept the [shared methods](./overview.md#methods-shared-by-all-chains), and end with `.ask(question)`.

## `choice(name)`

Pick from a fixed set of options. Call `.oneOf(...)` or `.manyOf(...)` before `.ask(...)`.

```ts
const department = await Intelligence.inference()
    .choice('department')
    .oneOf(['billing', 'technical', 'sales'])
    .with(ticket.body)
    .ask('Which team should handle this ticket?');

department.value;       // 'billing' | 'technical' | 'sales'
department.confidence;  // number | undefined
department.reason;      // string | undefined
```

| Method | Description |
|---|---|
| `.oneOf(options)` | Exactly one option. `value` is `T` |
| `.manyOf(options)` | Zero or more options. `value` is `T[]` |

`options` is either a list of strings, or a map from option to description:

```ts
.oneOf({
    billing: 'Payments, invoices, refunds and prices',
    technical: 'Defects, repairs, assembly and spare parts',
    sales: 'Product advice and new orders'
})
```

The options become the type of `value`:

```ts
const department = await choice.oneOf(['billing', 'technical']).ask('…');
department.value;   // typed 'billing' | 'technical'

const topics = await choice.manyOf(['refund', 'delivery']).ask('…');
topics.value;       // typed Array<'refund' | 'delivery'>
```

**Result:** `AIOneOfDecision<T>` or `AIManyOfDecision<T>`

| Field | Type | Description |
|---|---|---|
| `value` | `T` / `T[]` | The chosen option(s) |
| `confidence` | `number?` | 0–1 |
| `reason` | `string?` | Why, in words |
| `probabilities` | `Record<T, number>?` | Per option, from native choice models (`oneOf` only) |
| `raw` | `unknown` | The provider's response |

**Capabilities:** `oneOf` prefers `choice`, falls back to `structured`. `manyOf` uses `structured`.

## `check(name)`

A yes-or-no question.

```ts
const urgent = await Intelligence.inference()
    .check('urgent')
    .with(ticket.body)
    .ask('Does this ticket need an answer today?');

urgent.value;  // boolean
```

| Method | Description |
|---|---|
| `.threshold(threshold: number)` | For native `noul` models: `value` is `true` when the probability is at least `threshold`. Default `0.5` |

**Result:** `AICheckDecision`: `value: boolean`, `confidence?`, `reason?`, `score?` (the raw probability from native models), `raw`.

**Capabilities:** prefers `noul`, falls back to `structured`.

## `score(name)`

A number on a scale.

```ts
const frustration = await Intelligence.inference()
    .score('frustration')
    .between(0, 10)
    .criteria('0: calm and friendly', '10: angry, threatens to leave')
    .with(ticket.body)
    .ask('How frustrated is the customer?');

frustration.value;  // number between 0 and 10
```

| Method | Description |
|---|---|
| `.between(min: number, max: number)` | The scale |
| `.criteria(...criteria)` | What the scale means. Without criteria, the question is used |

**Result:** `AIScoreDecision`: `value: number`, `confidence?`, `reason?`, `raw`.

**Capabilities:** prefers `score`, falls back to `structured`. Native score models return 0–1, which is mapped onto `between(min, max)`.

:::tip Always give a scale
Without `between`, the fallback asks for "a number" and native models answer between 0 and 1. Say what you mean.
:::

## What the model receives

For the `structured` fallback, the model gets the instructions as system message and one user message with a JSON document of the question, the inputs, and the options or criteria. It must answer with `{ value, confidence, reason }` matching the schema. That's why `reason` is available from any chat model with the `structured` capability.

## Tips

- Use `temperature: 0` for decisions: `.options({ temperature: 0 })`, or in the AI's `defaults`.
- Add an explicit `other` option when a ticket might fit none.
- Store `reason` with the decision.
- Several decisions about the same text are independent calls. Run them in parallel with `Promise.all`, or use one [`extract`](./extract.md) if they belong together.
