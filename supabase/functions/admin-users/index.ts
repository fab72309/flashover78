import { createClient } from 'npm:@supabase/supabase-js@2.110.8'
import {
  corsHeadersForRequest,
  preflightResponse,
  rejectDisallowedOrigin,
} from '../_shared/cors.ts'

function baseJsonResponse(status: number, body: unknown, request?: Request) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeadersForRequest(request),
      'Content-Type': 'application/json',
    },
  })
}

function baseInternalErrorResponse(message = 'Opération impossible.', request?: Request) {
  return baseJsonResponse(500, { error: message }, request)
}

function auditPendingResponse(request?: Request) {
  return baseJsonResponse(503, {
    error: 'Opération effectuée, mais sa journalisation doit être réconciliée.',
    code: 'audit_pending',
    operationCompleted: true,
  }, request)
}

const allowedRoles = new Set(['member', 'contributor', 'admin'])
const allowedTrainerLevels = ['RSFR', 'FOR INC', 'FOR BAT'] as const
const allowedEmailDestinationKeys = ['main_courante', 'suivi_medical', 'demande_reparation'] as const
const requiredEmailDestinationKeys = new Set(['main_courante', 'demande_reparation'])
const emailPattern = /^[^\s@]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/
const PASSWORD_MIN_LENGTH = 15
const PASSWORD_MAX_LENGTH = 128

function getAllowedRedirectOrigins() {
  const configured = (Deno.env.get('APP_ALLOWED_REDIRECT_ORIGINS') ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
  return new Set(['https://app.flashover78.com', ...configured])
}

function validateInvitationRedirect(value: unknown) {
  const candidate = String(value ?? '').trim()
  if (!candidate) return undefined

  let redirect: URL
  try {
    redirect = new URL(candidate)
  } catch {
    throw new Error('URL de redirection invalide.')
  }

  if (!getAllowedRedirectOrigins().has(redirect.origin) || redirect.pathname !== '/login') {
    throw new Error('URL de redirection non autorisée.')
  }

  redirect.search = ''
  redirect.hash = ''
  return redirect.toString()
}

async function writeAdminAudit(
  adminClient: ReturnType<typeof createClient>,
  actorId: string,
  action: string,
  targetUserId: string | null,
  outcome: 'attempt' | 'success' | 'failure',
  details: Record<string, unknown> = {},
) {
  const { error } = await adminClient.from('admin_operation_audit').insert({
    actor_id: actorId,
    actor_role: 'admin',
    action,
    target_user_id: targetUserId,
    outcome,
    details,
  })

  if (error) {
    console.error('Unable to write administrator operation audit entry')
  }

  return !error
}

function normalizeTrainerLevels(value: unknown) {
  const candidates = Array.isArray(value) ? value.map((entry) => String(entry).trim().toUpperCase()) : []
  return allowedTrainerLevels.filter((level) => candidates.includes(level))
}

function normalizeEmailRecipients(value: unknown) {
  const candidates = Array.isArray(value) ? value : [value]
  return Array.from(new Set(
    candidates
      .flatMap((entry) => String(entry ?? '').split(/[\n,;]+/))
      .map((entry) => entry.trim().toLowerCase())
      .filter(Boolean),
  ))
}

function parseEmailDestinations(value: unknown) {
  if (!Array.isArray(value)) {
    throw new Error('La liste des destinataires est invalide.')
  }

  const destinations = new Map<string, string[]>()
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') {
      throw new Error('La liste des destinataires est invalide.')
    }

    const formKey = String((entry as { form_key?: unknown }).form_key ?? '')
    if (!allowedEmailDestinationKeys.includes(formKey as typeof allowedEmailDestinationKeys[number])) {
      throw new Error('Le type de formulaire est invalide.')
    }

    if (destinations.has(formKey)) {
      throw new Error('Un type de formulaire est présent plusieurs fois.')
    }

    const recipients = normalizeEmailRecipients((entry as { recipients?: unknown }).recipients)
    if (recipients.length > 20) {
      throw new Error('Une liste de destinataires ne peut pas dépasser 20 adresses.')
    }
    if (requiredEmailDestinationKeys.has(formKey) && recipients.length === 0) {
      throw new Error('Les formulaires principaux doivent conserver au moins un destinataire.')
    }

    const invalidRecipient = recipients.find((recipient) => !emailPattern.test(recipient))
    if (invalidRecipient) {
      throw new Error('Une adresse de destinataire est invalide.')
    }

    destinations.set(formKey, recipients)
  }

  if (destinations.size !== allowedEmailDestinationKeys.length) {
    throw new Error('Les trois types de formulaire doivent être configurés.')
  }

  return allowedEmailDestinationKeys.map((formKey) => ({
    form_key: formKey,
    recipients: destinations.get(formKey) ?? [],
  }))
}

Deno.serve(async (request) => {
  const originRejection = rejectDisallowedOrigin(request)
  if (originRejection) return originRejection

  const jsonResponse = (status: number, body: unknown) => baseJsonResponse(status, body, request)
  const internalErrorResponse = (message = 'Opération impossible.') =>
    baseInternalErrorResponse(message, request)

  if (request.method === 'OPTIONS') {
    return preflightResponse(request)
  }

  if (request.method !== 'POST') {
    return jsonResponse(405, { error: 'Méthode non autorisée.' })
  }

  const contentLength = Number(request.headers.get('content-length') ?? '0')
  if (Number.isFinite(contentLength) && contentLength > 131_072) {
    return jsonResponse(413, { error: 'Requête trop volumineuse.' })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
  const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  const authorization = request.headers.get('Authorization')

  if (!authorization) {
    return jsonResponse(401, { error: 'Authentification requise.' })
  }

  if (!supabaseUrl.trim() || !supabaseAnonKey.trim() || !supabaseServiceRoleKey.trim()) {
    return internalErrorResponse('Configuration Supabase incomplète.')
  }

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: authorization } },
  })

  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser()

  if (userError || !user) {
    return jsonResponse(401, { error: 'Session invalide.' })
  }

  const { data: profile, error: profileError } = await userClient
    .from('profiles')
    .select('role, is_admin, trainer_levels')
    .eq('id', user.id)
    .maybeSingle()

  if (profileError) {
    console.error('Unable to load administrator profile')
    return internalErrorResponse('Impossible de vérifier les droits administrateur.')
  }

  if (profile?.role !== 'admin') {
    return jsonResponse(403, { error: 'Action réservée aux administrateurs.' })
  }

  // The database checks the signed JWT, its TOTP method and a live verified factor.
  // Do this before creating a service-role client: it bypasses RLS.
  const { data: hasMfa, error: mfaError } = await userClient.rpc('has_admin_mfa')
  if (mfaError || hasMfa !== true) {
    return jsonResponse(403, { error: 'Validation TOTP requise.', code: 'mfa_required' })
  }

  const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  let payload: Record<string, unknown> = {}

  try {
    const body = await request.text()
    if (new TextEncoder().encode(body).byteLength > 131_072) {
      return jsonResponse(413, { error: 'Requête trop volumineuse.' })
    }
    payload = JSON.parse(body)
  } catch {
    payload = {}
  }

  const action = String(payload.action ?? '')
  const auditActionByRequest = new Map([
    ['delete', 'delete_user'],
    ['update_email_destinations', 'update_email_destinations'],
    ['update_trainer_levels', 'update_trainer_levels'],
    ['update_role', 'update_role'],
    ['invite', 'invite_user'],
    ['create', 'create_user'],
  ])
  const requestedAuditAction = auditActionByRequest.get(action)
  if (requestedAuditAction) {
    const targetUserId = ['delete', 'update_trainer_levels', 'update_role'].includes(action)
      ? String(payload.userId ?? '').trim() || null
      : null
    const auditAvailable = await writeAdminAudit(
      adminClient,
      user.id,
      requestedAuditAction,
      targetUserId,
      'attempt',
      { stage: 'requested' },
    )
    if (!auditAvailable) {
      return jsonResponse(503, {
        error: 'La journalisation de sécurité est indisponible; aucune opération n’a été exécutée.',
      })
    }
  }

  if (action === 'list') {
    const requestedPage = Number(payload.page ?? 1)
    const requestedPerPage = Number(payload.perPage ?? 100)
    const page = Number.isInteger(requestedPage) && requestedPage >= 1
      ? Math.min(requestedPage, 1000)
      : 1
    const perPage = Number.isInteger(requestedPerPage) && requestedPerPage >= 1
      ? Math.min(requestedPerPage, 100)
      : 100
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage })

    if (error) {
      console.error('Unable to list Auth users')
      return internalErrorResponse('Impossible de charger les utilisateurs.')
    }

    const ids = data.users.map((entry) => entry.id)
    const { data: profiles, error: profilesError } = ids.length
      ? await adminClient
          .from('profiles')
          .select('id, display_name, first_name, last_name, role, is_admin, trainer_levels')
          .in('id', ids)
      : { data: [], error: null }

    if (profilesError) {
      console.error('Unable to load user profiles')
      return internalErrorResponse('Impossible de charger les profils utilisateurs.')
    }

    const profileMap = new Map((profiles ?? []).map((entry) => [entry.id, entry]))

    return jsonResponse(200, {
      page,
      perPage,
      hasMore: data.users.length === perPage,
      users: data.users.map((entry) => {
        const localProfile = profileMap.get(entry.id)
        const firstName = localProfile?.first_name ?? entry.user_metadata?.first_name ?? null
        const lastName = localProfile?.last_name ?? entry.user_metadata?.last_name ?? null
        const displayName =
          localProfile?.display_name ??
          entry.user_metadata?.display_name ??
          [firstName, lastName].filter(Boolean).join(' ').trim() ??
          entry.email ??
          'Utilisateur'

        return {
          id: entry.id,
          email: entry.email ?? '',
          display_name: displayName,
          first_name: firstName,
          last_name: lastName,
          role: localProfile?.role ?? (localProfile?.is_admin ? 'admin' : 'member'),
          trainer_levels: normalizeTrainerLevels(localProfile?.trainer_levels),
          is_admin: Boolean(localProfile?.is_admin),
          created_at: entry.created_at ?? null,
          last_sign_in_at: entry.last_sign_in_at ?? null,
          email_confirmed_at: entry.email_confirmed_at ?? null,
        }
      }),
    })
  }

  if (action === 'delete') {
    const userId = String(payload.userId ?? '').trim()
    if (!userId) {
      return jsonResponse(400, { error: 'Utilisateur manquant.' })
    }

    if (userId === user.id) {
      return jsonResponse(409, { error: 'Vous ne pouvez pas supprimer votre propre compte.' })
    }

    const { data: targetUser, error: targetUserError } = await adminClient.auth.admin.getUserById(userId)
    if (targetUserError || !targetUser.user) {
      if (targetUserError) {
        console.error('Unable to load target Auth user before deletion')
      }
      return jsonResponse(404, { error: 'Utilisateur introuvable.' })
    }

    const { data: profiles, error: profilesError } = await adminClient
      .from('profiles')
      .select('id, role, is_admin')

    if (profilesError) {
      console.error('Unable to load profiles before deletion')
      return internalErrorResponse('Impossible de vérifier le compte à supprimer.')
    }

    const targetProfile = (profiles ?? []).find((entry) => entry.id === userId)
    const targetIsAdmin = targetProfile?.role === 'admin' || targetProfile?.is_admin === true
    if (targetIsAdmin) {
      const adminCount = (profiles ?? []).filter((entry) => entry.role === 'admin' || entry.is_admin === true).length
      if (adminCount <= 1) {
        return jsonResponse(409, { error: 'Le dernier administrateur ne peut pas être supprimé.' })
      }
    }

    const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId)
    if (deleteError) {
      if (/foreign key|violates/i.test(deleteError.message)) {
        return jsonResponse(409, {
          error: 'Ce compte possède encore un document partagé qui doit être réattribué avant suppression.',
        })
      }
      console.error('Unable to delete Auth user')
      return internalErrorResponse('Impossible de supprimer ce compte.')
    }

    if (!await writeAdminAudit(adminClient, user.id, 'delete_user', userId, 'success')) {
      return auditPendingResponse(request)
    }
    return jsonResponse(200, { success: true })
  }

  if (action === 'update_email_destinations') {
    let destinations
    try {
      destinations = parseEmailDestinations(payload.destinations)
    } catch (error) {
      return jsonResponse(400, {
        error: error instanceof Error ? error.message : 'Les destinataires sont invalides.',
      })
    }

    const { error: updateError } = await adminClient
      .from('email_destinations')
      .upsert(
        destinations.map((destination) => ({
          ...destination,
          updated_at: new Date().toISOString(),
          updated_by: user.id,
        })),
        { onConflict: 'form_key' },
      )

    if (updateError) {
      console.error('Unable to update email destinations')
      return internalErrorResponse('Impossible d’enregistrer les destinataires.')
    }

    if (!await writeAdminAudit(
      adminClient,
      user.id,
      'update_email_destinations',
      null,
      'success',
      { destination_count: destinations.length },
    )) {
      return auditPendingResponse(request)
    }
    return jsonResponse(200, { success: true })
  }

  if (action === 'update_trainer_levels') {
    const userId = String(payload.userId ?? '').trim()
    if (!userId) {
      return jsonResponse(400, { error: 'Utilisateur manquant.' })
    }

    const { error: updateError } = await adminClient
      .from('profiles')
      .update({ trainer_levels: normalizeTrainerLevels(payload.trainerLevels) })
      .eq('id', userId)

    if (updateError) {
      console.error('Unable to update trainer levels')
      return internalErrorResponse('Impossible de mettre à jour les fonctions formateur.')
    }

    if (!await writeAdminAudit(adminClient, user.id, 'update_trainer_levels', userId, 'success')) {
      return auditPendingResponse(request)
    }
    return jsonResponse(200, { success: true })
  }

  const role = String(payload.role ?? 'member')
  if (!allowedRoles.has(role)) {
    return jsonResponse(400, { error: 'Niveau d’accès invalide.' })
  }

  if (action === 'update_role') {
    const userId = String(payload.userId ?? '').trim()
    if (!userId) {
      return jsonResponse(400, { error: 'Utilisateur manquant.' })
    }

    const { data: targetProfile, error: targetError } = await adminClient
      .from('profiles')
      .select('role, is_admin')
      .eq('id', userId)
      .maybeSingle()

    if (targetError || !targetProfile) {
      if (targetError) {
        console.error('Unable to load target profile before role update')
      }
      return jsonResponse(404, { error: 'Utilisateur introuvable.' })
    }

    const targetIsAdmin = targetProfile.role === 'admin' || targetProfile.is_admin
    if (targetIsAdmin && role !== 'admin') {
      const { count, error: countError } = await adminClient
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('role', 'admin')

      if (countError) {
        console.error('Unable to count administrators')
        return internalErrorResponse('Impossible de vérifier le nombre d’administrateurs.')
      }

      if ((count ?? 0) <= 1) {
        return jsonResponse(409, { error: 'Le dernier administrateur ne peut pas être rétrogradé.' })
      }
    }

    const { error: updateError } = await adminClient
      .from('profiles')
      .update({ role, is_admin: role === 'admin' })
      .eq('id', userId)

    if (updateError) {
      console.error('Unable to update user role')
      return internalErrorResponse('Impossible de mettre à jour le rôle.')
    }

    if (!await writeAdminAudit(
      adminClient,
      user.id,
      'update_role',
      userId,
      'success',
      { previous_role: targetProfile.role, next_role: role },
    )) {
      return auditPendingResponse(request)
    }
    return jsonResponse(200, { success: true })
  }

  const email = String(payload.email ?? '').trim().toLowerCase()
  const firstName = String(payload.firstName ?? '').trim()
  const lastName = String(payload.lastName ?? '').trim()
  const displayName = [firstName, lastName].filter(Boolean).join(' ').trim() || email

  if (!email || !firstName || !lastName) {
    return jsonResponse(400, { error: 'Les informations utilisateur sont incomplètes.' })
  }

  if (action === 'invite') {
    let redirectTo: string | undefined
    try {
      redirectTo = validateInvitationRedirect(payload.redirectTo)
    } catch (error) {
      return jsonResponse(400, {
        error: error instanceof Error ? error.message : 'URL de redirection invalide.',
      })
    }
    const { data, error } = await adminClient.auth.admin.inviteUserByEmail(email, {
      data: {
        first_name: firstName,
        last_name: lastName,
        display_name: displayName,
      },
      redirectTo,
    })

    if (error) {
      console.error('Unable to invite Auth user')
      return internalErrorResponse('Impossible d’envoyer l’invitation.')
    }

    if (data.user) {
      const { error: upsertError } = await adminClient.from('profiles').upsert({
        id: data.user.id,
        email,
        display_name: displayName,
        first_name: firstName,
        last_name: lastName,
        trainer_levels: normalizeTrainerLevels(payload.trainerLevels),
        role,
        is_admin: role === 'admin',
      })

      if (upsertError) {
        const { error: cleanupError } = await adminClient.auth.admin.deleteUser(data.user.id)
        await writeAdminAudit(
          adminClient,
          user.id,
          'invite_user',
          data.user.id,
          'failure',
          { reason: 'profile_write_failed', cleanup_succeeded: !cleanupError },
        )
        return jsonResponse(500, {
          error: cleanupError
            ? 'La création du profil et l’annulation du compte ont échoué; une intervention est requise.'
            : 'La création du profil a échoué; le compte a été annulé.',
        })
      }

      if (!await writeAdminAudit(adminClient, user.id, 'invite_user', data.user.id, 'success')) {
        return auditPendingResponse(request)
      }
    }

    return jsonResponse(200, { success: true })
  }

  if (action === 'create') {
    const password = String(payload.password ?? '')
    if (password.length < PASSWORD_MIN_LENGTH || password.length > PASSWORD_MAX_LENGTH) {
      return jsonResponse(400, {
        error: `Le mot de passe doit contenir entre ${PASSWORD_MIN_LENGTH} et ${PASSWORD_MAX_LENGTH} caractères.`,
      })
    }

    const { data, error } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        first_name: firstName,
        last_name: lastName,
        display_name: displayName,
      },
    })

    if (error) {
      console.error('Unable to create Auth user')
      return internalErrorResponse('Impossible de créer le compte.')
    }

    if (data.user) {
      const { error: upsertError } = await adminClient.from('profiles').upsert({
        id: data.user.id,
        email,
        display_name: displayName,
        first_name: firstName,
        last_name: lastName,
        trainer_levels: normalizeTrainerLevels(payload.trainerLevels),
        role,
        is_admin: role === 'admin',
      })

      if (upsertError) {
        const { error: cleanupError } = await adminClient.auth.admin.deleteUser(data.user.id)
        await writeAdminAudit(
          adminClient,
          user.id,
          'create_user',
          data.user.id,
          'failure',
          { reason: 'profile_write_failed', cleanup_succeeded: !cleanupError },
        )
        return jsonResponse(500, {
          error: cleanupError
            ? 'La création du profil et l’annulation du compte ont échoué; une intervention est requise.'
            : 'La création du profil a échoué; le compte a été annulé.',
        })
      }

      if (!await writeAdminAudit(adminClient, user.id, 'create_user', data.user.id, 'success')) {
        return auditPendingResponse(request)
      }
    }

    return jsonResponse(200, { success: true })
  }

  return jsonResponse(400, { error: 'Action inconnue.' })
})
