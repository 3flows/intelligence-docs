---
title: 3. Add a chatbot
---

# 3. Add a chatbot

A chatbot is a configured human-facing AI surface with sessions. Use it when one external human talks to one named AI assistant.

Do not use a chatbot as a function call from your code. For that, use Fluent inference.

## Starter chatbot

```yaml title="starter/intelligence.yml"
chatbots:
  - name: support
    type: conversation
    model: DEFAULT
    prompts:
      - name: support.chatbot.base
        version: v1
    history:
      maxMessages: 20
    http:
      path: /support
    tools:
      - service: SupportService
        tags: [public]
    toolPolicy:
      allowDestructive: false
```

This creates a chatbot profile named `support`.

- `type: conversation` means normal multi-turn chat.
- `history.maxMessages` bounds how much previous session history is reused.
- `http.path` exposes HTTP conversation compatibility routes.
- `tools` discovers model-facing service tools.
- `toolPolicy` limits what the model may call.

## Chatbot storage is not business storage

Chatbot records are technical session records:

- `ChatbotSession`,
- `ChatbotMessage`,
- `ChatbotFile`,
- `ChatbotReaction`.

Your application still owns business records such as tickets, orders, decisions, and approvals.

## Add tools through services

A chatbot should call service tools, not arbitrary code:

```ts title="starter/support-service.ts"
tool(
  'lookupOrder',
  OrderInput,
  OrderOutput,
  async ({ number }, trigger) => {
    await trigger.ok({ number, status: number === 'A-1042' ? 'shipped' : 'unknown' });
  },
  {
    description: 'Look up a sample order status by order number.',
    readOnly: true,
    tags: ['public', 'orders']
  }
)
```

The same tool metadata can be reused by Fluent chat, chatbots, agents, and MCP.

## Chatbot or Fluent?

| Use chatbot when... | Use Fluent when... |
| --- | --- |
| An external human needs a chat session | Code needs one model result |
| The session owns history/files/reactions | Your app owns the history |
| HTTP/AG-UI client integration is the goal | The call is a service/workflow step |

Next: [package capabilities as skills and run agents](./04-agents-and-skills.md).
