import { describe, expect, it } from 'vitest';
import {
  createDefaultFormEmailDestinations,
  mergeEmailRecipients,
  normalizeEmailRecipients,
  toMailtoRecipientList,
  validateFormEmailDestinations,
} from './emailDestinations';

describe('destinataires email des formulaires', () => {
  it('ne publie aucun destinataire opérationnel dans le fallback navigateur', () => {
    expect(createDefaultFormEmailDestinations()).toEqual({
      mainCourante: [],
      suiviMedical: [],
      demandeReparation: [],
    });
  });

  it('normalise les listes saisies et supprime les doublons', () => {
    expect(normalizeEmailRecipients('  A@EXAMPLE.FR, b@example.fr\nA@example.fr; ')).toEqual([
      'a@example.fr',
      'b@example.fr',
    ]);
  });

  it('conserve une liste médicale vide mais exige les deux listes principales', () => {
    const validDestinations = {
      mainCourante: ['main@example.fr'],
      suiviMedical: [],
      demandeReparation: ['repair@example.fr'],
    };

    expect(validateFormEmailDestinations(validDestinations)).toBeNull();
    expect(validateFormEmailDestinations({ ...validDestinations, mainCourante: [] })).toContain(
      'main courante',
    );
    expect(validateFormEmailDestinations({ ...validDestinations, demandeReparation: [] })).toContain(
      'demande de réparation',
    );
  });

  it('inclut toujours l’utilisateur connecté dans le suivi médical', () => {
    expect(mergeEmailRecipients(['formateur@example.fr'], ['admin@example.fr', 'formateur@example.fr'])).toEqual([
      'formateur@example.fr',
      'admin@example.fr',
    ]);
  });

  it('refuse les adresses invalides', () => {
    expect(validateFormEmailDestinations({
      mainCourante: ['main@example.fr'],
      suiviMedical: ['adresse-invalide'],
      demandeReparation: ['repair@example.fr'],
    })).toContain('adresse-invalide');
  });

  it('encode et exclut les adresses invalides dans une URI mailto', () => {
    expect(toMailtoRecipientList(['person+tag@example.fr', 'evil@example.fr?bcc=leak@example.net'])).toBe(
      'person%2Btag%40example.fr',
    );
  });
});
