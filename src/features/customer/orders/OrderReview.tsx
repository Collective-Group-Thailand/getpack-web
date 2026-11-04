"use client";

import { useTranslations } from "next-intl";
import { useId, useState } from "react";

import { PhotoPicker, type PickedPhoto } from "@/features/customer/fulfilment/PhotoPicker";
import { useFormat } from "@/features/shared/format/useFormat";
import { browserApi } from "@/lib/api/browser";
import { isApiError } from "@/lib/api/problem";
import { browserRequests } from "@/lib/api/requests/browser";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { Field } from "@/ui/components/Field";
import { Textarea } from "@/ui/components/Input";
import { Icon } from "@/ui/icons";
import { cn } from "@/ui/lib/cn";

import {
  REVIEW_PHOTO_ACCEPT,
  REVIEW_PHOTO_MAX,
  REVIEW_PHOTO_MAX_BYTES,
  reviewPhotosOf,
  type Review,
  type ReviewPhoto,
} from "./review";

const SCORES = [1, 2, 3, 4, 5] as const;
const COMMENT_MAX = 1000;

/** Five stars, read-only: the rating as a picture with its words for a screen reader. */
export function ReviewStars({ rating, label, className }: { rating: number; label: string; className?: string }) {
  return (
    <span role="img" aria-label={label} className={cn("inline-flex items-center gap-0.5", className)}>
      {SCORES.map((score) => (
        <Icon
          key={score}
          name="star"
          size={16}
          fill={score <= rating ? "currentColor" : "none"}
          className={score <= rating ? "text-primary" : "text-border-strong"}
        />
      ))}
    </span>
  );
}

function Photos({ photos, label }: { photos: ReviewPhoto[]; label: string }) {
  if (!photos.length) return null;
  return (
    <ul aria-label={label} className="flex flex-wrap gap-2">
      {photos.map((photo, index) => (
        <li key={photo.id}>
          {/* eslint-disable-next-line @next/next/no-img-element -- a scrubbed review photo served by the API */}
          <img
            src={photo.url}
            alt={`${label} ${index + 1}`}
            className="border-border size-20 rounded-xl border object-cover"
          />
        </li>
      ))}
    </ul>
  );
}

/**
 * The review of a delivered order (D-135, loyalty P2 D-490): a star rating, an optional comment and up to four photos
 * of what arrived. The review is sent first (`store.reviews.submit`, published), then the photos
 * (`store.reviews.addPhotos`, CONTRACT-REQUEST) — so a review never waits on an upload, and photos can be added
 * later within the API's window. Reward figures are the API's `rewardPoints` (review + photo); none is shown at 0
 * (the D-476 cap may refuse it). Ratings say "ดาว", not points.
 */
export function OrderReview({ orderId, initial }: { orderId: string; initial: Review | null }) {
  const t = useTranslations("myOrders.review");
  const format = useFormat();
  const id = useId();
  const [review, setReview] = useState(initial);
  const [photosOnReview, setPhotosOnReview] = useState<ReviewPhoto[]>(() => (initial ? reviewPhotosOf(initial) : []));
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [picked, setPicked] = useState<PickedPhoto[]>([]);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const uploading = picked.some((photo) => !photo.fileId && !photo.failed);
  const fileIds = picked.flatMap((photo) => (photo.fileId ? [photo.fileId] : []));
  const room = REVIEW_PHOTO_MAX - photosOnReview.length;

  const photoFailure = (failure: unknown) => {
    const code = isApiError(failure) ? failure.code : "";
    return code === "reviews.photo_limit"
      ? t("errors.photoLimit", { max: REVIEW_PHOTO_MAX })
      : code === "reviews.photo_window_closed"
        ? t("errors.photoWindow")
        : t("errors.photos");
  };

  const sendPhotos = async (base: Review) => {
    const added = await browserRequests().call("POST /v1/store/orders/{orderId}/review/photos", {
      path: { orderId },
      body: { photoFileIds: fileIds },
    });
    setPhotosOnReview((current) => [...current, ...added.photos]);
    setReview({ ...base, rewardPoints: added.rewardPoints });
    setPicked([]);
  };

  const submit = async () => {
    setError(null);
    if (rating === 0) {
      setError(t("errors.rating"));
      document.getElementById(`${id}-star-1`)?.focus();
      return;
    }
    setBusy(true);
    let saved: Review | null = null;
    try {
      const { data } = await browserApi().POST("/v1/store/orders/{orderId}/review", {
        params: { path: { orderId } },
        body: { rating, comment: comment.trim() || null },
      });
      saved = data!;
      setReview(saved);
      if (fileIds.length) await sendPhotos(saved);
    } catch (failure) {
      const code = isApiError(failure) ? failure.code : "";
      // The review went in; only its photos did not — say so and keep them to retry.
      if (saved) {
        setAdding(true);
        setError(photoFailure(failure));
      } else
        setError(
          code === "reviews.exists"
            ? t("errors.exists")
            : code === "reviews.not_delivered"
              ? t("errors.notDelivered")
              : t("errors.failed"),
        );
    } finally {
      setBusy(false);
    }
  };

  const addPhotos = async () => {
    if (!review || !fileIds.length) return;
    setError(null);
    setBusy(true);
    try {
      await sendPhotos(review);
      setAdding(false);
    } catch (failure) {
      setError(photoFailure(failure));
    } finally {
      setBusy(false);
    }
  };

  const errorLine = error ? (
    <p role="alert" className="text-danger flex items-center gap-1.5 text-sm">
      <Icon name="error" size={14} aria-hidden="true" />
      {error}
    </p>
  ) : null;

  const picker = (max: number) => (
    <PhotoPicker
      id={`${id}-photos`}
      accept={REVIEW_PHOTO_ACCEPT}
      maxBytes={REVIEW_PHOTO_MAX_BYTES}
      max={max}
      purpose="image"
      photos={picked}
      onChange={setPicked}
    />
  );

  if (review) {
    return (
      <div className="flex flex-col gap-3.5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <ReviewStars rating={review.rating} label={t("starsLabel", { rating: review.rating })} />
          <Badge size="sm" tone={review.status === "published" ? "success" : "neutral"}>
            {t(`status.${review.status}`)}
          </Badge>
          <span className="text-muted text-[0.8125rem]">{t("sentOn", { date: format.date(review.createdAt) })}</span>
        </div>
        {review.comment ? <p className="text-[0.9375rem] leading-relaxed">{review.comment}</p> : null}
        <Photos photos={photosOnReview} label={t("photosLabel")} />

        {review.rewardPoints > 0 ? (
          <p className="bg-primary-subtle text-primary-subtle-fg flex items-center gap-2 rounded-xl px-3 py-2.5 text-[0.84375rem]">
            <Icon name="star" size={16} aria-hidden="true" />
            {t.rich("earned", {
              points: format.number(review.rewardPoints),
              b: (chunk) => <b className="font-semibold">{chunk}</b>,
            })}
          </p>
        ) : null}

        {review.reply ? (
          <div className="bg-bg-subtle rounded-xl px-3.5 py-3 text-[0.84375rem]">
            <p className="text-muted text-xs">{t("reply", { date: format.date(review.reply.repliedAt) })}</p>
            <p className="mt-1 leading-relaxed">{review.reply.body}</p>
          </div>
        ) : null}

        {room > 0 ? (
          adding ? (
            <div className="border-border flex flex-col gap-3 border-t pt-3.5">
              <p className="text-sm font-medium">{t("addTitle")}</p>
              {picker(room)}
              {errorLine}
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  loading={busy}
                  disabled={!fileIds.length || uploading}
                  onClick={() => void addPhotos()}
                >
                  {t("addSave", { count: fileIds.length })}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setAdding(false);
                    setPicked([]);
                    setError(null);
                  }}
                >
                  {t("cancel")}
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <Button size="sm" variant="secondary" iconStart="image" onClick={() => setAdding(true)}>
                {photosOnReview.length ? t("addMore") : t("addPhotos")}
              </Button>
              {photosOnReview.length === 0 ? <span className="text-muted text-xs">{t("photoBonus")}</span> : null}
            </div>
          )
        ) : null}
      </div>
    );
  }

  return (
    <form
      noValidate
      className="flex flex-col gap-5"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <p className="text-muted -mt-1 text-[0.84375rem]">{t("intro")}</p>

      <fieldset className="m-0 border-0 p-0">
        <legend id={`${id}-rating`} className="p-0 text-sm font-medium">
          {t("ratingLabel")}
        </legend>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
          <div role="radiogroup" aria-labelledby={`${id}-rating`} className="flex gap-1">
            {SCORES.map((score) => {
              const lit = score <= rating;
              return (
                <button
                  key={score}
                  id={`${id}-star-${score}`}
                  type="button"
                  role="radio"
                  aria-checked={score === rating}
                  aria-label={t("starsLabel", { rating: score })}
                  className={cn(
                    "rounded-control focus-visible:ring-focus-ring grid size-11 place-items-center outline-none focus-visible:ring-2",
                    lit ? "text-primary" : "text-border-strong hover:text-muted",
                  )}
                  onClick={() => {
                    setRating(score);
                    setError(null);
                  }}
                >
                  <Icon name="star" size={28} fill={lit ? "currentColor" : "none"} />
                </button>
              );
            })}
          </div>
          <span aria-live="polite" className="text-muted text-sm tabular-nums">
            {rating ? t(`ratingWords.${rating}`) : null}
          </span>
        </div>
      </fieldset>

      <Field label={t("commentLabel")} hint={t("commentHint", { max: COMMENT_MAX })}>
        <Textarea
          rows={3}
          maxLength={COMMENT_MAX}
          value={comment}
          onChange={(event) => setComment(event.target.value)}
        />
      </Field>

      <div className="flex flex-col gap-2">
        <p className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
          <span className="text-sm font-medium">{t("photosTitle")}</span>
          <span className="text-muted text-xs">{t("photoBonus")}</span>
        </p>
        {picker(REVIEW_PHOTO_MAX)}
      </div>

      {errorLine}

      <div className="border-border flex flex-wrap items-center justify-between gap-3 border-t pt-4">
        <p className="text-muted text-xs">{t("publicNote")}</p>
        <Button type="submit" loading={busy} disabled={uploading}>
          {uploading ? t("waitUpload") : t("submit")}
        </Button>
      </div>
    </form>
  );
}
