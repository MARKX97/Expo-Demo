begin;

create extension if not exists pgtap with schema extensions;

select plan(43);

select ok(
  to_regtype('public.app_role') is not null,
  'app_role enum exists'
);
select ok(
  to_regtype('public.work_order_status') is not null,
  'work_order_status enum exists'
);
select ok(
  to_regtype('public.work_order_priority') is not null,
  'work_order_priority enum exists'
);
select ok(to_regclass('public.profiles') is not null, 'profiles table exists');
select ok(to_regclass('public.work_orders') is not null, 'work_orders table exists');
select ok(
  to_regclass('public.work_order_attachments') is not null,
  'work_order_attachments table exists'
);
select ok(
  to_regprocedure('public.list_active_engineers()') is not null,
  'list_active_engineers RPC exists'
);
select ok(
  to_regprocedure(
    'public.create_work_order(uuid,text,text,text,public.work_order_priority,uuid,jsonb)'
  ) is not null,
  'create_work_order RPC exists'
);
select ok(
  to_regprocedure('public.reassign_work_order(uuid,uuid,integer)') is not null,
  'reassign_work_order RPC exists'
);
select ok(
  to_regprocedure('public.start_work_order(uuid,integer)') is not null,
  'start_work_order RPC exists'
);
select ok(
  to_regprocedure('public.close_work_order(uuid,text,integer)') is not null,
  'close_work_order RPC exists'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.profiles'::regclass),
  'profiles has RLS'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.work_orders'::regclass),
  'work_orders has RLS'
);
select ok(
  (
    select relrowsecurity
    from pg_class
    where oid = 'public.work_order_attachments'::regclass
  ),
  'work_order_attachments has RLS'
);
select ok(
  has_table_privilege(
    'service_role',
    'public.profiles',
    'SELECT, INSERT, UPDATE, DELETE'
  ),
  'service_role can manage profile fixtures'
);
select ok(
  has_table_privilege(
    'service_role',
    'public.work_orders',
    'SELECT, INSERT, UPDATE, DELETE'
  ),
  'service_role can manage work order fixtures'
);
select ok(
  has_table_privilege(
    'service_role',
    'public.work_order_attachments',
    'SELECT, INSERT, UPDATE, DELETE'
  ),
  'service_role can manage attachment fixtures'
);
select is(
  (select b.public from storage.buckets b where b.id = 'work-order-media'),
  false,
  'work-order-media bucket is private'
);
select is(
  (
    select count(*)::integer
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname like 'work_order_media_%'
  ),
  3,
  'storage has insert, select and delete policies'
);
select is(
  (
    select count(*)::integer
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname like 'work_order_media_%'
      and cmd = 'UPDATE'
  ),
  0,
  'storage has no update policy'
);

insert into auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values
  (
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'supervisor@example.invalid',
    '',
    now(),
    '{}',
    '{}',
    now(),
    now()
  ),
  (
    '00000000-0000-4000-8000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'engineer-a@example.invalid',
    '',
    now(),
    '{}',
    '{}',
    now(),
    now()
  ),
  (
    '00000000-0000-4000-8000-000000000003',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'engineer-b@example.invalid',
    '',
    now(),
    '{}',
    '{}',
    now(),
    now()
  ),
  (
    '00000000-0000-4000-8000-000000000004',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'inactive@example.invalid',
    '',
    now(),
    '{}',
    '{}',
    now(),
    now()
  );

insert into public.profiles (id, display_name, role, is_active)
values
  (
    '00000000-0000-4000-8000-000000000001',
    '主管',
    'elevator_supervisor',
    true
  ),
  (
    '00000000-0000-4000-8000-000000000002',
    '工程师 A',
    'elevator_engineer',
    true
  ),
  (
    '00000000-0000-4000-8000-000000000003',
    '工程师 B',
    'elevator_engineer',
    true
  ),
  (
    '00000000-0000-4000-8000-000000000004',
    '停用主管',
    'elevator_supervisor',
    false
  );

insert into storage.objects (bucket_id, name, owner_id, metadata)
values
  (
    'work-order-media',
    'work-orders/00000000-0000-4000-8000-000000000001/10000000-0000-4000-8000-000000000001/20000000-0000-4000-8000-000000000001.jpg',
    '00000000-0000-4000-8000-000000000001',
    '{"mimetype":"image/jpeg","size":1024}'
  ),
  (
    'work-order-media',
    'work-orders/00000000-0000-4000-8000-000000000001/10000000-0000-4000-8000-000000000002/20000000-0000-4000-8000-000000000002.jpg',
    '00000000-0000-4000-8000-000000000001',
    '{"mimetype":"image/jpeg","size":2048}'
  );

select throws_ok(
  $$
    insert into public.work_orders (
      id,
      elevator_area,
      elevator_code,
      description,
      priority,
      status,
      created_by,
      assignee_id,
      started_at,
      closed_at
    )
    values (
      '10000000-0000-4000-8000-000000000099',
      'A 区',
      'L-99',
      '非法关闭状态',
      'normal',
      'closed',
      '00000000-0000-4000-8000-000000000001',
      '00000000-0000-4000-8000-000000000002',
      now(),
      now()
    )
  $$,
  '23514',
  null,
  'closed status requires a resolution'
);

set local role anon;
select throws_ok(
  $$ select * from public.list_active_engineers() $$,
  '42501',
  'permission denied for function list_active_engineers',
  'anonymous RPC execution is denied'
);
reset role;

select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000004',
  true
);
set local role authenticated;
select throws_ok(
  $$ select * from public.list_active_engineers() $$,
  'P0001',
  'ACCOUNT_DISABLED',
  'inactive account is rejected'
);
reset role;

select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000002',
  true
);
set local role authenticated;
select throws_ok(
  $$ select * from public.list_active_engineers() $$,
  'P0001',
  'ROLE_FORBIDDEN',
  'engineer cannot list all active engineers'
);
select throws_ok(
  $$
    insert into public.work_orders (
      id,
      elevator_area,
      elevator_code,
      description,
      created_by,
      assignee_id
    )
    values (
      '10000000-0000-4000-8000-000000000098',
      'A 区',
      'L-98',
      '非法直写',
      '00000000-0000-4000-8000-000000000001',
      '00000000-0000-4000-8000-000000000002'
    )
  $$,
  '42501',
  'permission denied for table work_orders',
  'authenticated client cannot write work_orders directly'
);
reset role;

select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000001',
  true
);
set local role authenticated;
select is(
  (select count(*)::integer from public.list_active_engineers()),
  2,
  'supervisor sees only active engineers'
);
select lives_ok(
  $$
    select *
    from public.create_work_order(
      '10000000-0000-4000-8000-000000000001',
      ' A 区 ',
      ' L-01 ',
      ' 门机异常 ',
      'urgent',
      '00000000-0000-4000-8000-000000000002',
      jsonb_build_array(
        jsonb_build_object(
          'id', '20000000-0000-4000-8000-000000000001',
          'path', 'work-orders/00000000-0000-4000-8000-000000000001/10000000-0000-4000-8000-000000000001/20000000-0000-4000-8000-000000000001.jpg',
          'position', 0
        )
      )
    )
  $$,
  'supervisor creates an assigned work order'
);
select ok(
  (
    select status = 'assigned'
      and version = 1
      and elevator_area = 'A 区'
    from public.work_orders
    where id = '10000000-0000-4000-8000-000000000001'
  )
  and (
    select count(*) = 1
    from public.work_order_attachments
    where work_order_id = '10000000-0000-4000-8000-000000000001'
  ),
  'create writes the normalized order and one attachment atomically'
);
select lives_ok(
  $$
    select *
    from public.create_work_order(
      '10000000-0000-4000-8000-000000000001',
      'A 区',
      'L-01',
      '门机异常',
      'urgent',
      '00000000-0000-4000-8000-000000000002',
      jsonb_build_array(
        jsonb_build_object(
          'id', '20000000-0000-4000-8000-000000000001',
          'path', 'work-orders/00000000-0000-4000-8000-000000000001/10000000-0000-4000-8000-000000000001/20000000-0000-4000-8000-000000000001.jpg',
          'position', 0
        )
      )
    )
  $$,
  'equivalent create retry returns the existing work order'
);
select is(
  (
    select count(*)::integer
    from public.work_orders
    where id = '10000000-0000-4000-8000-000000000001'
  ),
  1,
  'idempotent create does not duplicate the work order'
);
select lives_ok(
  $$
    select *
    from public.create_work_order(
      '10000000-0000-4000-8000-000000000002',
      'B 区',
      'L-02',
      '平层异常',
      'normal',
      '00000000-0000-4000-8000-000000000002',
      jsonb_build_array(
        jsonb_build_object(
          'id', '20000000-0000-4000-8000-000000000002',
          'path', 'work-orders/00000000-0000-4000-8000-000000000001/10000000-0000-4000-8000-000000000002/20000000-0000-4000-8000-000000000002.jpg',
          'position', 0
        )
      )
    )
  $$,
  'supervisor creates a second work order'
);
select lives_ok(
  $$
    select *
    from public.reassign_work_order(
      '10000000-0000-4000-8000-000000000002',
      '00000000-0000-4000-8000-000000000003',
      1
    )
  $$,
  'supervisor reassigns an assigned work order'
);
select ok(
  (
    select assignee_id = '00000000-0000-4000-8000-000000000003'
      and version = 2
    from public.work_orders
    where id = '10000000-0000-4000-8000-000000000002'
  ),
  'reassign changes assignee and increments version'
);
reset role;

select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000003',
  true
);
set local role authenticated;
select is(
  (
    select count(*)::integer
    from public.work_orders
    where id = '10000000-0000-4000-8000-000000000001'
  ),
  0,
  'other engineer cannot read the first work order'
);
select is(
  (
    select count(*)::integer
    from storage.objects
    where bucket_id = 'work-order-media'
      and name like '%10000000-0000-4000-8000-000000000001%'
  ),
  0,
  'other engineer cannot read the first work order media'
);
select throws_ok(
  $$
    select *
    from public.start_work_order(
      '10000000-0000-4000-8000-000000000001',
      1
    )
  $$,
  'P0001',
  'NOT_FOUND_OR_FORBIDDEN',
  'other engineer cannot start the first work order'
);
reset role;

select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000002',
  true
);
set local role authenticated;
select lives_ok(
  $$
    select *
    from public.start_work_order(
      '10000000-0000-4000-8000-000000000001',
      1
    )
  $$,
  'assigned engineer starts the work order'
);
select ok(
  (
    select status = 'in_progress'
      and version = 2
      and started_at is not null
    from public.work_orders
    where id = '10000000-0000-4000-8000-000000000001'
  ),
  'start moves to in_progress and increments version'
);
select throws_ok(
  $$
    select *
    from public.start_work_order(
      '10000000-0000-4000-8000-000000000001',
      1
    )
  $$,
  'P0001',
  'VERSION_CONFLICT',
  'stale version cannot overwrite current state'
);
select throws_ok(
  $$
    select *
    from public.close_work_order(
      '10000000-0000-4000-8000-000000000001',
      '   ',
      2
    )
  $$,
  'P0001',
  'RESOLUTION_REQUIRED',
  'close rejects an empty resolution'
);
select lives_ok(
  $$
    select *
    from public.close_work_order(
      '10000000-0000-4000-8000-000000000001',
      ' 更换门机皮带 ',
      2
    )
  $$,
  'assigned engineer closes the in-progress work order'
);
select ok(
  (
    select status = 'closed'
      and version = 3
      and resolution = '更换门机皮带'
      and started_at is not null
      and closed_at is not null
    from public.work_orders
    where id = '10000000-0000-4000-8000-000000000001'
  ),
  'close stores resolution and satisfies the closed invariant'
);
select is(
  (
    select count(*)::integer
    from public.work_orders
    where id = '10000000-0000-4000-8000-000000000002'
  ),
  0,
  'previous engineer cannot read a reassigned work order'
);

select * from finish();
rollback;
