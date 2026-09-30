---
title: embedding(), reranker()
sidebar_label: embedding, reranker
---

# `embedding()`, `reranker()`

The building blocks of [retrieval](../concepts/retrieval.md).

## `embedding()`

Text to vectors. Requires the `embedding` capability.

```ts
const { vector } = await Intelligence.inference().embedding().with('How do I get a refund?').embed();

const { vectors } = await Intelligence.inference()
    .embedding()
    .model('embeddings')
    .with(['First passage', 'Second passage'])
    .embed();
```

| Method | Description |
|---|---|
| `.with(input: string \| string[])` | One text, or a batch |
| `.dimensions(n: number)` | Shorter vectors, where the model supports it (`text-embedding-3-*`) |
| `.model`, `.options`, `.metadata`, `.labels`, `.context`, `.trace`, `.observabilityTag` | [Shared](./overview.md#methods-shared-by-all-chains) |

### `.embed(): Promise<InferenceEmbeddingResponse>`

| Field | Description |
|---|---|
| `vector` | The vector, when the input was a single string. `undefined` for a batch |
| `vectors` | All vectors, in input order |
| `embeddings` | `{ index, vector, text? }` per input |
| `usage`, `model`, `provider`, `raw` | As for every response |

### With the platform's `vectors`

The platform's vector store takes an embedding function. This is the bridge:

```ts
const embed = async (text: string) =>
    (await Intelligence.inference().embedding().with(text).embed()).vector!;

await trigger.context.vector().index('help-center').documents(articles).embedding(embed).put();
const hits = await trigger.context.vector().index('help-center').query(question).embedding(embed).limit(5).find();
```

Use the **same** embedding AI for indexing and querying. When you change it, rebuild the index.

## `reranker()`

Sorts documents by relevance to a query. Requires the `reranking` capability, for example a Cohere- or Jina-compatible rerank model behind `openai-compatible`.

```ts
const ranked = await Intelligence.inference()
    .reranker()
    .query('How do I reset my password?')
    .with([
        'Reset your password in Settings under Security.',
        'Invoices arrive by email.',
        'Change your display name in your profile.'
    ])
    .topK(2)
    .rank();

ranked.results[0].index;     // position in the input
ranked.results[0].score;     // relevance
ranked.results[0].document;  // the document
```

| Method | Description |
|---|---|
| `.query(query: string)` | What the documents should answer. Required |
| `.with(documents)` | Strings, or `{ id?, text, metadata? }`. Required |
| `.with(items, { text, id?, metadata? })` | Any objects, with a mapper |
| `.topK(n)` / `.topN(n)` | Return the best `n` |

```ts
.with(articles, { text: (a) => a.body, id: (a) => a.slug })
```

### `.rank(): Promise<InferenceRerankResponse>`

`results`: `{ index, score, document, id?, metadata? }[]`, best first. Use `index` to map back to your input.
