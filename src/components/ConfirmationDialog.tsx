import { AlertTriangle, X } from 'lucide-react';

interface ConfirmationDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}
export default function ConfirmationDialog({
  open,
  title,
  description,
  confirmLabel,
  busy = false,
  onCancel,
  onConfirm,
}: ConfirmationDialogProps) {
  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[120] flex items-end justify-center bg-black/45 p-3 sm:items-center"
      role="presentation"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target && !busy) {
          onCancel();
        }
      }}
    >
      <section
        className="w-full max-w-md rounded-lg border border-outline-variant bg-surface-container-lowest p-5 shadow-ambient-lg"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirmation-title"
        aria-describedby="confirmation-description"
      >
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-red-100 text-red-700">
            <AlertTriangle size={21} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="confirmation-title" className="text-headline-md text-on-surface">
              {title}
            </h2>
            <p
              id="confirmation-description"
              className="mt-2 text-body-md text-on-surface-variant"
            >
              {description}
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container disabled:opacity-50"
            aria-label="Fermer"
          >
            <X size={19} />
          </button>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="min-h-11 rounded-lg bg-surface-container px-4 font-semibold text-on-surface hover:bg-surface-container-high disabled:opacity-50"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="min-h-11 rounded-lg bg-red-600 px-4 font-semibold text-white hover:bg-red-700 disabled:opacity-50"
          >
            {busy ? 'Traitement...' : confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}
