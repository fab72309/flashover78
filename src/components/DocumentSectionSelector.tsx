import { Check } from 'lucide-react';
import type { BrulageDocumentSectionId } from '../types';
import { BRULAGE_DOCUMENT_SECTIONS } from '../utils/brulageDocuments';

interface DocumentSectionSelectorProps {
  value: BrulageDocumentSectionId;
  onChange: (value: BrulageDocumentSectionId) => void;
  name?: string;
}

export default function DocumentSectionSelector({
  value,
  onChange,
  name = 'document-section',
}: DocumentSectionSelectorProps) {
  return (
    <fieldset className="rounded-lg border border-outline-variant p-4">
      <legend className="px-1 text-label-lg font-semibold text-on-surface">
        Classement dans le brûlage
      </legend>
      <p className="mt-1 text-label-sm text-on-surface-variant">
        Choisissez une seule catégorie pour retrouver le document au bon endroit.
      </p>
      <div className="mt-3 grid gap-2 md:grid-cols-3">
        {BRULAGE_DOCUMENT_SECTIONS.map((section) => {
          const checked = section.id === value;

          return (
            <label
              key={section.id}
              className="flex cursor-pointer items-start gap-3 rounded-lg bg-surface-container-high px-3 py-3 transition-colors hover:bg-surface-container-highest"
            >
              <input
                type="radio"
                name={name}
                value={section.id}
                checked={checked}
                onChange={() => onChange(section.id)}
                className="peer sr-only"
              />
              <span
                aria-hidden="true"
                className={[
                  'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-colors',
                  checked
                    ? 'border-primary bg-primary text-white'
                    : 'border-outline text-transparent',
                ].join(' ')}
              >
                <Check size={14} strokeWidth={3} />
              </span>
              <span className="min-w-0">
                <span className="block text-body-md font-semibold text-on-surface">
                  {section.label}
                </span>
                <span className="mt-0.5 block text-label-sm text-on-surface-variant">
                  {section.description}
                </span>
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
