---
title: Retrieval
---

# Retrieval

Your company knows things the model doesn't: return policies, product manuals, last year's answers to the same question. You can't send all of it with every call. **Retrieval** finds the few passages that matter for *this* question and sends only those.

The pattern is usually called **RAG**, retrieval-augmented generation. It has three building blocks.

## 1. Embeddings: meaning as numbers

An **embedding** turns a text into a vector, a list of a few hundred to a few thousand numbers. Texts with similar meaning get vectors that point in similar directions, even when they share no words:

```txt
"How do I get my money back?"        ─▶ [0.12, -0.03, 0.88, …]  ┐ close
"Refunds are paid within 14 days."   ─▶ [0.10, -0.01, 0.91, …]  ┘
"Our shop opens at 9."               ─▶ [-0.54, 0.33, 0.02, …]    far
```

```ts
const { vector } = await Intelligence.inference().embedding().with('How do I get my money back?').embed();
const { vectors } = await Intelligence.inference().embedding().with(['text one', 'text two']).embed();
```

Embedding models are separate, small and cheap. Configure one next to your chat model; `embedding()` finds it by capability.

Two rules:

- **Use the same embedding model for documents and questions.** Vectors from different models aren't comparable. Changing the model means re-embedding everything.
- **Embed passages, not books.** A vector summarizes its whole text. Split long documents into chunks of a paragraph or a section, so each vector means one thing.

## 2. A vector store: search by meaning

Vectors go into a store that finds the nearest ones to a query vector. The platform has one: `vectors`, with `memory`, `redis` and `mongo` backends. It takes an embedding function, so Intelligence plugs straight in:

```ts
const embed = async (text: string) => (await Intelligence.inference().embedding().with(text).embed()).vector!;

// index
await trigger.context.vector().index('help-center').documents(articles).embedding(embed).put();

// search
const passages = await trigger.context.vector().index('help-center').query(question).embedding(embed).limit(5).find();
```

```yaml
vectors:
  - name: DEFAULT
    type: memory   # or redis, mongo
```

## 3. Reranking: sort the candidates properly

Vector search is fast and approximate. A **reranker** is a model that reads the query and each candidate together, and scores how well the candidate answers the query. It's slower, so it runs on the few dozen results of the vector search, not on everything:

```ts
const ranked = await Intelligence.inference()
    .reranker()
    .query(question)
    .with(passages, { text: (p) => p.text, id: (p) => p.id })
    .topK(3)
    .rank();
```

Reranking is optional. Add it when the right passage is usually among the results, but not at the top.

## Putting it together

```ts
const passages = await vector().index('help-center').query(question).embedding(embed).limit(5).find();

const answer = await Intelligence.inference()
    .chat()
    .prompt('support.answer-from-articles')
    .with(passages.map(({ id, text }) => ({ id, text })))
    .ask(question);
```

And in the prompt, the rule that makes it trustworthy:

```yaml
prompts:
  - name: support.answer-from-articles
    template: |
      Answer only from the help center articles you are given.
      If they don't contain the answer, say that you will forward the question to a colleague.
      Name the ids of the articles you used.
```

## Retrieval or tools?

Both give the model facts it doesn't have. The difference is who decides to fetch:

| | Retrieval | Tools |
|---|---|---|
| Who fetches | your code, before the call | the model, during the call |
| Good for | knowledge: policies, manuals, FAQs | records: orders, accounts, stock |
| Found by | meaning | exact keys |

Many assistants use both: retrieval for "what's the rule?", a tool for "what's the state of *my* order?".

## Reviewer's view

- **What's in the index?** Everything in it can end up in an answer, to anyone who can ask. Don't index internal notes into a customer-facing assistant.
- **Is the answer grounded?** The prompt should restrict answers to the passages, and the answer should cite them.
- **Is the index fresh?** Who re-embeds an article when it changes? A [pipeline](https://3flows.github.io/platform-docs/docs/tutorial/pipelines) is a good shape for that.
