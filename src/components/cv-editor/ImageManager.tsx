"use client";

import { ImageCard } from "@/components/images/ImageCard";
import { ImageUploader } from "@/components/images/ImageUploader";
import type { ImageCallbacks } from "@/components/images/ProjectImageGallery";
import { MAX_IMAGES_PER_CV } from "@/lib/validation/image-schema";

/**
 * Images that are not linked to a project: profile photo, certificates and
 * similar. Project images are managed inside each project in the Projects
 * section; an image can be moved between the two via "Edit details".
 */
export function ImageManager({ cvId, images, projects, onImageSaved, onImageDeleted }: ImageCallbacks) {
  const unlinked = images.filter((image) => !image.projectId);
  const atCvLimit = images.length >= MAX_IMAGES_PER_CV;

  return (
    <section id="images" className="scroll-mt-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <header className="mb-4">
        <h2 className="text-base font-semibold text-slate-900">Other images</h2>
        <p className="text-sm text-slate-500">
          Profile photo, certificates and other images not tied to one project. Add project screenshots inside each
          project above.
        </p>
      </header>

      {!cvId ? (
        <p className="rounded-md border border-dashed border-slate-300 p-4 text-center text-sm text-slate-500">
          Save your CV first, then you can attach images.
        </p>
      ) : (
        <>
          {unlinked.length > 0 && (
            <ul className="mb-4 space-y-2">
              {unlinked.map((image) => (
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
          {atCvLimit ? (
            <p className="text-sm text-slate-500">
              This CV has the maximum of {MAX_IMAGES_PER_CV} images. Delete one to add another.
            </p>
          ) : (
            <ImageUploader
              cvId={cvId}
              idPrefix="cv-upload"
              projectId=""
              defaultKind="PROFILE_PHOTO"
              onUploaded={onImageSaved}
            />
          )}
        </>
      )}
    </section>
  );
}
