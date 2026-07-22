import OpenAI from "openai";
import { NextResponse } from "next/server";
import type { GenerationResult } from "@/lib/types";

export const runtime = "nodejs";

const TEXT_MODEL = process.env.OPENAI_TEXT_MODEL ?? "gpt-5-mini";
const IMAGE_MODEL = "gpt-image-1" as const;
const MOCK_FALLBACK_ENABLED = process.env.AI_MOCK_FALLBACK !== "false";
const MAX_PROMPT_LENGTH = 1500;

const metadataSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    tags: {
      type: "array",
      minItems: 3,
      maxItems: 6,
      items: { type: "string" }
    },
    palette: {
      type: "array",
      minItems: 3,
      maxItems: 5,
      items: { type: "string" }
    },
    references: {
      type: "array",
      minItems: 3,
      maxItems: 5,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          name: { type: "string" },
          reason: { type: "string" }
        },
        required: ["name", "reason"]
      }
    },
    rationale: { type: "string" },
    revisedPrompt: { type: "string" }
  },
  required: ["tags", "palette", "references", "rationale", "revisedPrompt"]
} as const;

export async function POST(request: Request) {
  const { prompt, baseImage } = (await request.json()) as { prompt?: string; baseImage?: string };
  const trimmedPrompt = prompt?.trim() ?? "";
  const apiKey = process.env.OPENAI_API_KEY?.trim();

  if (!trimmedPrompt) {
    return NextResponse.json({ error: "Prompt is required." }, { status: 400 });
  }

  if (trimmedPrompt.length > MAX_PROMPT_LENGTH) {
    return NextResponse.json({ error: `Prompt must be ${MAX_PROMPT_LENGTH} characters or fewer.` }, { status: 400 });
  }

  if (baseImage && !baseImage.startsWith("data:image/")) {
    return NextResponse.json({ error: "Base image must be a data URL." }, { status: 400 });
  }

  if (!isUsableOpenAIKey(apiKey)) {
    if (MOCK_FALLBACK_ENABLED) {
      return NextResponse.json(buildMockResult(trimmedPrompt, "OPENAI_API_KEY is not configured.", baseImage));
    }

    return NextResponse.json({ error: "OPENAI_API_KEY is not configured and mock fallback is disabled." }, { status: 500 });
  }

  try {
    const client = new OpenAI({ apiKey });
    const generationPrompt = buildGenerationPrompt(trimmedPrompt, Boolean(baseImage));
    const b64 = await generateImage(client, generationPrompt, baseImage);
    const metadata = await generateMetadata(client, trimmedPrompt, generationPrompt, b64);

    return NextResponse.json({
      imageUrl: `data:image/png;base64,${b64}`,
      ...metadata,
      mode: "openai"
    } satisfies GenerationResult);
  } catch (error) {
    console.error("OpenAI generation failed", error);

    if (MOCK_FALLBACK_ENABLED) {
      return NextResponse.json(buildMockResult(trimmedPrompt, "OpenAI generation failed.", baseImage));
    }

    return NextResponse.json({ error: "Generation failed. Mock fallback is disabled." }, { status: 502 });
  }
}

function isUsableOpenAIKey(value?: string) {
  return Boolean(value && value !== "sk-your_key_here" && value.startsWith("sk-"));
}

function buildGenerationPrompt(prompt: string, hasBaseImage: boolean) {
  const baseInstruction = hasBaseImage
    ? "Use the uploaded image as high-level inspiration for mood, composition, material cues, and subject context without copying exact identities, logos, or protected marks."
    : "Create a complete visual reference from the text direction.";

  return [
    baseInstruction,
    "Generate one polished aesthetic reference image for an early creative ideation workflow.",
    "Make it useful as art direction: clear composition, intentional palette, strong lighting, and refined visual genre cues.",
    "Avoid text overlays, watermarks, UI chrome, brand logos, and direct imitation of a living artist.",
    `Creative direction: ${prompt}`
  ].join("\n");
}

async function generateImage(client: OpenAI, generationPrompt: string, baseImage?: string) {
  const imageInput = [
    {
      role: "user" as const,
      content: [
        { type: "input_text" as const, text: generationPrompt },
        ...(baseImage
          ? [
              {
                type: "input_image" as const,
                image_url: baseImage,
                detail: "high" as const
              }
            ]
          : [])
      ]
    }
  ];

  const imageResponse = await client.responses.create({
    model: TEXT_MODEL,
    input: imageInput,
    tools: [
      {
        type: "image_generation",
        model: IMAGE_MODEL,
        size: "1024x1024",
        quality: "medium",
        input_fidelity: baseImage ? "high" : "low"
      }
    ],
    tool_choice: { type: "image_generation" }
  });

  const imageOutput = imageResponse.output.find((item) => item.type === "image_generation_call");
  const b64 = imageOutput && "result" in imageOutput ? imageOutput.result : undefined;

  if (!b64) {
    throw new Error("The image model did not return an image.");
  }

  return b64;
}

async function generateMetadata(client: OpenAI, prompt: string, generationPrompt: string, b64: string) {
  const metadataInput = [
    {
      role: "system" as const,
      content:
        "You are an art direction assistant. Return concise, useful visual metadata for a generated design reference. Favor genres, movements, materials, camera/lighting language, and research references. Avoid claiming the image is by a living artist."
    },
    {
      role: "user" as const,
      content: [
        {
          type: "input_text" as const,
          text: `User prompt: ${prompt}\n\nGenerated image prompt: ${generationPrompt}`
        },
        {
          type: "input_image" as const,
          image_url: `data:image/png;base64,${b64}`,
          detail: "high" as const
        }
      ]
    }
  ];

  const metadataResponse = await client.responses.create({
    model: TEXT_MODEL,
    input: metadataInput,
    text: {
      format: {
        type: "json_schema",
        name: "visual_reference_metadata",
        schema: metadataSchema,
        strict: true
      }
    }
  });

  return JSON.parse(metadataResponse.output_text) as Omit<GenerationResult, "imageUrl" | "mode">;
}

function buildMockResult(prompt: string, reason: string, baseImage?: string): GenerationResult {
  const variant = getMockVariant(prompt, baseImage);

  return {
    imageUrl: buildMockImage(prompt, variant),
    tags: variant.tags,
    palette: variant.palette,
    references: variant.references,
    rationale: `Demo fallback generated because ${reason} This variation responds to the selected base image and prompt preset so the portfolio flow remains convincing without depending on live generation.`,
    revisedPrompt: [
      "Generate one polished aesthetic reference for a visual ideation workflow.",
      `Use ${variant.palette.slice(0, 3).join(", ")} with ${variant.tags.slice(0, 2).join(" and ")} cues.`,
      `Creative direction: ${prompt}`
    ].join(" "),
    mode: "mock"
  };
}

function getMockVariant(prompt: string, baseImage?: string) {
  const seed = hashString(`${prompt}|${baseImage?.slice(0, 180) ?? "no-base"}`);
  const tagSets = [
    ["editorial product", "cinematic lighting", "glassmorphism", "premium tech"],
    ["cyberpunk", "neon atmosphere", "industrial gloss", "design fiction"],
    ["impressionist", "painterly light", "soft motion", "dreamlike surface"],
    ["minimal luxury", "negative space", "gallery lighting", "sculptural form"]
  ];
  const palettes = [
    ["electric blue", "violet shadow", "soft magenta", "ink black"],
    ["cyan flare", "deep ultramarine", "hot pink", "charcoal"],
    ["mist lavender", "pearl white", "cool gray", "faded blue"],
    ["liquid teal", "blue glass", "moonlit silver", "near black"]
  ];
  const references = [
    [
      { name: "Adobe Spectrum patterns", reason: "Grounds the workflow in compact creative tooling and clear interaction states." },
      { name: "Editorial product moodboards", reason: "Useful for polished lighting, material cues, and art-direction sequencing." },
      { name: "Generative ideation workflows", reason: "Frames the image as one checkpoint in a larger exploration." }
    ],
    [
      { name: "Syd Mead production sketches", reason: "Useful precedent for cinematic future-facing object language." },
      { name: "Blade Runner color studies", reason: "Strong reference for saturated atmosphere and reflective neon contrast." },
      { name: "High-tech concept render decks", reason: "Connects the result to premium design-fiction presentation." }
    ],
    [
      { name: "Turner light studies", reason: "Good reference for hazy illumination and atmospheric transitions." },
      { name: "Monet surface studies", reason: "Useful for soft color vibration without exact stylistic imitation." },
      { name: "Painterly material boards", reason: "Helps translate loose visual mood into tactile direction." }
    ],
    [
      { name: "Muji product still life", reason: "Reference for restraint, object clarity, and quiet spatial hierarchy." },
      { name: "Luxury fragrance campaigns", reason: "Useful for reflective surfaces and controlled negative space." },
      { name: "Gallery object photography", reason: "Supports a refined single-object composition." }
    ]
  ];

  const index = seed % tagSets.length;

  return {
    index,
    colorA: ["#116dff", "#00c7ff", "#c9b7ff", "#51e6b5"][index],
    colorB: ["#ff63e7", "#ff4fd8", "#f6f0ff", "#4b9cf5"][index],
    colorC: ["#7f5bff", "#5367ff", "#8f7cff", "#d8fff2"][index],
    tags: tagSets[index],
    palette: palettes[index],
    references: references[index]
  };
}

function buildMockImage(prompt: string, variant: ReturnType<typeof getMockVariant>) {
  const safePrompt = escapeSvg(prompt.slice(0, 120));
  const svg = `
    <svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="glowA" cx="34%" cy="28%" r="70%">
          <stop offset="0%" stop-color="${variant.colorA}"/>
          <stop offset="46%" stop-color="${variant.colorC}"/>
          <stop offset="100%" stop-color="#15101d"/>
        </radialGradient>
        <radialGradient id="glowB" cx="72%" cy="78%" r="62%">
          <stop offset="0%" stop-color="${variant.colorB}" stop-opacity=".72"/>
          <stop offset="58%" stop-color="#30263d" stop-opacity=".54"/>
          <stop offset="100%" stop-color="#15101d" stop-opacity="0"/>
        </radialGradient>
        <filter id="softBlur">
          <feGaussianBlur stdDeviation="38"/>
        </filter>
      </defs>
      <rect width="1024" height="1024" fill="#15101d"/>
      <rect width="1024" height="1024" fill="url(#glowA)" opacity=".82"/>
      <circle cx="720" cy="766" r="330" fill="url(#glowB)" filter="url(#softBlur)"/>
      <rect x="152" y="152" width="720" height="720" rx="44" fill="#f6f0ff" opacity=".08" stroke="#f6f0ff" stroke-opacity=".22"/>
      <path d="M292 698C364 470 500 340 690 322C744 316 788 354 778 414C754 562 594 688 392 710C336 716 278 740 292 698Z" fill="#fff" opacity=".18"/>
      <path d="M350 650C420 494 530 402 670 390C700 388 726 410 718 444C690 550 568 640 416 662C378 668 338 678 350 650Z" fill="#fff" opacity=".3"/>
      <path d="M704 250L730 326L806 352L730 378L704 454L678 378L602 352L678 326Z" fill="#fff" opacity=".94"/>
      <text x="512" y="812" text-anchor="middle" fill="#f6f0ff" font-family="Arial, sans-serif" font-size="30" opacity=".86">Variation ${variant.index + 1} visual reference</text>
      <text x="512" y="858" text-anchor="middle" fill="#d1c4df" font-family="Arial, sans-serif" font-size="22" opacity=".78">${safePrompt}</text>
    </svg>`;

  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

function hashString(value: string) {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }

  return Math.abs(hash);
}

function escapeSvg(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
