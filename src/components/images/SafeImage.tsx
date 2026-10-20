"use client";

import Image from "next/image";
import { useState } from "react";

interface SafeImageProps {
  src: string;
  alt: string;
  width: number;
  height: number;
  className?: string;
}

/**
 * An image served by the app's image API. If the file cannot be loaded (e.g.
 * it was removed from storage), a labelled placeholder is shown instead of a
 * broken-image icon. Images are served as uploaded (`unoptimized`).
 */
export function SafeImage({ src, alt, width, height, className = "" }: SafeImageProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  if (failedSrc === src) {
    return (
      <div
        role="img"
        aria-label={`Image unavailable: ${alt}`}
        style={{ width, height }}
        className={`flex items-center justify-center bg-slate-100 p-1 text-center text-[10px] leading-tight text-slate-500 ${className}`}
      >
        Image unavailable
      </div>
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      width={width}
      height={height}
      unoptimized
      onError={() => setFailedSrc(src)}
      className={className}
    />
  );
}
