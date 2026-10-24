import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runInNewContext } from 'node:vm';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { PDFDocument } from 'pdf-lib';

const require = createRequire(import.meta.url);
const bundle = await build({
  entryPoints: [new URL('../functions/medical-follow-up-email/index.ts', import.meta.url).pathname],
  bundle: true,
  write: false,
  format: 'iife',
  platform: 'node',
  mainFields: ['module', 'main'],
  plugins: [{
    name: 'mock-transport',
    setup(builder) {
      builder.onResolve({ filter: /^npm:@supabase\// }, () => ({ path: 'client', namespace: 'test' }));
      builder.onResolve({ filter: /^npm:pdf-lib@/ }, () => ({ path: require.resolve('pdf-lib') }));
      builder.onLoad({ filter: /.*/, namespace: 'test' }, () => ({
        contents: 'export const createClient = globalThis.testCreateClient;',
      }));
    },
  }],
});

const USER_ID = '11111111-1111-4111-8111-111111111111';
const SUBMISSION_ID = '22222222-2222-4222-8222-222222222222';
const submission = {
  id: SUBMISSION_ID,
  user_id: USER_ID,
  trainer_level: 'RSFR',
  nom_formateur: 'Durand',
  prenom_formateur: 'Élodie',
  email_formateur: 'elodie.durand@example.test',
  date_formation: '2026-09-19',
  journee: 'Journée complète',
  conditions_meteo: 'Ensoleillé',
  temperature: '22',
  hydratation_avant_bruleage: 'Oui',
  hydratation_apres_bruleage: 'Oui',
  lieu_formation: 'MLB TdL / FO',
  lieu_formation_autre: null,
  formation: 'Formation initiale',
  formation_autre: null,
  role_formateur: 'Responsable',
  role_formateur_autre: null,
  type_bruleage: 'Feux réels',
  type_bruleage_autre: '2',
  temps_ari: '30 minutes',
  decontamination_post_bruleage: 'Oui',
  douche_dans_heure: 'Oui',
  observations_post_bruleage: ['Aucune gêne'],
  observations_post_bruleage_autre: null,
  observations: 'Observation synthétique de test.',
  email_status: 'pending',
};

function fixture() {
  let handler;
  const calls = [];
  let brevoRequest;
  const userClient = {
    auth: {
      getUser: async () => ({ data: { user: { id: USER_ID, email: 'user@example.test' } }, error: null }),
    },
    rpc: async (name) => {
      calls.push(['rpc', name]);
      if (name === 'require_active_session') return { data: true, error: null };
      if (name === 'claim_form_email_delivery') return { data: true, error: null };
      throw new Error(`Unexpected user RPC ${name}`);
    },
    from: (table) => {
      assert.equal(table, 'medical_follow_ups');
      return {
        select: () => ({
          eq: () => ({ maybeSingle: async () => ({ data: submission, error: null }) }),
        }),
      };
    },
  };
  const adminClient = {
    from: (table) => {
      if (table === 'email_destinations') {
        return {
          select: () => ({
            eq: () => ({ maybeSingle: async () => ({ data: { recipients: ['operations@example.test'] }, error: null }) }),
          }),
        };
      }
      assert.equal(table, 'medical_follow_ups');
      return {
        update: () => ({ eq: async () => ({ error: null }) }),
      };
    },
  };
  const clientFactory = (_url, _key, options = {}) => (
    options.global?.headers?.Authorization ? userClient : adminClient
  );

  runInNewContext(bundle.outputFiles[0].text, {
    Request,
    Response,
    Blob,
    TextEncoder,
    TextDecoder,
    Uint8Array,
    URL,
    atob,
    btoa,
    console,
    fetch: async (_url, options) => {
      brevoRequest = JSON.parse(options.body);
      return new Response(JSON.stringify({ messageId: '<synthetic-message@example.test>' }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      });
    },
    Deno: {
      env: {
        get: (name) => ({
          SUPABASE_URL: 'https://synthetic.supabase.invalid',
          SUPABASE_ANON_KEY: 'synthetic-anon',
          SUPABASE_SERVICE_ROLE_KEY: 'synthetic-service-role',
          BREVO_API_KEY: 'synthetic-brevo',
          BREVO_FROM_EMAIL: 'no-reply@example.test',
          BREVO_SENDER_NAME: 'Flashover78',
        }[name] ?? ''),
      },
      serve: (callback) => { handler = callback; },
    },
    testCreateClient: clientFactory,
  });

  return {
    calls,
    getBrevoRequest: () => brevoRequest,
    request: (body) => handler(new Request('https://worker.invalid/medical-follow-up-email', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer synthetic-user-token',
        Origin: 'http://localhost:5173',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })),
  };
}

test('medical email generates the attachment from the owner row, not caller PDF bytes', async () => {
  const f = fixture();
  const response = await f.request({
    submissionId: SUBMISSION_ID,
    isEvolution: false,
    documentBase64: 'Zm9yZ2Vk',
    filename: '../../attacker.pdf',
  });

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: 'sent', providerId: '<synthetic-message@example.test>' });
  assert.deepEqual(f.calls, [
    ['rpc', 'require_active_session'],
    ['rpc', 'claim_form_email_delivery'],
  ]);

  const request = f.getBrevoRequest();
  assert.equal(request.attachment.length, 1);
  assert.equal(request.attachment[0].name, 'suivi-medical-2026-09-19.pdf');
  assert.notEqual(request.attachment[0].content, 'Zm9yZ2Vk');
  const bytes = Uint8Array.from(Buffer.from(request.attachment[0].content, 'base64'));
  const generated = await PDFDocument.load(bytes);
  assert.ok(generated.getPages().length >= 1);
});
