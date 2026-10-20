"use client";

import { useRouter } from "next/navigation";
import { ImageCard } from "@/components/images/ImageCard";
import type { CvImageDto } from "@/types/cv";

interface ReviewImageListProps {
  cvId: string;
  images: CvImageDto[];
  projects: { id: string; name: string }[];
}

/**
 * Image cards on the review page. Users can confirm, correct the description
 * or project link, replace or delete images here; the page then reloads its
 * server data so the readiness summary stays accurate.
 */
export function ReviewImageList({ cvId, images, projects }: ReviewImageListProps) {
  const router = useRouter();
  if (images.length === 0) return null;
  return (
    <ul className="mt-3 grid gap-2 xl:grid-cols-2">
      {images.map((image) => (
        <ImageCard
          key={image.id}
          cvId={cvId}
          image={image}
          projects={projects}
          onSaved={() => router.refresh()}
          onDeleted={() => router.refresh()}
        />
      ))}
    </ul>
  );
}
