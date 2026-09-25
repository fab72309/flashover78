const DEFAULT_ALLOWED_ORIGINS = [
  'https://app.flashover78.com',
  'http://localhost:5173',
  'http://localhost:4173',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:4173',
]

function allowedOrigins() {
  const configured = (Deno.env.get('APP_ALLOWED_ORIGINS') ?? '')
    .split(',')
    .map((origin) => origin.trim().replace(/\/$/, ''))
    .filter(Boolean)
  return new Set([...DEFAULT_ALLOWED_ORIGINS, ...configured])
}

export function isAllowedOrigin(origin: string | null) {
  return !origin || allowedOrigins().has(origin.replace(/\/$/, ''))
}

export function corsHeadersForRequest(request?: Request): HeadersInit {
  const origin = request?.headers.get('Origin') ?? null
  const headers: Record<string, string> = {
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  }

  if (origin && isAllowedOrigin(origin)) {
    headers['Access-Control-Allow-Origin'] = origin
  }

  return headers
}

export function rejectDisallowedOrigin(request: Request) {
  const origin = request.headers.get('Origin')
  if (isAllowedOrigin(origin)) return null

  return new Response(JSON.stringify({ error: 'Origine non autorisée.' }), {
    status: 403,
    headers: {
      ...corsHeadersForRequest(),
      'Content-Type': 'application/json',
    },
  })
}

export function preflightResponse(request: Request) {
  const rejection = rejectDisallowedOrigin(request)
  if (rejection) return rejection
  return new Response(null, { status: 204, headers: corsHeadersForRequest(request) })
}
