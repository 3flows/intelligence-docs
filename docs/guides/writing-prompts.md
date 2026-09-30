---
title: Writing prompts that review well
sidebar_label: Writing prompts
---

# Writing prompts that review well

A prompt is policy written in English. Write it the way you'd brief a capable new colleague on their first day: what the job is, what good looks like, what's off limits.

## Structure

```yaml
prompts:
  - name: support.reply
    version: v4
    description: Drafts replies to customer tickets for agents to review
    template: |
      You draft replies for the support team of {{ shop }}, a bike shop.

      Goal: a reply the agent can send with at most small edits.

      Rules:
      - Be brief: three short paragraphs at most.
      - Use the facts you are given. If a fact is missing, ask the customer for it.
      - Never promise refunds, discounts or delivery dates. Say that the team will confirm.
      - Answer in the language of the ticket.

      Tone: friendly, concrete, no marketing language.
```

1. **Role and audience:** who writes, for whom.
2. **Goal:** what a good result is.
3. **Rules:** short, one per line, testable. A reviewer should be able to check an answer against each.
4. **Tone:** one line.

## Do

- **Say what to do when information is missing.** Otherwise the model fills the gap.
- **Keep variables few and obvious.** `{{ shop }}` yes; a variable that swaps half the prompt, no: make it two prompts.
- **Version on every change.** `v3` → `v4`. The version is stored with every inference run, so answers can be traced to the prompt that produced them.
- **Describe the prompt.** `description` is for the next person who opens the file.
- **Put examples in, when format matters.** One short example of a good answer is worth ten rules about format.

## Don't

- **Don't put customer data in the template.** It belongs in `.with(...)`. See [Context and prompts](../concepts/context-and-prompts.md#why-keep-policy-and-data-apart).
- **Don't ask for JSON in a prompt.** Use [`extract`, `choice`, `check` or `score`](../concepts/language-into-data.md); the shape is enforced for you.
- **Don't shout.** "NEVER EVER" doesn't work better than "Never". Clear rules do.
- **Don't fix a context problem in the prompt.** If the model doesn't know the return policy, *"be accurate about returns"* won't help. Give it the policy.

## Prompts for decisions

Decisions take instructions like any chain, but most of the policy belongs in the options themselves:

```ts
ai.choice('department')
    .prompt('support.routing')
    .oneOf({
        billing: 'Payments, invoices, refunds and prices',
        technical: 'Defects, repairs, assembly and spare parts',
        sales: 'Product advice and orders that have not been placed yet'
    })
```

```yaml
prompts:
  - name: support.routing
    version: v2
    template: |
      You route tickets for a bike shop's support team.
      A ticket about a defect in a product that is also being returned goes to technical.
```

The prompt carries the tie-breaking rules; the option descriptions carry the definitions.

## Long prompts in blobs

When a prompt grows or is maintained by non-developers, keep the text in `blobs` and only the reference in YAML:

```yaml
prompts:
  - name: support.policy
    version: v12
    source:
      type: blob
      container: prompts
      path: support/policy.md
```

## Reviewing a prompt change

- Read the diff like a policy change. What behavior changes for which customers?
- Is there an evaluation run with the new version? Compare it with the old.
- Did the version change?
