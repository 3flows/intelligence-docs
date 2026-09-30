---
title: Inputs and files
---

# Inputs and files

Every chain takes input the same way.

## `.with(input, meta?)`

| `input` | Becomes |
|---|---|
| `string` | text |
| object, array | JSON |
| `Buffer`, `Readable` | a file, described by `meta` |

```ts
chat.with('The customer is a wholesale partner.')
    .with({ orderId: 'A-1042', status: 'shipped', shippedAt: '2025-05-02' })
    .with(buffer, { name: 'photo.jpg', mimeType: 'image/jpeg' });
```

Inputs are sent in the order they were added, before the question.

## `.withFile(source, meta?)`

| `source` | |
|---|---|
| a path | read from disk |
| `Buffer`, `Readable` | as is |
| a platform blob file (`blob().container(c).file(p)`) | downloaded |
| `{ container, path, blob? }` | the same as `withBlob` |

**Text files are sent as text.** A file counts as text if its extension is one of `.txt .md .csv .json .jsonl .yaml .yml .xml .html .log` or a source-code extension, or if `meta.mimeType` starts with `text/` or is `application/json`. Everything else is sent as a file.

## `.withBlob(container, path, meta?)`

Reads a file from the platform's `blobs`, with the same text rule:

```ts
chat.withBlob('attachments', `${ticket.id}/notes.txt`)
chat.withBlob({ blob: 'archive', container: 'attachments', path: 'old/notes.txt' })   // a named blob store
```

```yaml
blobs:
  - name: DEFAULT
    type: memory   # or azure, …
```

## `AIFileMeta`

| Field | Description |
|---|---|
| `name` | File name, also used to guess the type |
| `mimeType` | MIME type. Decides text vs. file |
| `size` | Size in bytes |
| `metadata` | Free-form |

## Which capabilities accept files

| Chain | Accepts |
|---|---|
| `chat`, `extract`, `choice`, `check`, `score`, conversations | text and text files. Binary files (images, PDFs) are rejected by the current providers: `AI … does not support file input for this operation` |
| `transcriber` | one audio file |
| `ocr`, `image`, `video` | files as provider input |

See [Known gaps](../guides/known-gaps.md) for image and PDF input to chat.
