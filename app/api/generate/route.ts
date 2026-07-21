import OpenAI from "openai";
import { NextResponse } from "next/server";
import type { GenerationResult } from "@/lib/types";

export const runtime = "nodejs";

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

  if (!prompt?.trim()) {
    return NextResponse.json({ error: "Prompt is required." }, { status: 400 });
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "OPENAI_API_KEY is not configured." }, { status: 500 });
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const generationPrompt = buildGenerationPrompt(prompt, Boolean(baseImage));

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
    model: "gpt-5-mini",
    input: imageInput,
    tools: [
      {
        type: "image_generation",
        model: "gpt-image-1",
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
    return NextResponse.json({ error: "The image model did not return an image." }, { status: 502 });
  }

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
    model: "gpt-5-mini",
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

  const metadata = JSON.parse(metadataResponse.output_text) as Omit<GenerationResult, "imageUrl">;

  return NextResponse.json({
    imageUrl: `data:image/png;base64,${b64}`,
    ...metadata
  } satisfies GenerationResult);
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
