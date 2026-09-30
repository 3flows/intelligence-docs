---
title: Context and prompts
---

# Context and prompts

A model only knows what's in the call. Most quality problems in AI features are context problems: the model didn't get the fact it needed, got too much noise, or couldn't tell policy from data.

Intelligence gives each kind of content its own place.

## Four places, four purposes

```ts
await trigger.context.inference()
    .chat()
    .prompt('support.reply', { shop: 'Velo Bikes' })   // policy, from the catalog
    .instructions('Answer in the customer’s language.') // policy, inline
    .with(ticket)                                       // data
    .ask('Draft a reply to this ticket.');              // the task
```

| Place | Method | Holds | Sent as |
|---|---|---|---|
| **Instructions** | `.instructions(...)` | How the model should behave, in this code path | system message |
| **Prompt** | `.prompt(name, vars)` | How the model should behave, reviewed and versioned in YAML | system message, after `instructions` |
| **Input** | `.with(...)`, `.withFile(...)`, `.withBlob(...)` | What the model works on | user messages, in order |
| **Question** | `.ask(...)` | What to do with it, this time | the last user message |

A good test for where something belongs: **would it be the same for every customer?** Then it's instructions or a prompt. **Is it about this customer?** Then it's input.

## Why keep policy and data apart

**Review.** A reviewer reads instructions and prompts as policy: tone, rules, limits. They read `.with(...)` as data flow: *which data leaves our system in this call?* Mixing them in one template string hides both.

**Safety.** Text from customers can contain instructions of its own ("ignore all previous instructions and…"). That's called **prompt injection**. Keeping customer text in input, never concatenated into instructions, is the first defense. It isn't a complete one: see [Guard the input](../tutorial/guard-the-input.md).

**Reuse.** Chains are [immutable](./the-fluent-api.md#chains-are-immutable). Build the policy part once, add data per call.

## Input: what `.with(...)` accepts

| You pass | The model gets |
|---|---|
| a string | the text |
| an object or array | its JSON |
| a `Buffer` or `Readable` with `meta` | a file |
| `.withFile('notes.md')` | the file's text, for text formats |
| `.withBlob('attachments', 'ticket-1/invoice.txt')` | the blob's text, for text formats |

Passing objects is usually better than pre-formatting them. `{ orderId, status, shippedAt }` is unambiguous; a sentence you wrote around it may not be. See [Inputs and files](../api/inputs-and-files.md) for file handling.

## Prompts are configuration

A prompt is instructions with a name, a version and variables, kept in YAML:

```yaml
prompts:
  - name: support.reply
    version: v3
    description: Replies to customer tickets
    template: |
      You are a support agent for {{ shop }}.
      Be brief, friendly and concrete.
      Never promise refunds; say that the billing team will decide.
```

```ts
chat.prompt('support.reply', { shop: 'Velo Bikes' })
```

Why bother, instead of a string constant in code?

- **A prompt change is a behavior change.** In YAML it gets its own diff, its own review, and a version number.
- **The version is recorded.** Every inference run stores the names and versions of the prompts it used, so a bad answer can be traced back to `support.reply@v3`.
- **Long prompts can live in blobs.** A prompt can point at a file in `blobs` instead of an inline template, so non-developers can maintain it.

Variables use `{{ name }}` and dot paths (`{{ customer.name }}`). Objects render as JSON. Missing variables render as empty text, so keep variables few and obvious.

## Messages: history you supply yourself

`chat()` also accepts explicit history:

```ts
chat.messages([
    { role: 'user', content: 'My order is late.' },
    { role: 'assistant', content: 'Sorry about that. What is the order number?' }
]).ask('It is A-1042.');
```

That's useful when the history already lives somewhere else, for example in an email thread. When your application owns the history, use a [conversation](./conversations.md) instead.

## How much context?

More isn't better. Every token costs money and time, and irrelevant text makes answers worse. Rules of thumb:

- Send the **fields** that matter, not the whole record.
- For knowledge ("what's our return policy?"), don't send the handbook. [Retrieve](./retrieval.md) the three most relevant passages.
- For facts the model might need, but often won't, give it a [tool](./tools.md) instead of pre-loading everything.

## Reviewer's view

For every AI call, a reviewer should be able to answer from the chain alone:

1. **What's the policy?** `instructions` and `prompt`: which ones, which version.
2. **What data leaves our system?** Everything in `with`, `withFile`, `withBlob`.
3. **What's the task?** The `ask`.

If one of these needs a debugger to answer, restructure the chain.
