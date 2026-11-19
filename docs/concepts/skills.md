# Skills

A skill is a reusable declarative capability bundle: instructions plus tool references and metadata. Skills let multiple agents share the same operational guidance without copying prompts and tool lists.

Skills in 0.9 are not the old core execution abstraction. Executable work belongs in Platform handlers, usually marked with `tool(...)`. Agents and other harnesses can include skills to inherit instructions and tool availability.

## Configuration

```yaml
skills:
  - name: order_resolution
    displayName: Order resolution
    description: Resolve order delivery and fulfillment problems.
    instructions:
      - Inspect order status before proposing actions.
      - Prefer a customer-safe summary over internal jargon.
    tools:
      - service: SupportService
        tags: [order]
    metadata:
      owner: support-ops
```

Attach the skill to an agent:

```yaml
agents:
  - name: order_ops
    model: DEFAULT
    skills:
      - order_resolution
```

## Tool references

Skill tools refer to Platform services and can use the same discovery controls as chatbots and agents:

```yaml
tools:
  - service: SupportService
  - service: BillingService
    include: [lookupInvoice]
  - service: UiService
    tags: [ui]
```

A service handler becomes model-facing when it is declared with `tool(...)`:

```ts
import { IntelligenceService, tool } from '@3flows/intelligence';
import { Register, t } from '@3flows/intelligence/platform';

@Register()
export class SupportService extends IntelligenceService {
  handlers = () => [
    tool('lookupOrder', Input, Output, async (params, trigger) => {
      await trigger.ok(await lookupOrder(params.number));
    }, { description: 'Look up order status.', readOnly: true, tags: ['order'] })
  ];
}
```

## Runtime access

Inside an Intelligence service, use the runtime context:

```ts
const skill = trigger.context.skill('order_resolution');
const skills = trigger.context.skills();
```

Avoid global mutable registries. Skills are resolved against the active Platform runtime.

## When to use a skill

Use a skill when several agents need the same instructions or tool bundle. Do not use a skill as a substitute for:

- a service handler (`handler` / `tool`) when work is deterministic code,
- an agent when you need runs, events, workspace, or policy,
- a workflow when you need deterministic orchestration,
- a prompt when you only need reusable text rendering.
