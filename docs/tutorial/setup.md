---
title: Set up a project
sidebar_label: Set up a project
---

# Set up a project

**Goal:** an empty project that starts the platform with Intelligence. Chapter 1 then adds the first intelligent service.

If you only want to run the tutorial's samples, skip to [The samples](./index.md#the-samples). This page is for starting your own project.

## What you need

- **Access to the 3flows repositories on GitHub.** The platform and Intelligence aren't public yet.
- **A GitHub token with `read:packages`.** Both are published to GitHub Packages as `@3flows/platform` and `@3flows/intelligence`. Create a personal access token (classic) with the `read:packages` scope.
- **Node.js 24+.** It comes with Corepack, which provides the right Yarn version per project.
- **A model.** An OpenAI API key is the quickest start. A [local model](../guides/local-models.md) with Ollama or LM Studio works too, with no key at all.

```sh
corepack enable
export NPM_REPOSITORY_GH_TOKEN=<your token>   # e.g. in your shell profile
export OPENAI_API_KEY=<your key>
```

## Start from the starter

The samples repository has an empty project, ready to copy:

```sh
git clone https://github.com/3flows/intelligence-samples.git
cp -r intelligence-samples/starter support-desk
cd support-desk
```

It's the [platform starter](https://3flows.github.io/platform-docs/docs/tutorial/setup) with one more dependency and one more YAML section. Here's what's different.

### `package.json`

```json title="package.json"
{
  "name": "my-intelligence-app",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "packageManager": "yarn@4.18.0",
  "engines": {
    "node": ">=24"
  },
  "scripts": {
    "build": "rm -rf dist && tsc",
    "start": "yarn build && node dist/main.js",
    "test": "yarn build && node --test dist/*.test.js"
  },
  "dependencies": {
    "@3flows/intelligence": "next",
    "@3flows/platform": "next"
  },
  "devDependencies": {
    "@types/node": "^24.0.0",
    "typescript": "^6.0.3"
  }
}
```

- `@3flows/intelligence` builds on `@3flows/platform`. Both come from the `next` preview tag; `yarn.lock` pins the exact versions.
- Everything else is the same as in the platform: `"type": "module"`, `packageManager`, and the `.yarnrc.yml` with the GitHub Packages scope.

### `.yarnrc.yml` and `tsconfig.json`

Unchanged from the [platform setup](https://3flows.github.io/platform-docs/docs/tutorial/setup#yarnrcyml): `nodeLinker: node-modules`, the `@3flows` scope on GitHub Packages, and `experimentalDecorators` with `emitDecoratorMetadata` for `@Register()`.

### `intelligence.yml`

```yaml title="intelligence.yml"
name: my-intelligence-app

https:
  - name: api
    port: 3000

# One model. The key comes from the environment.
ais:
  - name: DEFAULT
    provider: openai
    model: gpt-4.1-mini
    connection:
      apiKey: ${{ OPENAI_API_KEY }}
```

It's the platform's YAML, with one new section. `ais` lists the models the application may use; [chapter 1](./intelligent-service.md) explains it. We call the file `intelligence.yml` to tell it apart from plain platform projects; the name doesn't matter.

### `main.ts`

```ts title="main.ts"
import { Intelligence } from '@3flows/intelligence';

// Import your services here, before the platform starts, so that YAML can find them.

await Intelligence.run('./intelligence.yml');
```

`Intelligence.run` starts the platform with the Intelligence sections (`ais`, `prompts`, `conversations`, `tracers`) registered. It's `Platform.run` plus a `ready` line in the log.

The starter also has `main.test.ts`, which starts the platform and checks `/health` and the configured model. `yarn test` runs it, with no key needed.

### `intelligence-service.ts`

The base class for intelligent services, and a matching `handler`. It puts `inference()`, `conversations()` and `prompts()` into the trigger context, next to the platform's `doc()`, `mq()` and `service()`:

```ts
const { inference, doc } = trigger.context;
```

This file is a **preview** of a change proposed for `@3flows/intelligence`. Until the library ships it, the starter and the samples carry it. Afterwards, `import { IntelligenceService, handler } from '@3flows/intelligence'` replaces the local import, and the file goes away.

## Run it

```sh
yarn install
yarn start
```

The platform prints its banner, then `AIs • DEFAULT started` and `Intelligence • ready`. In a second terminal:

```sh
curl localhost:3000/health
```

```txt
OK
```

The model is configured, and nothing asks it anything yet. That's [chapter 1](./intelligent-service.md).

## When something goes wrong

Everything on the [platform's list](https://3flows.github.io/platform-docs/docs/tutorial/setup#when-something-goes-wrong) applies. In addition:

| Symptom | Cause |
|---|---|
| `401` or `Incorrect API key provided` on the first question | `OPENAI_API_KEY` isn't set in the shell that started the app. Unset variables become `null` in YAML |
| `No AI is defined with capability chat` | There's no `ais` section, or its model is an embedding or speech model |
| `No AI is defined with capability structured` | A local model without declared capabilities. Add `capabilities: [structured, tools]` |
| `fetch failed`, `ECONNREFUSED 127.0.0.1:11434` | Ollama isn't running |
| Two versions of `@3flows/platform` in `node_modules` | `@3flows/intelligence` and your project resolve different platform versions. Run `yarn up @3flows/platform@next @3flows/intelligence@next` |

## Working on Intelligence itself

To try an unreleased change, link local checkouts instead of the registry versions:

```json title="package.json"
"dependencies": {
  "@3flows/intelligence": "portal:../intelligence",
  "@3flows/platform": "portal:../platform"
}
```

Run `yarn build` in the linked project after every change. Link both, so there's exactly one copy of the platform. Switch back to `"next"` before you commit.

Next: [An intelligent service](./intelligent-service.md)
