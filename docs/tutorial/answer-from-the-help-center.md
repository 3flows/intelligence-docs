---
title: 15. Answer from the help center
---

# 15. Answer from the help center

**Where we are:** the help center is searchable by meaning.

**The problem:** Ada asks the assistant *"Can I still return the helmet? I bought it five weeks ago."* It answers confidently, with a return period it made up. The real one is 30 days, and it's in the help center.

## The solution: retrieval-augmented generation

Before the model answers, we **retrieve** the passages most relevant to the question and send them along. The model then answers from them, not from its imagination. That's RAG, and it's three lines on top of the last chapter:

```ts title="services.ts"
// highlight-start
/** The help center passages most relevant to a question. */
const helpCenter = (context: TriggerContext, query: string) => context.service('HelpCenterService')
    .method('searchArticles')
    .input({ query, limit: 4 })
    .call<Passage[]>();
// highlight-end

export const ChatAnswer = t.object({ answer: t.string(), sources: t.array(t.string()) });

handler('chat', ChatMessage, ChatAnswer, async ({ ticketId, message }, trigger) => {
    const ticket = await trigger.context.doc().collection('tickets').by(ticketId).get<StoredTicket>();
    if (!ticket) return trigger.notFound(`Ticket ${ticketId} not found`);

    // Retrieve first, then answer from what was retrieved.
    // highlight-next-line
    const articles = await helpCenter(trigger.context, message);

    const answer = await assistant(ticket)
        .tools(ordersOf(ticket, trigger.context))
        // highlight-next-line
        .with({ articles })
        .ask(message);

    await trigger.ok({ answer: answer.text ?? '', sources: articles.map((article) => article.id) });
})
```

The assistant calls the help center like any other service. The passages go in with `with(...)`: they're context for this turn, not history. The streaming route does the same: `assistant(ticket).with({ articles }).stream(message)`.

The part that makes it trustworthy is in the prompt:

```yaml title="intelligence.yml"
prompts:
  - name: support.chat
    version: v3
    template: |
      You are the support assistant of {{ shop }}, a bike shop, chatting with a customer about their ticket.
      You get the ticket and relevant help center articles as context.

      # highlight-start
      - Answer questions about policies (returns, warranty, shipping) only from the articles.
        If they don't answer the question, say that a colleague will get back to the customer.
      - Mention the title of the article you used.
      # highlight-end
      - If the customer asks about an order, look it up. Never guess an order's status.
      - Never promise refunds, discounts or delivery dates; say that the team will confirm.
      - Keep answers short.
```

## Run it

```sh
yarn step:15
curl -X POST localhost:3000/help-center/importArticles -H 'Content-Type: application/json' -d @steps/15-rag/articles.json
curl -X POST localhost:3000/chat -H 'Content-Type: application/json' \
  -d '{"ticketId":"5f0c…","message":"Can I still return the helmet? I bought it five weeks ago."}'
```

```json
{
  "answer": "Unfortunately not: according to “Returns and refunds”, unused items can be returned within 30 days, and five weeks is past that. If the helmet is defective, our warranty may still apply; a colleague will check.",
  "sources": ["returns#0", "returns#1", "warranty#0", "shipping#2"]
}
```

`sources` goes back to the chat page, which can link the articles. A reader can check the answer against them.

## Retrieval or tools?

The order lookup and the help center both give the model facts. They differ in who decides to fetch:

| | Help center (retrieval) | Orders (tool) |
|---|---|---|
| Fetched by | our code, before every turn | the model, when it needs it |
| Found by | meaning | exact number |
| Good for | policies, how-tos | the customer's own records |

Retrieval runs on every turn, even for *"thanks!"*. That's four passages of tokens. For a small help center, fine. For a large one, make the search a tool too, and let the model decide when to search.

## What you learned

- **RAG is search plus context**: retrieve passages, pass them with `with(...)`, answer.
- **The prompt restricts answers to the passages** and asks for a citation. That's what turns plausible into verifiable.
- **Return the sources**, so humans can check.

## Reviewer's view

> Every chat turn retrieves four help center passages and instructs the model to answer policy questions only from them.

Check two things: the prompt's rule for *"the articles don't answer it"* (here: hand over to a colleague, never guess), and the test that asserts the passages actually reach the model. A RAG feature whose retrieval silently returns nothing looks exactly like one that works, until it makes something up.

[Sample: step 15](https://github.com/3flows/intelligence-samples/tree/main/support-desk/steps/15-rag) · Next: [Rerank](./rerank.md)
