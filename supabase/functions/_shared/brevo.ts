const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MAX_ATTACHMENT_BASE64_LENGTH = 8_000_000

export type BrevoEmailInput = {
  to: readonly string[]
  subject: string
  textContent: string
  htmlContent: string
  replyTo?: string
  attachment?: {
    content: string
    name: string
  }
}

export type BrevoDeliveryResult =
  | { status: 'sent'; providerId: string | null }
  | { status: 'not_configured' }
  | { status: 'unavailable' }
  | { status: 'rejected'; httpStatus: number }

export function sanitizeEmailSubject(value: string) {
  return value.replace(/[\r\n]+/g, ' ').trim().slice(0, 255)
}

function isBase64(value: string) {
  return value.length > 0
    && value.length <= MAX_ATTACHMENT_BASE64_LENGTH
    && /^[A-Za-z0-9+/]+={0,2}$/.test(value)
}

export async function sendBrevoEmail(input: BrevoEmailInput): Promise<BrevoDeliveryResult> {
  const apiKey = Deno.env.get('BREVO_API_KEY')?.trim()
  const fromEmail = Deno.env.get('BREVO_FROM_EMAIL')?.trim().toLowerCase()
  const senderName = Deno.env.get('BREVO_SENDER_NAME')?.trim() || 'Flashover78'

  if (!apiKey || !fromEmail || !EMAIL_PATTERN.test(fromEmail)) {
    return { status: 'not_configured' }
  }

  if (input.to.length === 0 || input.to.some((email) => !EMAIL_PATTERN.test(email))) {
    return { status: 'rejected', httpStatus: 400 }
  }

  if (input.attachment && !isBase64(input.attachment.content)) {
    return { status: 'rejected', httpStatus: 413 }
  }

  const body: Record<string, unknown> = {
    sender: {
      email: fromEmail,
      name: senderName,
    },
    to: input.to.map((email) => ({ email })),
    subject: sanitizeEmailSubject(input.subject),
    textContent: input.textContent,
    htmlContent: input.htmlContent,
  }

  if (input.replyTo && EMAIL_PATTERN.test(input.replyTo)) {
    body.replyTo = { email: input.replyTo }
  }

  if (input.attachment) {
    body.attachment = [{
      content: input.attachment.content,
      name: input.attachment.name,
    }]
  }

  let response: Response
  try {
    response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })
  } catch {
    return { status: 'unavailable' }
  }

  if (!response.ok) {
    return { status: 'rejected', httpStatus: response.status }
  }

  let providerId: string | null = null
  try {
    const responseBody = await response.json() as { messageId?: unknown }
    providerId = typeof responseBody.messageId === 'string' ? responseBody.messageId : null
  } catch {
    providerId = null
  }

  return { status: 'sent', providerId }
}

export function describeBrevoFailure(result: Exclude<BrevoDeliveryResult, { status: 'sent' }>) {
  if (result.status === 'not_configured') return 'Service d’envoi email non configuré.'
  if (result.status === 'unavailable') return 'Le fournisseur email est indisponible.'
  return `Le fournisseur email a refusé l’envoi (${result.httpStatus}).`
}
