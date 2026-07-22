# AI Architecture

The prototype uses a production-plausible AI flow with a reliable portfolio fallback.

## Model Decisions

- `OPENAI_TEXT_MODEL`: defaults to `gpt-5-mini`
- Image model: `gpt-image-1`
- Image output: one `1024x1024` PNG returned as a data URL
- Metadata output: strict JSON schema through the Responses API

The route uses a text/vision model to coordinate image generation with the `image_generation` tool, then uses the same text/vision model to inspect the generated result and return structured metadata.

## Output Contract

`app/api/generate/route.ts` receives:

- `prompt`: required text, 1500 characters maximum
- `baseImage`: optional image data URL

It returns:

- `imageUrl`: generated image data URL or mock SVG data URL
- `tags`: visual genre and style tags
- `palette`: color and material palette terms
- `references`: research or artist/reference suggestions
- `rationale`: concise art-direction reasoning
- `revisedPrompt`: refined generation prompt
- `mode`: `openai` or `mock`

## Failure Behavior

`AI_MOCK_FALLBACK=true` keeps the public demo usable when:

- `OPENAI_API_KEY` is not configured
- the OpenAI request fails
- the image generation tool does not return an image

When fallback is active, the route returns the same `GenerationResult` shape with `mode: "mock"` and a generated SVG placeholder image. This keeps the interaction, timeline, tags, references, and save flow testable in portfolio and Vercel contexts.

Set `AI_MOCK_FALLBACK=false` for strict production behavior. In strict mode, missing API configuration returns `500`, and OpenAI failures return `502`.

## Future Storage

Timeline data is local in the MVP. A production version should store generated images in object storage and timeline records in a database.
