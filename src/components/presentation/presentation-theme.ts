import type { CSSProperties } from "react";

/**
 * Presentation-only visual tokens ("Soft Monochrome").
 *
 * Two independent groups:
 * - `editorPalette` / `presentationTheme`: the editor web shell around the slide.
 * - `slideCanvasTokens`: the slide canvas itself, kept as plain values so a later
 *   PPTX export can reuse them without depending on Tailwind classes.
 */

export const editorPalette = {
  page: "#EDEDED",
  panel: "#FAFAFA",
  raised: "#FFFFFF",
  note: "#E4E4E4",
  text: "#1A1A1A",
  textMuted: "#6B6B6B",
  textSubtle: "#9A9A9A",
  border: "#E3E3E3",
  primary: "#1A1A1A",
  primaryHover: "#333333",
  accent: "#FE5E0E",
  error: "#D93A3A",
  errorSurface: "#FCF3F3",
  warningText: "#3D3A35",
  warningSurface: "#F2EEE8",
  serif: 'Georgia, "Times New Roman", serif',
  shadowSoft: "0 1px 2px rgba(0, 0, 0, 0.04), 0 12px 32px -12px rgba(0, 0, 0, 0.10)",
  shadowLift: "0 2px 6px rgba(0, 0, 0, 0.04), 0 32px 64px -24px rgba(0, 0, 0, 0.18)",
} as const;

/** CSS custom properties applied once on the editor root; classes below read them. */
export const editorCssVars = {
  "--pe-page": editorPalette.page,
  "--pe-panel": editorPalette.panel,
  "--pe-raised": editorPalette.raised,
  "--pe-note": editorPalette.note,
  "--pe-text": editorPalette.text,
  "--pe-muted": editorPalette.textMuted,
  "--pe-subtle": editorPalette.textSubtle,
  "--pe-border": editorPalette.border,
  "--pe-primary": editorPalette.primary,
  "--pe-primary-hover": editorPalette.primaryHover,
  "--pe-accent": editorPalette.accent,
  "--pe-error": editorPalette.error,
  "--pe-error-surface": editorPalette.errorSurface,
  "--pe-warning-text": editorPalette.warningText,
  "--pe-warning-surface": editorPalette.warningSurface,
  "--pe-serif": editorPalette.serif,
  "--pe-shadow-soft": editorPalette.shadowSoft,
  "--pe-shadow-lift": editorPalette.shadowLift,
} as CSSProperties;

const focusRing =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--pe-text)";

/**
 * Editor shell classes. Type scale is limited to four steps:
 * display (serif 2rem) · base (1rem) · sm (0.875rem) · xs (0.75rem).
 */
export const presentationTheme = {
  shell: "min-h-full bg-(--pe-page) text-(--pe-text)",
  display: "font-(family-name:--pe-serif) text-[2rem] leading-tight font-normal tracking-tight",
  sectionTitle: "text-base font-semibold",
  eyebrow: "text-xs font-medium uppercase tracking-[0.12em] text-(--pe-muted)",
  muted: "text-(--pe-muted)",
  panel: "rounded-2xl bg-(--pe-panel) shadow-(--pe-shadow-soft)",
  card: "rounded-xl border border-(--pe-border) bg-(--pe-raised)",
  note: "rounded-2xl bg-(--pe-note) text-(--pe-text)",
  focus: focusRing,
  input:
    "w-full rounded-xl border border-(--pe-border) bg-(--pe-raised) px-3 py-2 text-sm text-(--pe-text) placeholder:text-(--pe-subtle) transition-colors hover:border-(--pe-subtle) focus:border-(--pe-text) focus:outline-none focus-visible:ring-2 focus-visible:ring-(--pe-text)/15 aria-invalid:border-(--pe-error) aria-invalid:border-2",
  label: "block text-sm font-medium text-(--pe-text)",
  helper: "mt-1.5 block text-xs leading-relaxed text-(--pe-muted)",
  fieldError: "mt-1.5 flex items-start gap-1.5 text-xs font-medium text-(--pe-error)",
  buttonPrimary: `inline-flex items-center justify-center gap-1.5 rounded-full bg-(--pe-primary) px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-(--pe-primary-hover) disabled:cursor-not-allowed disabled:opacity-40 ${focusRing}`,
  buttonSecondary: `inline-flex items-center justify-center gap-1.5 rounded-full border border-(--pe-border) bg-(--pe-raised) px-4 py-2 text-sm font-medium text-(--pe-text) transition-colors hover:border-(--pe-subtle) disabled:cursor-not-allowed disabled:text-(--pe-muted) disabled:hover:border-(--pe-border) ${focusRing}`,
  buttonGhost: `inline-flex items-center justify-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium text-(--pe-text) transition-colors hover:bg-(--pe-page) ${focusRing}`,
  statusPill: "inline-flex items-center gap-1.5 rounded-full bg-(--pe-raised) px-3 py-1.5 text-xs font-medium text-(--pe-text) shadow-(--pe-shadow-soft)",
  warning: "flex items-start gap-2 rounded-xl bg-(--pe-warning-surface) px-3 py-2.5 text-xs leading-relaxed text-(--pe-warning-text)",
  error: "flex items-start gap-2 rounded-xl border border-(--pe-error) bg-(--pe-error-surface) px-3 py-2.5 text-xs leading-relaxed text-(--pe-text)",
  accentBar: "bg-(--pe-accent)",
  slideFrame: "rounded-2xl shadow-(--pe-shadow-lift)",
} as const;

/**
 * Slide canvas tokens, independent from the editor shell.
 * Sizes are fractions of the slide width (percent → `cqw` in the preview,
 * points on a 960pt-wide 16:9 slide for a future PPTX export). `minPx` is a
 * readability floor for narrow on-screen previews; the canvas scrolls instead
 * of shrinking text further.
 */
export const slideCanvasTokens = {
  aspectRatio: 16 / 9,
  colors: {
    background: "#FFFFFF",
    heading: "#1A1A1A",
    body: "#3D3D3D",
    meta: "#6B6B6B",
    marker: "#9A9A9A",
    rule: "#E3E3E3",
    accent: "#FE5E0E",
    error: "#D93A3A",
    errorSurface: "#FCF3F3",
    imageMat: "#F5F5F5",
  },
  fonts: {
    heading: 'Georgia, "Times New Roman", serif',
    body: '"Helvetica Neue", Helvetica, Arial, sans-serif',
  },
  /** Percent of slide width. */
  size: {
    heading: { percent: 4.6, minPx: 18 },
    body: { percent: 2.6, minPx: 12 },
    meta: { percent: 1.5, minPx: 11 },
  },
  /** Percent of slide width. */
  spacing: {
    paddingX: 6,
    paddingY: 4.5,
    columnGap: 4,
    accentRuleWidth: 6,
    accentRuleHeight: 0.4,
  },
} as const;

const fluid = ({ percent, minPx }: { percent: number; minPx: number }) => `max(${minPx}px, ${percent}cqw)`;

/** CSS custom properties for the slide canvas preview. */
export const slideCanvasCssVars = {
  "--sc-bg": slideCanvasTokens.colors.background,
  "--sc-heading": slideCanvasTokens.colors.heading,
  "--sc-body": slideCanvasTokens.colors.body,
  "--sc-meta": slideCanvasTokens.colors.meta,
  "--sc-marker": slideCanvasTokens.colors.marker,
  "--sc-rule": slideCanvasTokens.colors.rule,
  "--sc-accent": slideCanvasTokens.colors.accent,
  "--sc-error": slideCanvasTokens.colors.error,
  "--sc-error-surface": slideCanvasTokens.colors.errorSurface,
  "--sc-image-mat": slideCanvasTokens.colors.imageMat,
  "--sc-font-heading": slideCanvasTokens.fonts.heading,
  "--sc-font-body": slideCanvasTokens.fonts.body,
  "--sc-size-heading": fluid(slideCanvasTokens.size.heading),
  "--sc-size-body": fluid(slideCanvasTokens.size.body),
  "--sc-size-meta": fluid(slideCanvasTokens.size.meta),
  "--sc-pad-x": `${slideCanvasTokens.spacing.paddingX}cqw`,
  "--sc-pad-y": `${slideCanvasTokens.spacing.paddingY}cqw`,
  "--sc-gap": `${slideCanvasTokens.spacing.columnGap}cqw`,
  "--sc-rule-w": `${slideCanvasTokens.spacing.accentRuleWidth}cqw`,
  "--sc-rule-h": `max(2px, ${slideCanvasTokens.spacing.accentRuleHeight}cqw)`,
} as CSSProperties;
