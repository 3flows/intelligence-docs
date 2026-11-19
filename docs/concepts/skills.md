---
title: Skills
---

# Skills

A **skill** bundles what an agent needs for one kind of work: instructions, and references to the tools for following them. It's configuration: words and references, no code.

```yaml
skills:
  - name: case-research
    description: Collect the facts of a support case before a person answers it.
    instructions:
      - Read the chat of the ticket first, so you know what was already said.
      - If the ticket mentions an order number, look the order up. Never guess an order's status.
    tools:
      - service: SupportService
        tags: [case]
      - service: HelpCenterService
        tags: [public]
```

An [agent](./agents.md) that lists the skill gets its instructions, added to its own, and its tools:

```yaml
agents:
  - name: case-researcher
    skills:
      - case-research
```

## Where the code is

A skill has none. What it can *do* is in service handlers marked with [`tool(...)`](./tools.md#marked-tools-tool); the skill only selects them, by service and tag. So a skill is reviewed like a prompt, and its tools are reviewed and tested like any other handler.

| Field | |
|---|---|
| `name`, `description` | What the skill is for |
| `instructions` | How to do this kind of work. Added to the agent's instructions |
| `tools` | Tool references: `service`, narrowed by `tags`, `include`, `exclude` |
| `examples` | Optional examples: `input`, `approach`, `output` |
| `policy` | Limits that come with the skill, like those of an [agent](./agents.md#limits) |

## When a skill is worth it

One agent with one job doesn't need a skill: instructions and tools can be on the agent. A skill pays off when the same way of working is needed twice, by two agents or by the same agent in two configurations. Then both get the same instructions and exactly the same tools, from one place.

A skill isn't a substitute for a service handler (work that code can do), a prompt (text for one call) or a workflow (a process of fixed steps).

The tutorial introduces skills in [Skills and agents](../tutorial/skills-and-agents.md).
