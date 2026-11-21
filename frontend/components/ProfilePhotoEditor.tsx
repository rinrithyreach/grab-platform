"use client";

import { useEffect, useRef, useState } from "react";
import type { User } from "@/lib/api";
import { errorMessage, useAuth } from "@/lib/auth";
import { useT } from "@/lib/i18n";
import { toast } from "@/lib/toast";
import Icon from "./Icon";

const TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 512 * 1024;
export const PROFILE_PHOTO_INPUT_ID = "profile-photo-file";

export default function ProfilePhotoEditor({ user }: { user: User }) {
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

  return <div className="w-full border-t border-border pt-4" aria-busy={busy}>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><p className="text-sm font-semibold">{t("profile.photo")}</p><p id="profile-photo-hint" className="mt-1 text-xs text-muted">{t("profile.photoHint")}</p></div>
      <div className="flex flex-wrap items-center gap-3">
        <input ref={input} id={PROFILE_PHOTO_INPUT_ID} type="file" className="sr-only" accept={TYPES.join(",")} aria-label={t("profile.changePhoto")} aria-describedby={error ? "profile-photo-hint profile-photo-error" : "profile-photo-hint"} disabled={busy} onChange={choose} />
        <button type="button" className="btn-outline h-10 text-xs" disabled={busy} onClick={() => input.current?.click()}><Icon name="camera" className="h-4 w-4" />{t("profile.changePhoto")}</button>
        {user.avatarUrl && !file && <button type="button" className="min-h-10 text-xs font-semibold text-muted hover:text-red-600" disabled={busy} onClick={() => void save(true)}>{t("profile.removePhoto")}</button>}
      </div>
    </div>
    {file && <div className="mt-4 flex flex-wrap items-center gap-4 rounded-2xl bg-brand-soft p-3">
      {/* Local blob previews and private data URLs are intentionally rendered without an image proxy. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={preview} alt={t("profile.photoPreview")} className="h-20 w-20 shrink-0 rounded-full object-cover ring-4 ring-surface" />
      <div className="flex flex-wrap gap-2"><button type="button" className="btn-primary h-10" disabled={busy} onClick={() => void save()}>{t(busy ? "profile.saving" : "profile.save")}</button><button type="button" className="btn-outline h-10" disabled={busy} onClick={() => { reset(); setError(""); }}>{t("common.cancel")}</button></div>
    </div>}
    {busy && !file && <p role="status" className="mt-2 text-sm text-muted">{t("profile.saving")}</p>}
    {error && <p id="profile-photo-error" role="alert" className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}
  </div>;
}
