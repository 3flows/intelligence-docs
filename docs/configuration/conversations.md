---
title: Chatbot configuration
---

# Chatbot configuration

The old `conversations:` configuration from the 0.8 documentation has been replaced by top-level `chatbots:` in Intelligence 0.9.

## Basic chatbot

```yaml
chatbots:
  - name: support
    type: conversation
    model: DEFAULT
    instructions:
      - Help customers with short, factual answers.
    history:
      maxMessages: 20
    http:
      path: /support
```

## With tools and policy

```yaml
chatbots:
  - name: support
    type: conversation
    model: DEFAULT
    instructions:
      - Look up orders before answering order-status questions.
    tools:
      - service: SupportService
        tags: [public]
    toolPolicy:
      denyTags: [internal]
      allowDestructive: false
      requireConfirmation: true
```

## With prompts and AG-UI

```yaml
chatbots:
  - name: support
    type: conversation
    model: DEFAULT
    prompts:
      - name: support.chatbot.base
        version: v1
    agui:
      useHttp: api
      path: /support/agui
      interactions:
        enabled: true
```

## Storage

Chatbot runtime records live in `IntelligenceChatbotDomain` as sessions, messages, files, and reactions. Configure normal Platform storage/domains for your runtime as you would for other Platform-native domains.

Do not configure old `conversations.store.type: entities`; that storage model and the old conversation ontology are not part of the 0.9 architecture.

## Related configuration

- `ais:` selects providers and models.
- `prompts:` defines reusable prompt bundles.
- `skills:` defines reusable capability bundles.
- `agents:` defines task/run harnesses.
- `intelligence.inference.require` enforces metadata, timeouts, or abort signals.

See [Chatbots](../concepts/chatbots.md) and [Migration guide: 0.8 to 0.9](../migration-0.8-to-0.9.md).
