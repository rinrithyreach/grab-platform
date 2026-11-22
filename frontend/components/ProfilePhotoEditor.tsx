"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { User } from "@/lib/api";
import { errorMessage, useAuth } from "@/lib/auth";
import { useT } from "@/lib/i18n";
import { toast } from "@/lib/toast";
import Icon from "./Icon";

const TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 512 * 1024;
export const PROFILE_PHOTO_INPUT_ID = "profile-photo-file";

/**
 * The profile picture is the editor: tap it to pick a photo, see it in the circle,
 * then Save or Cancel. `children` (name, phone) sits beside the picture.
 */
export default function ProfilePhotoEditor({ user, children }: { user: User; children?: ReactNode }) {
  const { api } = useAuth();
  const { t } = useT();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  function reset() {
    setFile(null); setPreview("");
    if (input.current) input.current.value = "";
  }

  function choose(event: React.ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0];
    if (!selected) return;
    setError("");
    if (!TYPES.includes(selected.type) || selected.size < 12) { reset(); setError(t("profile.photoInvalid")); return; }
    if (selected.size > MAX_BYTES) { reset(); setError(t("profile.photoTooLarge")); return; }
    setFile(selected); setPreview(URL.createObjectURL(selected));
  }

  async function save(remove = false) {
    if (busy || (!remove && !file)) return;
    setBusy(true); setError("");
    try {
      await api.saveProfilePhoto(remove ? null : file);
      reset();
      toast(t(remove ? "profile.photoRemoved" : "profile.photoSaved"));
    } catch (err) { setError(errorMessage(err, t)); }
    finally { setBusy(false); }
  }

  const pickFile = () => input.current?.click();
  const src = preview || user.avatarUrl;

  return <div className="min-w-0 flex-1" aria-busy={busy}>
    <input ref={input} id={PROFILE_PHOTO_INPUT_ID} type="file" className="sr-only" accept={TYPES.join(",")} aria-label={t("profile.changePhoto")} aria-describedby={error ? "profile-photo-error" : undefined} disabled={busy} onChange={choose} />
    <div className="flex items-center gap-4">
      <button type="button" onClick={pickFile} disabled={busy} aria-label={t("profile.changePhoto")} title={t("profile.changePhoto")} className="group relative shrink-0 rounded-full focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand disabled:opacity-70">
        <span className={`relative grid h-20 w-20 place-items-center overflow-hidden rounded-full bg-brand text-3xl font-bold text-white ring-4 dark:text-background ${file ? "ring-brand" : "ring-brand-soft"}`}>
          {/* Local blob previews and private data URLs are intentionally rendered without an image proxy. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {src ? <img src={src} alt={preview ? t("profile.photoPreview") : ""} className="h-full w-full object-cover" /> : <span aria-hidden>{user.fullName[0]?.toUpperCase() ?? "👤"}</span>}
          {/* Hover hint on desktop */}
          <span aria-hidden className="absolute inset-0 grid place-items-center bg-black/45 text-white opacity-0 transition-opacity group-hover:opacity-100"><Icon name="camera" className="h-6 w-6" /></span>
        </span>
        {/* Always-visible camera badge, so phone users know the photo can be tapped */}
        <span aria-hidden className="absolute -bottom-1 -right-1 grid h-8 w-8 place-items-center rounded-full border-[3px] border-surface bg-brand text-white shadow-sm transition-transform group-hover:scale-110 group-active:scale-95 dark:text-background"><Icon name="camera" className="h-3.5 w-3.5" /></span>
      </button>

      <div className="min-w-0 flex-1">
        {children}
        {!file && user.avatarUrl && <button type="button" className="mt-1 min-h-8 text-sm font-semibold text-muted hover:text-red-600 disabled:opacity-50" disabled={busy} onClick={() => void save(true)}>{t("profile.removePhoto")}</button>}
      </div>
    </div>

    {/* After picking: the new photo is already shown in the circle; confirm or undo. */}
    {file && <div className="mt-4 flex gap-2">
      <button type="button" className="btn-primary h-11 flex-1 sm:flex-none sm:px-6" disabled={busy} onClick={() => void save()}>{t(busy ? "profile.saving" : "profile.save")}</button>
      <button type="button" className="btn-outline h-11 flex-1 sm:flex-none sm:px-6" disabled={busy} onClick={() => { reset(); setError(""); }}>{t("common.cancel")}</button>
    </div>}
    {busy && !file && <p role="status" className="mt-2 text-sm text-muted">{t("profile.saving")}</p>}
    {error && <p id="profile-photo-error" role="alert" className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}
  </div>;
}
