---
title: Why 3flows Intelligence
sidebar_label: Why 3flows Intelligence
---

# Why 3flows Intelligence

## AI is a dependency like any other, only less predictable

Most applications don't need "an AI". They need a few very concrete things a language model happens to be good at:

- **Decide:** which team gets this ticket? Is this urgent? How risky is this contract?
- **Extract:** turn an email, an invoice or a transcript into a record with fields.
- **Answer:** reply to a customer, using what the company knows.
- **Act:** look up an order, book an appointment, send a confirmation.

Every one of these is an ordinary feature of an ordinary service. What's different is the dependency underneath: it's slow, it costs money per call, it changes every few months, and it doesn't always give the same answer twice.

3flows Intelligence treats that dependency the way the [3flows Platform](https://3flows.github.io/platform-docs/) treats databases and message brokers: **the code says what it needs, the configuration says who delivers it.**

## How: capabilities, one fluent API, and YAML

**Capabilities instead of vendors.** If you need a decision between options, you use `choice`. If you need a number on a scale, you use `score`. If you need a vector for search, you use `embedding`. Which model and which provider answers is not the service's business.

**A fluent API.** Every capability follows the same grammar: *what* you want, *with what* input, then a terminal verb.

```ts
const ai = Intelligence.inference();

await ai.chat().instructions('You are a support agent.').with(ticket).ask('Draft a reply.');
await ai.choice('department').oneOf(['billing', 'technical']).with(ticket.body).ask('Who handles this?');
await ai.score('frustration').between(0, 10).with(ticket.body).ask('How frustrated is the customer?');
await ai.embedding().with(article.text).embed();
```

**Configuration in YAML.** YAML describes which models exist and what they are allowed to do. Prompts can live there too, versioned:

```yaml
ais:
  - name: DEFAULT
    provider: openai          # or anthropic, azureai, groq, ollama, lmstudio, …
    model: gpt-4.1-mini
    connection:
      apiKey: ${{ OPENAI_API_KEY }}
```

**Portability.** Try a new model by changing one line. Run a local model on a laptop and a hosted one in production. Run tests with no model at all. The service code stays the same.

## Language in, data out

The biggest source of friction in AI features isn't the model. It's the glue: prompts that ask for JSON, parsing code that hopes for JSON, and `if (answer.includes('yes'))`.

Intelligence removes that glue. `choice`, `check`, `score` and `extract` return typed values:

```ts
const urgent = await ai.check('urgent').with(ticket.body).ask('Does this need an answer today?');

urgent.value;       // true
urgent.confidence;  // 0.85
urgent.reason;      // "The customer's shop opens tomorrow and the order hasn't arrived."
```

A value your service can store, route on, count and test. A reason a human can read.

## Does this still make sense with agents?

With coding agents, wiring an LLM SDK into a service takes minutes. So why an extra layer?

Because, as with the platform, **writing code is no longer the bottleneck. Review is.** And AI features are harder to review than most code:

- The behavior lives partly in **prompts**, and a prompt change is a behavior change.
- The model sees **context** that's assembled at runtime. What exactly did it get?
- With **tools**, the model decides what to call. Which calls did we allow?
- The result is **non-deterministic**. How do we test it at all?

A reviewer needs to answer these questions in one read. That's what the vocabulary is for.

## A shared language for humans and agents

The fluent API is written for the human who has to understand and approve the feature.

```ts
await Intelligence.conversations()
    .conversation(ticket.id)
    .prompt('support.reply', { customer })
    .service('OrdersService', 'lookupOrder')
    .ask(message);
```

Read top to bottom: a persistent conversation per ticket, the reviewed and versioned `support.reply` prompt, and exactly one thing the model may do on its own, which is look up an order. The agent writes the code. The human reads it, reviews it, and takes responsibility for it.

## Production-hardened, and observable

Every call goes through the same path: capability selection, retries, tracing and usage recording. Turn on a tracer in YAML and every chat, choice and tool call appears as a span. Turn on the conversations ontology and every turn, message, tool call and token count is an entity you can query.

So when someone asks *"why did the assistant say that?"* or *"what did this cost last month?"*, there's an answer.

## So: yes

We still need this layer. Not because calling a model is hard, but because owning an AI feature in production is.

**See it for yourself:** the [tutorial](./tutorial/index.md) builds a support desk from a first question to an assistant that routes tickets, looks up orders and answers from the help center, one small step at a time. If you're new to language models, start with [Models for application developers](./concepts/models-for-developers.md).
