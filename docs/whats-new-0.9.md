---
title: What's new in 0.9
---

# What's new in 0.9

This page compares `@3flows/intelligence@0.9.0-next.7` with the last 0.8 release, `0.8.30`. To move an application, see the [migration guide](./migration-0.8-to-0.9.md).

0.9 isn't an update of 0.8: it's a different library with the same purpose. 0.8 was a framework of **channels, agents and skills**: a message came in through a channel, an agent with a personality answered it, and skills were classes that did the work. 0.9 is built around **calls**: a service asks a model for one thing, in one readable line, and everything larger (chatbots, agents, workflows) is built from that.

## At a glance

| | 0.8 | 0.9 |
|---|---|---|
| Models | `models` and `embeddings` in YAML, one section each | One section, `ais`. Every model is an AI with capabilities |
| Calling a model | `this.model().chatCompletion(messages, …)` | The fluent API: `inference().chat()…answer()` |
| Structured answers | `invokeWithStructuredOutput(prompt, schema)` | `extract`, and the decisions `choice`, `check`, `score` |
| Other capabilities | Chat and embeddings | Also reranking, transcription, speech, images, OCR, moderation |
| Prompts | An agent's `personality`, and prompts inside skill classes | A catalog in YAML, `prompts`: named, versioned, with variables |
| Chat for people | `channels` (`http-chat`) in front of a `conversational` agent | `chatbots` |
| Agents | The thing that answers a channel | A model that works on a task in several steps, with tools and limits |
| Skills | Classes with tools and structured outputs | Configuration: instructions and tool references |
| Tools | `Tool` objects of a skill | Service handlers, marked with `tool(...)` |
| Processes | In code, between channels, agents and skills | `workflow(...)`: named steps, with a report |
| Services | `IntelligenceService` with `handle(signal)` | `IntelligenceService` with handlers; everything in `trigger.context` |
| Records | Model and conversation records | Three domains: `IntelligenceTrace`, `IntelligenceChatbot`, `IntelligenceAgent` |
| Tests | Mock the provider yourself | `@3flows/intelligence/testing`: a scripted provider, `runOffline` |
| Platform | `@3flows/platform` 0.8 | `@3flows/platform` 0.9, pinned exactly |

## New: the fluent API

Every model capability is one chain: what you want, what it needs, a verb.

```ts
const ai = trigger.context.inference();

const reply = await ai.chat().prompt('support.reply').with(ticket).question('Draft a reply.').answer();

const department = await ai.choice('department')
    .oneOf(['billing', 'technical', 'sales'])
    .instructions('Which team should handle this ticket?')
    .state(ticket.body)
    .decide();

const facts = await ai.extract('facts').schema(Facts).from(ticket.body).extract();
```

- **Thirteen capabilities, one grammar**: `chat`, `extract`, `choice`, `check`, `score`, `embedding`, `reranker`, `transcriber`, `speech`, `image`, `video`, `ocr`, `moderation`.
- **Decisions are typed values**: `department.value` is one of the three options, with a `confidence` and a `reason`.
- **Every call can be bounded and tagged**: `.timeout(ms)`, `.signal(abortSignal)`, `.metadata({ subjectType, subjectId, purpose })`. A policy in YAML can require both.
- **Streaming** returns an `InferenceStream`: iterable, and with `toReadable()`, `text()`, `completed` and `onSettled()`. Streams run tools.
- **`collection(items)`** runs calls over many items with bounded concurrency, retries and cancellation.

Start with [The fluent API](./concepts/the-fluent-api.md).

## New: `ais`, capabilities instead of vendors

`models` and `embeddings` are one section. An AI has a provider, a model, a connection and defaults; what it can do is its **capabilities**. A chain asks for a capability, and YAML decides which AI has it.

```yaml
ais:
  - name: DEFAULT
    provider: openai
    model: gpt-4.1-mini
    connection:
      apiKey: ${{ OPENAI_API_KEY }}
    defaults:
      timeoutMs: 30000
      retry: { attempts: 3, backoffMs: 1000 }
```

Providers: OpenAI and everything OpenAI-compatible (Groq, Ollama, LM Studio, …), Azure AI, Anthropic and TypeSafe. See [Capabilities and providers](./concepts/capabilities-and-providers.md).

## New: prompts as configuration

Policy is no longer a `personality` string or a method of a skill. It's a catalog in YAML, used with `.prompt(name, variables)`, and the version that was used is recorded with every call. See [`prompts`](./configuration/prompts.md).

## New: chatbots

A chatbot is a configured assistant with its own sessions: model, prompts, history window, tools and HTTP exposure in YAML. It replaces the `http-chat` channel with a `conversational` agent behind it, and keeps the `/conversation` route names. New in 0.9: streaming as server-sent events, an AG-UI endpoint, tools selected by service and tag with a `toolPolicy`, and the types `retrieval` and `structured`. See [Chatbots](./concepts/chatbots.md).

## New: agents and skills, with a new meaning

The words are the same as in 0.8. What they mean isn't.

- A 0.9 **agent** is a model that works on a task in several steps: it chooses the next tool, inside a policy. It has runs, events, optional working memory, and can ask other agents. See [Agents](./concepts/agents.md).
- A 0.9 **skill** is configuration: instructions and tool references that an agent uses. It has no code. See [Skills](./concepts/skills.md).

## New: tools are handlers

A tool is a service handler. Any handler can be offered to a model per call, with `.service(name, method)`. A handler meant for models is marked with `tool(...)`, which adds a description, tags and facts like `readOnly`; chatbots, agents and `.toolsFrom(service)` find marked tools by service and tag. See [Tools](./concepts/tools.md).

## New: frontends, other assistants, and other agents

- **AG-UI**: agents and chatbots are served to frontends as a stream of protocol events, with an `agui` block. The frontend's state reaches the model as context.
- **UI tools**: twenty typed tools (`show_card`, `show_form`, `show_confirmation`, …) with which a model asks a frontend to render something, without writing markup.
- **MCP**: a service's marked tools, and agents, are offered on a platform MCP server.
- **Peers and cards**: an agent can ask other agents of the application, within limits; every agent has an A2A-shaped card and can be found by capability, skill or tag.
- **Confirmation**: a tool marked `requiresConfirmation` makes a run wait for a person.

See [AG-UI and UI tools](./concepts/ag-ui-and-ui-tools.md) and [Agents together](./concepts/agent-cards.md).

## New: workflows

A process is written down as named steps, with branches, retries and timeouts. Steps are code, service calls, fluent calls or agents. `report()` returns the status of every step. See [Workflows](./concepts/workflows.md).

## New: records in three domains

| Domain | Records |
|---|---|
| `IntelligenceTrace` | Every model call: runs, calls to providers with tokens and duration, inputs and outputs, tool executions |
| `IntelligenceChatbot` | Chatbot sessions, messages, files, reactions |
| `IntelligenceAgent` | Agent runs, steps, events, delegations, workspace items |

They're registered under `entities.domains`, and kept apart from each other and from your business data. `.metadata({ subjectType, subjectId })` links a model call to the record it was made for.

## New: validation, inspection, testing

- **Startup validation** reports AIs without a timeout, prompts without a version, broken references and keys written into YAML. `intelligence.strict: true` turns findings into errors.
- **`Intelligence.inspect()`** returns the version, the AIs, prompts and chatbots, and the findings.
- **`@3flows/intelligence/testing`** has a scripted provider and `runOffline(yaml)`: the real configuration, no model, no key.
- **`@3flows/intelligence/platform`** re-exports the platform, for applications that prefer one import.

## Removed

| Removed | Use instead |
|---|---|
| `models`, `embeddings` in YAML; `Model`, `Embedding` | `ais`; `inference()` |
| `channels`: `http-chat`, `email`, `sms` | `chatbots` for chat. For email and other transports, a platform route or connector that calls a service |
| `agents` with `type: conversational`, `observational`, `quality`; `personality` | `chatbots`; `agents` in the new sense; `check` and `score` for quality |
| `Skill` classes, `scope`, `type: local` / `remote`, `RemoteSkill` | Service handlers marked with `tool(...)`; `skills` as configuration |
| `Tool`, `StructuredOutput` | `tool(...)`; schemas with `extract` |
| `Signal`, `IntelligenceService.handle(signal)` | Handlers and routes; `trigger.signal` for cancellation |
| Error classes for input, output and upload validation | `inputValidation`, `outputValidation` and upload rules on a chatbot; your own checks in services |

## If you used an earlier 0.9 preview

The terminal verbs changed in `0.9.0-next.4`. Every chain now ends with a verb of its own, and takes its task from a method before it:

| Before | Since `0.9.0-next.4` |
|---|---|
| `chat()….ask(question)` | `chat()….question(question).answer()` |
| `chat()….stream(question)` | `chat()….question(question).stream()` |
| `choice(n).oneOf(o).with(data).ask(question)` | `choice(n).oneOf(o).instructions(question).state(data).decide()` |
| `check(n).with(data).ask(question)` | `check(n).instructions(question).state(data).decide()` |
| `score(n)….with(data).ask(question)` | `score(n)….instructions(question).state(data).decide()` |
| `extract(n).schema(s).with(data).ask(question)` | `extract(n).schema(s).instructions(question).from(data).extract()` |
| `reranker()….rank()` | `reranker()….rerank()` |
| `moderation().check(text)` | `moderation().input(text).moderate()` |
| `speech().speak(text)` | `speech().text(text).speak()` |
| `image().generate(prompt)` | `image().description(prompt).generate()` |
| `ocr()….read(prompt)` | `ocr()….guidance(prompt).read()` |
| `conversations().conversation(id)` | `chat().messages(history)` with your own store, or a chatbot |
| `conversations:` and `entities.ontologies` in YAML | `entities.domains` |
| `InferenceRunEntity`, `ConversationMessageEntity` | `IntelligenceTraceDomain`; your own store, or `IntelligenceChatbotDomain` |
| `Intelligence.prompts()`, `prompts().render({ name, variables })` | `trigger.context.prompts().prompt(name).variables(v).render()` |
| A custom provider's `doChat(request)` | `doChat(chain)`, with `chain._request()` |

### Fixed in `0.9.0-next.5`

- Chatbots read the whole session. Before, only the first ten stored messages were read, so the model lost parts of a conversation after about four turns, and deleting a session left messages behind.
- `agent(name).run(id).events()` returns every event of a run, not the first ten. Limits above ten for `maxSteps` and `maxChildRuns` are enforced.
- A blocking agent `run()` records `tool.started` and `tool.completed` events, as `stream()` does.

### Fixed and added in `0.9.0-next.7`

- **Built on Platform `0.9.0`.** Pin `"@3flows/platform": "0.9.0"`.
- **An agent's AG-UI stream carries tool arguments** (`TOOL_CALL_ARGS`). Before, a frontend had to read a UI tool's specification from the result.
- **A waiting agent run is continued over AG-UI.** It ends with `outcome: { type: 'interrupt' }`, and a request with `resume: [{ interruptId, status }]` continues or stops it. Before, every AG-UI request started a new run. See [AG-UI and UI tools](./concepts/ag-ui-and-ui-tools.md#confirmations-interrupts-and-resume).
- **`run(id).resume()….stream()`** continues a waiting run as a stream; `.submit()` stays the blocking form.
- **A streamed agent run records `tool.started` once per call, with its arguments**, as a blocking run does. Before, the streamed event had no `args`.
- **`reasoningEffort`** in `ais[].defaults`, as in 0.8.26 and later.
- **Chatbot files keep `originalFileName`**, and file listings include `storageContainer` and `storagePath`, as in 0.8.30.

## Known gaps

0.9 is a preview. What doesn't work yet is listed in [Known gaps](./guides/known-gaps.md).
