"use client";

/**
 * Shows the questions asked with confirmDialog() (lib/dialog.ts).
 * Uses the browser's <dialog> element, which handles Escape, focus trapping and the dim backdrop.
 */
import { useEffect, useRef } from "react";
import { settleConfirm, useConfirmQueue } from "@/lib/dialog";
import { useT } from "@/lib/i18n";
import Icon from "./Icon";

export default function ConfirmDialog() {
  const { t } = useT();
  const current = useConfirmQueue();
  const ref = useRef<HTMLDialogElement>(null);
  const confirmButton = useRef<HTMLButtonElement>(null);
  const cancelButton = useRef<HTMLButtonElement>(null);
  const id = current?.id;

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (id !== undefined && !d.open) d.showModal?.();
    if (id === undefined && d.open) d.close();
    // Destructive actions start on the safe choice; everything else on the confirm button.
    if (id !== undefined) (current?.tone === "danger" ? cancelButton : confirmButton).current?.focus();
  }, [id, current?.tone]);

  const answer = (ok: boolean) => { if (id !== undefined) settleConfirm(id, ok); };
  const danger = current?.tone === "danger";

  return (
    <dialog
      ref={ref}
      onCancel={(e) => { e.preventDefault(); answer(false); }}
      onClick={(e) => { if (e.target === ref.current) answer(false); }}
      aria-labelledby="confirm-dialog-title"
      aria-describedby={current?.message ? "confirm-dialog-message" : undefined}
      className="item-dialog confirm-dialog"
    >
      {current && (
        <div className="confirm-dialog-body">
          <span className={`confirm-dialog-icon ${danger ? "is-danger" : ""}`} aria-hidden><Icon name={danger ? "warning" : "info"} /></span>
          <h2 id="confirm-dialog-title">{current.title}</h2>
          {current.message && <p id="confirm-dialog-message">{current.message}</p>}
          <div className="confirm-dialog-actions">
            <button ref={cancelButton} type="button" className="btn-outline" onClick={() => answer(false)}>{current.cancelLabel ?? t("common.cancel")}</button>
            <button ref={confirmButton} type="button" className={danger ? "btn-primary confirm-danger" : "btn-primary"} onClick={() => answer(true)}>{current.confirmLabel ?? t("dialog.confirm")}</button>
          </div>
        </div>
      )}
    </dialog>
  );
}
