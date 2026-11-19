---
title: 9. Remember
---

# 9. Remember

**Where we are:** every ticket is triaged into data; `draftReply` drafts one reply at a time.

**The problem:** Velo wants a chat on the ticket page, so customers can talk to the assistant while they wait. But every call is independent: when Ada writes *"It's the front one"*, the model has no idea what *it* is.

## The solution: send the history along

A model [remembers nothing](../concepts/models-for-developers.md#1-its-stateless). If it "remembers" what Ada wrote a minute ago, that's because we sent it again. So memory is our application's job: store what was said, and send the relevant part with every new question.

The ticket is ours, and so is its chat. It gets a small file of its own:

```ts title="chat.ts"
import { AIMessage, History, IntelligenceServiceContext } from '@3flows/intelligence';

export type ChatTurn = { role: 'user' | 'assistant'; content: string };

type Docs = Pick<IntelligenceServiceContext, 'doc'>;

/** Everything said on a ticket so far. */
export const chatOf = async (context: Docs, ticketId: string): Promise<ChatTurn[]> =>
    (await context.doc().collection('chats').by(ticketId).get<{ messages: ChatTurn[] }>())?.messages ?? [];

/** Store one turn: what the customer wrote, and what the assistant answered. */
export async function remember(context: Docs, ticketId: string, message: string, answer: string): Promise<void> {
    const messages: ChatTurn[] = [
        ...(await chatOf(context, ticketId)),
        { role: 'user', content: message },
        { role: 'assistant', content: answer }
    ];
    await context.doc().collection('chats').by(ticketId).set({ ticketId, messages });
}

// highlight-start
/** What the model gets of it: the last messages, not the whole chat. */
export const recent = (messages: ChatTurn[]): AIMessage[] => History.window(messages, { maxMessages: 20 });
// highlight-end
```

The chat is stored in `docs`, under the ticket's id, exactly like the ticket. The only Intelligence in this file is **`History.window`**: it keeps the last messages, so a long chat doesn't grow the request forever.

`chat()` takes the history with **`messages(...)`**:

```ts title="services.ts"
// highlight-start
/** The assistant for one ticket: its history, its prompt, and the ticket as context. */
const assistant = (context: Pick<IntelligenceServiceContext, 'inference'>, ticket: StoredTicket, history: ChatTurn[]) => context.inference()
    .chat()
    .messages(recent(history))
    .prompt('support.chat', { shop: 'Velo' })
    .with({ subject: ticket.subject, body: ticket.body, triage: ticket.triage });
// highlight-end

export const ChatMessage = t.object({ ticketId: t.string(), message: t.string() });
export const ChatAnswer = t.object({ answer: t.string() });

handler('chat', ChatMessage, ChatAnswer, async ({ ticketId, message }, trigger) => {
    const ticket = await trigger.context.doc().collection('tickets').by(ticketId).get<StoredTicket>();
    if (!ticket) return trigger.notFound(`Ticket ${ticketId} not found`);

    // highlight-start
    const history = await chatOf(trigger.context, ticketId);
    const answer = await assistant(trigger.context, ticket, history).question(message).answer();
    await remember(trigger.context, ticketId, message, answer.text ?? '');
    // highlight-end
    await trigger.ok({ answer: answer.text ?? '' });
})
```

- **The history** (Ada's messages and the assistant's answers) goes in `messages(...)`. The model sees it as the conversation so far.
- **The ticket** is passed with `with(...)` on every turn. It's context, not history: it isn't stored as a message, and when the ticket changes, the next turn sees the new state.
- **The prompt** is also sent on every turn and not stored. Improve `support.chat`, and running chats use the new version from their next message.
- **The turn is stored after the answer.** A failed model call stores nothing, so the customer can simply send the message again.

```yaml title="intelligence.yml"
prompts:
  - name: support.chat
    version: v1
    template: |
      You are the support assistant of {{ shop }}, a bike shop, chatting with a customer about their ticket.
      You get the ticket as context. Help the customer, ask for missing details, and keep answers short.
      Never promise refunds, discounts or delivery dates; say that the team will confirm.
```

## The chat is a record

Because the chat is our own data, the agents can read it next to the ticket, with no model involved:

```ts title="services.ts"
const Message = t.object({ role: t.string(), content: t.string() });

handler('transcript', t.object({ ticketId: t.string() }), t.array(Message), async ({ ticketId }, trigger) => {
    await trigger.ok(await chatOf(trigger.context, ticketId));
})
```

`docs` is `memory` in this step: fine for a demo, gone on restart. [Chapter 25](./going-live.md) moves it to a database, without touching this code.

:::note Why not a chatbot?
Intelligence also has **chatbots**: configured assistants that keep their own sessions and history. They fit one person talking to one assistant. Here, the service owns the work: it adds the ticket to every turn, and later the customer's orders, help-center articles and guardrails. When the application owns the history and the context, a `chat()` with `messages(...)` is the right tool. [Chapter 26](./a-chatbot.md) adds a chatbot where it fits: the shop's public help chat.
:::

## Run it

```sh
yarn step:09
curl -X POST localhost:3000/chat -H 'Content-Type: application/json' -d '{"ticketId":"5f0c…","message":"The brake pads don’t fit."}'
curl -X POST localhost:3000/chat -H 'Content-Type: application/json' -d '{"ticketId":"5f0c…","message":"It’s the front one."}'
```

```json
{ "answer": "Sorry about that! Could you tell me which brake it is, front or rear?" }
{ "answer": "Thanks! I’ve noted that the front brake pads for your Velo City 3 don’t fit. The technical team will confirm the right ones." }
```

The second answer knows what *it* is.

## Test it

```ts title="step.test.ts"
test('the second turn sees the first', async () => {
    ScriptedAI.reset(() => 'Which brake is it, front or rear?');
    await post('http://127.0.0.1:3000/chat', { ticketId: id, message: 'The brake pads don’t fit.' });

    ScriptedAI.reset(() => 'Thanks, noted: the front brake pads.');
    await post('http://127.0.0.1:3000/chat', { ticketId: id, message: 'It’s the front one.' });

    assert.deepEqual(ScriptedAI.requests[0].messages.map((m) => [m.role, m.content]), [
        ['user', 'The brake pads don’t fit.'],
        ['assistant', 'Which brake is it, front or rear?']
    ]);
});

test('the chat is stored under the ticket id, as our own record', async () => { /* … transcript returns both messages */ });
test('another ticket has its own chat', async () => { /* … its first request has no messages */ });
```

## Memory is a product decision

Every turn resends history: more tokens, more cost, more latency, and eventually the context window is full. `History.window` bounds that: the model sees the last 20 messages (`maxTokens` bounds by size instead). What the *model* sees and what *we* keep are two decisions: the record keeps everything until we delete it.

And the record stores what customers typed, which is personal data with a retention period. One chat per ticket keeps that manageable: when the ticket goes, its chat goes with it.

## What you learned

- **A model is stateless; the application remembers.** `chat().messages(history)` sends what was said before.
- **`History.window(messages, { maxMessages })`** bounds what the model sees.
- **Context goes in `with(...)`, history in `messages(...)`.** Prompts and context are sent every turn; only the turn itself is stored.
- **The chat is the application's record**, in `docs`, readable without a model.

## Reviewer's view

> Customers chat with an assistant per ticket; the chat is stored in `docs` under the ticket id, and the model sees its last 20 messages.

The key question is the id. It decides who shares a history: anyone who can call `chat` with a ticket id can read and continue that chat. In production, `chat` must check that the caller owns the ticket. The second question is retention: who deletes the chats of closed tickets? [Chapter 25](./going-live.md) answers it.

[Sample: step 09](https://github.com/3flows/intelligence-samples/tree/main/support-desk/steps/09-remember) · Next: [Stream](./stream.md)
