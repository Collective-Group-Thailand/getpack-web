"use client";

import { useEffect, useRef, useState } from "react";

export interface CardImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
  /** What takes the picture's place when it cannot be loaded (a 404, a dead signed URL). */
  fallback: React.ReactNode;
}

/**
 * A card's picture that never leaves an empty plate behind: when the file fails — before or after
 * hydration — the card's own line drawing takes its place instead of a grey tile with a broken-image
 * mark. Everything else is a plain `<img>` (the caller's size, loading and priority hints).
 */
export function CardImage({ fallback, onError, ...props }: CardImageProps) {
  const [failed, setFailed] = useState(false);
  const ref = useRef<HTMLImageElement>(null);

  // An image the server rendered may have failed before React attached `onError`.
  useEffect(() => {
    const image = ref.current;
    if (image && image.complete && image.naturalWidth === 0 && image.currentSrc) setFailed(true);
  }, []);

  // A new picture gets a new chance.
  const [src, setSrc] = useState(props.src);
  if (src !== props.src) {
    setSrc(props.src);
    setFailed(false);
  }

  if (failed) return <>{fallback}</>;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- ProductCard's images come through the BFF (see there)
    <img
      ref={ref}
      {...props}
      alt={props.alt}
      onError={(event) => {
        setFailed(true);
        onError?.(event);
      }}
    />
  );
}
