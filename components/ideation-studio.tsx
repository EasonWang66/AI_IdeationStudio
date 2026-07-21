"use client";

import { defaultTheme, Provider, Button, Flex, Heading, ProgressCircle, Text } from "@adobe/react-spectrum";
import AddCircle from "@spectrum-icons/workflow/AddCircle";
import ChevronLeft from "@spectrum-icons/workflow/ChevronLeft";
import ChevronRight from "@spectrum-icons/workflow/ChevronRight";
import Download from "@spectrum-icons/workflow/Download";
import ImageAdd from "@spectrum-icons/workflow/ImageAdd";
import { ChangeEvent, PointerEvent, useEffect, useMemo, useState } from "react";
import type { GenerationResult, TimelineEntry } from "@/lib/types";

const STORAGE_KEY = "visual-ideation-studio.timeline";
const THUMBNAILS_PER_PAGE = 9;
const PANEL_POSITIONS = {
  outcome: { x: 24, y: 24 },
  timeline: { x: 690, y: 24 },
  styles: { x: 690, y: 288 },
  references: { x: 690, y: 500 }
};
const PANEL_SIZES = {
  outcome: { width: 640, height: 498 },
  timeline: { width: 320, height: 240 },
  styles: { width: 320, height: 188 },
  references: { width: 320, height: 240 }
};
const PANEL_MIN_SIZES = {
  outcome: { width: 520, height: 360 },
  timeline: { width: 280, height: 180 },
  styles: { width: 280, height: 150 },
  references: { width: 280, height: 180 }
};
type PanelId = keyof typeof PANEL_POSITIONS;

const starterPrompt = "";

export function IdeationStudio() {
  const [baseImage, setBaseImage] = useState<string>("");
  const [prompt, setPrompt] = useState(starterPrompt);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [activeId, setActiveId] = useState<string>("");
  const [galleryPage, setGalleryPage] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState("");
  const [navSide, setNavSide] = useState<"left" | "right">("left");
  const [panelPositions, setPanelPositions] = useState(PANEL_POSITIONS);
  const [panelSizes, setPanelSizes] = useState(PANEL_SIZES);

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);

    if (!stored) return;

    try {
      const entries = JSON.parse(stored) as TimelineEntry[];
      setTimeline(entries);
      setActiveId(entries[0]?.id ?? "");
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(timeline));
  }, [timeline]);

  useEffect(() => {
    const lastPage = Math.max(0, Math.ceil(timeline.length / THUMBNAILS_PER_PAGE) - 1);
    setGalleryPage((page) => Math.min(page, lastPage));
  }, [timeline.length]);

  const activeEntry = useMemo(
    () => timeline.find((entry) => entry.id === activeId) ?? timeline[0],
    [activeId, timeline]
  );
  const totalGalleryPages = Math.max(1, Math.ceil(timeline.length / THUMBNAILS_PER_PAGE));
  const galleryEntries = timeline.slice(
    galleryPage * THUMBNAILS_PER_PAGE,
    galleryPage * THUMBNAILS_PER_PAGE + THUMBNAILS_PER_PAGE
  );
  const thumbnailSlots = Array.from({ length: THUMBNAILS_PER_PAGE }, (_, index) => galleryEntries[index]);

  async function handleImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setBaseImage(String(reader.result));
    };
    reader.readAsDataURL(file);
  }

  async function generate() {
    setError("");

    if (!prompt.trim()) {
      setError("Input a text prompt before generating.");
      return;
    }

    setIsGenerating(true);
    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, baseImage })
      });

      const payload = (await response.json()) as GenerationResult | { error: string };
      if (!response.ok || "error" in payload) {
        throw new Error("error" in payload ? payload.error : "Generation failed.");
      }

      const nextEntry: TimelineEntry = {
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        prompt,
        baseImage,
        result: payload
      };

      setTimeline((entries) => [nextEntry, ...entries]);
      setActiveId(nextEntry.id);
      setGalleryPage(0);
    } catch (generationError) {
      setError(generationError instanceof Error ? generationError.message : "Generation failed.");
    } finally {
      setIsGenerating(false);
    }
  }

  function startNewProject() {
    setBaseImage("");
    setPrompt(starterPrompt);
    setTimeline([]);
    setActiveId("");
    setGalleryPage(0);
    setError("");
  }

  function saveResult() {
    if (!activeEntry) return;

    const anchor = document.createElement("a");
    anchor.href = activeEntry.result.imageUrl;
    anchor.download = `visual-ideation-${activeEntry.createdAt.slice(0, 10)}-${activeEntry.id.slice(0, 8)}.png`;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
  }

  function toggleNavSide() {
    setNavSide((side) => (side === "left" ? "right" : "left"));
  }

  function beginPanelDrag(panel: PanelId, event: PointerEvent<HTMLElement>) {
    const startX = event.clientX;
    const startY = event.clientY;
    const startPosition = panelPositions[panel];

    event.currentTarget.setPointerCapture(event.pointerId);

    function movePanel(moveEvent: globalThis.PointerEvent) {
      const nextX = Math.max(16, startPosition.x + moveEvent.clientX - startX);
      const nextY = Math.max(16, startPosition.y + moveEvent.clientY - startY);
      setPanelPositions((positions) => ({
        ...positions,
        [panel]: { x: nextX, y: nextY }
      }));
    }

    function endPanelDrag() {
      window.removeEventListener("pointermove", movePanel);
      window.removeEventListener("pointerup", endPanelDrag);
    }

    window.addEventListener("pointermove", movePanel);
    window.addEventListener("pointerup", endPanelDrag);
  }

  function beginPanelResize(panel: PanelId, event: PointerEvent<HTMLElement>) {
    event.preventDefault();
    event.stopPropagation();

    const startX = event.clientX;
    const startY = event.clientY;
    const startSize = panelSizes[panel];
    const minSize = PANEL_MIN_SIZES[panel];

    event.currentTarget.setPointerCapture(event.pointerId);

    function resizePanel(moveEvent: globalThis.PointerEvent) {
      const nextWidth = Math.max(minSize.width, startSize.width + moveEvent.clientX - startX);
      const nextHeight = Math.max(minSize.height, startSize.height + moveEvent.clientY - startY);
      setPanelSizes((sizes) => ({
        ...sizes,
        [panel]: { width: nextWidth, height: nextHeight }
      }));
    }

    function endPanelResize() {
      window.removeEventListener("pointermove", resizePanel);
      window.removeEventListener("pointerup", endPanelResize);
    }

    window.addEventListener("pointermove", resizePanel);
    window.addEventListener("pointerup", endPanelResize);
  }

  return (
    <Provider theme={defaultTheme} colorScheme="dark">
      <div className={`studio-shell theme-dark studio-nav-${navSide}`}>
        <aside className="studio-nav">
          <button
            className="studio-dock-toggle"
            type="button"
            aria-label={`Move control panel to the ${navSide === "left" ? "right" : "left"} side`}
            onClick={toggleNavSide}
          />
          <div className="studio-nav-head">
            <div className="studio-logo">
              <img className="studio-logo-mark" src="/brand/studio-mark-simple.svg" alt="" />
              <div>
                <strong>Visual Ideation Studio</strong>
              </div>
            </div>
            <div className="studio-nav-actions">
              <Button variant="secondary" onPress={startNewProject} UNSAFE_className="studio-glass-button">
                <AddCircle />
                <Text>New Project</Text>
              </Button>
            </div>
          </div>

          <section className="studio-history-section">
            <div className="studio-history-head">
              <Heading level={2}>Generated</Heading>
              <div className="studio-page-controls">
                <button
                  className="studio-icon-button"
                  type="button"
                  aria-label="Previous generated page"
                  disabled={galleryPage === 0}
                  onClick={() => setGalleryPage((page) => Math.max(0, page - 1))}
                >
                  <ChevronLeft size="S" />
                </button>
                <span>{timeline.length ? `${galleryPage + 1} / ${totalGalleryPages}` : "0 / 0"}</span>
                <button
                  className="studio-icon-button"
                  type="button"
                  aria-label="Next generated page"
                  disabled={galleryPage + 1 >= totalGalleryPages}
                  onClick={() => setGalleryPage((page) => Math.min(totalGalleryPages - 1, page + 1))}
                >
                  <ChevronRight size="S" />
                </button>
              </div>
            </div>

            <div className="studio-thumbnail-grid">
              {thumbnailSlots.map((entry, index) =>
                entry ? (
                  <button
                    className="studio-thumbnail"
                    type="button"
                    aria-current={entry.id === activeId}
                    aria-label={`Open generated image from ${formatDate(entry.createdAt)}`}
                    key={entry.id}
                    onClick={() => setActiveId(entry.id)}
                  >
                    <img src={entry.result.imageUrl} alt="" />
                  </button>
                ) : (
                  <div className="studio-thumbnail-empty" key={`empty-${index}`}>
                    {index === 4 && !timeline.length ? "Generated images will appear here." : null}
                  </div>
                )
              )}
            </div>
          </section>

          <section className="studio-nav-section studio-input-section">
            <div className="studio-form">
              <label className="studio-upload">
                {baseImage ? (
                  <img className="studio-preview" src={baseImage} alt="Selected base reference" />
                ) : (
                  <Flex direction="column" gap="size-100" alignItems="center">
                    <ImageAdd size="L" />
                    <Text>Select a base image</Text>
                    <Text UNSAFE_className="studio-small">PNG, JPG, or WebP</Text>
                  </Flex>
                )}
                <input hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={handleImageChange} />
              </label>

              <label>
                <Text>Prompt</Text>
                <textarea
                  className="studio-textarea"
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value)}
                  placeholder="Input a text prompt to describe the mood, style, material, genre, or visual direction."
                />
              </label>

              <div className="studio-actions studio-actions-stack">
                <Button
                  variant="accent"
                  onPress={generate}
                  isDisabled={isGenerating}
                  UNSAFE_className="studio-generate-button"
                >
                  {isGenerating ? (
                    <ProgressCircle size="S" isIndeterminate />
                  ) : null}
                  <Text>{activeEntry ? "Regenerate" : "Generate"}</Text>
                </Button>
              </div>

              {error ? <Text UNSAFE_style={{ color: "var(--studio-warning)" }}>{error}</Text> : null}
            </div>
          </section>
        </aside>

        <main className="studio-main">
          <div className="studio-workspace" aria-label="Customizable workspace">
            <section
              className="studio-panel studio-floating-panel studio-outcome-panel"
              style={{
                width: panelSizes.outcome.width,
                height: panelSizes.outcome.height,
                transform: `translate(${panelPositions.outcome.x}px, ${panelPositions.outcome.y}px)`
              }}
            >
              <button
                className="studio-panel-drag-edge"
                type="button"
                aria-label="Drag outcome panel"
                onPointerDown={(event) => beginPanelDrag("outcome", event)}
              />
              <div className="studio-panel-title">
                <Heading level={2}>Outcome</Heading>
                <div className="studio-title-actions">
                  {activeEntry ? <Text UNSAFE_className="studio-small">{formatDate(activeEntry.createdAt)}</Text> : null}
                  <Button
                    variant="secondary"
                    onPress={saveResult}
                    isDisabled={!activeEntry}
                    UNSAFE_className="studio-glass-button"
                  >
                    <Download />
                    <Text>Save PNG</Text>
                  </Button>
                </div>
              </div>

              {activeEntry ? (
                <div className="studio-form">
                  <img className="studio-result-image" src={activeEntry.result.imageUrl} alt="Generated aesthetic reference" />

                  <div className="studio-meta-grid">
                    <MetaBlock title="Visual Genres">
                      <div className="studio-tag-row">
                        {activeEntry.result.tags.map((tag) => (
                          <span className="studio-tag" key={tag}>
                            {tag}
                          </span>
                        ))}
                      </div>
                    </MetaBlock>
                    <MetaBlock title="Palette">
                      <Text>{activeEntry.result.palette.join(", ")}</Text>
                    </MetaBlock>
                  </div>

                  <MetaBlock title="Recommended Artists / References">
                    <ul className="studio-reference-list">
                      {activeEntry.result.references.map((reference) => (
                        <li key={reference.name}>
                          <strong>{reference.name}</strong>
                          <Text>{reference.reason}</Text>
                        </li>
                      ))}
                    </ul>
                  </MetaBlock>

                  <MetaBlock title="Direction Notes">
                    <Text>{activeEntry.result.rationale}</Text>
                  </MetaBlock>
                </div>
              ) : (
                <div className="studio-result-placeholder">
                  <Text>The generated reference and visual intelligence will appear here.</Text>
                </div>
              )}
              <button
                className="studio-panel-resize-handle"
                type="button"
                aria-label="Resize outcome panel"
                onPointerDown={(event) => beginPanelResize("outcome", event)}
              />
            </section>

            <section
              className="studio-panel studio-floating-panel studio-timeline-panel"
              style={{
                width: panelSizes.timeline.width,
                height: panelSizes.timeline.height,
                transform: `translate(${panelPositions.timeline.x}px, ${panelPositions.timeline.y}px)`
              }}
            >
              <button
                className="studio-panel-drag-edge"
                type="button"
                aria-label="Drag timeline panel"
                onPointerDown={(event) => beginPanelDrag("timeline", event)}
              />
              <div className="studio-panel-title">
                <Heading level={2}>Timeline</Heading>
              </div>
              {timeline.length ? (
                <ol className="studio-timeline-list">
                  {timeline.map((entry, index) => (
                    <li key={entry.id}>
                      <button
                        className="studio-timeline-item"
                        type="button"
                        aria-current={entry.id === activeId}
                        onClick={() => setActiveId(entry.id)}
                      >
                        <span>Iteration {timeline.length - index}</span>
                        <strong>{entry.result.tags.slice(0, 3).join(", ")}</strong>
                        <span className="studio-small">{formatDate(entry.createdAt)}</span>
                      </button>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="studio-empty">Project checkpoints will appear here as you generate.</p>
              )}
              <button
                className="studio-panel-resize-handle"
                type="button"
                aria-label="Resize timeline panel"
                onPointerDown={(event) => beginPanelResize("timeline", event)}
              />
            </section>

            <section
              className="studio-panel studio-floating-panel studio-side-panel studio-styles-panel"
              style={{
                width: panelSizes.styles.width,
                height: panelSizes.styles.height,
                transform: `translate(${panelPositions.styles.x}px, ${panelPositions.styles.y}px)`
              }}
            >
              <button
                className="studio-panel-drag-edge"
                type="button"
                aria-label="Drag styles panel"
                onPointerDown={(event) => beginPanelDrag("styles", event)}
              />
              <div className="studio-panel-title">
                <Heading level={2}>Styles</Heading>
              </div>
              {activeEntry ? (
                <div className="studio-chip-list">
                  {activeEntry.result.tags.map((tag) => (
                    <span className="studio-tag" key={tag}>
                      {tag}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="studio-empty">Style genres will appear here after generation.</p>
              )}
              <button
                className="studio-panel-resize-handle"
                type="button"
                aria-label="Resize styles panel"
                onPointerDown={(event) => beginPanelResize("styles", event)}
              />
            </section>

            <section
              className="studio-panel studio-floating-panel studio-side-panel studio-references-panel"
              style={{
                width: panelSizes.references.width,
                height: panelSizes.references.height,
                transform: `translate(${panelPositions.references.x}px, ${panelPositions.references.y}px)`
              }}
            >
              <button
                className="studio-panel-drag-edge"
                type="button"
                aria-label="Drag references panel"
                onPointerDown={(event) => beginPanelDrag("references", event)}
              />
              <div className="studio-panel-title">
                <Heading level={2}>References</Heading>
              </div>
              {activeEntry ? (
                <ul className="studio-reference-list studio-panel-scroll">
                  {activeEntry.result.references.map((reference) => (
                    <li key={reference.name}>
                      <strong>{reference.name}</strong>
                      <Text>{reference.reason}</Text>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="studio-empty">Artist and research references will appear here after generation.</p>
              )}
              <button
                className="studio-panel-resize-handle"
                type="button"
                aria-label="Resize references panel"
                onPointerDown={(event) => beginPanelResize("references", event)}
              />
            </section>
          </div>
        </main>
      </div>
    </Provider>
  );
}

function MetaBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="studio-panel-title">
        <Heading level={3}>{title}</Heading>
      </div>
      {children}
    </section>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));
}
