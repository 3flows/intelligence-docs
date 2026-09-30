---
title: 16. Rerank
---

# 16. Rerank

**Where we are:** every chat turn retrieves four help center passages.

**The problem:** *"My e-bike battery drains fast in winter"* retrieves two passages about charging, one about the warranty, and, in fifth place, the one that answers it: *"Batteries lose up to 30% of range below 5 °C."* Vector search found it, but ranked it too low to make the cut.

## The solution: `reranker()`

Vector search compares two vectors, computed separately. A **reranker** is a model that reads the question and each candidate *together*, and scores how well the candidate answers the question. It's slower, so it doesn't search; it sorts a short list:

1. vector search for the **top 12** candidates, fast and approximate,
2. rerank them, and keep the **top 4**.

```ts title="help-center.ts"
handler('searchArticles', SearchQuery, t.array(Passage), async ({ query, limit = 5 }, trigger) => {
    // Retrieve many, fast and approximate ...
    const candidates = await trigger.context.vector().index('help-center')
        .query(query)
        .embedding(embed)
        // highlight-next-line
        .limit(limit * 3)
        .find();
    if (!candidates.length) return trigger.ok([]);   // nothing to rank: the reranker rejects an empty list

    // highlight-start
    const ranked = await Intelligence.inference()
        .reranker()
        .query(query)
        .with(candidates, { text: (candidate) => candidate.text, id: (candidate) => candidate.id })
        .topK(limit)
        .rank();
    // highlight-end

    await trigger.ok(ranked.results.map(({ index }) => toPassage(candidates[index])));
})
```

The empty-list check isn't cosmetic: before the first import, or for a new tenant, the index is empty, and the reranker would fail the whole chat turn. The tests found that one. `SearchQuery` is the input schema from before, `{ query, limit }`, and `toPassage` is the mapping from a vector hit to a `Passage` that `searchArticles` already had, moved into a function.

`with(items, mapper)` takes any objects and a mapper to their text. `results` come best first; `index` points back into `candidates`.

A reranker is its own kind of model, with the `reranking` capability. Any service with a Cohere- or Jina-style `/rerank` endpoint works through `openai-compatible`:

```yaml title="intelligence.yml"
ais:
  # … DEFAULT and embeddings as before
  # highlight-start
  - name: reranker
    provider: openai-compatible
    model: jina-reranker-v2-base-multilingual
    connection:
      baseUrl: https://api.jina.ai/v1
      apiKey: ${{ JINA_API_KEY }}
  # highlight-end
```

The model name contains `rerank`, so Intelligence infers the capability. The chat handler doesn't change at all: it still asks the help center for four passages.

## Run it

```sh
export JINA_API_KEY=<your key>
yarn step:16
curl -X POST localhost:3000/help-center/importArticles -H 'Content-Type: application/json' -d @steps/16-rerank/articles.json
curl -X POST localhost:3000/help-center/searchArticles -H 'Content-Type: application/json' \
  -d '{"query":"my e-bike battery drains fast in winter","limit":2}'
```

```json
[
  { "id": "battery#3", "title": "E-bike batteries", "text": "Batteries lose up to 30% of range below 5 °C. Store and charge them indoors …" },
  { "id": "battery#1", "title": "E-bike batteries", "text": "…" }
]
```

## Is it worth it?

A reranker adds a call, some latency and some cost per turn. Add it when you can see the problem: the right passage is usually among the candidates, but not at the top. Measure with a small set of real questions and the passage a human would pick. If vector search already puts it first, skip the reranker.

## What you learned

- **Retrieve many, rerank, keep few.** `reranker().query(q).with(candidates, mapper).topK(n).rank()`.
- **A reranker is a separate model** with the `reranking` capability, configured like any other AI.
- The change is inside `searchArticles`; its callers didn't notice.

## Reviewer's view

> Help center search takes 3 × `limit` candidates from the vector index and keeps the best `limit` by a Jina reranker.

A third provider now receives customer questions: Jina. That's a data-processing question for the reviewer, visible in one YAML entry.

[Sample: step 16](https://github.com/3flows/intelligence-samples/tree/main/support-desk/steps/16-rerank) · Next: [The right model for each job](./the-right-model-for-each-job.md)
