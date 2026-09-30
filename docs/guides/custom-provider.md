---
title: Writing a provider
---

# Writing a provider

A provider adapts one vendor's API to the capabilities of the fluent API. You need one when a vendor isn't supported yet, when a company gateway speaks its own protocol, when a capability has no built-in provider (`ocr`, `video`), or for tests.

## The shape

A provider is a class that extends `AI`, registered under the namespace `ai`:

```ts title="acme-ai.ts"
import { Register } from '@3flows/platform';
import { AI, AICapabilitiesConfiguration, AIChatRequest, AIChatResponse, AIConfiguration } from '@3flows/intelligence';

@Register('acme', 'ai')                 // provider: acme
export class AcmeAI extends AI {
    initialise(configuration: AIConfiguration): AI {
        this.configuration = configuration;
        return this;
    }

    protected inferredCapabilities(): AICapabilitiesConfiguration {
        return ['chat', 'structured'];
    }

    protected async doChat(request: AIChatRequest): Promise<AIChatResponse> {
        const options = this.mergeOptions(request);      // AI defaults + per-call options
        const answer = await this.withRetry(
            () => this.http()
                .url(this.configuration.connection?.baseUrl as string)
                .path('/generate')
                .bearer(this.configuration.connection?.apiKey as string)
                .data({ model: this.configuration.model, messages: request.messages, temperature: options.temperature })
                .post<{ text: string; tokens: { in: number; out: number } }>(),
            options.retry
        );
        return {
            text: answer.text,
            usage: { promptTokens: answer.tokens.in, completionTokens: answer.tokens.out, totalTokens: answer.tokens.in + answer.tokens.out },
            model: this.configuration.model,
            provider: this.configuration.provider
        };
    }
}
```

```yaml
ais:
  - name: DEFAULT
    provider: acme
    model: acme-large
    connection:
      baseUrl: https://api.acme.example/v1
      apiKey: ${{ ACME_API_KEY }}
```

Import the file in `main.ts` so the class is registered before the platform starts.

## What to implement

Override the `do…` methods for the capabilities you support. Everything else fails with a clear *does not support* error.

| Method | Capability |
|---|---|
| `doChat(request)` | `chat`, `tools` (read `request.tools`, return `toolCalls`), and by default `structured` |
| `doStream(request)` | `streaming`: return an `AsyncIterable<AIStreamEvent>` ending with `done` |
| `doStructured(request)` | `structured`, if the vendor has a native mode. The default calls `doChat` with `responseSchema` and parses the text |
| `doEmbed`, `doRerank`, `doTranscribe`, `doSpeech`, `doImage`, `doVideo`, `doOCR`, `doModerate` | The other capabilities |
| `doChoice`, `doScore`, `doNoul` | Native decisions |
| `discoverCapabilities()` | Optional: ask the vendor what the model supports, and set `this.discovered` |

Don't override the public methods (`chat`, `embed`, …). They wrap your `do…` methods with tracing and inference-run recording, so a new provider is observable from the first call.

## What you get from `AI`

| Helper | |
|---|---|
| `this.configuration` | The YAML entry: `name`, `provider`, `model`, `connection`, `defaults`, `providerOptions` |
| `this.mergeOptions(request)` | `defaults` from YAML, overridden by the call's `options` |
| `this.withRetry(fn, retry)` | Retries with backoff |
| `this.http()` | The platform's HTTP client |
| `this.schemaToJSONSchema(schema)` | Zod to JSON schema, for native structured output |
| `this.ensureSupportedInputs(request, { text, json, file })` | Rejects inputs the vendor can't take |

## Test it like the built-in ones

The built-in providers are tested against a mocked `fetch`: set `globalThis.fetch` to a function that asserts the request body and returns a canned vendor response. That checks the mapping in both directions without a network. See the provider tests in the [intelligence repository](https://github.com/3flows/intelligence/tree/main/tests/ais) and the [scripted provider](./testing.md#the-scripted-provider).
