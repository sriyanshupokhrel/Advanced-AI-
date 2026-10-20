"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { ImageManager } from "@/components/cv-editor/ImageManager";
import { AchievementsSection } from "@/components/cv-editor/sections/AchievementsSection";
import { EducationSection } from "@/components/cv-editor/sections/EducationSection";
import { ExperienceSection } from "@/components/cv-editor/sections/ExperienceSection";
import { PersonalDetailsSection } from "@/components/cv-editor/sections/PersonalDetailsSection";
import { ProjectsSection } from "@/components/cv-editor/sections/ProjectsSection";
import { SkillsSection } from "@/components/cv-editor/sections/SkillsSection";
import { CvPreview } from "@/components/cv-preview/CvPreview";
import { Button, buttonClass } from "@/components/ui/button";
import { fieldId } from "@/components/ui/form-fields";
import { ReturnToReviewBanner } from "@/components/ui/ReturnToReviewBanner";
import { cvApi } from "@/lib/api/api-client";
import {
  createEmptyCvForm,
  cvToFormState,
  formStateToInput,
  type CvFormState,
  type CvListSection,
} from "@/lib/cv/form-state";
import { cvSchema, toFieldErrors } from "@/lib/validation/cv-schema";
import type { CvImageDto, CvProfileDto, FieldErrors } from "@/types/cv";

type SaveStatus =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "saved"; message: string }
  | { kind: "error"; message: string };

/** Moves keyboard focus to the first invalid field so users can fix it. */
function focusFirstError(errors: FieldErrors) {
  requestAnimationFrame(() => {
    for (const path of Object.keys(errors)) {
      const element = document.getElementById(fieldId(path));
      if (element) {
        element.focus();
        element.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }
    }
    document.getElementById("save-status")?.scrollIntoView({ behavior: "smooth" });
  });
}

/** Removes errors for `prefix` itself and every path below it. */
function withoutErrorsUnder(errors: FieldErrors, prefix: string): FieldErrors {
  return Object.fromEntries(
    Object.entries(errors).filter(([key]) => key !== prefix && !key.startsWith(`${prefix}.`)),
  );
}

export function CvEditor({ initialCv, returnTo }: { initialCv: CvProfileDto | null; returnTo?: string }) {
  const [cvId, setCvId] = useState<string | null>(initialCv?.id ?? null);
  const [values, setValues] = useState<CvFormState>(() =>
    initialCv ? cvToFormState(initialCv) : createEmptyCvForm(),
  );
  const [images, setImages] = useState<CvImageDto[]>(initialCv?.images ?? []);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [status, setStatus] = useState<SaveStatus>({ kind: "idle" });
  const [isDirty, setIsDirty] = useState(false);
  const [mobileView, setMobileView] = useState<"edit" | "preview">("edit");

  // Warn before leaving the page with unsaved changes.
  useEffect(() => {
    if (!isDirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [isDirty]);

  const markChanged = () => {
    setIsDirty(true);
    if (status.kind === "saved") setStatus({ kind: "idle" });
  };

  const setPersonalField = (field: keyof CvFormState, value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => withoutErrorsUnder(current, field));
    markChanged();
  };

  // Returns an onChange handler for one list section.
  const listHandler =
    <K extends CvListSection>(section: K) =>
    (items: CvFormState[K], changedPaths: string[] | null) => {
      setValues((current) => ({ ...current, [section]: items }));
      setErrors((current) => {
        // Structural change: indexes shift, so clear the whole section's errors.
        if (changedPaths === null) return withoutErrorsUnder(current, section);
        return changedPaths.reduce(
          (acc, path) => withoutErrorsUnder(acc, `${section}.${path}`),
          current,
        );
      });
      markChanged();
    };

  const listProps = <K extends CvListSection>(section: K) => ({
    items: values[section],
    onChange: listHandler(section),
    errorFor: (path: string) => errors[`${section}.${path}`],
    sectionError: errors[section],
  });

  async function handleSave(event: FormEvent) {
    event.preventDefault();

    const parsed = cvSchema.safeParse(formStateToInput(values));
    if (!parsed.success) {
      const fieldErrors = toFieldErrors(parsed.error);
      const count = Object.keys(fieldErrors).length;
      setErrors(fieldErrors);
      setStatus({
        kind: "error",
        message: `Please fix ${count} highlighted ${count === 1 ? "field" : "fields"} before saving.`,
      });
      setMobileView("edit");
      focusFirstError(fieldErrors);
      return;
    }

    setStatus({ kind: "saving" });
    const result = cvId ? await cvApi.update(cvId, parsed.data) : await cvApi.create(parsed.data);

    if (!result.ok) {
      const fieldErrors = result.error.fieldErrors ?? {};
      setErrors(fieldErrors);
      setStatus({ kind: "error", message: result.error.error });
      focusFirstError(fieldErrors);
      return;
    }

    // Use the server's copy: new items now have database ids.
    setValues(cvToFormState(result.data));
    setImages(result.data.images);
    setErrors({});
    setIsDirty(false);
    setStatus({ kind: "saved", message: cvId ? "Changes saved." : "CV created and saved." });
    if (!cvId) {
      setCvId(result.data.id);
      // Update the URL to the edit page without remounting the editor.
      window.history.replaceState(null, "", `/cv/${result.data.id}`);
    }
  }

  const savedProjects = values.projects.flatMap((p) => (p.id ? [{ id: p.id, name: p.name }] : []));

  // Image changes are saved immediately by their own API calls; these keep the
  // editor (galleries + live preview) in sync with what the server returned.
  const imageProps = {
    cvId,
    images,
    projects: savedProjects,
    onImageSaved: (saved: CvImageDto) =>
      setImages((current) =>
        current.some((image) => image.id === saved.id)
          ? current.map((image) => (image.id === saved.id ? saved : image))
          : [...current, saved],
      ),
    onImageDeleted: (imageId: string) => setImages((current) => current.filter((image) => image.id !== imageId)),
  };

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6">
      {returnTo && <ReturnToReviewBanner href={returnTo} />}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">{cvId ? "Edit CV" : "Create a new CV"}</h1>
          <p className="text-sm text-slate-500">
            Fields marked <span className="text-red-600">*</span> are required.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {cvId && (
            <>
              <Link href={`/cv/${cvId}/preview`} className={buttonClass("secondary")}>
                Full-page preview
              </Link>
              <Link href={`/prepare?cvId=${cvId}`} className={buttonClass("secondary")}>
                Pair with a job
              </Link>
            </>
          )}
          <Button type="submit" form="cv-form" disabled={status.kind === "saving"}>
            {status.kind === "saving" ? "Saving…" : "Save CV"}
          </Button>
        </div>
      </div>

      <div id="save-status" aria-live="polite" className="mb-4 empty:hidden">
        {status.kind === "error" && (
          <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {status.message}
          </p>
        )}
        {status.kind === "saved" && (
          <p className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
            {status.message}
          </p>
        )}
        {status.kind === "idle" && isDirty && (
          <p className="text-sm text-amber-700">You have unsaved changes.</p>
        )}
      </div>

      {/* Edit / Preview switch for small screens; both panes show side by side on large screens. */}
      <div className="mb-4 grid grid-cols-2 rounded-md border border-slate-300 bg-white p-1 lg:hidden" role="tablist">
        {(["edit", "preview"] as const).map((view) => (
          <button
            key={view}
            type="button"
            role="tab"
            aria-selected={mobileView === view}
            onClick={() => setMobileView(view)}
            className={`rounded py-1.5 text-sm font-medium ${
              mobileView === view ? "bg-indigo-600 text-white" : "text-slate-700"
            }`}
          >
            {view === "edit" ? "Edit" : "Preview"}
          </button>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className={`space-y-5 ${mobileView === "edit" ? "" : "hidden lg:block"}`}>
          <form id="cv-form" onSubmit={handleSave} noValidate className="space-y-5">
            <PersonalDetailsSection
              values={values}
              onFieldChange={setPersonalField}
              errors={{
                fullName: errors.fullName,
                headline: errors.headline,
                email: errors.email,
                phone: errors.phone,
                location: errors.location,
                website: errors.website,
                summary: errors.summary,
              }}
            />
            <ExperienceSection {...listProps("experience")} />
            <EducationSection {...listProps("education")} />
            <SkillsSection {...listProps("skills")} />
            <ProjectsSection {...listProps("projects")} imageProps={imageProps} />
            <AchievementsSection {...listProps("achievements")} />
            <div className="flex justify-end">
              <Button type="submit" disabled={status.kind === "saving"}>
                {status.kind === "saving" ? "Saving…" : "Save CV"}
              </Button>
            </div>
          </form>
          <ImageManager {...imageProps} />
        </div>

        <div className={mobileView === "preview" ? "" : "hidden lg:block"}>
          <div className="lg:sticky lg:top-4">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Live preview</p>
            <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto">
              <CvPreview cv={values} images={images} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
