import { decodeBase64Document, isLikelyPdf } from '../_shared/pdf.ts'
import { sanitizePdf } from '../_shared/pdfSanitizer.ts'
import { getConfiguredKey } from '../_shared/config.ts'
import { createClient } from 'npm:@supabase/supabase-js@2.110.8'
import {
  corsHeadersForRequest,
  preflightResponse,
  rejectDisallowedOrigin,
} from '../_shared/cors.ts'

const MAX_PDF_BYTES = 5 * 1024 * 1024
const MAX_DOCUMENT_BASE64_LENGTH = 7_000_000
const MAX_REQUEST_BYTES = 7_100_000
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const FORM_CONFIG = {
  main_courante: 'main-courantes',
  demande_reparation: 'equipment-repair-requests',
} as const

type FormKey = keyof typeof FORM_CONFIG

function baseJsonResponse(status: number, body: unknown, request?: Request) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeadersForRequest(request),
      'Cache-Control': 'no-store',
      'Content-Type': 'application/json',
    },
  })
}

function normalizeFilename(value: unknown) {
  const candidate = String(value ?? '').trim()
  if (!candidate || candidate.length > 180 || !/^[A-Za-z0-9._-]+\.pdf$/.test(candidate)) {
    return null
  }
  return candidate
}

function isBase64(value: string) {
  return value.length > 0
    && value.length <= MAX_DOCUMENT_BASE64_LENGTH
    && value.length % 4 === 0
    && /^[A-Za-z0-9+/]+={0,2}$/.test(value)
}

function isFormKey(value: unknown): value is FormKey {
  return value === 'main_courante' || value === 'demande_reparation'
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
  const supabaseUrl = Deno.env.get('SUPABASE_URL')?.trim() ?? ''
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
    const parsed: unknown = JSON.parse(body)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return jsonResponse(400, { error: 'Requête invalide.' })
    }
    payload = parsed as Record<string, unknown>
  } catch {
    return jsonResponse(400, { error: 'Requête invalide.' })
  }

  const formKey = payload.formKey
  const submissionId = String(payload.submissionId ?? '').trim()
  const filename = normalizeFilename(payload.filename)
  const documentBase64 = String(payload.documentBase64 ?? '').trim()
  if (!isFormKey(formKey) || !UUID_PATTERN.test(submissionId) || !filename || !isBase64(documentBase64)) {
    return jsonResponse(400, { error: 'Le PDF à enregistrer est invalide.' })
  }

  const documentBytes = decodeBase64Document(documentBase64)
  if (!documentBytes || documentBytes.byteLength < 1 || documentBytes.byteLength > MAX_PDF_BYTES || !isLikelyPdf(documentBytes)) {
    return jsonResponse(422, { error: 'Le contenu PDF est invalide ou dangereux.' })
  }

  const sanitizedBytes = await sanitizePdf(documentBytes)
  if (!sanitizedBytes) {
    return jsonResponse(422, { error: 'Le PDF ne peut pas être finalisé de manière sûre.' })
  }

  const bucketId = FORM_CONFIG[formKey]
  const storagePath = `${user.id}/${submissionId}/${filename}`
  const document = new Blob([sanitizedBytes], { type: 'application/pdf' })
  const { error: uploadError } = await adminClient.storage
    .from(bucketId)
    .upload(storagePath, document, {
      cacheControl: 'no-store',
      contentType: 'application/pdf',
      upsert: false,
    })

  if (uploadError) {
    return jsonResponse(409, { error: 'Impossible de réserver ce PDF.' })
  }

  const { data: approved, error: approvalError } = await adminClient.rpc(
    'register_form_pdf_approval',
    {
      p_bucket_id: bucketId,
      p_storage_path: storagePath,
      p_user_id: user.id,
      p_file_size: sanitizedBytes.byteLength,
    },
  )

  if (approvalError || approved !== true) {
    const { error: cleanupError } = await adminClient.storage
      .from(bucketId)
      .remove([storagePath])
    if (cleanupError) {
      const { error: queueError } = await adminClient.rpc(
        'enqueue_storage_cleanup_service_role',
        {
          p_bucket_id: bucketId,
          p_storage_path: storagePath,
          p_requested_by: user.id,
        },
      )
      if (queueError) console.error('Form PDF cleanup after approval failure failed')
    }
    return jsonResponse(503, { error: 'Le PDF n’a pas pu être finalisé.' })
  }

  return jsonResponse(200, {
    bucketId,
    storagePath,
    filename,
    fileSize: sanitizedBytes.byteLength,
  })
})
