import { cn } from "../lib/cn";

const SIZES = {
  sm: "size-6 text-[0.625rem]",
  md: "size-8 text-xs",
  lg: "size-10 text-sm",
} as const;

export interface AvatarProps {
  /**
   * The person's name. Required, and used both for the initials and — when there is an
   * image — for its `alt`, so an avatar can never be an unlabelled picture of a face.
   */
  name: string;
  src?: string | null;
  size?: keyof typeof SIZES;
  className?: string;
}

/**
 * Initials for Thai and Latin names alike.
 *
 * Thai is written without spaces inside a word but Thai *names* are spaced ("สมชาย ใจดี"), so
 * splitting on whitespace works for both scripts. Two initials at most: three is a monogram,
 * not a label, and Thai glyphs with tone marks are tall enough that two already fill the
 * circle.
 */
export function initialsOf(name: string): string {
  // Only words that start with a letter: "สมชาย ใจดี (ฝ่ายขาย)" is สมชาย ใจดี, not สม(.
  const parts = name
    .trim()
    .split(/\s+/)
    .filter((part) => /^\p{L}/u.test(part));
  if (parts.length === 0) return "";
  // `[...part]` rather than `part[0]`: a surrogate pair or a Thai character with a combining
  // mark would otherwise be sliced in half and render as a replacement glyph.
  const first = [...(parts[0] ?? "")][0] ?? "";
  const second = parts.length > 1 ? ([...(parts[parts.length - 1] ?? "")][0] ?? "") : "";
  return `${first}${second}`;
}

/**
 * A person, at a glance. Falls back to initials rather than a generic silhouette, because a
 * silhouette beside a name tells the reader nothing the name did not.
 */
export function Avatar({ name, src, size = "md", className }: AvatarProps) {
  const classes = cn(
    "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full",
    "bg-primary-subtle text-primary-subtle-fg font-medium select-none",
    SIZES[size],
    className,
  );

  if (src) {
    // Avatars arrive as short-lived signed URLs (api-conventions §3), which next/image cannot
    // optimise and would re-fetch through its own loader after the signature had expired.
    // eslint-disable-next-line @next/next/no-img-element -- see above
    return <img src={src} alt={name} className={classes} width={32} height={32} />;
  }

  return (
    // The initials are decorative: the name is always rendered beside the avatar, so reading
    // "สจ" aloud first would just be noise.
    <span className={classes} aria-hidden>
      {initialsOf(name)}
    </span>
  );
}
