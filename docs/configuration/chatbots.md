---
title: chatbots
---

# `chatbots`

Configured assistants with their own sessions. Concepts: [Chatbots](../concepts/chatbots.md).

```yaml
chatbots:
  - name: shop
    type: conversation
    model: DEFAULT
    greeting: Hi, I'm the Velo assistant.
    prompts:
      - name: shop.assistant
        version: v1
    history:
      maxMessages: 20
    tools:
      - service: HelpCenterService
        tags: [public]
    toolPolicy:
      allowDestructive: false
    http:
      useHttp: public
      path: /shop
```

| Field | Description |
|---|---|
| `name` | The chatbot's name: `Intelligence.chatbots().chatbot(name)` |
| `type` | `conversation` (default), `retrieval` or `structured` |
| `displayName` | A name for people |
| `model` | An AI from [`ais`](./ais.md) |
| `instructions` | Instructions, as text or a list |
| `prompts` | Instructions from the [prompt catalog](./prompts.md): `{ name, version }` |
| `greeting` | The first message of every session |
| `initialRecommendations` | Suggested first questions, returned when a session starts |
| `disclaimer` | Text returned with every answer |
| `history` | What the model sees of a session: `maxMessages`, `maxTokens` |
| `tools` | Tool references: `service`, narrowed by `tags`, `include`, `exclude`. Only handlers marked with `tool(...)` are found |
| `toolPolicy` | `allowTags`, `denyTags`, `allowDestructive`, `requireConfirmation` |
| `retrieval` | For `type: retrieval`: `sources`, `topK`, `cite`. A source is a collection of documents: `docs` (the collection), and optionally `doc` (the docs provider, default `DEFAULT`), `query` (a filter), `textField`, `titleField`, `idField` |
| `responseSchema` | For `type: structured`: `{ name?, schema }`, a JSON schema |
| `inputValidation`, `outputValidation` | Reject messages or answers that fail the built-in text checks |
| `allowedMimeTypes`, `secureFileUpload`, `useAV` | Rules for uploaded files |
| `customizable` | Allow a session to override the prompt and model settings when it starts |
| `observabilityTag`, `metadata` | Passed to traces and records |
| `http` | Serve the chatbot over HTTP: `path`, and `useHttp` (the name of a server in `https`, default `DEFAULT`) |
| `agui` | Serve it as an AG-UI endpoint: `path`, `useHttp` |

A chatbot is added to the HTTP server named in `useHttp` as a service of its own. Give it a server where no other service is mounted at the root path, or a server of its own.

## Storage

Sessions, messages, files and reactions are stored in the `IntelligenceChatbot` domain:

```yaml
entities:
  backend: docs
  domains:
    - IntelligenceChatbot
```

The startup validation warns when chatbots are configured without it, when a chatbot's history is unbounded, and when it refers to an AI or a prompt that doesn't exist.
