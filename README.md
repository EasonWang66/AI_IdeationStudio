# Adobe_Firefly_IdeationStudio

## Description

This project showcases a prototype for an AI-powered visual ideation product called Visual Ideation Studio. The app helps creative users explore aesthetic directions by combining a selected base image with a text prompt, then generating one refined visual reference with supporting visual intelligence.

This build focuses on a polished end-to-end prototype flow rather than a full production asset-management platform. It supports base image upload, prompt-driven generation through the OpenAI API, one primary generated outcome, visual genre tags, palette notes, direction rationale, artist and research references, and a local iteration timeline so users can revisit earlier explorations.

The prototype is designed around Adobe Spectrum visual patterns where possible, including React Spectrum controls, Sarpanch typography selected for the product identity, compact tool panels, glass-style dark surfaces, draggable and resizable workspace panels, thumbnail history pagination, accessible button states, and restrained animated background motion. The primary target is a fixed desktop demonstration canvas with a minimum width of 1200px for use in portfolio, GitHub, and Vercel presentation contexts.

The repository folder is named `Adobe_Firefly_IdeationStudio` for portfolio positioning, while the product interface uses the name Visual Ideation Studio to avoid implying Adobe sponsorship or an official Adobe Firefly integration.

## Link to Live Demo

Vercel deployment pending.

## Tools and Technologies Used

Adobe Spectrum design system — visual structure, React Spectrum components, control styling, spacing logic, dark UI behavior, and interaction polish adapted for the prototype.

Next.js — app framework, local development server, server route, and production build pipeline.

React — component-based interface for the ideation control panel, generated outcome panel, timeline, style tags, references, and draggable workspace.

TypeScript — typed generation results, timeline entries, UI state, and API response contracts.

OpenAI API — image generation and structured visual metadata generation for tags, palette, rationale, and references.

CSS3 — fixed-width canvas, glass panel system, draggable workspace styling, responsive constraints, animated gradients, hover states, and custom product theming.

Sarpanch — bundled product typography used consistently across controls, headings, and panel content.

Figma — intended source of truth for UI references, portfolio polish, and future design handoff.

Git & GitHub — version control and repository hosting.

Vercel — hosting target for live demo access.

## Pages

`/` — Prototype: Visual Ideation Studio workspace with a left-side control panel, generated image thumbnail history, base image selection, prompt input, generate action, draggable/resizable Outcome panel, Timeline panel, Styles panel, and References panel.

The prototype currently includes:

New Project — clears the current base image, prompt, generated images, selected result, and timeline state.

Base Image Selection — upload area for PNG, JPG, or WebP reference images.

Prompt Input — text prompt field for defining mood, material, genre, visual direction, or art-direction constraints.

Generate / Regenerate — sends the prompt and optional base image to the generation route and creates one outcome at a time.

Generated Thumbnail History — 3x3 thumbnail grid with pagination once attempts exceed nine results.

Outcome Panel — primary generated visual result with save-to-local PNG support.

Timeline Panel — ongoing iteration log so users can revisit earlier generation checkpoints.

Styles Panel — generated visual genre tags such as impressionism, cyberpunk, editorial minimalism, cinematic lighting, or related visual categories.

References Panel — recommended artists, research references, and rationale-style inspiration notes returned by the AI metadata flow.

Customizable Workspace — users can move the side panel between left and right, drag workspace panels, and resize the Outcome, Timeline, Styles, and References panels.

The AI output is driven by the API route in `app/api/generate/route.ts`, with shared TypeScript data models in `lib/`, so the prototype behaves like a connected product concept rather than a static mockup.

## Responsive Strategy

Built desktop-first for a fixed presentation canvas:

Base (1200px minimum) — fixed-width ideation workspace with a docked control panel and open draggable workspace.

Large desktop — the canvas remains stable so the prototype can be presented consistently in portfolio, GitHub, and Vercel contexts.

Narrower browser windows — horizontal overflow is allowed so the 1200px prototype layout does not collapse or distort.

The interface can be adapted into a responsive experience later, but this prototype intentionally prioritizes visual accuracy, desktop workspace customization, and controlled presentation fidelity.

## Getting Started

```bash
pnpm install
pnpm dev
```

Create a `.env.local` file and add:

```bash
OPENAI_API_KEY=your_api_key_here
```

Build for production:

```bash
pnpm build
```

## Project Structure

```text
Adobe_Firefly_IdeationStudio/
  next.config.ts         Next.js configuration
  package.json           scripts and dependencies
  pnpm-workspace.yaml    pnpm workspace configuration
  tsconfig.json          TypeScript configuration
  .env.example           environment variable example
  .gitignore             ignored local and build files
  ai/
    prompts/
      image-generation.md        product prompt direction for image generation
    schemas/
      generation-result.json     structured generation metadata schema
  app/
    layout.tsx           app metadata and root layout
    page.tsx             main Visual Ideation Studio page
    globals.css          Sarpanch fonts, Spectrum-inspired styling, layout, and animations
    api/
      generate/
        route.ts         OpenAI image and metadata generation endpoint
  components/
    ideation-studio.tsx  main interactive workspace, panels, timeline, and controls
  docs/
    design/
      spectrum-usage.md  notes on Spectrum-inspired product design usage
    product/
      product-brief.md   product concept, goals, and feature framing
    technical/
      ai-architecture.md AI route and structured output architecture notes
  lib/
    types.ts             shared TypeScript data models
  public/
    brand/               product logo, wand mark, and generate assets
    fonts/
      Sarpanch/          bundled Sarpanch font files
```
