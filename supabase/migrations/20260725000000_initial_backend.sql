create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create type public.app_role as enum (
  'elevator_supervisor',
  'elevator_engineer'
);

create type public.work_order_status as enum (
  'assigned',
  'in_progress',
  'closed'
);

create type public.work_order_priority as enum (
  'normal',
  'urgent'
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null
    constraint profiles_display_name_check
    check (char_length(btrim(display_name)) between 1 and 80),
  role public.app_role not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index profiles_role_active_idx
  on public.profiles (role, is_active);

create table public.work_orders (
  id uuid primary key,
  elevator_area text not null
    constraint work_orders_elevator_area_check
    check (char_length(btrim(elevator_area)) between 1 and 80),
  elevator_code text not null
    constraint work_orders_elevator_code_check
    check (char_length(btrim(elevator_code)) between 1 and 80),
  description text not null
    constraint work_orders_description_check
    check (char_length(btrim(description)) between 1 and 1000),
  priority public.work_order_priority not null default 'normal',
  status public.work_order_status not null default 'assigned',
  created_by uuid not null
    constraint work_orders_created_by_fkey
    references public.profiles (id) on delete restrict,
  assignee_id uuid not null
    constraint work_orders_assignee_id_fkey
    references public.profiles (id) on delete restrict,
  resolution text
    constraint work_orders_resolution_check
    check (
      resolution is null
      or char_length(btrim(resolution)) between 1 and 2000
    ),
  version integer not null default 1
    constraint work_orders_version_check
    check (version >= 1),
  created_at timestamptz not null default now(),
  started_at timestamptz,
  closed_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint work_orders_state_check check (
    (
      status = 'assigned'
      and started_at is null
      and closed_at is null
      and resolution is null
    )
    or (
      status = 'in_progress'
      and started_at is not null
      and closed_at is null
      and resolution is null
    )
    or (
      status = 'closed'
      and started_at is not null
      and closed_at is not null
      and resolution is not null
      and char_length(btrim(resolution)) > 0
    )
  )
);

create index work_orders_priority_created_idx
  on public.work_orders (priority desc, created_at desc, id desc);
create index work_orders_status_priority_created_idx
  on public.work_orders (status, priority desc, created_at desc, id desc);
create index work_orders_assignee_status_priority_created_idx
  on public.work_orders (
    assignee_id,
    status,
    priority desc,
    created_at desc,
    id desc
  );
create index work_orders_created_by_created_idx
  on public.work_orders (created_by, created_at desc);

create table public.work_order_attachments (
  id uuid primary key,
  work_order_id uuid not null
    constraint work_order_attachments_work_order_id_fkey
    references public.work_orders (id) on delete restrict,
  storage_path text not null unique,
  mime_type text not null
    constraint work_order_attachments_mime_type_check
    check (mime_type = 'image/jpeg'),
  size_bytes integer not null
    constraint work_order_attachments_size_bytes_check
    check (size_bytes between 1 and 10485760),
  position smallint not null
    constraint work_order_attachments_position_check
    check (position between 0 and 2),
  created_at timestamptz not null default now(),
  unique (work_order_id, position)
);

create index work_order_attachments_work_order_idx
  on public.work_order_attachments (work_order_id);

create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function private.set_updated_at();

create trigger work_orders_set_updated_at
before update on public.work_orders
for each row execute function private.set_updated_at();

create function private.require_active_role(p_role public.app_role)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_profile public.profiles%rowtype;
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'AUTH_REQUIRED';
  end if;

  select *
  into v_profile
  from public.profiles
  where id = v_user_id;

  if not found then
    raise exception using errcode = 'P0001', message = 'PROFILE_MISSING';
  end if;

  if not v_profile.is_active then
    raise exception using errcode = 'P0001', message = 'ACCOUNT_DISABLED';
  end if;

  if v_profile.role <> p_role then
    raise exception using errcode = 'P0001', message = 'ROLE_FORBIDDEN';
  end if;

  return v_user_id;
end;
$$;

create function public.current_user_is_supervisor()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'elevator_supervisor'
      and is_active
  );
$$;

create function public.can_read_work_order(p_work_order_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    left join public.work_orders w
      on w.id = p_work_order_id
    where p.id = auth.uid()
      and p.is_active
      and (
        p.role = 'elevator_supervisor'
        or (
          p.role = 'elevator_engineer'
          and w.assignee_id = p.id
        )
      )
  );
$$;

create function public.can_read_profile_summary(p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    p_profile_id = auth.uid()
    or exists (
      select 1
      from public.profiles current_profile
      where current_profile.id = auth.uid()
        and current_profile.is_active
        and (
          current_profile.role = 'elevator_supervisor'
          or (
            current_profile.role = 'elevator_engineer'
            and exists (
              select 1
              from public.work_orders w
              where w.assignee_id = current_profile.id
                and w.created_by = p_profile_id
            )
          )
        )
    );
$$;

alter table public.profiles enable row level security;
alter table public.work_orders enable row level security;
alter table public.work_order_attachments enable row level security;

create policy profiles_select
on public.profiles
for select
to authenticated
using (public.can_read_profile_summary(id));

create policy work_orders_select
on public.work_orders
for select
to authenticated
using (public.can_read_work_order(id));

create policy work_order_attachments_select
on public.work_order_attachments
for select
to authenticated
using (public.can_read_work_order(work_order_id));

revoke all on table public.profiles from anon, authenticated;
revoke all on table public.work_orders from anon, authenticated;
revoke all on table public.work_order_attachments from anon, authenticated;
grant select on table public.profiles to authenticated;
grant select on table public.work_orders to authenticated;
grant select on table public.work_order_attachments to authenticated;

create function public.list_active_engineers()
returns table (
  id uuid,
  display_name text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_active_role('elevator_supervisor');

  return query
  select p.id, p.display_name
  from public.profiles p
  where p.role = 'elevator_engineer'
    and p.is_active
  order by p.display_name, p.id;
end;
$$;

create function public.create_work_order(
  p_id uuid,
  p_elevator_area text,
  p_elevator_code text,
  p_description text,
  p_priority public.work_order_priority,
  p_assignee_id uuid,
  p_attachments jsonb
)
returns table (
  id uuid,
  status public.work_order_status,
  assignee_id uuid,
  resolution text,
  version integer,
  started_at timestamptz,
  closed_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_existing public.work_orders%rowtype;
  v_item jsonb;
  v_attachment_count integer;
  v_input_attachments jsonb;
  v_existing_attachments jsonb;
  v_metadata jsonb;
  v_size_bytes integer;
  v_result public.work_orders%rowtype;
begin
  v_user_id := private.require_active_role('elevator_supervisor');

  if p_id is null
    or p_assignee_id is null
    or p_priority is null
    or p_elevator_area is null
    or char_length(btrim(p_elevator_area)) not between 1 and 80
    or p_elevator_code is null
    or char_length(btrim(p_elevator_code)) not between 1 and 80
    or p_description is null
    or char_length(btrim(p_description)) not between 1 and 1000
  then
    raise exception using errcode = 'P0001', message = 'VALIDATION_FAILED';
  end if;

  if p_attachments is null or jsonb_typeof(p_attachments) <> 'array' then
    raise exception using errcode = 'P0001', message = 'PHOTO_COUNT_INVALID';
  end if;

  v_attachment_count := jsonb_array_length(p_attachments);
  if v_attachment_count not between 1 and 3 then
    raise exception using errcode = 'P0001', message = 'PHOTO_COUNT_INVALID';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_attachments) item
    where jsonb_typeof(item) <> 'object'
  ) then
    raise exception using errcode = 'P0001', message = 'VALIDATION_FAILED';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_attachments) item
    where not (item ?& array['id', 'path', 'position'])
      or (select count(*) from jsonb_object_keys(item)) <> 3
      or coalesce(item ->> 'id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      or coalesce(item ->> 'position', '') !~ '^[0-2]$'
      or coalesce(item ->> 'path', '') <> format(
        'work-orders/%s/%s/%s.jpg',
        v_user_id,
        p_id,
        item ->> 'id'
      )
  ) then
    raise exception using errcode = 'P0001', message = 'VALIDATION_FAILED';
  end if;

  if (
    select count(distinct item ->> 'id') <> v_attachment_count
      or count(distinct item ->> 'path') <> v_attachment_count
      or count(distinct item ->> 'position') <> v_attachment_count
    from jsonb_array_elements(p_attachments) item
  ) then
    raise exception using errcode = 'P0001', message = 'VALIDATION_FAILED';
  end if;

  select jsonb_agg(
    jsonb_build_object(
      'id', item ->> 'id',
      'path', item ->> 'path',
      'position', (item ->> 'position')::integer
    )
    order by (item ->> 'position')::integer
  )
  into v_input_attachments
  from jsonb_array_elements(p_attachments) item;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_id::text, 0)
  );

  select *
  into v_existing
  from public.work_orders
  where work_orders.id = p_id;

  if found then
    select jsonb_agg(
      jsonb_build_object(
        'id', a.id::text,
        'path', a.storage_path,
        'position', a.position::integer
      )
      order by a.position
    )
    into v_existing_attachments
    from public.work_order_attachments a
    where a.work_order_id = p_id;

    if v_existing.created_by <> v_user_id
      or v_existing.elevator_area <> btrim(p_elevator_area)
      or v_existing.elevator_code <> btrim(p_elevator_code)
      or v_existing.description <> btrim(p_description)
      or v_existing.priority <> p_priority
      or v_existing.assignee_id <> p_assignee_id
      or v_existing_attachments is distinct from v_input_attachments
    then
      raise exception using errcode = 'P0001', message = 'IDEMPOTENCY_CONFLICT';
    end if;

    return query
    select
      v_existing.id,
      v_existing.status,
      v_existing.assignee_id,
      v_existing.resolution,
      v_existing.version,
      v_existing.started_at,
      v_existing.closed_at,
      v_existing.updated_at;
    return;
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.id = p_assignee_id
      and p.role = 'elevator_engineer'
      and p.is_active
  ) then
    raise exception using errcode = 'P0001', message = 'ENGINEER_INACTIVE';
  end if;

  insert into public.work_orders (
    id,
    elevator_area,
    elevator_code,
    description,
    priority,
    created_by,
    assignee_id
  )
  values (
    p_id,
    btrim(p_elevator_area),
    btrim(p_elevator_code),
    btrim(p_description),
    p_priority,
    v_user_id,
    p_assignee_id
  );

  for v_item in
    select item
    from jsonb_array_elements(p_attachments) item
    order by (item ->> 'position')::integer
  loop
    select o.metadata
    into v_metadata
    from storage.objects o
    where o.bucket_id = 'work-order-media'
      and o.name = v_item ->> 'path'
      and o.owner_id = v_user_id::text;

    if not found then
      raise exception using errcode = 'P0001', message = 'PHOTO_OBJECT_MISSING';
    end if;

    if coalesce(v_metadata ->> 'mimetype', '') <> 'image/jpeg' then
      raise exception using errcode = 'P0001', message = 'PHOTO_TYPE_INVALID';
    end if;

    if coalesce(v_metadata ->> 'size', '') !~ '^[0-9]+$' then
      raise exception using errcode = 'P0001', message = 'PHOTO_SIZE_INVALID';
    end if;

    if (v_metadata ->> 'size')::numeric not between 1 and 10485760 then
      raise exception using errcode = 'P0001', message = 'PHOTO_SIZE_INVALID';
    end if;

    v_size_bytes := (v_metadata ->> 'size')::integer;

    insert into public.work_order_attachments (
      id,
      work_order_id,
      storage_path,
      mime_type,
      size_bytes,
      position
    )
    values (
      (v_item ->> 'id')::uuid,
      p_id,
      v_item ->> 'path',
      'image/jpeg',
      v_size_bytes,
      (v_item ->> 'position')::smallint
    );
  end loop;

  select *
  into v_result
  from public.work_orders
  where work_orders.id = p_id;

  return query
  select
    v_result.id,
    v_result.status,
    v_result.assignee_id,
    v_result.resolution,
    v_result.version,
    v_result.started_at,
    v_result.closed_at,
    v_result.updated_at;
end;
$$;

create function public.reassign_work_order(
  p_id uuid,
  p_assignee_id uuid,
  p_expected_version integer
)
returns table (
  id uuid,
  status public.work_order_status,
  assignee_id uuid,
  resolution text,
  version integer,
  started_at timestamptz,
  closed_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_work_order public.work_orders%rowtype;
begin
  perform private.require_active_role('elevator_supervisor');

  if p_id is null
    or p_assignee_id is null
    or p_expected_version is null
    or p_expected_version < 1
  then
    raise exception using errcode = 'P0001', message = 'VALIDATION_FAILED';
  end if;

  select *
  into v_work_order
  from public.work_orders
  where work_orders.id = p_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'NOT_FOUND_OR_FORBIDDEN';
  end if;

  if v_work_order.version <> p_expected_version then
    raise exception using errcode = 'P0001', message = 'VERSION_CONFLICT';
  end if;

  if v_work_order.status <> 'assigned' then
    raise exception using errcode = 'P0001', message = 'INVALID_TRANSITION';
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.id = p_assignee_id
      and p.role = 'elevator_engineer'
      and p.is_active
  ) then
    raise exception using errcode = 'P0001', message = 'ENGINEER_INACTIVE';
  end if;

  if v_work_order.assignee_id = p_assignee_id then
    raise exception using errcode = 'P0001', message = 'ENGINEER_UNCHANGED';
  end if;

  update public.work_orders as wo
  set assignee_id = p_assignee_id,
      version = wo.version + 1
  where wo.id = p_id
  returning * into v_work_order;

  return query
  select
    v_work_order.id,
    v_work_order.status,
    v_work_order.assignee_id,
    v_work_order.resolution,
    v_work_order.version,
    v_work_order.started_at,
    v_work_order.closed_at,
    v_work_order.updated_at;
end;
$$;

create function public.start_work_order(
  p_id uuid,
  p_expected_version integer
)
returns table (
  id uuid,
  status public.work_order_status,
  assignee_id uuid,
  resolution text,
  version integer,
  started_at timestamptz,
  closed_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_work_order public.work_orders%rowtype;
begin
  v_user_id := private.require_active_role('elevator_engineer');

  if p_id is null
    or p_expected_version is null
    or p_expected_version < 1
  then
    raise exception using errcode = 'P0001', message = 'VALIDATION_FAILED';
  end if;

  select *
  into v_work_order
  from public.work_orders
  where work_orders.id = p_id
  for update;

  if not found or v_work_order.assignee_id <> v_user_id then
    raise exception using errcode = 'P0001', message = 'NOT_FOUND_OR_FORBIDDEN';
  end if;

  if v_work_order.version <> p_expected_version then
    raise exception using errcode = 'P0001', message = 'VERSION_CONFLICT';
  end if;

  if v_work_order.status <> 'assigned' then
    raise exception using errcode = 'P0001', message = 'INVALID_TRANSITION';
  end if;

  update public.work_orders as wo
  set status = 'in_progress',
      started_at = now(),
      version = wo.version + 1
  where wo.id = p_id
  returning * into v_work_order;

  return query
  select
    v_work_order.id,
    v_work_order.status,
    v_work_order.assignee_id,
    v_work_order.resolution,
    v_work_order.version,
    v_work_order.started_at,
    v_work_order.closed_at,
    v_work_order.updated_at;
end;
$$;

create function public.close_work_order(
  p_id uuid,
  p_resolution text,
  p_expected_version integer
)
returns table (
  id uuid,
  status public.work_order_status,
  assignee_id uuid,
  resolution text,
  version integer,
  started_at timestamptz,
  closed_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_work_order public.work_orders%rowtype;
begin
  v_user_id := private.require_active_role('elevator_engineer');

  if p_resolution is null
    or char_length(btrim(p_resolution)) not between 1 and 2000
  then
    raise exception using errcode = 'P0001', message = 'RESOLUTION_REQUIRED';
  end if;

  if p_id is null
    or p_expected_version is null
    or p_expected_version < 1
  then
    raise exception using errcode = 'P0001', message = 'VALIDATION_FAILED';
  end if;

  select *
  into v_work_order
  from public.work_orders
  where work_orders.id = p_id
  for update;

  if not found or v_work_order.assignee_id <> v_user_id then
    raise exception using errcode = 'P0001', message = 'NOT_FOUND_OR_FORBIDDEN';
  end if;

  if v_work_order.version <> p_expected_version then
    raise exception using errcode = 'P0001', message = 'VERSION_CONFLICT';
  end if;

  if v_work_order.status <> 'in_progress' then
    raise exception using errcode = 'P0001', message = 'INVALID_TRANSITION';
  end if;

  update public.work_orders as wo
  set status = 'closed',
      resolution = btrim(p_resolution),
      closed_at = now(),
      version = wo.version + 1
  where wo.id = p_id
  returning * into v_work_order;

  return query
  select
    v_work_order.id,
    v_work_order.status,
    v_work_order.assignee_id,
    v_work_order.resolution,
    v_work_order.version,
    v_work_order.started_at,
    v_work_order.closed_at,
    v_work_order.updated_at;
end;
$$;

revoke all on function public.current_user_is_supervisor() from public, anon, authenticated;
revoke all on function public.can_read_work_order(uuid) from public, anon, authenticated;
revoke all on function public.can_read_profile_summary(uuid) from public, anon, authenticated;
revoke all on function private.set_updated_at() from public, anon, authenticated;
revoke all on function private.require_active_role(public.app_role) from public, anon, authenticated;
revoke all on function public.list_active_engineers() from public, anon, authenticated;
revoke all on function public.create_work_order(
  uuid,
  text,
  text,
  text,
  public.work_order_priority,
  uuid,
  jsonb
) from public, anon, authenticated;
revoke all on function public.reassign_work_order(uuid, uuid, integer) from public, anon, authenticated;
revoke all on function public.start_work_order(uuid, integer) from public, anon, authenticated;
revoke all on function public.close_work_order(uuid, text, integer) from public, anon, authenticated;

grant execute on function public.current_user_is_supervisor() to authenticated;
grant execute on function public.can_read_work_order(uuid) to authenticated;
grant execute on function public.can_read_profile_summary(uuid) to authenticated;
grant execute on function public.list_active_engineers() to authenticated;
grant execute on function public.create_work_order(
  uuid,
  text,
  text,
  text,
  public.work_order_priority,
  uuid,
  jsonb
) to authenticated;
grant execute on function public.reassign_work_order(uuid, uuid, integer) to authenticated;
grant execute on function public.start_work_order(uuid, integer) to authenticated;
grant execute on function public.close_work_order(uuid, text, integer) to authenticated;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'work-order-media',
  'work-order-media',
  false,
  10485760,
  array['image/jpeg']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy work_order_media_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'work-order-media'
  and public.current_user_is_supervisor()
  and (storage.foldername(name))[1] = 'work-orders'
  and (storage.foldername(name))[2] = auth.uid()::text
  and (storage.foldername(name))[3]
    ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  and array_length(storage.foldername(name), 1) = 3
  and storage.filename(name)
    ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.jpg$'
);

create policy work_order_media_select
on storage.objects
for select
to authenticated
using (
  bucket_id = 'work-order-media'
  and (
    exists (
      select 1
      from public.work_order_attachments a
      where a.storage_path = name
        and public.can_read_work_order(a.work_order_id)
    )
    or (
      owner_id = auth.uid()::text
      and public.current_user_is_supervisor()
      and (storage.foldername(name))[1] = 'work-orders'
      and (storage.foldername(name))[2] = auth.uid()::text
      and (storage.foldername(name))[3]
        ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      and array_length(storage.foldername(name), 1) = 3
      and storage.filename(name)
        ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.jpg$'
      and not exists (
        select 1
        from public.work_order_attachments a
        where a.storage_path = name
      )
    )
  )
);

create policy work_order_media_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'work-order-media'
  and owner_id = auth.uid()::text
  and public.current_user_is_supervisor()
  and not exists (
    select 1
    from public.work_order_attachments a
    where a.storage_path = name
  )
);
