---
title: 26. A chatbot
---

# 26. A chatbot

**Where we are:** the desk runs in production. Customers chat with the assistant on their ticket: the service owns that chat, and adds the ticket, the orders and the help center to every turn.

**The problem:** Velo wants a help chat on the shop's website. Visitors there have no ticket, and often no order yet: *"Can I return a helmet?"*, *"How fast do you ship?"* There's nothing for our service to own: no record, no rules about whose data it is. Building `chat.ts`, a session id and two routes again, just to hold a conversation, would be code without a purpose.

## The solution: `chatbots`

A **chatbot** is a configured assistant that holds its own conversations: one person, one assistant, a session with a history. It's the right tool when the conversation *is* the feature. It's configuration, not code:

```yaml title="intelligence.yml"
# The shop's public help chat: one visitor, one assistant, sessions and history kept by the chatbot.
chatbots:
  - name: shop
    type: conversation
    model: DEFAULT
    greeting: Hi, I'm the Velo assistant. Ask me about returns, shipping, sizes or assembly.
    prompts:
      - name: shop.assistant
        version: v1
    history:
      maxMessages: 20        # what the model sees of a session
    tools:
      - service: HelpCenterService
        tags: [public]       # only handlers marked as tools, and only the public ones
    toolPolicy:
      allowDestructive: false
    http:
      useHttp: public
      path: /shop
```

- **`model`** names an AI from `ais`, as `.model(...)` does in code.
- **`prompts`** are the chatbot's instructions, from the same catalog as everything else: named, versioned, reviewed.
- **`history.maxMessages`** is `History.window` from [chapter 9](./remember.md), as configuration.
- **`tools`** and **`toolPolicy`** say what the chatbot may do. More on that below.
- **`http`** puts it on an HTTP server.

Its prompt says what it is, and what it isn't:

```yaml title="intelligence.yml"
prompts:
  - name: shop.assistant
    version: v1
    description: The public help chat on the shop's website
    template: |
      You are the assistant on the website of Velo, a bike shop. Visitors ask general questions before or after buying.
      - Answer only from the help center. Search it before you answer; if it has no answer, say so and point to the contact form.
      - Mention the title of the article you used.
      - You don't know anything about a visitor's orders or tickets. For those, point to the ticket page.
      - Never promise refunds, discounts or delivery dates.
      - Keep answers short.
```

### Its own server

The website is the public internet. The API on port 3000 is for the team's tools. So the chatbot gets a server of its own, with nothing else on it:

```yaml title="intelligence.yml"
https:
  - name: api
    port: 3000
    services:
      - name: SupportService
      # …
  # The shop's website talks to its own server: the public chat, and nothing else.
  - name: public
    port: 3001
```

`useHttp: public` puts the chatbot there. Its routes are:

| | |
|---|---|
| `POST /shop/conversation` | Start a session. Answers with the greeting and a `conversationId` |
| `POST /shop/conversation/:id` | Send a message, get the answer |
| `POST /shop/conversation/:id/stream` | The same, streamed as server-sent events |
| `GET /shop/conversation/:id` | The messages of the session |

### Tools: handlers with a description

The chatbot should answer from the help center, and `HelpCenterService` already has the search. In [chapter 11](./act.md), we wrote a tool by hand, because it had to be scoped to one customer. This one is safe with any input, so the handler itself can be the tool. **`tool(...)`** is `handler(...)` with a description for the model:

```ts title="help-center.ts"
import { IntelligenceServiceContext, IntelligenceService, handler, tool } from '@3flows/intelligence';

// A tool is a handler with a description for the model. Whoever is given this service's tools gets this one.
// highlight-next-line
tool('searchArticles', SearchQuery, t.array(Passage), async ({ query, limit = 5 }, trigger) => {
    // … the search, unchanged
}, {
    // highlight-start
    name: 'search_help_center',
    description: 'Search the Velo help center: returns, shipping, assembly, sizes and care. Returns the most relevant passages with the title of their article.',
    readOnly: true,
    tags: ['public']
    // highlight-end
})
```

It's still a handler: `SupportService` calls it as before. What's new is the metadata: a name and a description written for a model, `readOnly`, and tags.

`tools: [{ service: HelpCenterService, tags: [public] }]` then means: *every handler of that service that is marked as a tool and tagged `public`*. `importArticles` isn't a tool, so the chatbot can't call it, whatever a visitor writes. `toolPolicy.allowDestructive: false` is the second lock: should someone add a tool that changes data later, this chatbot doesn't get it.

The same discovery works in code, with `chat().toolsFrom('HelpCenterService', { tags: ['public'] })`.

### Where sessions live

The chatbot keeps its sessions and messages in a domain of its own, registered next to the trace domain:

```yaml title="intelligence.yml"
entities:
  backend: docs
  domains:
    - IntelligenceTrace
    - IntelligenceChatbot    # chatbot sessions and their messages
```

Three kinds of records, three purposes: **tickets and their chats** are our business data, **chatbot sessions** are the technical state of a conversation, **traces** are the evidence of what the model did.

## Chatbot, or `chat()` in a service?

| | Chatbot | `chat()` with `messages(...)` |
|---|---|---|
| Who owns the history | the chatbot: sessions | our service: a record of ours |
| What the model sees besides the history | its prompt and its tools | whatever the service adds per turn: the ticket, articles, files |
| Tools | handlers marked as tools, by service and tag | anything, also scoped per call |
| Guardrails | `inputValidation`, `outputValidation`, `toolPolicy` | our own, before and after the model |
| Code | none | a handler, a route, a store |

The ticket assistant stays what it is: it needs the customer's ticket, the customer's orders and a review of every reply. The website chat needs none of that. **A chatbot is for a conversation; a service is for work that includes a conversation.**

## Run it

```sh
yarn step:26
curl -X POST localhost:3000/help-center/importArticles -H 'Content-Type: application/json' -d @steps/26-a-chatbot/articles.json
curl -X POST localhost:3001/shop/conversation
```

```json
{ "id": "session:8c1f…", "conversationId": "session:8c1f…", "message": "Hi, I'm the Velo assistant. Ask me about returns, shipping, sizes or assembly." }
```

```sh
curl -X POST 'localhost:3001/shop/conversation/session:8c1f…' -H 'Content-Type: application/json' \
  -d '{"message":"Can I return a helmet?"}'
```

The same chatbot can be used from code, for example from a test or another service:

```ts
const chatbot = Intelligence.chatbots().chatbot('shop');

const { conversationId } = await chatbot.session().start();
const answer = await chatbot.session(conversationId).message().text('How fast do you ship?').send();
```

## Test it

No new test helper is needed: the chatbot runs on the same scripted provider.

```ts title="step.test.ts"
/** First round: the model searches the help center. Once the passages are there, it answers. */
const searches = (query: string, answer: string) => (request: AIChatRequest) => request.messages.at(-1)?.role === 'tool'
    ? answer
    : { text: '', toolCalls: [{ id: 'call-1', name: 'search_help_center', arguments: { query } }] };

test('the chatbot answers with its prompt, and with the tools of the help center only', async () => {
    ScriptedAI.reset(searches('return policy', 'You can return unused items within 30 days (Returns and refunds).'));

    const answer = await post(`${SHOP}/conversation/${encodeURIComponent(session)}`, { message: 'Can I return a helmet?' });

    assert.equal(answer.message, 'You can return unused items within 30 days (Returns and refunds).');
    const [first, second] = ScriptedAI.requests;
    assert.match(String(first.instructions), /assistant on the website of Velo/);
    // highlight-next-line
    assert.deepEqual(first.tools?.map((tool) => tool.name), ['search_help_center']);
    // The second round got passages from the help center as the tool's result.
    const passages = JSON.parse(String(second.messages.at(-1)!.content));
    assert.ok(passages.length > 0 && passages.every((passage: any) => passage.title && passage.text));
});

test('a session starts with the greeting from YAML, without a model call', async () => { /* … */ });
test('the session keeps the history: the next message sees the turn before', async () => { /* … */ });
test('sessions and messages are records of the chatbot domain, apart from tickets and chats', async () => { /* … */ });
```

The highlighted line is the permission list of this chatbot, as a test.

:::caution Long sessions in 0.9.0-next.4
In this version, a chatbot reads only the first ten stored messages of a session. After about four turns, the model no longer sees the whole conversation. Short help chats work; don't rely on long sessions until this is fixed. See [Known gaps](../guides/known-gaps.md#chatbots-and-agents).
:::

## What you learned

- **A chatbot is a configured assistant with its own sessions**: model, prompts, history, tools and HTTP exposure in YAML.
- **`tool(...)`** marks a handler as usable by a model, with a name, a description and tags. Chatbots, agents and `toolsFrom(...)` find tools by service and tag.
- **Chatbot sessions live in the `IntelligenceChatbot` domain**, apart from business data and from traces.
- **Use a chatbot when the conversation is the feature**; use `chat()` in a service when the service owns the work.

## Reviewer's view

> A public help chat on its own server, answering from the help center only; sessions are stored in the chatbot domain.

Read the YAML as the contract: the prompt, the tool list and the server. Two questions for a public endpoint. Who may call it? That's the platform's `https` configuration. And retention: sessions hold what visitors typed, and they're kept until someone deletes them, with `chatbot.session(id).delete()`. Decide who does that, and when.

[Sample: step 26](https://github.com/3flows/intelligence-samples/tree/main/support-desk/steps/26-a-chatbot) · Next: [Skills and agents](./skills-and-agents.md)
