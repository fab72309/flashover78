import { escapeHtml } from '../_shared/html.ts'
import { isLikelyPdf } from '../_shared/pdf.ts'
import { sanitizePdf } from '../_shared/pdfSanitizer.ts'
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
const EQUIPMENT_REPAIR_BUCKET = 'equipment-repair-requests'
const MAX_DOCUMENT_BASE64_LENGTH = 8_000_000
const MAX_REQUEST_BYTES = 16_384
const EMAIL_PATTERN = /^[^\s@]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function baseJsonResponse(status: number, body: unknown, request?: Request) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeadersForRequest(request),
      'Content-Type': 'application/json',
    },
  })
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

async function getConfiguredRecipients(
  adminClient: ReturnType<typeof createClient>,
) {
  const { data, error } = await adminClient
    .from('email_destinations')
    .select('recipients')
    .eq('form_key', 'demande_reparation')
    .maybeSingle()

  if (error || !data) return DEFAULT_ADMIN_EMAILS
  const recipients = normalizeEmailRecipients(data.recipients)
  return recipients.length > 0 ? recipients : DEFAULT_ADMIN_EMAILS
}

function normalizeFilename(value: unknown) {
  const candidate = String(value ?? '').trim()
  if (!candidate || candidate.length > 180 || !/^[a-zA-Z0-9._-]+\.pdf$/.test(candidate)) {
    return 'demande-reparation.pdf'
  }
  return candidate
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
    .from('equipment_repair_requests')
    .update({ ...values, updated_at: new Date().toISOString() })
    .eq('id', submissionId)

  return error
}

async function baseFailureResponse(
  adminClient: ReturnType<typeof createClient>,
  submissionId: string,
  message: string,
  status: number,
  request?: Request,
) {
  const updateError = await updateEmailStatus(adminClient, submissionId, {
    email_status: 'failed',
    email_error: message,
  })

  if (updateError) return baseJsonResponse(500, { error: 'Impossible de mettre à jour la demande de réparation.' }, request)
  return baseJsonResponse(status, { status: 'failed', error: message }, request)
}

function getEmailStatusResponseCode(status: 'not_configured' | 'unavailable' | 'rejected') {
  return status === 'not_configured' ? 503 : 502
}

Deno.serve(async (request) => {
  const originRejection = rejectDisallowedOrigin(request)
  if (originRejection) return originRejection

  const jsonResponse = (status: number, body: unknown) => baseJsonResponse(status, body, request)
  const failureResponse = (
    adminClient: ReturnType<typeof createClient>,
    submissionId: string,
    message: string,
    status: number,
  ) => baseFailureResponse(adminClient, submissionId, message, status, request)

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
  const forceResend = payload.forceResend === true

  if (!UUID_PATTERN.test(submissionId)) {
    return jsonResponse(400, { error: 'La demande de réparation à envoyer est invalide.' })
  }

  const { data: submission, error: submissionError } = await userClient
    .from('equipment_repair_requests')
    .select('id, user_id, pdf_storage_path, pdf_filename, lieu_formation, lieu_formation_autre, date_demande, email_demandeur, demande_concerne, equipement, equipement_autre, numero_inventaire, probleme, nom_demandeur, email_status')
    .eq('id', submissionId)
    .maybeSingle()

  if (submissionError) {
    return jsonResponse(500, { error: 'Impossible de vérifier la demande de réparation.' })
  }

  if (!submission || submission.user_id !== user.id) {
    return jsonResponse(404, { error: 'Demande de réparation introuvable.' })
  }

  if (submission.email_status === 'sent' && !forceResend) {
    return jsonResponse(200, { status: 'sent', alreadySent: true })
  }


  const { data: claimed, error: claimError } = await userClient.rpc(
    'claim_form_email_delivery',
    {
      p_form_key: 'demande_reparation',
      p_submission_id: submissionId,
      p_allow_resend: forceResend,
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
      error: 'Cet envoi est déjà en cours, trop récent ou sa limite de tentatives est atteinte.',
    })
  }

  const recipients = await getConfiguredRecipients(adminClient)
  const { data: document, error: documentError } = await adminClient.storage
    .from(EQUIPMENT_REPAIR_BUCKET)
    .download(submission.pdf_storage_path)

  if (documentError || !document) {
    return failureResponse(
      adminClient,
      submissionId,
      'Le PDF de la demande de réparation est indisponible.',
      502,
    )
  }

  const documentBytes = new Uint8Array(await document.arrayBuffer())
  if (!isLikelyPdf(documentBytes)) {
    return failureResponse(
      adminClient,
      submissionId,
      'Le fichier joint ne présente pas une structure PDF valide.',
      422,
    )
  }

  const sanitizedBytes = await sanitizePdf(documentBytes)
  if (!sanitizedBytes) {
    return failureResponse(
      adminClient,
      submissionId,
      'Le PDF de la demande de réparation ne peut pas être transmis de manière sûre.',
      422,
    )
  }

  const documentBase64 = encodeBytesToBase64(sanitizedBytes)
  if (documentBase64.length > MAX_DOCUMENT_BASE64_LENGTH) {
    return failureResponse(
      adminClient,
      submissionId,
      'Le PDF de la demande de réparation est trop volumineux pour un envoi email.',
      413,
    )
  }

  const location = submission.lieu_formation === 'Autre :' && submission.lieu_formation_autre?.trim()
    ? `Autre : ${submission.lieu_formation_autre.trim()}`
    : submission.lieu_formation || 'Non renseigné'
  const equipment = submission.equipement === 'Autre :' && submission.equipement_autre?.trim()
    ? `Autre : ${submission.equipement_autre.trim()}`
    : submission.equipement || 'Non renseigné'
  const date = submission.date_demande || 'Non renseignée'
  const inventory = submission.numero_inventaire?.trim() || 'Non renseigné'
  const subject = sanitizeEmailSubject(
    `Demande de réparation - ${submission.demande_concerne} - ${equipment}`,
  )
  const textContent = [
    'Bonjour,',
    '',
    'Veuillez trouver en pièce jointe une demande de réparation d’équipement.',
    `Lieu de formation : ${location}`,
    `Date : ${date}`,
    `Adresse mail du demandeur : ${submission.email_demandeur}`,
    `La demande concerne : ${submission.demande_concerne}`,
    `Matériel concerné : ${equipment}`,
    `Numéro d’inventaire : ${inventory}`,
    `Nom du demandeur : ${submission.nom_demandeur}`,
    `Problème rencontré : ${submission.probleme}`,
    '',
    'Message envoyé automatiquement par Flashover 78.',
  ].join('\n')
  const htmlContent = `
    <p>Bonjour,</p>
    <p>Veuillez trouver en pièce jointe une demande de réparation d’équipement.</p>
    <p><strong>Lieu de formation :</strong> ${escapeHtml(location)}<br />
    <strong>Date :</strong> ${escapeHtml(date)}<br />
    <strong>Adresse mail du demandeur :</strong> ${escapeHtml(submission.email_demandeur)}<br />
    <strong>La demande concerne :</strong> ${escapeHtml(submission.demande_concerne)}<br />
    <strong>Matériel concerné :</strong> ${escapeHtml(equipment)}<br />
    <strong>Numéro d’inventaire :</strong> ${escapeHtml(inventory)}<br />
    <strong>Nom du demandeur :</strong> ${escapeHtml(submission.nom_demandeur)}</p>
    <p><strong>Problème rencontré :</strong><br />${escapeHtml(submission.probleme).replace(/\n/g, '<br />')}</p>
    <p>Message envoyé automatiquement par Flashover 78.</p>
  `

  const delivery = await sendBrevoEmail({
    to: recipients,
    subject,
    textContent,
    htmlContent,
    replyTo: submission.email_demandeur?.trim().toLowerCase(),
    attachment: {
      content: documentBase64,
      name: normalizeFilename(submission.pdf_filename),
    },
  })

  if (delivery.status !== 'sent') {
    return failureResponse(
      adminClient,
      submissionId,
      describeBrevoFailure(delivery),
      getEmailStatusResponseCode(delivery.status),
    )
  }

  const updateError = await updateEmailStatus(adminClient, submissionId, {
    email_status: 'sent',
    email_sent_at: new Date().toISOString(),
    email_provider_id: delivery.providerId,
    email_error: null,
  })
  if (updateError) {
    return jsonResponse(500, { error: 'Email envoyé, mais le statut n’a pas pu être enregistré.' })
  }

  return jsonResponse(200, { status: 'sent', providerId: delivery.providerId })
})
