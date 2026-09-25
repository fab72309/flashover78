import { decodeBase64Document } from '../_shared/pdf.ts'
import { corsHeadersForRequest, preflightResponse, rejectDisallowedOrigin } from '../_shared/cors.ts'
import { getConfiguredKey } from '../_shared/config.ts'
import {
  expectedDocumentMimeType,
  hasExpectedDocumentSignature,
  isUploadableDocumentExtension,
} from '../_shared/documentSignature.ts'
import { sanitizePdf } from '../_shared/pdfSanitizer.ts'
import { createClient } from 'npm:@supabase/supabase-js@2.110.8'

const MAX_DOCUMENT_BYTES = 20 * 1024 * 1024
const MAX_DOCUMENT_BASE64_LENGTH = 28_000_000
const MAX_REQUEST_BYTES = 28_100_000
const BUCKETS = new Set([
  'sdis78-documents',
  'lectures-documents',
  'brulage-documents',
  'resources',
])
const EXTENSION_PATTERN = /\.([A-Za-z0-9]+)$/

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

function isBase64(value: string) {
  return value.length > 0
    && value.length <= MAX_DOCUMENT_BASE64_LENGTH
    && value.length % 4 === 0
    && /^[A-Za-z0-9+/]+={0,2}$/.test(value)
}

function getExtension(storagePath: string) {
  return storagePath.match(EXTENSION_PATTERN)?.[1]?.toLowerCase() ?? ''
}

function isAllowedStoragePath(storagePath: unknown, userId: string, extension: string) {
  if (typeof storagePath !== 'string') return false
  if (storagePath.length < 1 || storagePath.length > 500) return false
  if (storagePath.includes('..') || storagePath.startsWith('/') || storagePath.includes('\\')) return false
  if (!storagePath.startsWith(`${userId}/`)) return false
  if (!/^[A-Za-z0-9._/-]+$/.test(storagePath)) return false
  return getExtension(storagePath) === extension
}

Deno.serve(async (request) => {
  const originRejection = rejectDisallowedOrigin(request)
  if (originRejection) return originRejection

  const jsonResponse = (status: number, body: unknown) => baseJsonResponse(status, body, request)

  if (request.method === 'OPTIONS') return preflightResponse(request)
  if (request.method !== 'POST') return jsonResponse(405, { error: 'Méthode non autorisée.' })

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
  if (userError || !user) return jsonResponse(401, { error: 'Session invalide.' })

  const { data: contributorSession, error: contributorError } = await userClient.rpc(
    'require_contributor_session',
  )
  if (contributorError || contributorSession !== true) {
    return jsonResponse(403, { error: 'Droits insuffisants.' })
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

  const bucketId = String(payload.bucketId ?? '')
  const storagePath = String(payload.storagePath ?? '')
  const documentBase64 = String(payload.documentBase64 ?? '').trim()
  const extension = getExtension(storagePath)
  const mimeType = expectedDocumentMimeType(extension)
  if (
    !BUCKETS.has(bucketId)
    || !mimeType
    || !isUploadableDocumentExtension(extension)
    || !isAllowedStoragePath(storagePath, user.id, extension)
  ) {
    return jsonResponse(400, { error: 'Le document à enregistrer est invalide.' })
  }
  if (!isBase64(documentBase64)) {
    return jsonResponse(400, { error: 'Le contenu du document est invalide.' })
  }

  const documentBytes = decodeBase64Document(documentBase64)
  if (
    !documentBytes
    || documentBytes.byteLength < 1
    || documentBytes.byteLength > MAX_DOCUMENT_BYTES
    || !hasExpectedDocumentSignature(documentBytes, extension)
  ) {
    return jsonResponse(422, { error: 'Le contenu ne correspond pas au type déclaré.' })
  }

  let finalizedBytes = documentBytes
  if (extension === 'pdf') {
    const sanitized = await sanitizePdf(documentBytes, MAX_DOCUMENT_BYTES)
    if (!sanitized) {
      return jsonResponse(422, { error: 'Le PDF ne peut pas être finalisé de manière sûre.' })
    }
    finalizedBytes = sanitized
  }

  const { error: uploadError } = await adminClient.storage
    .from(bucketId)
    .upload(storagePath, new Blob([finalizedBytes], { type: mimeType }), {
      cacheControl: 'no-store',
      contentType: mimeType,
      upsert: false,
    })

  if (uploadError) return jsonResponse(409, { error: 'Impossible de réserver ce document.' })

  const { data: approved, error: approvalError } = await adminClient.rpc(
    'register_document_upload_approval',
    {
      p_bucket_id: bucketId,
      p_storage_path: storagePath,
      p_user_id: user.id,
      p_file_size: finalizedBytes.byteLength,
      p_mime_type: mimeType,
    },
  )

  if (approvalError || approved !== true) {
    const { error: cleanupError } = await adminClient.storage.from(bucketId).remove([storagePath])
    if (cleanupError) {
      const { error: queueError } = await adminClient.rpc(
        'enqueue_storage_cleanup_service_role',
        {
          p_bucket_id: bucketId,
          p_storage_path: storagePath,
          p_requested_by: user.id,
        },
      )
      if (queueError) console.error('Document cleanup after approval failure failed')
    }
    return jsonResponse(503, { error: 'Le document n’a pas pu être finalisé.' })
  }

  return jsonResponse(200, {
    bucketId,
    storagePath,
    fileSize: finalizedBytes.byteLength,
    mimeType,
  })
})
