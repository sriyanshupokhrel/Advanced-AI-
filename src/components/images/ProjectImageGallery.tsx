"use client";

import { ImageCard } from "@/components/images/ImageCard";
import { ImageUploader } from "@/components/images/ImageUploader";
import { MAX_IMAGES_PER_PROJECT } from "@/lib/validation/image-schema";
import type { CvImageDto } from "@/types/cv";

export interface ImageCallbacks {
  cvId: string | null;
  images: CvImageDto[];
  /** Saved projects of the CV (images can only link to saved projects). */
  projects: { id: string; name: string }[];
  onImageSaved: (image: CvImageDto) => void;
  onImageDeleted: (imageId: string) => void;
}

interface ProjectImageGalleryProps extends ImageCallbacks {
  /** Database id of the project; undefined while the project is unsaved. */
  projectId: string | undefined;
}

/** Visual evidence for one project: previews, review/confirm, upload. */
export function ProjectImageGallery({
  cvId,
  projectId,
  images,
  projects,
  onImageSaved,
  onImageDeleted,
}: ProjectImageGalleryProps) {
  const projectImages = projectId ? images.filter((image) => image.projectId === projectId) : [];
  const confirmed = projectImages.filter((image) => image.confirmationStatus === "CONFIRMED").length;

  return (
    <div className="mt-4 border-t border-slate-200 pt-3">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h4 className="text-sm font-semibold text-slate-700">Project images</h4>
        {projectId && (
          <p className="text-xs text-slate-500">
            {projectImages.length} / {MAX_IMAGES_PER_PROJECT} · {confirmed} confirmed
          </p>
        )}
      </div>

      {!cvId || !projectId ? (
        <p className="rounded-md border border-dashed border-slate-300 p-3 text-center text-xs text-slate-500">
          Save the CV to add screenshots or other images to this project.
        </p>
      ) : (
        <>
          {projectImages.length > 0 && (
            <ul className="mb-3 space-y-2">
              {projectImages.map((image) => (
                <ImageCard
                  key={image.id}
                  cvId={cvId}
                  image={image}
                  projects={projects}
                  onSaved={onImageSaved}
                  onDeleted={onImageDeleted}
                />
              ))}
            </ul>
          )}
          {projectImages.length < MAX_IMAGES_PER_PROJECT ? (
            <details className="rounded-md border border-slate-200 bg-white p-3" open={projectImages.length === 0}>
              <summary className="cursor-pointer text-sm font-medium text-indigo-700">Add an image</summary>
              <div className="mt-3">
                <ImageUploader
                  cvId={cvId}
                  idPrefix={`project-${projectId}-upload`}
                  projectId={projectId}
                  defaultKind="PROJECT_SCREENSHOT"
                  onUploaded={onImageSaved}
                />
              </div>
            </details>
          ) : (
            <p className="text-xs text-slate-500">
              This project has the maximum of {MAX_IMAGES_PER_PROJECT} images. Delete one to add another.
            </p>
          )}
        </>
      )}
    </div>
  );
}
