---
title: Modalities
---

# Modalities

A **modality** is a kind of content: text, audio, images, video, documents. Modern models convert between them, and Intelligence gives each conversion its own capability, with the same grammar as `chat()`.

## The map

| From → to | Capability | Chain | Typical use |
|---|---|---|---|
| audio → text | `transcription` | `transcriber().withFile(audio).transcribe()` | voicemails, call recordings, dictation |
| text → audio | `speech` | `speech().voice('alloy').speak(text)` | phone bots, read-aloud, accessibility |
| text → image | `image` | `image().size('1024x1024').generate(prompt)` | illustrations, product mock-ups |
| text → video | `video` | `video().duration(5).generate(prompt)` | short clips |
| document → text | `ocr` | `ocr().withFile(scan).read()` | scanned letters, receipts |
| text → vector | `embedding` | `embedding().with(text).embed()` | search, similarity, clustering |
| text → verdict | `moderation` | `moderation().check(text)` | safety screening |

Each capability is served by a model that has it. A typical `ais` section has one chat model and a few small specialists:

```yaml
ais:
  - name: DEFAULT
    provider: openai
    model: gpt-4.1-mini
    connection: { apiKey: '${{ OPENAI_API_KEY }}' }
  - name: transcriber
    provider: openai
    model: whisper-1
    connection: { apiKey: '${{ OPENAI_API_KEY }}' }
  - name: voice
    provider: openai
    model: tts-1
    connection: { apiKey: '${{ OPENAI_API_KEY }}' }
```

## Chains compose through plain values

Modalities combine by passing results along. A voicemail becomes a ticket in three lines:

```ts
const ai = trigger.context.inference();

const { text } = await ai.transcriber().withBlob('voicemails', `${id}.mp3`).language('en').transcribe();
const department = await ai.choice('department').oneOf(['billing', 'technical', 'sales']).with(text).ask('Which team?');
const { audio } = await ai.speech().voice('alloy').speak(`Thanks for your message. The ${department.value} team will call you back.`);
```

Every step is an ordinary value: a string, a decision, a `Buffer`. Store them, test them, and look at them in a review like any other data.

## Files in, files out

Audio, images and documents come in as files: a path, a `Buffer`, a stream or a platform blob (`.withBlob(container, path)`). Generated audio comes back as a `Buffer`; store it in `blobs` rather than in memory. See [Inputs and files](../api/inputs-and-files.md).

## Availability

Capabilities are only as available as the providers behind them. The API for all of them is in place, but not every provider implements every one. As of now, `video` and `ocr` have no built-in provider, and image and PDF input to chat is not yet supported. See [Known gaps](../guides/known-gaps.md). Until then, a [custom provider](../guides/custom-provider.md) can fill any capability.

## Reviewer's view

Audio and images carry more personal data than they seem to: voices, faces, background conversations, handwriting. For each modality, ask which provider receives it, and whether the stored originals are needed after they've been converted to text.
