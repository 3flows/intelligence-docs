---
title: 9. Remember
---

# 9. Remember

**Where we are:** every ticket is triaged into data; `draftReply` drafts one reply at a time.

**The problem:** Velo wants a chat on the ticket page, so customers can talk to the assistant while they wait. But every call is independent: when Ada writes *"It's the front one"*, the model has no idea what *it* is.

## The solution: `conversations()`

A model [remembers nothing](../concepts/models-for-developers.md#1-its-stateless). A conversation is our application remembering for it: it stores the messages under an id and sends them along with every new question. Conversations are the second thing an intelligent service finds in its trigger context: `conversations()`, next to `inference()`.

```ts title="services.ts"
// highlight-start
/** The assistant for one ticket: its conversation, its prompt, and the ticket as context. */
const assistant = (context: Pick<IntelligenceContext, 'conversations'>, ticket: StoredTicket) => context.conversations()
    .conversation(`ticket-${ticket.id}`)
    .prompt('support.chat', { shop: 'Velo' })
    .with({ subject: ticket.subject, body: ticket.body, triage: ticket.triage });
// highlight-end

export const ChatMessage = t.object({ ticketId: t.string(), message: t.string() });
export const ChatAnswer = t.object({ answer: t.string() });

handler('chat', ChatMessage, ChatAnswer, async ({ ticketId, message }, trigger) => {
    const ticket = await trigger.context.doc().collection('tickets').by(ticketId).get<StoredTicket>();
    if (!ticket) return trigger.notFound(`Ticket ${ticketId} not found`);

    // highlight-next-line
    const answer = await assistant(trigger.context, ticket).ask(message);
    await trigger.ok({ answer: answer.text ?? '' });
})
```

- **The id is ours**: one conversation per ticket. The same id continues the same conversation, from any request.
- **The history** (Ada's messages and the assistant's answers) is stored by the conversation.
- **The ticket** is passed with `with(...)` on every turn. It's context, not history: it isn't stored as a message, and when the ticket changes, the next turn sees the new state.
- **The prompt** is also sent on every turn and not stored. Improve `support.chat`, and running conversations use the new version from their next message.

```yaml title="intelligence.yml"
prompts:
  - name: support.chat
    version: v1
    template: |
      You are the support assistant of {{ shop }}, a bike shop, chatting with a customer about their ticket.
      You get the ticket as context. Help the customer, ask for missing details, and keep answers short.
      Never promise refunds, discounts or delivery dates; say that the team will confirm.
```

## Where the history lives

In memory, by default: fine for a demo, gone on restart. For the real thing, conversations become **entities**, with the ontology Intelligence brings along:

```yaml title="intelligence.yml"
# highlight-start
conversations:
  store:
    type: entities

entities:
  backend: docs
  ontologies:
    - IntelligenceConversationsOntology
# highlight-end
```

Now every conversation is data: `AIConversation`, one `AIConversationTurn` per `ask`, one `AIConversationMessage` per message. The agents want to see the chat next to the ticket:

```ts title="services.ts"
import { ConversationMessageEntity } from '@3flows/intelligence';

const Message = t.object({ role: t.string(), content: t.string() });

handler('transcript', t.object({ ticketId: t.string() }), t.array(Message), async ({ ticketId }, trigger) => {
    const messages = await ConversationMessageEntity
        .find({ conversationKey: `ticket-${ticketId}` })
        .sort({ index: 1 })
        .all();
    await trigger.ok(messages.map((message: any) => ({ role: message.data.role, content: message.data.content })));
})
```

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

test('another ticket has its own conversation', async () => { /* … its first request has no messages */ });
```

## Memory is a product decision

Every turn resends the whole history: more tokens, more cost, more latency, and eventually the context window is full. And a conversation stores what customers typed, which is personal data with a retention period. One conversation per ticket keeps both bounded. `conversation.clear()` deletes one when the ticket is closed.

## What you learned

- **`conversations().conversation(id)`** is `chat()` with a history. The id is yours.
- **Context goes in `with(...)`, history is stored.** Prompts and context are sent every turn.
- **`store: entities`** makes conversations durable, shared and queryable.

## Reviewer's view

> Customers chat with an assistant per ticket; the history is stored as entities under `ticket-<id>`.

The key question is the id. It decides who shares a history: anyone who can call `chat` with a ticket id can read and continue that conversation. In production, `chat` must check that the caller owns the ticket. The second question is retention: who clears conversations of closed tickets? [Chapter 25](./going-live.md) answers it.

[Sample: step 09](https://github.com/3flows/intelligence-samples/tree/main/support-desk/steps/09-remember) · Next: [Stream](./stream.md)
