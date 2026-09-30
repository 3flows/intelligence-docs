---
title: Turning language into data
---

# Turning language into data

Most AI features in business applications aren't chatbots. They're **decisions about text**: route this ticket, flag this contract, tag this review, fill in this form. The answer has to be a value your code can act on, not a paragraph.

Intelligence has four capabilities for that. Each returns a typed value, and most return a `reason` and a `confidence` alongside it.

## Pick the smallest shape that fits

| The question has… | Use | `value` is |
|---|---|---|
| exactly one answer from a fixed list | `choice(name).oneOf([...])` | one of the options |
| any number of answers from a fixed list | `choice(name).manyOf([...])` | a list of options |
| a yes or no answer | `check(name)` | `true` / `false` |
| an answer on a scale | `score(name).between(min, max)` | a number |
| several fields at once | `extract(name).schema(zod)` | an object of your schema's type |

```ts
const ai = Intelligence.inference();

const department = await ai.choice('department').oneOf(['billing', 'technical', 'sales']).with(body).ask('Which team?');
const topics     = await ai.choice('topics').manyOf(['refund', 'delivery', 'defect', 'invoice']).with(body).ask('Which topics?');
const urgent     = await ai.check('urgent').with(body).ask('Does this need an answer today?');
const frustration = await ai.score('frustration').between(0, 10).with(body).ask('How frustrated is the customer?');
```

The smallest shape is the most reliable one. A model picks well from three options; it's less reliable across fifteen fields. When one call gets complicated, split it.

## Why not just ask for JSON?

You could write `chat().ask('Answer with JSON: {"department": ...}')` and parse the text. That's the glue these capabilities remove:

- **The shape is enforced.** Options become an enum, a check becomes a boolean. With a `structured` model, the provider enforces the schema; the result is validated against it before your code sees it.
- **Nothing to parse.** No `JSON.parse`, no `includes('yes')`, no regexes.
- **Native models plug in.** Some providers have models built for decisions, like TypeSafe's `jev`, that return calibrated probabilities instead of generated text. Add one to `ais` and `choice`, `check` and `score` use it, with no code change. See [Capabilities and providers](./capabilities-and-providers.md#how-a-call-finds-its-ai).

## `reason` and `confidence`

```ts
urgent.value;       // true
urgent.confidence;  // 0.85
urgent.reason;      // "The customer needs the part before a race on Saturday."
```

- **`reason`** is for humans. Store it with the decision. When a reviewer, a colleague or the customer asks "why was this marked urgent?", it's the answer. Chat models provide it; native decision models may not.
- **`confidence`** is the model's own estimate, between 0 and 1. From a native decision model it's calibrated. From a chat model it's a self-assessment: useful to sort by, not a probability to rely on.

A common pattern is to act automatically only when the model is sure, and let a human decide otherwise:

```ts
if (department.confidence !== undefined && department.confidence >= 0.8) {
    await assignTo(department.value);
} else {
    await queueForHumanTriage(ticket);
}
```

`check` has a built-in version of this for native models: `.threshold(0.8)` means the answer is only `true` above that probability.

## Describe your options

Options can be a list, or a map from option to description. Use the map whenever an option's name alone is ambiguous:

```ts
ai.choice('department').oneOf({
    billing: 'Payments, invoices, refunds and prices',
    technical: 'Defects, repairs, assembly and spare parts',
    sales: 'Product advice and orders that have not been placed yet'
});
```

The descriptions are exactly what a new colleague would need to route tickets correctly. They're also the first thing to improve when routing is wrong.

## Scores need a scale

A score without a definition is noise. Give the range with `between` and say what the ends mean with `criteria`:

```ts
ai.score('frustration')
    .between(0, 10)
    .criteria('0 means calm and friendly', '10 means angry and threatening to leave')
    .with(body)
    .ask('How frustrated is the customer?');
```

## Extract: several fields, one schema

When you need a record, describe it with a schema, using `t` (Zod) from the platform:

```ts
const Triage = t.object({
    orderNumber: t.string().nullable().describe('Order number like A-1042, if mentioned'),
    product: t.string().nullable(),
    summary: t.string().describe('One sentence, in English')
});

const triage = await ai.extract('triage').schema(Triage).with(body).ask('Extract the triage record.');
triage.orderNumber; // typed as string | null
```

`extract` returns the value itself, typed by the schema. `.describe(...)` on fields is part of the prompt: use it.

Make fields **nullable** when the information may be missing. Otherwise the model will invent something to fill the field.

## Reviewer's view

Decisions are where AI features touch business rules, so they deserve the closest look:

- **Are the options complete?** What happens to a ticket that fits none? Consider an explicit `other`.
- **What acts on the value?** An automatic action on a model's decision should be reversible, or gated by `confidence`, or reviewed by a human.
- **Is the `reason` stored?** If not, nobody can explain the decision later.
