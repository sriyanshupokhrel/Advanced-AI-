"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { SelectField, TextField, fieldId } from "@/components/ui/form-fields";
import { imageApi } from "@/lib/api/api-client";
import { formatFileSize } from "@/lib/cv/format";
import { toFieldErrors } from "@/lib/validation/cv-schema";
import {
  ALLOWED_IMAGE_LABEL,
  ALLOWED_IMAGE_TYPES,
  IMAGE_KINDS,
  IMAGE_KIND_LABELS,
  MAX_IMAGE_BYTES,
  imageMetadataSchema,
  type ImageKind,
} from "@/lib/validation/image-schema";
import type { CvImageDto, FieldErrors } from "@/types/cv";

interface ImageUploaderProps {
  cvId: string;
  /** Unique per instance; prefixes field ids. */
  idPrefix: string;
  /** Link the upload to this project ("" for none). */
  projectId: string;
  defaultKind: ImageKind;
  onUploaded: (image: CvImageDto) => void;
}

/**
 * Upload form for one image. Rendered as a <div>, not a <form>, because it is
 * nested inside the CV editor's form (nested forms are invalid HTML); Enter in
 * a text field uploads instead of submitting the CV.
 *
 * Browser checks are for quick feedback only; the server re-validates the file
 * content and every rule.
 */
export function ImageUploader({ cvId, idPrefix, projectId, defaultKind, onUploaded }: ImageUploaderProps) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [kind, setKind] = useState<ImageKind>(defaultKind);
  const [altText, setAltText] = useState("");
  const [caption, setCaption] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const path = (field: string) => `${idPrefix}.${field}`;

  // Local preview of the chosen file before it is uploaded. The object URL is
  // released when the selection changes and when the component unmounts.
  const previewRef = useRef<string | null>(null);
  const selectFile = (next: File | null) => {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    previewRef.current = next ? URL.createObjectURL(next) : null;
    setPreviewUrl(previewRef.current);
    setFile(next);
  };
  useEffect(() => () => {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
  }, []);

  const clearError = (field: string) => setErrors(({ [field]: _removed, ...rest }) => rest);

  async function upload() {
    setMessage(null);
    const parsed = imageMetadataSchema.safeParse({ kind, altText, caption, projectId });
    const nextErrors: FieldErrors = parsed.success ? {} : toFieldErrors(parsed.error);
    if (!file) nextErrors.file = "Choose an image file to upload.";
    else if (file.size > MAX_IMAGE_BYTES) nextErrors.file = `Image must be ${formatFileSize(MAX_IMAGE_BYTES)} or smaller.`;
    else if (!(ALLOWED_IMAGE_TYPES as readonly string[]).includes(file.type))
      nextErrors.file = `Only ${ALLOWED_IMAGE_LABEL} images are supported.`;

    if (Object.keys(nextErrors).length > 0 || !file || !parsed.success) {
      setErrors(nextErrors);
      document.getElementById(fieldId(path(Object.keys(nextErrors)[0])))?.focus();
      return;
    }

    const form = new FormData();
    form.append("file", file);
    Object.entries(parsed.data).forEach(([key, value]) => form.append(key, value));

    setBusy(true);
    const result = await imageApi.upload(cvId, form);
    setBusy(false);
    if (!result.ok) {
      setErrors(result.error.fieldErrors ?? {});
      setMessage({ kind: "error", text: result.error.error });
      return;
    }
    onUploaded(result.data);
    selectFile(null);
    setAltText("");
    setCaption("");
    setErrors({});
    if (fileInput.current) fileInput.current.value = "";
    setMessage({ kind: "success", text: "Image uploaded. Review it below and confirm it when you are happy." });
  }

  const handleEnter = (event: KeyboardEvent) => {
    if (event.key === "Enter" && event.target instanceof HTMLInputElement) {
      event.preventDefault();
      void upload();
    }
  };

  const fileFieldId = fieldId(path("file"));

  return (
    <div role="group" aria-label="Upload an image" onKeyDown={handleEnter} className="grid gap-3 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <label htmlFor={fileFieldId} className="mb-1 block text-sm font-medium text-slate-700">
          Image file<span className="ml-0.5 text-red-600" aria-hidden="true">*</span>
        </label>
        <div className="flex items-center gap-3">
          {previewUrl && (
            <Image
              src={previewUrl}
              alt="Preview of the selected file"
              width={56}
              height={56}
              unoptimized
              className="h-14 w-14 shrink-0 rounded border border-slate-200 object-cover"
            />
          )}
          <input
            ref={fileInput}
            id={fileFieldId}
            type="file"
            accept={ALLOWED_IMAGE_TYPES.join(",")}
            onChange={(event) => {
              selectFile(event.target.files?.[0] ?? null);
              clearError("file");
              setMessage(null);
            }}
            aria-invalid={Boolean(errors.file)}
            aria-describedby={`${fileFieldId}-${errors.file ? "error" : "hint"}`}
            className="block w-full min-w-0 text-sm text-slate-700 file:mr-3 file:rounded-md file:border-0 file:bg-indigo-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-indigo-700 hover:file:bg-indigo-100"
          />
        </div>
        {errors.file ? (
          <p id={`${fileFieldId}-error`} className="mt-1 text-xs font-medium text-red-600">
            {errors.file}
          </p>
        ) : (
          <p id={`${fileFieldId}-hint`} className="mt-1 text-xs text-slate-500">
            {ALLOWED_IMAGE_LABEL}, up to {formatFileSize(MAX_IMAGE_BYTES)}.
          </p>
        )}
      </div>
      <TextField
        path={path("altText")}
        label="What does the image show?"
        required
        value={altText}
        onChange={(value) => {
          setAltText(value);
          clearError("altText");
        }}
        error={errors.altText}
        placeholder="e.g. Login screen of the budgeting app"
      />
      <TextField
        path={path("caption")}
        label="Caption"
        value={caption}
        onChange={(value) => {
          setCaption(value);
          clearError("caption");
        }}
        error={errors.caption}
      />
      <SelectField
        path={path("kind")}
        label="Image type"
        required
        value={kind}
        onChange={(value) => setKind(value as ImageKind)}
        error={errors.kind}
        options={IMAGE_KINDS.map((k) => ({ value: k, label: IMAGE_KIND_LABELS[k] }))}
      />
      <div className="flex items-end">
        <Button variant="secondary" onClick={upload} disabled={busy} className="w-full sm:w-auto">
          {busy ? "Uploading…" : "Upload image"}
        </Button>
      </div>
      {(message || errors.projectId) && (
        <p
          role={message?.kind === "success" ? "status" : "alert"}
          className={`text-sm sm:col-span-2 ${message?.kind === "success" ? "text-green-700" : "text-red-700"}`}
        >
          {errors.projectId ?? message?.text}
        </p>
      )}
    </div>
  );
}
