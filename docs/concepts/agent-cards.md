---
title: Agents together
---

# Agents together: peers, cards and discovery

One agent with many jobs gets long instructions and a long tool list, and both make it worse. Several agents with one job each stay small. Two things are needed then: a way for one agent to ask another, and a way to find out which agents exist.

## Peers

An agent may ask the agents listed under `peers`:

```yaml
agents:
  - name: case-researcher
    peers:
      - agent: policy-advisor
    delegation:
      maxDepth: 1
      maxChildRuns: 3

  - name: policy-advisor
    description: Answers questions about returns, warranty and shipping rules.
    capabilities: [returns-policy, warranty]
```

For the model, a peer is a tool: `ask_policy_advisor`, with a `task` and an optional `input`. Calling it starts a run of the peer, which works with its own instructions, tools and policy. Its answer comes back as the tool's result.

| | |
|---|---|
| `peers[].agent` | The agent to ask |
| `peers[].as`, `description` | Another tool name or description, for this agent only. By default both come from the peer's name, `description` and `capabilities` |
| `delegation.maxDepth` | How deep agents may ask each other |
| `delegation.maxChildRuns` | How many peer runs one run may start |
| `delegation.allowCycles` | Whether an agent may be asked again further down. Off by default |

**A peer sees what it's asked, and nothing else.** It doesn't get the asking agent's task, input or tools. That makes splitting agents a way to split access: an agent that knows the rules never sees a customer; an agent that reads cases can't search the web.

Every peer call is recorded as an `AgentDelegation` in the `IntelligenceAgent` domain, with the parent run and the child run, and as `delegation.started` and `delegation.completed` events of the asking run.

## Cards

Every agent has a **card**: what it says about itself to others. It has the shape of the A2A agent card.

```ts
const card = trigger.context.agent('policy-advisor').card();

card.name;           // 'Policy Advisor': displayName, or the name
card.description;
card.skills;         // from the agent's skills, or else from its capabilities
card.capabilities;   // { streaming, pushNotifications, stateTransitionHistory }
card.url;            // '/agents/policy-advisor/card', if the agent is served over HTTP
card.metadata;       // tags and capabilities from the configuration
```

The card is derived from the agent's configuration. `a2a.card` overrides parts of it: `name`, `description`, `version`, `provider`, `skills`. An agent with an `http` block serves its card at `GET <path>/card`.

## Discovery

Agents with `a2a.discoverable: true` can be listed and searched:

```ts
const agents = trigger.context.agents();

agents.cards().list();                            // every discoverable agent, with its card
agents.cards().includePrivate().list();           // all agents

agents.discover().capability('warranty').list();  // by capability
agents.discover().skill('policy-research').list();
agents.discover().tag('policy').list();
agents.discover().text('returns').list();         // anywhere in the card
```

Each result is `{ agent, card, local: true }`.

:::note Local, in this version
Discovery finds the agents of the running application, and peers are always agents of the same application. The cards are A2A-shaped, so they can be published to others; calling agents of other systems over the A2A protocol isn't part of Intelligence.
:::

## Reviewer's view

Several agents mean several permission lists. For each: its tools, and what its peers can do on its behalf. Then the path between them: what an agent writes into a peer's `task` is up to the model, so anything the asking agent can read may end up there. And the bill: `maxChildRuns` times the peer's own limits.

The tutorial builds two agents in [Agents that work together](../tutorial/agents-together.md).
