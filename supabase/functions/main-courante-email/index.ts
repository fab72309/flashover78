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
const MAIN_COURANTE_BUCKET = 'main-courantes'
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
  formKey: string,
  fallback: string[] = [],
) {
  const { data, error } = await adminClient
    .from('email_destinations')
    .select('recipients')
    .eq('form_key', formKey)
    .maybeSingle()

  if (error || !data) return fallback
  return normalizeEmailRecipients(data.recipients)
}

function normalizeFilename(value: unknown) {
  const candidate = String(value ?? '').trim()
  if (!candidate || candidate.length > 180 || !/^[a-zA-Z0-9._-]+\.pdf$/.test(candidate)) {
    return 'main-courante.pdf'
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
    .from('main_courantes')
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

  if (updateError) return baseJsonResponse(500, { error: 'Impossible de mettre à jour la main courante.' }, request)
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
    return jsonResponse(400, { error: 'La main courante à envoyer est invalide.' })
  }

  const { data: submission, error: submissionError } = await userClient
    .from('main_courantes')
    .select('id, user_id, pdf_storage_path, pdf_filename, email_formateur, date_main_courante, site_formation, type_session, formation, formateur_1, formateur_2, formateur_3, formateur_4, formateur_5, reparations_materiel, email_status')
    .eq('id', submissionId)
    .maybeSingle()

  if (submissionError) {
    return jsonResponse(500, { error: 'Impossible de vérifier la main courante.' })
  }

  if (!submission || submission.user_id !== user.id) {
    return jsonResponse(404, { error: 'Main courante introuvable.' })
  }

  if (submission.email_status === 'sent' && !forceResend) {
    return jsonResponse(200, { status: 'sent', alreadySent: true })
  }


  const { data: claimed, error: claimError } = await userClient.rpc(
    'claim_form_email_delivery',
    {
      p_form_key: 'main_courante',
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

  const configuredRecipients = await getConfiguredRecipients(
    adminClient,
    'main_courante',
    DEFAULT_ADMIN_EMAILS,
  )
  const mainRecipients = configuredRecipients.length > 0
    ? configuredRecipients
    : DEFAULT_ADMIN_EMAILS
  const repairRecipients = submission.reparations_materiel?.trim()
    ? await getConfiguredRecipients(adminClient, 'demande_reparation')
    : []
  const recipients = Array.from(new Set([...mainRecipients, ...repairRecipients]))

  const { data: document, error: documentError } = await adminClient.storage
    .from(MAIN_COURANTE_BUCKET)
    .download(submission.pdf_storage_path)

  if (documentError || !document) {
    return failureResponse(
      adminClient,
      submissionId,
      'Le PDF de la main courante est indisponible.',
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
      'Le PDF de la main courante ne peut pas être transmis de manière sûre.',
      422,
    )
  }

  const documentBase64 = encodeBytesToBase64(sanitizedBytes)
  if (documentBase64.length > MAX_DOCUMENT_BASE64_LENGTH) {
    return failureResponse(
      adminClient,
      submissionId,
      'Le PDF de la main courante est trop volumineux pour un envoi email.',
      413,
    )
  }

  const formateurs = [
    submission.formateur_1,
    submission.formateur_2,
    submission.formateur_3,
    submission.formateur_4,
    submission.formateur_5,
  ].filter((value): value is string => Boolean(value?.trim()))
  const displayFormateurs = formateurs.length > 0 ? formateurs.join(', ') : 'Aucun formateur renseigné'
  const repairDescription = submission.reparations_materiel?.trim() ?? ''
  const subject = sanitizeEmailSubject(
    `Main courante - ${submission.site_formation} - ${submission.date_main_courante}`,
  )
  const textContent = [
    'Bonjour,',
    '',
    'Veuillez trouver en pièce jointe la main courante de la session de brûlage.',
    `Site : ${submission.site_formation}`,
    `Date : ${submission.date_main_courante}`,
    submission.type_session ? `Type de session : ${submission.type_session}` : '',
    submission.formation ? `Formation : ${submission.formation}` : '',
    `Formateurs : ${displayFormateurs}`,
    repairDescription ? `Demande de réparation : ${repairDescription}` : '',
    '',
    'Message envoyé automatiquement par Flashover 78.',
  ].filter(Boolean).join('\n')
  const htmlContent = `
    <p>Bonjour,</p>
    <p>Veuillez trouver en pièce jointe la main courante de la session de brûlage.</p>
    <p><strong>Site :</strong> ${escapeHtml(submission.site_formation)}<br />
    <strong>Date :</strong> ${escapeHtml(submission.date_main_courante)}<br />
    ${submission.type_session ? `<strong>Type de session :</strong> ${escapeHtml(submission.type_session)}<br />` : ''}
    ${submission.formation ? `<strong>Formation :</strong> ${escapeHtml(submission.formation)}<br />` : ''}
    <strong>Formateurs :</strong> ${escapeHtml(displayFormateurs)}</p>
    ${repairDescription ? `<p><strong>Demande de réparation :</strong><br />${escapeHtml(repairDescription).replace(/\n/g, '<br />')}</p>` : ''}
    <p>Message envoyé automatiquement par Flashover 78.</p>
  `

  const delivery = await sendBrevoEmail({
    to: recipients,
    subject,
    textContent,
    htmlContent,
    replyTo: submission.email_formateur?.trim().toLowerCase(),
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
