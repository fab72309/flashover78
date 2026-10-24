import { createClient } from 'npm:@supabase/supabase-js@2.110.8'

const MAX_BATCH_SIZE = 100
const MAX_BODY_BYTES = 4096

type CleanupTarget = {
  id: string
  bucket_id: string
  storage_path: string
  should_delete: boolean
}

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'Content-Type': 'application/json',
    },
  })
}

function constantTimeEqual(left: string, right: string) {
  const encoder = new TextEncoder()
  const leftBytes = encoder.encode(left)
  const rightBytes = encoder.encode(right)
  let difference = leftBytes.length ^ rightBytes.length
  const length = Math.max(leftBytes.length, rightBytes.length)

  for (let index = 0; index < length; index += 1) {
    difference |= (leftBytes[index] ?? 0) ^ (rightBytes[index] ?? 0)
  }

  return difference === 0
}

function getWorkerToken(request: Request) {
  const explicitToken = request.headers.get('x-storage-cleanup-token')?.trim()
  if (explicitToken) return explicitToken

  const authorization = request.headers.get('Authorization')?.trim() ?? ''
  return authorization.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length).trim()
    : ''
}

async function parseBatchSize(request: Request) {
  const contentLength = Number(request.headers.get('content-length') ?? '0')
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) return null

  const body = await request.text()
  if (new TextEncoder().encode(body).byteLength > MAX_BODY_BYTES) return null
  if (!body.trim()) return 50

  try {
    const parsed = JSON.parse(body) as { limit?: unknown }
    const requested = Number(parsed.limit ?? 50)
    if (!Number.isInteger(requested) || requested < 1) return 50
    return Math.min(requested, MAX_BATCH_SIZE)
  } catch {
    return 50
  }
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') {
    return jsonResponse(405, { error: 'Méthode non autorisée.' })
  }

  // This endpoint is for a scheduler/operations worker, never for a browser.
  if (request.headers.has('Origin')) {
    return jsonResponse(403, { error: 'Origine non autorisée.' })
  }

  const workerSecret = Deno.env.get('STORAGE_CLEANUP_WORKER_SECRET')?.trim() ?? ''
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim() ?? ''
  const presentedToken = getWorkerToken(request)
  const hasWorkerSecret = workerSecret.length > 0
    && constantTimeEqual(presentedToken, workerSecret)
  // A scheduler may send the service-role JWT in Authorization so that the
  // Supabase gateway's native JWT verification can remain enabled. This is
  // accepted only server-side; the key is never returned or accepted from a
  // browser-originated request.
  const hasServiceRoleBearer = request.headers.has('Authorization')
    && serviceRoleKey.length > 0
    && constantTimeEqual(presentedToken, serviceRoleKey)
  if (!hasWorkerSecret && !hasServiceRoleBearer) {
    return jsonResponse(401, { error: 'Authentification du worker requise.' })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')?.trim() ?? ''
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse(503, { error: 'Configuration du worker indisponible.' })
  }

  const limit = await parseBatchSize(request)
  if (limit === null) {
    return jsonResponse(413, { error: 'Requête trop volumineuse.' })
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: claimed, error: claimError } = await adminClient.rpc(
    'claim_storage_cleanup_batch',
    { p_limit: limit },
  )

  if (claimError) {
    console.error('Storage cleanup claim failed')
    return jsonResponse(503, { error: 'Impossible de réserver la file de nettoyage.' })
  }

  const targets = Array.isArray(claimed) ? claimed as CleanupTarget[] : []
  let deleted = 0
  let skippedReferenced = 0
  let failed = 0

  for (const target of targets) {
    let succeeded = false
    let errorMessage = ''

    try {
      const { data: referenced, error: referenceError } = await adminClient.rpc(
        'storage_cleanup_is_referenced',
        {
          p_bucket_id: target.bucket_id,
          p_storage_path: target.storage_path,
        },
      )

      if (referenceError) {
        throw new Error('reference_check_failed')
      }

      if (referenced === true) {
        skippedReferenced += 1
        succeeded = true
      } else if (target.should_delete) {
        const { error: removeError } = await adminClient.storage
          .from(target.bucket_id)
          .remove([target.storage_path])

        if (removeError) throw new Error('storage_remove_failed')
        deleted += 1
        succeeded = true
      } else {
        // The object was referenced when it was claimed, but that reference
        // disappeared before processing. Keep it queued and require a fresh
        // claim instead of deleting on a stale decision.
        throw new Error('reference_state_changed')
      }
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : 'cleanup_failed'
      failed += 1
    }

    const { data: completed, error: completionError } = await adminClient.rpc(
      'complete_storage_cleanup',
      {
        p_id: target.id,
        p_succeeded: succeeded,
        p_error: succeeded ? null : errorMessage,
      },
    )

    if (completionError || completed !== true) {
      failed += 1
      console.error('Storage cleanup completion failed')
    }
  }

  return jsonResponse(200, {
    claimed: targets.length,
    deleted,
    skippedReferenced,
    failed,
  })
})
