"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";

/**
 * Generic editor for a list of CV items (education, experience, ...).
 * Handles add / remove / reorder; the caller renders each item's fields.
 *
 * `onChange` receives the new list plus the fields that changed (as
 * "index.field" paths) so the parent can clear just those validation errors.
 * Structural changes (add/remove/move) pass `null`, meaning "re-index all".
 */
export interface RepeatableSectionProps<T extends { clientKey: string }> {
  title: string;
  description: string;
  items: T[];
  onChange: (items: T[], changedPaths: string[] | null) => void;
  createItem: () => T;
  itemLabel: (item: T, index: number) => string;
  renderItem: (item: T, index: number, patch: (changes: Partial<T>) => void) => ReactNode;
  addLabel: string;
  emptyMessage: string;
  sectionError?: string;
  /** DOM id so other pages can link straight to this section (e.g. #projects). */
  anchorId?: string;
}

export function RepeatableSection<T extends { clientKey: string }>({
  title,
  description,
  items,
  onChange,
  createItem,
  itemLabel,
  renderItem,
  addLabel,
  emptyMessage,
  sectionError,
  anchorId,
}: RepeatableSectionProps<T>) {
  const patchItem = (index: number) => (changes: Partial<T>) => {
    const next = items.map((item, i) => (i === index ? { ...item, ...changes } : item));
    onChange(next, Object.keys(changes).map((field) => `${index}.${field}`));
  };

  const removeItem = (index: number) => onChange(items.filter((_, i) => i !== index), null);

  const moveItem = (index: number, offset: -1 | 1) => {
    const target = index + offset;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next, null);
  };

  return (
    <section id={anchorId} className="scroll-mt-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <header className="mb-4">
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
        <p className="text-sm text-slate-500">{description}</p>
        {sectionError && <p className="mt-1 text-xs font-medium text-red-600">{sectionError}</p>}
      </header>

      {items.length === 0 ? (
        <p className="rounded-md border border-dashed border-slate-300 p-4 text-center text-sm text-slate-500">
          {emptyMessage}
        </p>
      ) : (
        <ol className="space-y-4">
          {items.map((item, index) => {
            const label = itemLabel(item, index);
            return (
              <li key={item.clientKey} className="rounded-md border border-slate-200 bg-slate-50/60 p-3 sm:p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-slate-700">{label}</h3>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      className="px-2 py-1"
                      onClick={() => moveItem(index, -1)}
                      disabled={index === 0}
                      aria-label={`Move ${label} up`}
                    >
                      ↑
                    </Button>
                    <Button
                      variant="ghost"
                      className="px-2 py-1"
                      onClick={() => moveItem(index, 1)}
                      disabled={index === items.length - 1}
                      aria-label={`Move ${label} down`}
                    >
                      ↓
                    </Button>
                    <Button
                      variant="danger"
                      className="px-2 py-1"
                      onClick={() => removeItem(index)}
                      aria-label={`Remove ${label}`}
                    >
                      Remove
                    </Button>
                  </div>
                </div>
                {renderItem(item, index, patchItem(index))}
              </li>
            );
          })}
        </ol>
      )}

      <Button variant="secondary" className="mt-4" onClick={() => onChange([...items, createItem()], null)}>
        + {addLabel}
      </Button>
    </section>
  );
}
