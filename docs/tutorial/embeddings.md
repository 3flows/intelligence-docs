---
title: 14. Embeddings
---

# 14. Embeddings

**Where we are:** an assistant that chats, looks up orders and reads attachments.

**The problem:** Velo has a help center with forty articles: returns, warranty, brake maintenance, e-bike batteries. The assistant knows none of it. And searching it by keyword fails: *"how do I get my money back"* doesn't contain the word *refund*.

## The solution: search by meaning

An **embedding** turns text into a vector, a list of numbers, such that texts with similar meaning get similar vectors. Search then means: embed the question, find the nearest passages. See [Retrieval](../concepts/retrieval.md).

This chapter builds the index and the search. The next one uses it in answers.

### An embedding model

Embedding models are separate, small and cheap. Add one next to the chat model:

```yaml title="intelligence.yml"
ais:
  - name: DEFAULT
    provider: openai
    model: gpt-4.1-mini
    # …
  # highlight-start
  - name: embeddings
    provider: openai
    model: text-embedding-3-small
    connection:
      apiKey: ${{ OPENAI_API_KEY }}
  # highlight-end

vectors:
  - name: DEFAULT
    type: memory   # or redis, mongo
```

`embedding()` asks for the `embedding` capability; `text-embedding-3-small` is the only AI that has it, so it answers. No `.model(...)` needed.

### The help center service

```ts title="help-center.ts"
import { Register, Service, handler, t } from '@3flows/platform';
import { Intelligence } from '@3flows/intelligence';

export const Article = t.object({ id: t.string(), title: t.string(), body: t.string() });
export type Article = t.infer<typeof Article>;

export const Passage = t.object({ id: t.string(), articleId: t.string(), title: t.string(), text: t.string() });
export type Passage = t.infer<typeof Passage>;

export const SearchQuery = t.object({ query: t.string(), limit: t.number().optional() });

// highlight-start
/** The bridge between Intelligence and the platform's vector store. */
export const embed = async (text: string): Promise<number[]> =>
    (await Intelligence.inference().embedding().with(text).embed()).vector!;
// highlight-end

/** One passage per paragraph, so every vector means one thing. */
export function passagesOf(article: Article): Passage[] {
    return article.body.split(/\n\s*\n/).map((text, index) => ({
        id: `${article.id}#${index}`,
        articleId: article.id,
        title: article.title,
        text: text.trim()
    }));
}

@Register()
export class HelpCenterService extends Service {
    handlers = () => [
        handler('importArticles', t.object({ articles: t.array(Article) }), t.object({ passages: t.number() }), async ({ articles }, trigger) => {
            const passages = articles.flatMap(passagesOf);
            // highlight-start
            await trigger.context.vector().index('help-center')
                .documents(passages.map(({ id, articleId, title, text }) => ({
                    id,
                    text: `${title}\n${text}`,
                    metadata: { articleId, title }
                })))
                .embedding(embed)
                .put();
            // highlight-end
            await trigger.ok({ passages: passages.length });
        }),

        handler('searchArticles', SearchQuery, t.array(Passage), async ({ query, limit = 5 }, trigger) => {
            // highlight-start
            const hits = await trigger.context.vector().index('help-center')
                .query(query)
                .embedding(embed)
                .limit(limit)
                .find();
            // highlight-end
            await trigger.ok(hits.map((hit) => ({
                id: hit.id,
                articleId: hit.metadata?.articleId ?? '',
                title: hit.metadata?.title ?? '',
                text: hit.text
            })));
        })
    ];
}
```

- **`embed`** is the only line that touches Intelligence. The platform's `vectors` takes any embedding function; this one delegates to whatever AI has the `embedding` capability.
- **Passages, not articles.** A vector summarizes its whole text. A paragraph about brake pads and one about warranty in one vector make both harder to find.
- **The title goes into every passage**, so *"How long does it take?"* in the returns article is still about returns.

The help center runs next to the other services, on its own path:

```yaml title="intelligence.yml"
services:
  - name: SupportService
  - name: OrdersService
  - name: HelpCenterService

https:
  - name: api
    port: 3000
    services:
      - name: SupportService
      - name: OrdersService
        basepath: /orders
      - name: HelpCenterService
        basepath: /help-center
```

## Run it

```sh
yarn step:14
curl -X POST localhost:3000/help-center/importArticles -H 'Content-Type: application/json' -d @steps/14-embeddings/articles.json
curl -X POST localhost:3000/help-center/searchArticles -H 'Content-Type: application/json' -d '{"query":"how do I get my money back","limit":2}'
```

```json
[
  { "id": "returns#1", "title": "Returns and refunds", "text": "Refunds are paid to the original payment method within 14 days of us receiving the item." },
  { "id": "returns#0", "title": "Returns and refunds", "text": "You can return any unused item within 30 days …" }
]
```

No keyword in common, found anyway.

## Two rules to keep

- **The same embedding model for indexing and search.** Vectors from different models aren't comparable. Changing `model` under `embeddings` means re-importing everything.
- **The index must follow the articles.** When an article changes, its passages must be re-embedded. In production, a [pipeline](https://3flows.github.io/platform-docs/docs/tutorial/pipelines) triggered by the CMS is the right shape.

## What you learned

- **`embedding().with(text).embed()`** returns a vector; `.with([...])` embeds a batch.
- **The platform's `vectors` stores and searches them**; `embed` is the bridge.
- **Chunk into passages** and give each enough context to stand alone.

## Reviewer's view

> Help center articles are split into paragraphs, embedded with `text-embedding-3-small`, and stored in the `help-center` vector index.

Everything in the index can end up in an answer. Only public articles belong here; internal notes don't. And somebody has to own keeping it current.

[Sample: step 14](https://github.com/3flows/intelligence-samples/tree/main/support-desk/steps/14-embeddings) · Next: [Answer from the help center](./answer-from-the-help-center.md)
