export const FORM_EMAIL_DESTINATION_DB_KEYS = {
  mainCourante: 'main_courante',
  suiviMedical: 'suivi_medical',
  demandeReparation: 'demande_reparation',
} as const;

export type FormEmailDestinationKey = keyof typeof FORM_EMAIL_DESTINATION_DB_KEYS;

export interface FormEmailDestinations {
  mainCourante: string[];
  suiviMedical: string[];
  demandeReparation: string[];
}

export const DEFAULT_FORM_EMAIL_DESTINATIONS: Readonly<Record<FormEmailDestinationKey, readonly string[]>> = {
  mainCourante: ['flashover78@gmail.com'],
  suiviMedical: ['flashover78@gmail.com'],
  demandeReparation: ['flashover78@gmail.com'],
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmailRecipient(value: string) {
  return EMAIL_PATTERN.test(value);
}

export function createDefaultFormEmailDestinations(): FormEmailDestinations {
  return {
    mainCourante: [...DEFAULT_FORM_EMAIL_DESTINATIONS.mainCourante],
    suiviMedical: [...DEFAULT_FORM_EMAIL_DESTINATIONS.suiviMedical],
    demandeReparation: [...DEFAULT_FORM_EMAIL_DESTINATIONS.demandeReparation],
  };
}

export function normalizeEmailRecipients(value: unknown): string[] {
  const candidates = Array.isArray(value) ? value : [value];
  return Array.from(new Set(
    candidates
      .flatMap((entry) => String(entry ?? '').split(/[\n,;]+/))
      .map((entry) => entry.trim().toLowerCase())
      .filter(Boolean),
  ));
}

export function parseEmailRecipients(value: string) {
  return normalizeEmailRecipients(value);
}

export function validateFormEmailDestinations(destinations: FormEmailDestinations): string | null {
  const requiredKeys: FormEmailDestinationKey[] = ['mainCourante', 'demandeReparation'];
  const labels: Record<FormEmailDestinationKey, string> = {
    mainCourante: 'main courante',
    suiviMedical: 'suivi médical',
    demandeReparation: 'demande de réparation',
  };

  for (const key of Object.keys(labels) as FormEmailDestinationKey[]) {
    const recipients = normalizeEmailRecipients(destinations[key]);
    if (requiredKeys.includes(key) && recipients.length === 0) {
      return `Renseignez au moins une adresse pour la ${labels[key]}.`;
    }

    const invalidRecipient = recipients.find((recipient) => !isValidEmailRecipient(recipient));
    if (invalidRecipient) {
      return `L’adresse « ${invalidRecipient} » n’est pas valide pour la ${labels[key]}.`;
    }

    if (recipients.length > 20) {
      return `La liste de la ${labels[key]} ne peut pas dépasser 20 adresses.`;
    }
  }

  return null;
}

export function mergeEmailRecipients(...recipientLists: Array<readonly string[]>) {
  return normalizeEmailRecipients(recipientLists.flat());
}

export function formatEmailRecipients(recipients: readonly string[]) {
  return recipients.length > 0 ? recipients.join(', ') : 'aucun destinataire supplémentaire';
}
