import { createClient } from 'npm:@supabase/supabase-js@2'

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

function normalizeTrainerLevels(value: unknown) {
  const candidates = Array.isArray(value) ? value.map((entry) => String(entry).trim().toUpperCase()) : []
  const levels = allowedTrainerLevels.filter((level) => candidates.includes(level))
  return levels.length > 0 ? levels : ['RSFR']
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
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

  if (profile?.role !== 'admin' && !profile?.is_admin) {
    return jsonResponse(403, { error: 'Action réservée aux administrateurs.' })
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
