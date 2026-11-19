---
title: Chatbots
---

# Chatbots

A **chatbot** is a configured assistant that holds its own conversations: one person, one assistant, a session with a history. It's configuration, not code.

Use a chatbot when the conversation *is* the feature. When a service owns the work around the conversation (a ticket, a case, an order), and decides per turn what the model gets, use [`chat()` with `messages(...)`](../api/chat.md#history) in that service instead. The tutorial shows both: [Remember](../tutorial/remember.md) and [A chatbot](../tutorial/a-chatbot.md).

## What a chatbot is made of

```yaml
chatbots:
  - name: shop
    type: conversation
    model: DEFAULT                 # an AI from `ais`
    greeting: Hi, I'm the Velo assistant.
    prompts:                       # its instructions, from the prompt catalog
      - name: shop.assistant
        version: v1
    history:
      maxMessages: 20              # what the model sees of a session
    tools:                         # handlers marked with tool(...), by service and tag
      - service: HelpCenterService
        tags: [public]
    toolPolicy:
      allowDestructive: false
    http:                          # where it's reachable
      useHttp: public
      path: /shop
```

Every field is described in the [configuration reference](../configuration/chatbots.md).

There are three types:

| `type` | |
|---|---|
| `conversation` | A multi-turn chat with instructions and, optionally, tools |
| `retrieval` | A chat that answers from documents in `docs`, configured under `retrieval` |
| `structured` | A chat whose answers match a JSON schema, configured under `responseSchema` |

## Sessions

A conversation with a chatbot is a **session**. Starting one returns its id and the greeting; every message is sent to a session:

```ts
const chatbot = Intelligence.chatbots().chatbot('shop');

const { conversationId } = await chatbot.session().start();
const answer = await chatbot.session(conversationId).message().text('Can I return a helmet?').send();

answer.message;   // the reply
```

`message().stream()` returns an [`InferenceStream`](../api/results-and-streams.md#streams) of chatbot events (`message.started`, `message.delta`, tool events, `message.completed`). `session(id).messages().list()` reads the session, `session(id).delete()` deletes it.

The session id is created by the chatbot. An application that wants one session per customer or per case stores the id with its own record.

## Over HTTP

With `http`, a chatbot is served on a platform HTTP server, under its `path`:

| | |
|---|---|
| `POST /conversation` | Start a session |
| `POST /conversation/:id` | Send a message |
| `POST /conversation/:id/stream` | Send a message, answer as server-sent events |
| `GET /conversation/:id` | The messages of the session |
| `DELETE /conversation/:id` | Delete the session |
| `POST /conversation/:id/file`, `GET /conversation/:id/file` | Upload and list files of the session |
| `POST /conversation/:id/:messageid/reaction`, `GET /conversation/:id/reactions` | Feedback on answers: `like`, `dislike`, `report` |

With `agui`, the same chatbot is also served as an AG-UI endpoint, for frontends that speak that protocol.

## Tools

A chatbot may use the handlers that were marked as tools with [`tool(...)`](./tools.md#marked-tools-tool), selected by service and narrowed with `tags`, `include` or `exclude`. `toolPolicy` is the limit on top: `allowTags` and `denyTags`, `allowDestructive: false` to keep out every tool that changes data, and `requireConfirmation` to ask the person before a tool runs.

Chatbot tools can't be scoped per call: they see what the model passes. A tool that must only return *this* customer's data belongs in a service that knows the customer. See [Act](../tutorial/act.md).

## Where sessions are stored

Chatbots keep their records in the **`IntelligenceChatbot`** domain: profiles, sessions, messages, files and reactions. Register it next to the other domains:

```yaml
entities:
  backend: docs
  domains:
    - IntelligenceTrace
    - IntelligenceChatbot
```

These are the technical records of a conversation. They aren't the place for business data: what the application needs to keep, it stores itself.

## Reviewer's view

A chatbot's YAML is its contract: the prompt, the tools, the server it's on. Check three things. **What may it do?** The tool list, and whether any tool on it changes data. **Who can reach it?** The HTTP server and its authentication. **What is kept?** Sessions hold what people typed; decide who deletes them, and when.
