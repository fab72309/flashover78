import { escapeHtml } from '../_shared/html.ts'
import { sanitizePdf } from '../_shared/pdfSanitizer.ts'
import { renderMedicalFollowUpPdf } from '../_shared/medicalPdf.ts'
import { getConfiguredKey } from '../_shared/config.ts'
import { createClient } from 'npm:@supabase/supabase-js@2.110.8'
import {
  describeBrevoFailure,
  sanitizeEmailSubject,
  sendBrevoEmail,
} from '../_shared/brevo.ts'
import {
  corsHeadersForRequest,
  preflightResponse,
  rejectDisallowedOrigin,
} from '../_shared/cors.ts'

const DEFAULT_ADMIN_EMAILS = ['flashover78@gmail.com']
// The endpoint now receives only a submission id and a boolean. Keep a small
// envelope limit so callers cannot use it as an arbitrary body sink.
const MAX_REQUEST_BYTES = 64 * 1024
const EMAIL_PATTERN = /^[^\s@]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/

function baseJsonResponse(status: number, body: unknown, request?: Request) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeadersForRequest(request),
      'Content-Type': 'application/json',
    },
  })
}

function encodeBytesToBase64(bytes: Uint8Array) {
  let binary = ''
  const chunkSize = 0x8000
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize))
  }
  return btoa(binary)
}

async function updateEmailStatus(
  adminClient: ReturnType<typeof createClient>,
  submissionId: string,
  values: Record<string, unknown>,
) {
  const { error } = await adminClient
    .from('medical_follow_ups')
    .update({ ...values, updated_at: new Date().toISOString() })
    .eq('id', submissionId)

  return error
}

function normalizeEmailRecipients(value: unknown) {
  const candidates = Array.isArray(value) ? value : [value]
  return Array.from(new Set(
    candidates
      .flatMap((entry) => String(entry ?? '').split(/[\n,;]+/))
      .map((entry) => entry.trim().toLowerCase())
      .filter((entry) => EMAIL_PATTERN.test(entry)),
  ))
}

async function getConfiguredMedicalRecipients(adminClient: ReturnType<typeof createClient>) {
  const { data, error } = await adminClient
    .from('email_destinations')
    .select('recipients')
    .eq('form_key', 'suivi_medical')
    .maybeSingle()

  if (error || !data) {
    return DEFAULT_ADMIN_EMAILS
  }

  return normalizeEmailRecipients(data.recipients)
}

Deno.serve(async (request) => {
  const originRejection = rejectDisallowedOrigin(request)
  if (originRejection) return originRejection

  const jsonResponse = (status: number, body: unknown) => baseJsonResponse(status, body, request)

  if (request.method === 'OPTIONS') {
    return preflightResponse(request)
  }

  if (request.method !== 'POST') {
    return jsonResponse(405, { error: 'Méthode non autorisée.' })
  }

  const contentLength = Number(request.headers.get('content-length') ?? '0')
  if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BYTES) {
    return jsonResponse(413, { error: 'Requête trop volumineuse.' })
  }

  const authorization = request.headers.get('Authorization')
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const publishableKey = getConfiguredKey('SUPABASE_ANON_KEY', 'SUPABASE_PUBLISHABLE_KEYS')
  const secretKey = getConfiguredKey('SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SECRET_KEYS')

  if (!authorization || !supabaseUrl || !publishableKey || !secretKey) {
    return jsonResponse(500, { error: 'Configuration Supabase incomplète.' })
  }

  const userClient = createClient(supabaseUrl, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: authorization } },
  })
  const adminClient = createClient(supabaseUrl, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser()

  if (userError || !user) {
    return jsonResponse(401, { error: 'Session invalide.' })
  }

  // Do not spend CPU decoding or sanitizing a document for a JWT whose Auth
  // session has already been revoked. This is intentionally checked before
  // parsing the caller-controlled payload.
  const { data: activeSession, error: activeSessionError } = await userClient.rpc(
    'require_active_session',
  )
  if (activeSessionError || activeSession !== true) {
    return jsonResponse(401, { error: 'Session invalide ou révoquée.' })
  }

  let payload: Record<string, unknown>
  try {
    const body = await request.text()
    if (new TextEncoder().encode(body).byteLength > MAX_REQUEST_BYTES) {
      return jsonResponse(413, { error: 'Requête trop volumineuse.' })
    }
    payload = JSON.parse(body)
  } catch {
    return jsonResponse(400, { error: 'Requête invalide.' })
  }

  const submissionId = String(payload.submissionId ?? '').trim()
  const isEvolution = payload.isEvolution === true
  if (!/^[0-9a-f-]{36}$/i.test(submissionId)) {
    return jsonResponse(400, { error: 'La fiche à envoyer est invalide.' })
  }

  const { data: submission, error: submissionError } = await userClient
    .from('medical_follow_ups')
    .select(`
      id, user_id, trainer_level, nom_formateur, prenom_formateur, email_formateur,
      date_formation, journee, conditions_meteo, temperature,
      hydratation_avant_bruleage, hydratation_apres_bruleage,
      lieu_formation, lieu_formation_autre, formation, formation_autre,
      role_formateur, role_formateur_autre, type_bruleage, type_bruleage_autre,
      temps_ari, decontamination_post_bruleage, douche_dans_heure,
      observations_post_bruleage, observations_post_bruleage_autre, observations,
      email_status
    `)
    .eq('id', submissionId)
    .maybeSingle()

  if (submissionError) {
    return jsonResponse(500, { error: 'Impossible de vérifier le suivi médical.' })
  }

  if (!submission || submission.user_id !== user.id) {
    return jsonResponse(404, { error: 'Suivi médical introuvable.' })
  }

  if (submission.email_status === 'sent') {
    return jsonResponse(200, { status: 'sent', alreadySent: true })
  }

  let sanitizedBytes: Uint8Array
  try {
    // The attachment is generated from the row read through the caller's RLS
    // context. No caller-supplied PDF bytes or filename are trusted anymore.
    const generatedBytes = await renderMedicalFollowUpPdf(submission, isEvolution)
    const sanitized = await sanitizePdf(generatedBytes)
    if (!sanitized) {
      return jsonResponse(422, { error: 'Le PDF médical ne peut pas être transmis de manière sûre.' })
    }
    sanitizedBytes = sanitized
  } catch {
    return jsonResponse(422, { error: 'Le PDF médical ne peut pas être généré de manière sûre.' })
  }

  const filename = `suivi-medical-${submission.date_formation}${isEvolution ? '-evolution' : ''}.pdf`

  const recipientEmail = user.email?.trim().toLowerCase()
  if (!recipientEmail) {
    return jsonResponse(400, { error: 'Adresse email utilisateur introuvable.' })
  }

  const { data: claimed, error: claimError } = await userClient.rpc(
    'claim_form_email_delivery',
    {
      p_form_key: 'suivi_medical',
      p_submission_id: submissionId,
      p_allow_resend: false,
    },
  )
  if (claimError) {
    const rateLimited = /rate limit/i.test(claimError.message ?? '')
    return jsonResponse(rateLimited ? 429 : 500, {
      error: rateLimited
        ? 'La limite horaire d’envoi est atteinte.'
        : 'Impossible de réserver cet envoi.',
    })
  }
  if (claimed !== true) {
    return jsonResponse(409, {
      error: 'Cet envoi est déjà en cours ou sa limite de tentatives est atteinte.',
    })
  }

  const configuredRecipients = await getConfiguredMedicalRecipients(adminClient)
  const recipients = Array.from(new Set([recipientEmail, ...configuredRecipients]))
  const displayName = `${submission.nom_formateur} ${submission.prenom_formateur}`.trim()
  const subject = sanitizeEmailSubject(`${isEvolution ? 'Evolution Suivi médical' : 'Suivi médical formateur'} - ${displayName} - ${submission.date_formation}`)
  const text = [
    'Bonjour,',
    '',
    `Veuillez trouver en pièce jointe ${isEvolution ? 'la fiche d’évolution du suivi médical' : 'la fiche de suivi médical formateur'}.`,
    `Formateur : ${displayName}`,
    `Fonction : ${submission.trainer_level}`,
    `Date : ${submission.date_formation}`,
    '',
    'Message envoyé automatiquement par Flashover 78.',
  ].join('\n')
  const html = `
    <p>Bonjour,</p>
    <p>Veuillez trouver en pièce jointe ${isEvolution ? 'la fiche d’évolution du suivi médical' : 'la fiche de suivi médical formateur'}.</p>
    <p><strong>Formateur :</strong> ${escapeHtml(displayName)}<br />
    <strong>Fonction :</strong> ${escapeHtml(submission.trainer_level)}<br />
    <strong>Date :</strong> ${escapeHtml(submission.date_formation)}</p>
    <p>Message envoyé automatiquement par Flashover 78.</p>
  `

  const delivery = await sendBrevoEmail({
    to: recipients,
    subject,
    textContent: text,
    htmlContent: html,
    replyTo: recipientEmail,
    attachment: {
      content: encodeBytesToBase64(sanitizedBytes),
      name: filename,
    },
  })

  if (delivery.status !== 'sent') {
    const deliveryError = describeBrevoFailure(delivery)
    const updateError = await updateEmailStatus(adminClient, submissionId, {
      email_status: 'failed',
      email_error: deliveryError,
    })
    if (updateError) return jsonResponse(500, { error: 'Impossible de mettre à jour le suivi.' })
    return jsonResponse(delivery.status === 'not_configured' ? 503 : 502, {
      status: 'failed',
      error: deliveryError,
    })
  }

  const providerId = delivery.providerId
  const updateError = await updateEmailStatus(adminClient, submissionId, {
    email_status: 'sent',
    email_sent_at: new Date().toISOString(),
    email_provider_id: providerId,
    email_error: null,
  })
  if (updateError) return jsonResponse(500, { error: 'Email envoyé, mais le statut n’a pas pu être enregistré.' })

  return jsonResponse(200, { status: 'sent', providerId })
})
