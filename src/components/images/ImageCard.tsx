"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import { SafeImage } from "@/components/images/SafeImage";
import { ConfirmationBadge } from "@/components/targets/ConfirmationBadge";
import { Button } from "@/components/ui/button";
import { SelectField, TextField } from "@/components/ui/form-fields";
import { imageApi } from "@/lib/api/api-client";
import { formatFileSize } from "@/lib/cv/format";
import { toFieldErrors } from "@/lib/validation/cv-schema";
import {
  ALLOWED_IMAGE_LABEL,
  ALLOWED_IMAGE_TYPES,
  IMAGE_KINDS,
  IMAGE_KIND_LABELS,
  MAX_IMAGE_BYTES,
  imageUpdateSchema,
  type ImageKind,
} from "@/lib/validation/image-schema";
import type { CvImageDto, FieldErrors } from "@/types/cv";

interface ImageCardProps {
  cvId: string;
  image: CvImageDto;
  /** Saved projects of this CV that the image can be linked to. */
  projects: { id: string; name: string }[];
  onSaved: (image: CvImageDto) => void;
  onDeleted: (imageId: string) => void;
}

/**
 * One uploaded image: preview, user-provided description, project link and
 * confirmation status, with edit / replace / delete / confirm actions.
 *
 * Confirming records only that the user checked the description and project
 * link. It does not make the image proof of anything.
 */
export function ImageCard({ cvId, image, projects, onSaved, onDeleted }: ImageCardProps) {
  const replaceInput = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ altText: "", caption: "", kind: image.kind, projectId: "" });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<null | "saving" | "replacing" | "deleting" | "confirming">(null);

  const project = projects.find((p) => p.id === image.projectId);
  const idPrefix = `image-${image.id}`;

  const startEditing = () => {
    setDraft({ altText: image.altText, caption: image.caption, kind: image.kind, projectId: image.projectId ?? "" });
    setErrors({});
    setError(null);
    setEditing(true);
  };

  async function saveEdits() {
    const parsed = imageUpdateSchema.safeParse(draft);
    if (!parsed.success) return setErrors(toFieldErrors(parsed.error));
    setBusy("saving");
    const result = await imageApi.update(cvId, image.id, parsed.data);
    setBusy(null);
    if (!result.ok) {
      setErrors(result.error.fieldErrors ?? {});
      setError(result.error.error);
      return;
    }
    setEditing(false);
    setError(null);
    onSaved(result.data);
  }

  async function setConfirmed(confirmed: boolean) {
    setBusy("confirming");
    setError(null);
    const result = await imageApi.update(cvId, image.id, { confirmed });
    setBusy(null);
    if (!result.ok) return setError(result.error.error);
    onSaved(result.data);
  }

  async function replaceFile(file: File | undefined) {
    if (replaceInput.current) replaceInput.current.value = "";
    if (!file) return;
    setError(null);
    if (file.size > MAX_IMAGE_BYTES) return setError(`Image must be ${formatFileSize(MAX_IMAGE_BYTES)} or smaller.`);
    if (!(ALLOWED_IMAGE_TYPES as readonly string[]).includes(file.type))
      return setError(`Only ${ALLOWED_IMAGE_LABEL} images are supported.`);
    setBusy("replacing");
    const result = await imageApi.replaceFile(cvId, image.id, file);
    setBusy(null);
    if (!result.ok) return setError(result.error.fieldErrors?.file ?? result.error.error);
    onSaved(result.data);
  }

  async function remove() {
    if (!window.confirm(`Delete "${image.originalName}"? This cannot be undone.`)) return;
    setBusy("deleting");
    setError(null);
    const result = await imageApi.remove(cvId, image.id);
    setBusy(null);
    if (!result.ok && result.status !== 404) return setError(result.error.error);
    onDeleted(image.id);
  }

  // Enter inside the edit fields saves the image instead of submitting the CV form.
  const handleEnter = (event: KeyboardEvent) => {
    if (event.key === "Enter" && event.target instanceof HTMLInputElement) {
      event.preventDefault();
      void saveEdits();
    }
  };

  const dimensions = image.width && image.height ? `${image.width}×${image.height}` : null;

  return (
    <li className="rounded-md border border-slate-200 bg-white p-3">
      <div className="flex gap-3">
        <a href={image.url} target="_blank" rel="noopener noreferrer" className="shrink-0" title="Open full size">
          <SafeImage
            src={image.url}
            alt={image.altText}
            width={96}
            height={96}
            className="h-24 w-24 rounded border border-slate-200 object-cover"
          />
        </a>
        <div className="min-w-0 flex-1 text-xs text-slate-600">
          <div className="mb-1">
            <ConfirmationBadge status={image.confirmationStatus} />
          </div>
          <p className="text-sm font-medium text-slate-900">{image.altText}</p>
          {image.caption && <p className="italic">{image.caption}</p>}
          <p className="mt-1 truncate" title={image.originalName}>
            {IMAGE_KIND_LABELS[image.kind]} · {[dimensions, formatFileSize(image.sizeBytes)].filter(Boolean).join(" · ")}
          </p>
          <p className="truncate">{project ? `Project: ${project.name}` : "Not linked to a project"}</p>
        </div>
      </div>

      {editing ? (
        <div role="group" aria-label="Edit image details" onKeyDown={handleEnter} className="mt-3 grid gap-3 sm:grid-cols-2">
          <TextField
            path={`${idPrefix}.altText`}
            label="What does the image show?"
            required
            value={draft.altText}
            onChange={(altText) => setDraft((d) => ({ ...d, altText }))}
            error={errors.altText}
          />
          <TextField
            path={`${idPrefix}.caption`}
            label="Caption"
            value={draft.caption}
            onChange={(caption) => setDraft((d) => ({ ...d, caption }))}
            error={errors.caption}
          />
          <SelectField
            path={`${idPrefix}.kind`}
            label="Image type"
            value={draft.kind}
            onChange={(kind) => setDraft((d) => ({ ...d, kind: kind as ImageKind }))}
            error={errors.kind}
            options={IMAGE_KINDS.map((k) => ({ value: k, label: IMAGE_KIND_LABELS[k] }))}
          />
          <SelectField
            path={`${idPrefix}.projectId`}
            label="Linked project"
            value={draft.projectId}
            onChange={(projectId) => setDraft((d) => ({ ...d, projectId }))}
            error={errors.projectId}
            options={[{ value: "", label: "None" }, ...projects.map((p) => ({ value: p.id, label: p.name || "Untitled project" }))]}
          />
          <div className="flex gap-2 sm:col-span-2">
            <Button onClick={saveEdits} disabled={busy !== null}>
              {busy === "saving" ? "Saving…" : "Save image details"}
            </Button>
            <Button variant="ghost" onClick={() => setEditing(false)} disabled={busy !== null}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <>
          {image.confirmationStatus !== "CONFIRMED" && (
            <p className="mt-3 rounded bg-slate-50 px-2 py-1.5 text-xs text-slate-600">
              {image.confirmationStatus === "CHANGED_SINCE_CONFIRMATION" && "This image changed after you confirmed it. "}
              Check that the description is accurate and the image belongs to{" "}
              {project ? <strong>{project.name}</strong> : "this CV"}, then confirm.
            </p>
          )}
          <div className="mt-2 flex flex-wrap gap-1.5">
            {image.confirmationStatus === "CONFIRMED" ? (
              <Button variant="ghost" className="px-2 py-1 text-xs" onClick={() => setConfirmed(false)} disabled={busy !== null}>
                Withdraw confirmation
              </Button>
            ) : (
              <Button className="px-2 py-1 text-xs" onClick={() => setConfirmed(true)} disabled={busy !== null}>
                {busy === "confirming" ? "Confirming…" : "Confirm"}
              </Button>
            )}
            <Button variant="secondary" className="px-2 py-1 text-xs" onClick={startEditing} disabled={busy !== null}>
              Edit details
            </Button>
            <Button
              variant="secondary"
              className="px-2 py-1 text-xs"
              onClick={() => replaceInput.current?.click()}
              disabled={busy !== null}
            >
              {busy === "replacing" ? "Replacing…" : "Replace file"}
            </Button>
            <Button variant="danger" className="px-2 py-1 text-xs" onClick={remove} disabled={busy !== null}>
              {busy === "deleting" ? "Deleting…" : "Delete"}
            </Button>
            <input
              ref={replaceInput}
              type="file"
              accept={ALLOWED_IMAGE_TYPES.join(",")}
              className="hidden"
              aria-label={`Replacement file for ${image.altText}`}
              onChange={(event) => replaceFile(event.target.files?.[0])}
            />
          </div>
        </>
      )}

      {error && (
        <p role="alert" className="mt-2 text-xs font-medium text-red-700">
          {error}
        </p>
      )}
    </li>
  );
}
