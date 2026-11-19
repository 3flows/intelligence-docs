# Chatbots

Chatbots are the current high-level interactive surface in Intelligence 0.9. They replace the old internal `conversations` concept while keeping HTTP route names such as `/conversation` where compatibility matters.

Use a chatbot when you need a named assistant with sessions, history, files, reactions, tools, structured output, retrieval context, HTTP exposure, or AG-UI exposure.

## Chatbot types

Current stable types are:

| Type | Use it for |
| --- | --- |
| `conversation` | General multi-turn chat with instructions and optional tools |
| `retrieval` | Chat grounded in retrieved context |
| `structured` | Chat that must return a configured schema |

`task` is intentionally deferred; use agents for task/run semantics.

## Configuration

```yaml
chatbots:
  - name: support
    type: conversation
    model: DEFAULT
    instructions:
      - You answer support questions for Velo.
      - Be concise and ask for a human when confidence is low.
    prompts:
      - name: support.chatbot.base
        version: v1
    history:
      maxMessages: 20
    http:
      path: /support
    agui:
      useHttp: api
      path: /support/agui
      interactions:
        enabled: true
    toolPolicy:
      requireConfirmation: true
      allowDestructive: false
    tools:
      - service: SupportService
```

## Sessions and records

A chatbot session is the durable runtime record for a user/thread/ticket conversation. 0.9 deliberately keeps these records separate from technical traces and business data:

- `ChatbotSession` tracks the chatbot profile and session.
- `ChatbotMessage` stores messages.
- `ChatbotFile` stores file metadata.
- `ChatbotReaction` stores user feedback.
- `IntelligenceTraceDomain` stores model/tool-call evidence.
- Your app stores business state such as tickets and orders.

This separation matters for retention: closing a support ticket may delete the chatbot session while preserving an auditable business event or deleting technical traces on a different schedule.

## Tools

A chatbot can discover model-facing tools from Platform services. Prefer `tool(...)` handlers in your services:

```ts
import { IntelligenceService, tool } from '@3flows/intelligence';
import { Register, t } from '@3flows/intelligence/platform';

@Register()
export class SupportService extends IntelligenceService {
  handlers = () => [
    tool(
      'lookupOrder',
      t.object({ number: t.string() }),
      t.object({ status: t.string() }),
      async ({ number }, trigger) => trigger.ok({ status: `Order ${number} shipped` }),
      { description: 'Look up an order by order number.', readOnly: true, tags: ['public'] }
    )
  ];
}
```

Then expose all eligible tools, selected tools, or tagged tools:

```yaml
tools:
  - service: SupportService
  - service: BillingService
    include: [lookupInvoice]
  - service: UiService
    tags: [ui]
```

`toolPolicy` can filter tags, block destructive tools, require confirmation, and bound tool rounds.

## AG-UI

The `agui` block exposes a chatbot as an AG-UI HTTP/SSE endpoint. Intelligence maps AG-UI state, context, forwarded props, resume data, and form submissions into structured model-visible context. The frontend still owns rendering; models request typed UI through tools rather than emitting arbitrary HTML or JavaScript.

## Compatibility with old conversations

The word `conversation` still appears in HTTP compatibility routes, but it is not the old 0.8 internal model. Use `chatbots:` in YAML and chatbot domain records for durable sessions.
