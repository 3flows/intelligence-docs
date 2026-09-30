---
title: extract()
---

# `extract(name)`

Structured output: text in, an object of your schema out. Requires the `structured` capability.

```ts
import { t } from '@3flows/platform';

const Triage = t.object({
    orderNumber: t.string().nullable().describe('Order number like A-1042, if the customer mentions one'),
    product: t.string().nullable().describe('The product the ticket is about'),
    summary: t.string().describe('One sentence, in English')
});

const triage = await Intelligence.inference()
    .extract('triage')
    .schema(Triage)
    .with(ticket.body)
    .ask('Extract the triage record for this ticket.');

triage.orderNumber;  // string | null, typed
```

## Methods

In addition to the [shared methods](./overview.md#methods-shared-by-all-chains):

| Method | Description |
|---|---|
| `.schema(schema: t.ZodType<R>, name?: string)` | The shape of the answer. Changes the chain's result type to `R`. `name` overrides the schema name sent to the model |

## Terminal verb

### `.ask(prompt: string): Promise<T>`

Resolves with the **value itself**, validated against the schema. Rejects if no schema was given, or if the model's answer doesn't match it.

## Writing good schemas

- **`.describe(...)` every field that isn't obvious.** Descriptions are sent to the model as part of the JSON schema; they're your field-level instructions.
- **Make optional information `nullable()`.** A required field makes the model produce *something*, even when the text doesn't contain it.
- **Use enums for closed sets.** `t.enum(['low', 'normal', 'high'])` instead of a string.
- **Keep it flat and small.** Five good fields beat twenty mediocre ones. Split large extractions into several calls.

:::note Strict schemas
Providers with native structured output (OpenAI, Azure) use strict JSON schema mode. Strict mode requires every field to be present; use `.nullable()` rather than `.optional()` for fields that may be missing.
:::

## From files

```ts
const invoice = await Intelligence.inference()
    .extract('invoice')
    .schema(Invoice)
    .withBlob('attachments', `${ticket.id}/invoice.txt`)
    .ask('Extract the invoice.');
```

Text files are sent as text. For scanned documents, [`ocr()`](./audio-and-media.md#ocr) first, then extract from the text.
