-- Keep every carpool cancellation on one lock order.  The previous
-- cancel_carpool_post implementation locked the target post first and an
-- accepted counterpart later, while cancel_carpool_match locked both posts
-- ordered by UUID.  Two opposite cancellations could therefore deadlock.
-- This replacement locks the complete post set in UUID order before touching
-- any match row.  It preserves the existing authorization and state rules.

create or replace function public.cancel_carpool_post(p_post_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  target_post public.carpool_posts;
  target_match public.carpool_matches;
  offer_post public.carpool_posts;
begin
  if current_user_id is null or not private.has_active_session() then
    raise exception 'Authentification requise';
  end if;

  -- Read before locking only to discover the relationship set.  The target
  -- and all counterparts are locked again below, in one deterministic order,
  -- then re-read and authorized while those locks are held.
  select * into target_post
  from public.carpool_posts
  where id = p_post_id;

  if target_post.id is null then
    raise exception 'Publication introuvable ou action non autorisée';
  end if;

  perform 1
  from public.carpool_posts as post
  where post.id = p_post_id
     or post.id in (
       select case
         when match.offer_post_id = p_post_id then match.need_post_id
         else match.offer_post_id
       end
       from public.carpool_matches as match
       where (match.offer_post_id = p_post_id or match.need_post_id = p_post_id)
         and match.status in ('pending', 'accepted')
     )
  order by post.id
  for update;

  select * into target_post
  from public.carpool_posts
  where id = p_post_id
  for update;

  if target_post.id is null
    or (target_post.author_id <> current_user_id and not (select private.is_admin())) then
    raise exception 'Publication introuvable ou action non autorisée';
  end if;

  for target_match in
    select *
    from public.carpool_matches
    where (offer_post_id = target_post.id or need_post_id = target_post.id)
      and status in ('pending', 'accepted')
    order by id
    for update
  loop
    if target_match.status = 'accepted' and target_post.kind = 'need' then
      select * into offer_post
      from public.carpool_posts
      where id = target_match.offer_post_id;
    end if;

    update public.carpool_matches
    set status = 'cancelled', updated_at = timezone('utc', now())
    where id = target_match.id;

    if target_match.status = 'accepted' then
      if target_post.kind = 'need' then
        perform private.refresh_carpool_post_status(offer_post.id);
      else
        perform private.refresh_carpool_post_status(target_match.need_post_id);
      end if;
    end if;
  end loop;

  update public.carpool_posts
  set status = 'cancelled', updated_at = timezone('utc', now())
  where id = target_post.id;
end;
$$;

revoke all on function public.cancel_carpool_post(uuid) from public, anon;
grant execute on function public.cancel_carpool_post(uuid) to authenticated;
