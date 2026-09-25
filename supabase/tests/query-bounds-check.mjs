import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const migration = await readFile(
  new URL('../migrations/20260919190000_query_response_bounds.sql', import.meta.url),
  'utf8',
);
const service = await readFile(
  new URL('../../src/services/supabaseService.ts', import.meta.url),
  'utf8',
);
const carpoolService = await readFile(
  new URL('../../src/services/carpoolMobilityService.ts', import.meta.url),
  'utf8',
);

test('collection RPCs have explicit defensive limits and retain active-session guards', () => {
  assert.match(migration, /public\.search_documents[\s\S]*?limit 200;/i);
  assert.match(migration, /public\.list_document_versions[\s\S]*?limit 200;/i);
  assert.match(migration, /public\.get_training_session_summaries[\s\S]*?limit 1000;/i);
  assert.match(migration, /public\.get_training_session_participants[\s\S]*?limit 500;/i);
  assert.equal(
    (migration.match(/not private\.has_active_session\(\)/g) ?? []).length,
    4,
  );
});

test('direct collection reads use bounded pages with stable ordering', () => {
  assert.match(service, /fetchAllPages<MedicalFollowUpRow>/);
  assert.match(service, /fetchAllPages<MainCouranteRow>/);
  assert.match(service, /fetchAllPages<EquipmentRepairRequestRow>/);
  assert.match(service, /fetchAllPages<EventRow>/);
  assert.match(service, /fetchAllPages<CarpoolTripRow>/);
  assert.match(service, /fetchAllPages<CarpoolRequestRow>/);
  assert.match(service, /\.range\(from, to\)/);
  assert.match(carpoolService, /fetchAllPages<CarpoolPostRow>/);
  assert.match(carpoolService, /fetchAllPages<CarpoolMatchRow>/);
});
