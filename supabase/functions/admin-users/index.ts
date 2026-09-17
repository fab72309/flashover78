import { createClient } from 'npm:@supabase/supabase-js@2.110.8'

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

const allowedRoles = new Set(['member', 'contributor', 'admin'])
const allowedTrainerLevels = ['RSFR', 'FOR INC', 'FOR BAT'] as const
const allowedEmailDestinationKeys = ['main_courante', 'suivi_medical', 'demande_reparation'] as const
const requiredEmailDestinationKeys = new Set(['main_courante', 'demande_reparation'])
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function normalizeTrainerLevels(value: unknown) {
  const candidates = Array.isArray(value) ? value.map((entry) => String(entry).trim().toUpperCase()) : []
  const levels = allowedTrainerLevels.filter((level) => candidates.includes(level))
  return levels.length > 0 ? levels : ['RSFR']
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
      throw new Error(`L’adresse « ${invalidRecipient} » n’est pas valide.`)
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
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (request.method !== 'POST') {
    return jsonResponse(405, { error: 'Méthode non autorisée.' })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
  const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  const authorization = request.headers.get('Authorization')

  if (!authorization) {
    return jsonResponse(401, { error: 'Authentification requise.' })
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
    return jsonResponse(500, { error: profileError.message })
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
    payload = await request.json()
  } catch {
    payload = {}
  }

  const action = String(payload.action ?? '')

  if (action === 'list') {
    const { data, error } = await adminClient.auth.admin.listUsers({ page: 1, perPage: 200 })

    if (error) {
      return jsonResponse(500, { error: error.message })
    }

    const ids = data.users.map((entry) => entry.id)
    const { data: profiles, error: profilesError } = ids.length
      ? await adminClient
          .from('profiles')
          .select('id, display_name, first_name, last_name, role, is_admin, trainer_levels')
          .in('id', ids)
      : { data: [], error: null }

    if (profilesError) {
      return jsonResponse(500, { error: profilesError.message })
    }

    const profileMap = new Map((profiles ?? []).map((entry) => [entry.id, entry]))

    return jsonResponse(200, {
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
      return jsonResponse(404, { error: targetUserError?.message ?? 'Utilisateur introuvable.' })
    }

    const { data: profiles, error: profilesError } = await adminClient
      .from('profiles')
      .select('id, role, is_admin')

    if (profilesError) {
      return jsonResponse(500, { error: profilesError.message })
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
      return jsonResponse(500, { error: deleteError.message })
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
      return jsonResponse(500, { error: updateError.message })
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
      return jsonResponse(500, { error: updateError.message })
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
      return jsonResponse(404, { error: targetError?.message ?? 'Utilisateur introuvable.' })
    }

    const targetIsAdmin = targetProfile.role === 'admin' || targetProfile.is_admin
    if (targetIsAdmin && role !== 'admin') {
      const { count, error: countError } = await adminClient
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('role', 'admin')

      if (countError) {
        return jsonResponse(500, { error: countError.message })
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
      return jsonResponse(500, { error: updateError.message })
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
    const redirectTo = String(payload.redirectTo ?? '').trim() || undefined
    const { data, error } = await adminClient.auth.admin.inviteUserByEmail(email, {
      data: {
        first_name: firstName,
        last_name: lastName,
        display_name: displayName,
      },
      redirectTo,
    })

    if (error) {
      return jsonResponse(500, { error: error.message })
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
        return jsonResponse(500, { error: upsertError.message })
      }
    }

    return jsonResponse(200, { success: true })
  }

  if (action === 'create') {
    const password = String(payload.password ?? '')
    if (password.length < 6) {
      return jsonResponse(400, { error: 'Le mot de passe doit contenir au moins 6 caractères.' })
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
      return jsonResponse(500, { error: error.message })
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
        return jsonResponse(500, { error: upsertError.message })
      }
    }

    return jsonResponse(200, { success: true })
  }

  return jsonResponse(400, { error: 'Action inconnue.' })
})
