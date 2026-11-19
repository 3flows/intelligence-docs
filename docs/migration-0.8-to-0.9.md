# Migration guide: 0.8 to 0.9

Intelligence 0.9 is not a small API rename. It removes the old framework layer and keeps the parts that map cleanly to Platform: services, handlers, routes, docs/blobs/vectors, domains, flows, prompts, policies, and runtime context.

## Migration checklist

1. Replace local preview wrappers with `IntelligenceService`, `handler`, and `tool` from `@3flows/intelligence`.
2. Move from `conversations:` to `chatbots:` for interactive assistants.
3. Replace old internal conversation storage assumptions with chatbot domain records.
4. Replace channels/coworkers/old agents with the 0.9 agent harness.
5. Replace old `Skill.tools()` style abstractions with Platform service `tool(...)` handlers and top-level `skills:` configuration.
6. Move long-running, multi-step business logic into workflows.
7. Add metadata and timeouts to model calls; consider `intelligence.inference.require`.
8. Update tests to `@3flows/intelligence/testing`.
9. Review storage/retention for business docs, chatbot records, agent records, and traces separately.

## Imports

### Before

Many 0.8 samples carried a local wrapper that injected `inference()`, `conversations()`, and `prompts()` into the trigger context.

```ts
import { IntelligenceService, handler } from '../_shared/intelligence-service.js';
import { Register, t } from '@3flows/platform';
```

### After

```ts
import { IntelligenceService, handler, tool } from '@3flows/intelligence';
import { Register, t } from '@3flows/intelligence/platform';
```

The service context now includes current Intelligence primitives: `ai(...)`, `inference()`, `prompts()`, `skill(...)`, `skills()`, `agent(...)`, `agents()`, `workflow(...)`, and `workflows()`.

## Conversations became chatbots

### Before

```yaml
conversations:
  store:
    type: entities
```

```ts
const answer = await trigger.context
  .conversations()
  .conversation(`ticket-${ticket.id}`)
  .instructions('Help the customer.')
  .ask(message);
```

### After

```yaml
chatbots:
  - name: support
    type: conversation
    model: DEFAULT
    instructions:
      - Help the customer.
    history:
      maxMessages: 20
    http:
      path: /support
    tools:
      - service: SupportService
```

Use `Intelligence.chatbots()` / `trigger.context` chatbot APIs for configured chatbot execution and HTTP exposure. If you need one history per ticket, use a chatbot session id derived from the ticket id. The compatibility HTTP route still says `/conversation`, but the durable records are `ChatbotSession`, `ChatbotMessage`, `ChatbotFile`, and `ChatbotReaction`.

### Storage migration

Old entity-backed conversation records do not map one-to-one to 0.9 internals. Plan a one-time migration:

| Old record | New home |
| --- | --- |
| Business ticket/order state | Your Platform docs/entities/domain |
| Conversation transcript | `IntelligenceChatbotDomain` session/message records, or archive-only docs if you do not need live continuation |
| Tool-call technical details | `IntelligenceTraceDomain` model/tool records |
| Attachments/files | Chatbot files plus Platform blobs, depending on retention requirements |

Do not use traces as your business history. Traces are technical evidence; business state belongs to your application.

## Channels, coworkers, and old agents

0.8-era channels, old coworker/actor runtimes, and `Channel → Agent → Skill` dispatch are gone.

### Before

A channel routed user input to an agent, which assembled skills and tools through framework dispatch.

### After

Choose one of these explicit surfaces:

- **Chatbot** when the main abstraction is a user session/conversation.
- **Agent** when the main abstraction is a task/run with events, tools, policy, workspace memory, and optional peer delegation.
- **Workflow** when the main abstraction is deterministic orchestration with reports, branches, waits, retries, and timeouts.
- **Fluent inference** when one model call or a small chain is enough.

## Skills changed meaning

A skill is now declarative configuration: reusable instructions plus tool references. It is not the old core execution abstraction.

```yaml
skills:
  - name: order_resolution
    instructions:
      - Inspect order status before proposing actions.
    tools:
      - service: SupportService
```

Attach skills to agents:

```yaml
agents:
  - name: order_ops
    model: DEFAULT
    skills: [order_resolution]
```

Put executable behavior in Platform handlers marked with `tool(...)`:

```ts
tool('lookupOrder', Input, Output, async (params, trigger) => {
  await trigger.ok(await lookup(params.number));
}, { description: 'Look up order status.', readOnly: true });
```

## Tools and MCP

Use `tool(...)` instead of duplicating model-facing tool metadata in every surface. A single tool-marked handler can be discovered by Fluent chat, chatbots, agents, and Platform MCP.

```ts
const answer = await trigger.context
  .inference()
  .chat()
  .toolsFrom('SupportService')
  .ask('Where is order A-1042?');
```

```yaml
chatbots:
  - name: support
    tools:
      - service: SupportService

agents:
  - name: order_ops
    tools:
      - service: SupportService
```

## Workflows replace ad-hoc orchestration

If a 0.8 app used a conversation, channel, or agent mainly to coordinate multiple steps, move that coordination into a workflow.

```ts
import { workflow } from '@3flows/intelligence';

export const refundWorkflow = workflow('support.refund')
  .input<{ ticketId: string; text: string }>()
  .step('classify', (s) =>
    s.inference().check('refund-request')
      .state(({ input }) => input.text)
      .define()
  )
  .when('needsRefund', ({ steps }) => steps.classify.accepted)
  .step('agent', (s) =>
    s.agent('order_ops')
      .task(({ input }) => `Prepare refund resolution for ${input.ticketId}`)
      .input(({ input }) => input)
      .define()
  )
  .end()
  .returns(({ steps }) => steps);
```

Workflows run through a service context so every step receives Platform and Intelligence capabilities.

## Streaming

Fluent chat streaming now returns `InferenceStream`:

```ts
const stream = await trigger.context.inference().chat().ask('Hello').stream();
for await (const event of stream) console.log(event);
const final = await stream.completed;
```

Use `stream.text()` to collect text or `stream.toReadable({ format: 'sse' })` for HTTP SSE.

## Testing

Use the exported testing kit instead of app-local provider shims:

```ts
import { runOffline, ScriptedAI, expectPrompt, collectStream } from '@3flows/intelligence/testing';
```

Patch `globalThis.fetch` only in provider wire-format tests.

## Configuration validation

0.9 validates Intelligence configuration at startup. Start with warnings:

```yaml
intelligence:
  strict: false
```

Then enforce production policy:

```yaml
intelligence:
  strict: true
  inference:
    require:
      metadata: true
      timeout: true
    onViolation: error
```

Common migration warnings include missing prompt versions, missing AI defaults/timeouts, invalid chatbot references, unbounded history, literal API keys, missing domains, and invalid response schemas.

## Breaking changes summary

| Breaking change | Migration |
| --- | --- |
| `conversations:` internal model removed | Configure `chatbots:`; map history to chatbot sessions/messages |
| `context.conversations()` no longer the central high-level API | Use chatbots for sessions, Fluent `chat()` for direct calls |
| Channels removed | Use chatbots, agents, workflows, or explicit routes/services |
| Old agents/coworkers removed | Configure `agents:` and run `trigger.context.agent(name)` |
| Old skills execution model removed | Configure `skills:` and put executable behavior in `tool(...)` handlers |
| Old ontology/conversation entities removed | Use Intelligence chatbot/agent/trace domains plus app-owned business storage |
| Local sample `IntelligenceService` wrappers obsolete | Import service helpers from `@3flows/intelligence` |
| Tool metadata moved to handlers | Use `tool(...)` and service-level discovery |
| Streaming contract changed | Treat stream as `InferenceStream`; use `.completed`, `.text()`, `.toReadable()` |
| Structured-output parse failures now throw clearly | Catch provider/model parse errors and handle invalid model output explicitly |
