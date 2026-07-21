# AI Architecture

The MVP uses two OpenAI calls:

1. Image generation with `gpt-image-1`
2. Metadata extraction with a text/vision model and structured JSON output

## Server Route

`app/api/generate/route.ts` receives:

- `prompt`
- optional `baseImage` data URL

It returns:

- generated image data URL
- visual genre tags
- palette terms
- recommended references
- rationale
- revised prompt

## Future Storage

Timeline data is local in the MVP. A production version should store generated images in object storage and timeline records in a database.
