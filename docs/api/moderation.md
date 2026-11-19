---
title: moderation()
---

# `moderation()`

Checks content against a provider's safety policy: harassment, hate, self-harm, sexual content, violence and similar categories. Capability `moderation` (e.g. `omni-moderation-latest`).

```ts
const moderation = await Intelligence.inference()
    .moderation()
    .input(ticket.body)
    .moderate();

moderation.flagged;                      // true if any input was flagged
moderation.results[0].categories;        // { harassment: true, violence: false, … }
moderation.results[0].categoryScores;    // { harassment: 0.91, … }
```

| Method | Description |
|---|---|
| `.input(input: string \| string[])` | The text to check, or several texts |
| `.model(name)` | The moderation AI |
| `.moderate()` | Terminal verb |

**Result:** `{ flagged: boolean, results: [{ flagged, categories?, categoryScores? }], usage?, model, provider, raw }`. With several inputs, `results` has one entry per input.

## Moderation or `check`?

| | `moderation()` | `check('safe')` |
|---|---|---|
| Policy | the provider's, fixed categories | yours, in words |
| Model | a small, dedicated, usually free model | any chat model |
| Output | categories and scores | `value`, `reason` |

Use `moderation()` as a cheap first screen for clearly unsafe content. Use `check` for your own rules: *"Does this message ask us to change a bank account number?"*

Use moderation at service boundaries, before text reaches a model or a customer. The tutorial does both in [Guard the input](../tutorial/guard-the-input.md).
