---
title: 2. Prompts in YAML
---

# 2. Prompts in YAML

**Where we are:** `draftReply` drafts replies with two lines of instructions in code.

**The problem:** the support lead wants to change the tone. The instructions are a string constant in `services.ts`, so every wording change is a code change, and nobody can tell afterwards which wording produced a given reply.

## The solution: `prompts`

A prompt is instructions with a name, a version and variables, kept in YAML next to the models:

```yaml title="intelligence.yml"
prompts:
  - name: support.reply
    version: v1
    description: Drafts replies to customer tickets, for agents to review
    template: |
      You draft replies for the support team of {{ shop }}, a bike shop.

      Rules:
      - Be brief: three short paragraphs at most.
      - Use the facts you are given. If a fact is missing, ask the customer for it.
      - Never promise refunds, discounts or delivery dates. Say that the team will confirm.
      - Answer in the language of the ticket.

      Tone: friendly, concrete, no marketing language.
```

The chain refers to it by name, with variables:

```ts title="services.ts"
const replies = Intelligence.inference()
    .chat()
    // highlight-next-line
    .prompt('support.reply', { shop: 'Velo' });
```

The handler is unchanged: `replies.with(ticket).ask('Draft a reply to this ticket.')`.

`{{ shop }}` is replaced by the variable. Dot paths like `{{ customer.name }}` work too; objects are inserted as JSON. Keep variables few: a variable that changes half the prompt should be a second prompt.

## Why this is better

- **A prompt change is a reviewed change.** It has its own diff in YAML, and a reviewer reads it like a policy change.
- **Every answer knows its prompt.** The prompt's name and version are recorded with each model call. When a reply is wrong, you can tell whether it came from `support.reply@v1` or `@v2`. Chapter 19 shows where.
- **Policy lives in one place.** Prompts are listed where the models are listed. Non-developers can read them.

Bump the `version` on every change.

## Long prompts in blobs

When a prompt grows, or the support lead maintains it, point at a file in `blobs` instead:

```yaml
prompts:
  - name: support.reply
    version: v7
    source:
      type: blob
      container: prompts
      path: support/reply.md
```

## Run it

```sh
yarn step:02
curl -X POST localhost:3000/draftReply -H 'Content-Type: application/json' -d '{
  "email": "ada@example.com",
  "subject": "Bremsen quietschen",
  "body": "Hallo, die Bremsen meines neuen Velo City 3 quietschen. Ist das normal?"
}'
```

```json
{ "reply": "Hallo Ada,\n\ndanke für deine Nachricht! Bei neuen Bremsen ist leichtes Quietschen normal …" }
```

*Answer in the language of the ticket* at work.

## What you learned

- **Prompts are configuration**: named, versioned, reviewed in YAML.
- `.prompt(name, variables)` renders a prompt into the call's instructions. `.instructions(...)` still works for code-specific additions.
- The version travels with every call.

## Reviewer's view

> `support.reply@v1` defines how replies are drafted.

The four rules are what to review. They're short, testable and complete enough that an agent reading a draft knows what to expect. The code change is one line.

[Sample: step 02](https://github.com/3flows/intelligence-samples/tree/main/support-desk/steps/02-prompts-in-yaml) · Next: [Test without a model](./test-without-a-model.md)
