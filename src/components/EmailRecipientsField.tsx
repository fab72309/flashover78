import { useEffect, useState, type KeyboardEvent } from 'react';
import { Mail, Plus, X } from 'lucide-react';
import {
  isValidEmailRecipient,
  mergeEmailRecipients,
  parseEmailRecipients,
} from '../utils/emailDestinations';

interface EmailRecipientsFieldProps {
  label: string;
  description: string;
  recipients: readonly string[];
  required?: boolean;
  disabled?: boolean;
  onChange: (recipients: string[]) => void;
  onRemoveRequest: (recipient: string) => void;
}

export default function EmailRecipientsField({
  label,
  description,
  recipients,
  required = false,
  disabled = false,
  onChange,
  onRemoveRequest,
}: EmailRecipientsFieldProps) {
  const [draft, setDraft] = useState('');
  const [selectedRecipient, setSelectedRecipient] = useState<string | null>(null);
  const [inputError, setInputError] = useState<string | null>(null);

  useEffect(() => {
    if (selectedRecipient && !recipients.includes(selectedRecipient)) {
      setSelectedRecipient(null);
    }
  }, [recipients, selectedRecipient]);

  const addDraftRecipients = () => {
    const candidates = parseEmailRecipients(draft);
    if (candidates.length === 0) {
      setInputError(null);
      return;
    }

    const invalidRecipient = candidates.find((recipient) => !isValidEmailRecipient(recipient));
    if (invalidRecipient) {
      setInputError(`L’adresse « ${invalidRecipient} » n’est pas valide.`);
      return;
    }

    const nextRecipients = mergeEmailRecipients(recipients, candidates);
    if (nextRecipients.length > 20) {
      setInputError('Une liste ne peut pas dépasser 20 adresses.');
      return;
    }

    onChange(nextRecipients);
    setDraft('');
    setInputError(null);
    setSelectedRecipient(null);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' || event.key === ',' || event.key === ';') {
      event.preventDefault();
      addDraftRecipients();
    }
  };

  return (
    <fieldset disabled={disabled} className="min-w-0">
      <legend className="mb-2 block text-label-lg font-semibold text-on-surface">
        {label}
        {required ? <span className="ml-1 text-primary" aria-hidden="true">*</span> : null}
      </legend>

      <div className="rounded-lg border border-outline-variant bg-surface-container-low p-3 transition-colors focus-within:border-primary/60 focus-within:bg-surface-container">
        <div className="flex min-w-0 flex-wrap gap-2" role="list" aria-label={`Destinataires ${label.toLowerCase()}`}>
          {recipients.map((recipient) => {
            const selected = selectedRecipient === recipient;
            return (
              <div
                key={recipient}
                role="listitem"
                className={[
                  'inline-flex max-w-full items-center rounded-full border text-label-sm transition-colors',
                  selected
                    ? 'border-primary/50 bg-primary/10 text-primary'
                    : 'border-outline-variant bg-surface-container-lowest text-on-surface',
                ].join(' ')}
              >
                <button
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setSelectedRecipient(selected ? null : recipient)}
                  className="inline-flex min-h-9 min-w-0 max-w-full items-center gap-1.5 rounded-full px-3 py-1.5 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  title={selected ? 'Adresse sélectionnée' : 'Sélectionner cette adresse'}
                >
                  <Mail size={14} className="shrink-0" aria-hidden="true" />
                  <span className="min-w-0 break-all">{recipient}</span>
                </button>
                {selected ? (
                  <button
                    type="button"
                    onClick={() => onRemoveRequest(recipient)}
                    className="mr-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-primary transition hover:bg-primary/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    aria-label={`Supprimer l’adresse ${recipient}`}
                    title="Supprimer cette adresse"
                  >
                    <X size={15} aria-hidden="true" />
                  </button>
                ) : null}
              </div>
            );
          })}

          {recipients.length === 0 ? (
            <p className="py-1 text-label-sm text-on-surface-variant">Aucune adresse supplémentaire.</p>
          ) : null}
        </div>

        <div className="mt-3 flex items-center gap-2 border-t border-outline-variant/70 pt-3">
          <input
            type="text"
            value={draft}
            onChange={(event) => {
              setDraft(event.target.value);
              if (inputError) setInputError(null);
            }}
            onKeyDown={handleKeyDown}
            onBlur={addDraftRecipients}
            className="min-w-0 flex-1 bg-transparent px-1 py-2 text-body-md text-on-surface outline-none placeholder:text-on-surface-variant"
            placeholder="Ajouter une adresse"
            inputMode="email"
            aria-label={`Ajouter une adresse pour ${label.toLowerCase()}`}
            aria-required={required}
            aria-invalid={inputError ? 'true' : 'false'}
          />
          <button
            type="button"
            onClick={addDraftRecipients}
            className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-lg bg-surface-container-highest px-3 text-label-lg font-semibold text-on-surface transition hover:bg-surface-container disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!draft.trim()}
          >
            <Plus size={16} aria-hidden="true" />
            Ajouter
          </button>
        </div>
      </div>

      <p className="mt-2 text-label-sm text-on-surface-variant">{description}</p>
      {selectedRecipient ? (
        <p className="mt-1 text-label-sm text-primary" aria-live="polite">
          Adresse sélectionnée : la croix permet de demander sa suppression.
        </p>
      ) : null}
      {inputError ? (
        <p className="mt-1 text-label-sm text-red-700" role="alert">
          {inputError}
        </p>
      ) : null}
    </fieldset>
  );
}
