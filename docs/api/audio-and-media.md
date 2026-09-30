---
title: Audio, images, video and OCR
sidebar_label: Audio, images, video, OCR
---

# Audio, images, video and OCR

The non-text [modalities](../concepts/modalities.md). Each requires an AI with the matching capability.

## `transcriber()`

Audio to text. Capability `transcription` (e.g. `whisper-1`, `gpt-4o-transcribe`).

```ts
const transcript = await Intelligence.inference()
    .transcriber()
    .withBlob('voicemails', 'call-0042.mp3')
    .language('en')
    .transcribe();

transcript.text;
```

| Method | Description |
|---|---|
| `.with(source, meta?)` / `.withFile(source, meta?)` | The audio: path, `Buffer`, `Readable` or blob file. One file per call |
| `.withBlob(container, path, meta?)` | The audio from `blobs` |
| `.language(code)` | ISO language code, improves accuracy |
| `.prompt(text)` | A hint: names, product words, the previous sentence |
| `.timestamps()` | Ask for segments with timings (`verbose_json`) |
| `.responseFormat(format)` | `json`, `text`, `srt`, `verbose_json`, `vtt` |
| `.temperature(n)` | Sampling temperature |

**`.transcribe()`** resolves with `{ text, language?, duration?, segments?, usage?, model, provider, raw }`.

## `speech()`

Text to audio. Capability `speech` (e.g. `tts-1`, `gpt-4o-mini-tts`).

```ts
const { audio, mimeType } = await Intelligence.inference()
    .speech()
    .voice('alloy')
    .format('mp3')
    .speak('Thanks for calling. Your order has shipped.');

await trigger.context.blob().container('greetings').file('shipped.mp3').upload(Readable.from([audio]));
```

| Method | Description |
|---|---|
| `.speak(text?)` | The text to speak. Without an argument, the last `with(...)` text is spoken |
| `.voice(name)` | Provider voice, e.g. `alloy`, `nova` |
| `.format(f)` / `.responseFormat(f)` | `mp3`, `opus`, `aac`, `flac`, `wav`, `pcm` |
| `.speed(n)` | Playback speed |
| `.instructions(...)` / `.prompt(...)` | How to speak, for models that support it: *warm and slow* |

**Result:** `{ audio: Buffer, mimeType?, usage?, model, provider, raw }`.

## `image()`

Text (and optionally images) to images. Capability `image` (e.g. `dall-e-3`, `gpt-image-1`).

```ts
const { images } = await Intelligence.inference()
    .image()
    .size('1024x1024')
    .quality('high')
    .generate('A watercolor of a city bike leaning against a bakery window.');

images[0].url ?? images[0].b64Json;
```

| Method | Description |
|---|---|
| `.generate(prompt?)` | The description. Instructions and prompts are prepended |
| `.with(...)` / `.withFile(...)` | Reference images, where the model supports editing |
| `.count(n)`, `.size(s)`, `.quality(q)`, `.style(s)` | Provider parameters |
| `.responseFormat('url' \| 'b64_json')` | How images come back |

**Result:** `{ images: [{ url?, b64Json?, revisedPrompt? }], usage?, model, provider, raw }`.

## `video()`

Text (and optionally a start image) to video. Capability `video`.

```ts
const { videos } = await Intelligence.inference().video().duration(5).size('1280x720').generate('A bike ride along a canal at dawn.');
```

| Method | Description |
|---|---|
| `.generate(prompt?)` | The description |
| `.duration(seconds)`, `.size(s)` | Provider parameters |
| `.withFile(...)` | Start frame |

**Result:** `{ videos: [{ url?, b64Json? }], … }`.

:::caution No built-in provider yet
The `video()` chain is in place, but no bundled provider implements `video` yet. Use a [custom provider](../guides/custom-provider.md).
:::

## `ocr()` {#ocr}

Documents and images to text. Capability `ocr`.

```ts
const { text, pages } = await Intelligence.inference()
    .ocr()
    .withBlob('attachments', 'ticket-42/receipt.png')
    .read('Keep the table layout as markdown.');
```

| Method | Description |
|---|---|
| `.read(prompt?)` | Runs OCR. The optional prompt guides layout and format |
| `.with(...)`, `.withFile(...)`, `.withBlob(...)` | The document(s). Required |

**Result:** `{ text, pages?: [{ index?, text }], usage?, model, provider, raw }`.

:::caution No built-in provider yet
The `ocr()` chain is in place, but no bundled provider implements `ocr` yet. Use a [custom provider](../guides/custom-provider.md).
:::
