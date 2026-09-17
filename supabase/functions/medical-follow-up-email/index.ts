import { escapeHtml } from '../_shared/html.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
import {
  describeBrevoFailure,
  sanitizeEmailSubject,
  sendBrevoEmail,
} from '../_shared/brevo.ts'

const DEFAULT_ADMIN_EMAILS = ['flashover78@gmail.com']
const MAX_DOCUMENT_BASE64_LENGTH = 8_000_000
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  })
}

function getConfiguredKey(legacyName: string, namedKeysName: string) {
  const legacyKey = Deno.env.get(legacyName)?.trim()
  if (legacyKey) return legacyKey

  const namedKeys = Deno.env.get(namedKeysName)
  if (!namedKeys) return ''

  try {
    const parsed = JSON.parse(namedKeys) as Record<string, unknown>
    const defaultKey = typeof parsed.default === 'string' ? parsed.default : ''
    if (defaultKey) return defaultKey
    const firstKey = Object.values(parsed).find((value): value is string => typeof value === 'string')
    return firstKey ?? ''
  } catch {
    return ''
  }
}


function normalizeFilename(value: unknown) {
  const candidate = String(value ?? '').trim()
  if (!candidate || candidate.length > 180 || !/^[a-zA-Z0-9._-]+\.pdf$/.test(candidate)) {
    return 'suivi-medical-formateur.pdf'
  }
  return candidate
}

function isBase64(value: string) {
  return value.length > 0
    && value.length <= MAX_DOCUMENT_BASE64_LENGTH
    && /^[A-Za-z0-9+/]+={0,2}$/.test(value)
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
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
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

  let payload: Record<string, unknown>
  try {
    payload = await request.json()
  } catch {
    return jsonResponse(400, { error: 'Requête invalide.' })
  }

  const submissionId = String(payload.submissionId ?? '').trim()
  const documentBase64 = String(payload.documentBase64 ?? '').trim()
  const filename = normalizeFilename(payload.filename)
  const isEvolution = payload.isEvolution === true

  if (!submissionId || !isBase64(documentBase64)) {
    return jsonResponse(400, { error: 'La fiche à envoyer est invalide.' })
  }

  const { data: submission, error: submissionError } = await userClient
    .from('medical_follow_ups')
    .select('id, user_id, trainer_level, nom_formateur, prenom_formateur, date_formation, email_status')
    .eq('id', submissionId)
    .maybeSingle()

  if (submissionError) {
    return jsonResponse(500, { error: submissionError.message })
  }

  if (!submission || submission.user_id !== user.id) {
    return jsonResponse(404, { error: 'Suivi médical introuvable.' })
  }

  if (submission.email_status === 'sent') {
    return jsonResponse(200, { status: 'sent', alreadySent: true })
  }

  const recipientEmail = user.email?.trim().toLowerCase()
  if (!recipientEmail) {
    return jsonResponse(400, { error: 'Adresse email utilisateur introuvable.' })
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
      content: documentBase64,
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
