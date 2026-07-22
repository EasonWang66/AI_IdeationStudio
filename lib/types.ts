export type ReferenceSuggestion = {
  name: string;
  reason: string;
};

export type GenerationResult = {
  imageUrl: string;
  tags: string[];
  palette: string[];
  references: ReferenceSuggestion[];
  rationale: string;
  revisedPrompt: string;
  mode?: "openai" | "mock";
};

export type TimelineEntry = {
  id: string;
  createdAt: string;
  prompt: string;
  baseImage?: string;
  result: GenerationResult;
};
