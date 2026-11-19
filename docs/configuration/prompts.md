---
title: prompts
---

# `prompts`

The prompt catalog. Chains use prompts by name with `.prompt(name, variables)`. Concepts: [Context and prompts](../concepts/context-and-prompts.md#prompts-are-configuration). Guide: [Writing prompts](../guides/writing-prompts.md).

```yaml
prompts:
  - name: support.reply
    version: v3
    description: Drafts replies to customer tickets
    template: |
      You draft replies for the support team of {{ shop }}.
      Be brief and friendly. Answer in the language of the ticket.

  - name: support.policy
    version: v12
    source:
      type: blob
      container: prompts
      path: support/policy.md
```

## Fields

| Field | Required | Description |
|---|---:|---|
| `name` | yes | The name used in `.prompt(name)` |
| `version` | no | Recorded with every inference run that uses the prompt |
| `template` | one of | The text, with `{{ variable }}` placeholders |
| `source` | one of | Load the text from `blobs` instead: `{ type: blob, blob?, container, path }` |
| `title`, `description` | no | For people |
| `format` | no | `text`, `markdown` or `chat` |
| `variables` | no | Documents the expected variables |
| `labels`, `metadata` | no | Free-form |

## Variables

`{{ name }}` is replaced by the variable, `{{ customer.name }}` follows a dot path. Strings are inserted as is; other values as pretty-printed JSON; missing values as empty text.

```ts
chat.prompt('support.reply', { shop: 'Velo Bikes' })
```

## Order

A chain's system message is its `instructions`, then its prompts in the order of the `.prompt(...)` calls, joined by blank lines.

## From code

In a service, the catalog is in the trigger context:

```ts
const prompts = trigger.context.prompts();

prompts.prompt('support.reply').exists();                                             // true
const rendered = await prompts.prompt('support.reply').variables({ shop: 'Velo Bikes' }).render();
rendered.text;      // the rendered text
rendered.version;   // 'v3'

prompts.list();     // every prompt, with name, version and description
```
