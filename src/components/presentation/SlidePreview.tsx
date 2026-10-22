"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import type { PresentationSlide } from "@/types/presentation";
import type { ReferenceResult, ResolvedImageSource } from "@/lib/presentation/editor-model";
import { AlertIcon, WarningIcon } from "./PresentationIcons";
import { presentationTheme, slideCanvasCssVars } from "./presentation-theme";

interface SlidePreviewProps {
  presentationTitle: string;
  slide: PresentationSlide;
  slideNumber: number;
  totalSlides: number;
  images: ReferenceResult<ResolvedImageSource>[];
  failedImageIds: ReadonlySet<string>;
  onImageError: (imageId: string) => void;
  synthetic?: boolean;
}

/** Slide canvas preview. Visual values come from `slideCanvasTokens` via `--sc-*` variables. */
export function SlidePreview({ presentationTitle, slide, slideNumber, totalSlides, images, failedImageIds, onImageError, synthetic = false }: SlidePreviewProps) {
  const foundImages = images.filter((image): image is Extract<typeof image, { status: "FOUND" }> => image.status === "FOUND");
  const missingImages = images.filter((image) => image.status === "MISSING");
  const canvasRef = useRef<HTMLElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [overflowing, setOverflowing] = useState(false);

  // Display-only: surface content that extends past the 16:9 frame instead of letting it disappear.
  useEffect(() => {
    const canvas = canvasRef.current;
    const content = contentRef.current;
    if (!canvas || !content) return;
    const measure = () => setOverflowing(canvas.scrollHeight > canvas.clientHeight + 1);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(canvas);
    observer.observe(content);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="space-y-2">
      <section
        ref={canvasRef}
        tabIndex={overflowing ? 0 : undefined}
        aria-label={`Slide ${slideNumber} preview`}
        style={slideCanvasCssVars}
        className={`relative aspect-video w-full overflow-auto bg-(--sc-bg) ${presentationTheme.focus} font-(family-name:--sc-font-body) text-(--sc-body) [container-type:inline-size] ${presentationTheme.slideFrame}`}
      >
        <div ref={contentRef} className="flex min-h-full flex-col px-(--sc-pad-x) py-(--sc-pad-y)">
          <div className="flex items-baseline justify-between gap-[2cqw] text-(length:--sc-size-meta) leading-snug tracking-[0.08em] text-(--sc-meta) uppercase">
            <span className="min-w-0 break-words">{presentationTitle || "Untitled presentation"}</span>
            <span className="shrink-0 tabular-nums">{slideNumber} / {totalSlides}</span>
          </div>
          <div className={`grid flex-1 items-center gap-(--sc-gap) py-[3cqw] ${foundImages.length ? "grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]" : "grid-cols-1"}`}>
            <div className="min-w-0">
              <h2 className="font-(family-name:--sc-font-heading) text-(length:--sc-size-heading) leading-[1.12] font-normal break-words text-(--sc-heading)">{slide.heading || "Untitled slide"}</h2>
              <span aria-hidden="true" className="mt-[2cqw] block h-(--sc-rule-h) w-(--sc-rule-w) bg-(--sc-accent)" />
              <ul className="mt-[2.4cqw] space-y-[1.2cqw] text-(length:--sc-size-body) leading-[1.45]">
                {slide.bullets.map((bullet, index) => (
                  <li key={index} className="flex gap-[0.6em] break-words">
                    <span aria-hidden="true" className="mt-[0.62em] h-[0.3em] w-[0.3em] shrink-0 rounded-full bg-(--sc-marker)" />
                    <span className="min-w-0">{bullet || <span className="inline-flex items-center gap-1 italic text-(--sc-error)"><AlertIcon className="h-[1em] w-[1em]" />Empty bullet</span>}</span>
                  </li>
                ))}
              </ul>
            </div>
            {foundImages.length > 0 && (
              <div className="grid min-w-0 gap-[2cqw]">
                {foundImages.map(({ value }) => (
                  <figure key={value.imageId} className="min-w-0">
                    {failedImageIds.has(value.imageId) ? (
                      <div role="status" className="flex aspect-[4/3] flex-col items-center justify-center gap-1 rounded-lg border border-(--sc-error) bg-(--sc-error-surface) p-3 text-center text-(length:--sc-size-meta) text-(--sc-heading)">
                        <AlertIcon className="h-5 w-5 text-(--sc-error)" />
                        <span className="font-semibold">Image failed to load</span>
                        <code className="break-all">{value.imageId}</code>
                      </div>
                    ) : (
                      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg border border-(--sc-rule) bg-(--sc-image-mat)">
                        <Image src={value.image.url} alt={value.image.description.altText} fill unoptimized sizes="(max-width: 1280px) 40vw, 24vw" className="object-contain" onError={() => onImageError(value.imageId)} />
                      </div>
                    )}
                    <figcaption className="mt-[0.8cqw] text-(length:--sc-size-meta) leading-snug text-(--sc-meta)">{value.projectName} · user-uploaded, unverified{synthetic ? " synthetic image" : " image"}</figcaption>
                  </figure>
                ))}
              </div>
            )}
          </div>
          {missingImages.length > 0 && (
            <p role="status" className="flex items-start gap-1.5 rounded-md border border-(--sc-error) bg-(--sc-error-surface) px-2 py-1 text-(length:--sc-size-meta) font-medium text-(--sc-heading)">
              <AlertIcon className="mt-px h-[1.2em] w-[1.2em] text-(--sc-error)" />
              <span>Missing image reference: {missingImages.map((image) => image.id).join(", ")}</span>
            </p>
          )}
        </div>
      </section>
      {overflowing && <p role="status" className={presentationTheme.warning}><WarningIcon className="mt-px h-4 w-4" /><span><span className="font-semibold">Content extends beyond the slide.</span> Scroll inside the preview to see all of it; on a real slide it would not fit.</span></p>}
    </div>
  );
}
