import { describe, expect, it } from 'vitest';
import {
  cancelTrainingRegistration,
  listTrainingSessionSummaries,
  registerForTraining,
} from './supabaseService';

describe('training registration preview flow', () => {
  it('libère une place puis permet de se réinscrire', async () => {
    const eventId = 'preview-event-1';
    const initialSummary = (await listTrainingSessionSummaries(eventId))[0];

    expect(initialSummary.myStatus).toBe('registered');
    expect(initialSummary.registeredCount).toBe(1);

    await cancelTrainingRegistration(eventId);
    const cancelledSummary = (await listTrainingSessionSummaries(eventId))[0];

    expect(cancelledSummary.myStatus).toBeNull();
    expect(cancelledSummary.registeredCount).toBe(0);

    const registration = await registerForTraining(eventId);
    const registeredSummary = (await listTrainingSessionSummaries(eventId))[0];

    expect(registration.status).toBe('registered');
    expect(registeredSummary.myStatus).toBe('registered');
    expect(registeredSummary.registeredCount).toBe(1);
  });
});
