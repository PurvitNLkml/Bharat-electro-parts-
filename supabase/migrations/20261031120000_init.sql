-- BharatElectroParts Phase 1
-- Public catalogue columns live on listings. Supplier identity and private
-- price breaks live on separate tables so a buyer select cannot return them.
-- Bids do not carry supplier_id. Ownership is bid_owners, revealed to the
-- buyer only after that bid is awarded. No aggregate over other bids is
-- exposed: a supplier's select policy can see only their own bid rows.

create extension if not exists pg_trgm;
create extension if not exists pgcrypto with schema extensions;

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

-- ---------------------------------------------------------------------------
-- Helpers. Security definer stays in the private schema.
-- ---------------------------------------------------------------------------

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

create or replace function private.current_supplier_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select supplier_id from public.supplier_private where user_id = auth.uid();
$$;

create or replace function private.current_buyer_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.buyers where user_id = auth.uid();
$$;

create or replace function private.current_manufacturer_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select manufacturer_id from public.manufacturer_accounts where user_id = auth.uid();
$$;

create or replace function private.owns_listing(listing uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.listing_owners
    where listing_id = listing and supplier_id = private.current_supplier_id()
  );
$$;

create or replace function private.owns_bid(bid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.bid_owners
    where bid_id = bid and supplier_id = private.current_supplier_id()
  );
$$;

create or replace function private.buyer_can_see_bid(bid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.bids b
    join public.rfq_lines l on l.id = b.rfq_line_id
    join public.rfqs r on r.id = l.rfq_id
    where b.id = bid and r.buyer_id = private.current_buyer_id()
  );
$$;

create or replace function private.bid_awarded_to_current_buyer(bid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.bids b
    join public.rfq_lines l on l.id = b.rfq_line_id and l.awarded_bid_id = b.id
    join public.rfqs r on r.id = l.rfq_id
    where b.id = bid and r.buyer_id = private.current_buyer_id()
  );
$$;

create or replace function private.supplier_is_verified(supplier uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.suppliers where id = supplier and status = 'verified'
  );
$$;

create or replace function private.gstin_ok(raw text)
returns boolean
language plpgsql
immutable
set search_path = public
as $$
declare
  g text := upper(regexp_replace(coalesce(raw, ''), '\s', '', 'g'));
  alphabet text := '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  i int;
  code int;
  product int;
  sum int := 0;
  check_char text;
begin
  if g !~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$' then
    return false;
  end if;
  for i in 1..14 loop
    code := position(substr(g, i, 1) in alphabet) - 1;
    product := code * (((i - 1) % 2) + 1);
    sum := sum + (product / 36) + (product % 36);
  end loop;
  check_char := substr(alphabet, ((36 - (sum % 36)) % 36) + 1, 1);
  return substr(g, 15, 1) = check_char;
end;
$$;

-- ---------------------------------------------------------------------------
-- Accounts
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null check (role in ('buyer', 'supplier', 'manufacturer', 'admin')),
  name text not null,
  email text not null unique,
  created_at timestamptz not null default now()
);

create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  company_name text not null,
  city text not null,
  state text not null,
  status text not null default 'pending' check (status in ('pending', 'verified', 'rejected')),
  created_at timestamptz not null default now()
);

create table public.supplier_private (
  supplier_id uuid primary key references public.suppliers (id) on delete cascade,
  user_id uuid not null unique references public.profiles (id) on delete cascade,
  contact_person text not null,
  mobile text not null,
  email text not null,
  gstin text not null unique,
  constraint supplier_gstin_format check (private.gstin_ok(gstin))
);

create table public.buyers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles (id) on delete cascade,
  name text not null,
  company text not null,
  email text not null,
  city text not null,
  mobile text not null default ''
);

create table public.manufacturers (
  id uuid primary key default gen_random_uuid(),
  brand_name text not null,
  slug text not null unique,
  description text not null default '',
  website text not null default '',
  created_at timestamptz not null default now()
);

create table public.manufacturer_accounts (
  manufacturer_id uuid primary key references public.manufacturers (id) on delete cascade,
  user_id uuid not null unique references public.profiles (id) on delete cascade
);

create table public.authorisations (
  manufacturer_id uuid not null references public.manufacturers (id) on delete cascade,
  supplier_id uuid not null references public.suppliers (id) on delete cascade,
  primary key (manufacturer_id, supplier_id)
);

-- ---------------------------------------------------------------------------
-- Stock. Identity and price breaks are not columns on the public catalogue.
-- ---------------------------------------------------------------------------

create table public.listings (
  id uuid primary key default gen_random_uuid(),
  mpn text not null,
  mpn_norm text generated always as (upper(regexp_replace(mpn, '[^A-Za-z0-9]', '', 'g'))) stored,
  manufacturer text not null,
  description text not null default '',
  category text not null,
  package text not null default '',
  qty integer not null check (qty >= 0),
  moq integer not null check (moq >= 0),
  gst_mode text not null check (gst_mode in ('inclusive', 'extra')),
  lead_time text not null default '',
  date_code text not null default '',
  city text not null,
  state text not null,
  last_updated timestamptz not null default now(),
  created_at timestamptz not null default now(),
  search_vector tsvector generated always as (
    setweight(to_tsvector('simple', coalesce(mpn, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(manufacturer, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(description, '')), 'C') ||
    setweight(to_tsvector('simple', coalesce(category, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(package, '')), 'D')
  ) stored,
  constraint listing_mpn_present check (char_length(trim(mpn)) >= 2)
);

create index listings_search_idx on public.listings using gin (search_vector);
create index listings_mpn_trgm_idx on public.listings using gin (mpn_norm gin_trgm_ops);
create index listings_category_idx on public.listings (category);
create index listings_fresh_idx on public.listings (last_updated desc);

create table public.listing_owners (
  listing_id uuid primary key references public.listings (id) on delete cascade,
  supplier_id uuid not null references public.suppliers (id) on delete cascade
);

create index listing_owners_supplier_idx on public.listing_owners (supplier_id);

create table public.listing_prices (
  listing_id uuid primary key references public.listings (id) on delete cascade,
  price_breaks jsonb not null default '[]'::jsonb,
  constraint price_breaks_max check (
    jsonb_typeof(price_breaks) = 'array' and jsonb_array_length(price_breaks) <= 5
  )
);

create or replace function private.stamp_listing_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  supplier uuid := private.current_supplier_id();
begin
  -- SQL seed and service-role maintenance insert listing_owners themselves.
  if auth.uid() is null then
    return new;
  end if;
  if supplier is null and not private.is_admin() then
    raise exception 'Only a supplier can publish stock';
  end if;
  insert into public.listing_owners (listing_id, supplier_id)
  values (new.id, supplier);
  return new;
end;
$$;

create trigger listings_stamp_owner
after insert on public.listings
for each row execute function private.stamp_listing_owner();

-- ---------------------------------------------------------------------------
-- BOMs and RFQs. Rows exist only when a submission inserts them.
-- ---------------------------------------------------------------------------

create table public.boms (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references public.buyers (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  constraint bom_name_present check (char_length(trim(name)) > 0)
);

create table public.bom_revisions (
  id uuid primary key default gen_random_uuid(),
  bom_id uuid not null references public.boms (id) on delete cascade,
  label text not null,
  note text not null default '',
  created_at timestamptz not null default now()
);

create table public.bom_lines (
  id uuid primary key default gen_random_uuid(),
  revision_id uuid not null references public.bom_revisions (id) on delete cascade,
  line_no integer not null check (line_no > 0),
  mpn text not null,
  manufacturer text not null default '',
  description text not null default '',
  qty integer not null check (qty > 0),
  refdes text not null default '',
  package text not null default '',
  constraint bom_line_mpn check (char_length(trim(mpn)) > 0)
);

create table public.rfqs (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references public.buyers (id) on delete cascade,
  title text not null,
  status text not null default 'open' check (status in ('open', 'awarded', 'closed')),
  notes text not null default '',
  created_at timestamptz not null default now(),
  awarded_at timestamptz,
  constraint rfq_title_present check (char_length(trim(title)) > 0)
);

create table public.rfq_lines (
  id uuid primary key default gen_random_uuid(),
  rfq_id uuid not null references public.rfqs (id) on delete cascade,
  line_no integer not null check (line_no > 0),
  mpn text not null,
  manufacturer text not null default '',
  description text not null default '',
  qty integer not null check (qty > 0),
  awarded_bid_id uuid,
  constraint rfq_line_mpn check (char_length(trim(mpn)) > 0)
);

create table public.rfq_routes (
  rfq_id uuid not null references public.rfqs (id) on delete cascade,
  supplier_id uuid not null references public.suppliers (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (rfq_id, supplier_id)
);

create table public.bids (
  id uuid primary key default gen_random_uuid(),
  rfq_line_id uuid not null references public.rfq_lines (id) on delete cascade,
  rate numeric,
  moq integer,
  stock integer,
  lead_time text not null default '',
  brand text not null default '',
  alternate_part text not null default '',
  date_code text not null default '',
  validity text not null default '',
  remarks text not null default '',
  attachment_path text,
  attachment_name text,
  cant_supply boolean not null default false,
  submitted_at timestamptz not null default now(),
  constraint bid_is_a_submission check (cant_supply or rate is not null),
  constraint bid_rate_nonnegative check (rate is null or rate >= 0)
);

alter table public.rfq_lines
  add constraint rfq_lines_awarded_bid_fk
  foreign key (awarded_bid_id) references public.bids (id) on delete set null;

create table public.bid_owners (
  bid_id uuid primary key references public.bids (id) on delete cascade,
  supplier_id uuid not null references public.suppliers (id) on delete cascade
);

create index bid_owners_supplier_idx on public.bid_owners (supplier_id);

create or replace function private.stamp_bid_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  supplier uuid := private.current_supplier_id();
begin
  if auth.uid() is null then
    return new;
  end if;
  if supplier is null or not private.supplier_is_verified(supplier) then
    raise exception 'Only a verified supplier can submit a bid';
  end if;
  if not exists (
    select 1 from public.rfq_lines l
    join public.rfq_routes rt on rt.rfq_id = l.rfq_id
    where l.id = new.rfq_line_id and rt.supplier_id = supplier and l.awarded_bid_id is null
  ) then
    raise exception 'This line is not open for your account';
  end if;
  if exists (
    select 1
    from public.bid_owners o
    join public.bids b on b.id = o.bid_id
    where b.rfq_line_id = new.rfq_line_id and o.supplier_id = supplier
  ) then
    raise exception 'You already submitted a bid on this line';
  end if;
  insert into public.bid_owners (bid_id, supplier_id) values (new.id, supplier);
  return new;
end;
$$;

create trigger bids_stamp_owner
after insert on public.bids
for each row execute function private.stamp_bid_owner();

create table public.fraud_flags (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('supplier', 'listing', 'bid', 'buyer')),
  entity_id uuid not null,
  reason text not null,
  created_at timestamptz not null default now(),
  resolved boolean not null default false
);

create or replace function private.flag_zero_rate()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1
    from jsonb_array_elements(new.price_breaks) break
    where (break->>'rate')::numeric = 0
  ) then
    insert into public.fraud_flags (entity_type, entity_id, reason)
    values ('listing', new.listing_id, 'Stock is listed with a zero rate.');
  end if;
  return new;
end;
$$;

create trigger listing_prices_flag_zero
after insert or update on public.listing_prices
for each row execute function private.flag_zero_rate();

-- ---------------------------------------------------------------------------
-- Search. Full text plus pg_trgm. Default results are the last 14 days.
-- ---------------------------------------------------------------------------

create or replace function public.search_listings(
  q text default '',
  category_slug text default null,
  city_name text default null,
  in_stock boolean default false,
  include_stale boolean default false
)
returns table (
  id uuid,
  mpn text,
  manufacturer text,
  description text,
  category text,
  package text,
  qty integer,
  moq integer,
  gst_mode text,
  lead_time text,
  date_code text,
  city text,
  state text,
  last_updated timestamptz,
  in_stock_now boolean
)
language sql
stable
security invoker
set search_path = public
as $$
  with needle as (
    select upper(regexp_replace(coalesce(q, ''), '[^A-Za-z0-9]', '', 'g')) as norm
  )
  select
    l.id, l.mpn, l.manufacturer, l.description, l.category, l.package,
    l.qty, l.moq, l.gst_mode, l.lead_time, l.date_code, l.city, l.state, l.last_updated,
    l.qty > 0 as in_stock_now
  from public.listings l
  cross join needle n
  where (include_stale or l.last_updated >= now() - interval '14 days')
    and (category_slug is null or category_slug = '' or l.category = category_slug)
    and (city_name is null or city_name = '' or l.city ilike city_name)
    and (not in_stock or l.qty > 0)
    and (
      q is null or length(trim(q)) = 0
      or l.search_vector @@ plainto_tsquery('simple', q)
      or (n.norm <> '' and (l.mpn_norm ilike '%' || n.norm || '%' or similarity(l.mpn_norm, n.norm) > 0.35))
    )
  order by
    case when n.norm <> '' and l.mpn_norm = n.norm then 0 else 1 end,
    similarity(l.mpn_norm, n.norm) desc,
    l.qty desc;
$$;

-- Buyer-only reveal. Empty unless this buyer awarded this exact bid.
create or replace function private.awarded_supplier(bid uuid)
returns table (company_name text, city text, email text, mobile text)
language sql
stable
security definer
set search_path = public
as $$
  select s.company_name, s.city, sp.email, sp.mobile
  from public.bids b
  join public.bid_owners o on o.bid_id = b.id
  join public.rfq_lines l on l.id = b.rfq_line_id and l.awarded_bid_id = b.id
  join public.rfqs r on r.id = l.rfq_id and r.buyer_id = private.current_buyer_id()
  join public.suppliers s on s.id = o.supplier_id
  join public.supplier_private sp on sp.supplier_id = s.id
  where b.id = bid;
$$;

create or replace function public.awarded_supplier(bid uuid)
returns table (company_name text, city text, email text, mobile text)
language sql
stable
security invoker
set search_path = public, private
as $$
  select * from private.awarded_supplier(bid);
$$;

create or replace function private.routed_buyer(rfq uuid)
returns table (company text, city text)
language sql
stable
security definer
set search_path = public
as $$
  select b.company, b.city
  from public.rfqs r
  join public.buyers b on b.id = r.buyer_id
  join public.rfq_routes rt on rt.rfq_id = r.id
  where r.id = rfq and rt.supplier_id = private.current_supplier_id();
$$;

create or replace function private.brand_stock(brand_slug text)
returns table (
  supplier_id uuid,
  company_name text,
  city text,
  state text,
  mpn text,
  qty integer,
  package text,
  stock_city text
)
language sql
stable
security definer
set search_path = public
as $$
  select s.id, s.company_name, s.city, s.state, l.mpn, l.qty, l.package, l.city
  from public.manufacturers m
  join public.authorisations a on a.manufacturer_id = m.id
  join public.suppliers s on s.id = a.supplier_id and s.status = 'verified'
  join public.listing_owners o on o.supplier_id = s.id
  join public.listings l on l.id = o.listing_id
  where m.slug = brand_slug
    and lower(l.manufacturer) = lower(m.brand_name)
    and l.last_updated >= now() - interval '14 days'
    and l.qty > 0;
$$;

create or replace function public.brand_stock(brand_slug text)
returns table (
  supplier_id uuid,
  company_name text,
  city text,
  state text,
  mpn text,
  qty integer,
  package text,
  stock_city text
)
language sql
stable
security invoker
set search_path = public, private
as $$
  select * from private.brand_stock(brand_slug);
$$;

create or replace function public.routed_buyer(rfq uuid)
returns table (company text, city text)
language sql
stable
security invoker
set search_path = public, private
as $$
  select * from private.routed_buyer(rfq);
$$;

-- Admin-only projection. security_invoker is off so the fixed column list can
-- join private tables; the predicate still requires private.is_admin(), which
-- reads the caller's JWT. Non-admins receive zero rows.
create or replace view public.admin_bid_sheet
with (security_barrier = true, security_invoker = false) as
select
  b.id as bid_id,
  b.rfq_line_id,
  l.rfq_id,
  l.line_no,
  l.mpn,
  b.rate,
  b.moq,
  b.stock,
  b.lead_time,
  b.brand,
  b.alternate_part,
  b.date_code,
  b.validity,
  b.remarks,
  b.attachment_path,
  b.attachment_name,
  b.cant_supply,
  b.submitted_at,
  o.supplier_id,
  s.company_name as supplier_company,
  s.city as supplier_city,
  sp.email as supplier_email,
  s.status as supplier_status
from public.bids b
join public.bid_owners o on o.bid_id = b.id
join public.suppliers s on s.id = o.supplier_id
join public.supplier_private sp on sp.supplier_id = s.id
join public.rfq_lines l on l.id = b.rfq_line_id
where private.is_admin();

create or replace view public.admin_supplier_sheet
with (security_barrier = true, security_invoker = false) as
select
  s.id,
  s.company_name,
  s.city,
  s.state,
  s.status,
  sp.user_id,
  sp.contact_person,
  sp.mobile,
  sp.email,
  sp.gstin
from public.suppliers s
join public.supplier_private sp on sp.supplier_id = s.id
where private.is_admin();

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.suppliers enable row level security;
alter table public.supplier_private enable row level security;
alter table public.buyers enable row level security;
alter table public.manufacturers enable row level security;
alter table public.manufacturer_accounts enable row level security;
alter table public.authorisations enable row level security;
alter table public.listings enable row level security;
alter table public.listing_owners enable row level security;
alter table public.listing_prices enable row level security;
alter table public.boms enable row level security;
alter table public.bom_revisions enable row level security;
alter table public.bom_lines enable row level security;
alter table public.rfqs enable row level security;
alter table public.rfq_lines enable row level security;
alter table public.rfq_routes enable row level security;
alter table public.bids enable row level security;
alter table public.bid_owners enable row level security;
alter table public.fraud_flags enable row level security;

revoke all on table public.profiles from anon, authenticated;
revoke all on table public.suppliers from anon, authenticated;
revoke all on table public.supplier_private from anon, authenticated;
revoke all on table public.buyers from anon, authenticated;
revoke all on table public.manufacturers from anon, authenticated;
revoke all on table public.manufacturer_accounts from anon, authenticated;
revoke all on table public.authorisations from anon, authenticated;
revoke all on table public.listings from anon, authenticated;
revoke all on table public.listing_owners from anon, authenticated;
revoke all on table public.listing_prices from anon, authenticated;
revoke all on table public.boms from anon, authenticated;
revoke all on table public.bom_revisions from anon, authenticated;
revoke all on table public.bom_lines from anon, authenticated;
revoke all on table public.rfqs from anon, authenticated;
revoke all on table public.rfq_lines from anon, authenticated;
revoke all on table public.rfq_routes from anon, authenticated;
revoke all on table public.bids from anon, authenticated;
revoke all on table public.bid_owners from anon, authenticated;
revoke all on table public.fraud_flags from anon, authenticated;

grant select, insert, update on public.profiles to authenticated;
grant select (id, company_name, city, state, status) on public.suppliers to anon, authenticated;
grant insert (id, company_name, city, state, status) on public.suppliers to authenticated;
grant update (company_name, city, state, status) on public.suppliers to authenticated;
grant select, insert, update on public.supplier_private to authenticated;
grant select, insert, update on public.buyers to authenticated;
grant select on public.manufacturers to anon, authenticated;
grant insert, update on public.manufacturers to authenticated;
grant select, insert on public.manufacturer_accounts to authenticated;
grant select on public.authorisations to anon, authenticated;
grant insert, delete on public.authorisations to authenticated;
grant select, insert, update, delete on public.listings to anon, authenticated;
revoke insert, update, delete on public.listings from anon;
grant select, insert, delete on public.listing_owners to authenticated;
grant select, insert, update, delete on public.listing_prices to authenticated;
grant select, insert on public.boms to authenticated;
grant select, insert on public.bom_revisions to authenticated;
grant select, insert on public.bom_lines to authenticated;
grant select, insert, update on public.rfqs to authenticated;
grant select, insert, update on public.rfq_lines to authenticated;
grant select, insert on public.rfq_routes to authenticated;
grant select, insert, update on public.bids to authenticated;
grant select on public.bid_owners to authenticated;
grant select, update on public.fraud_flags to authenticated;
grant select on public.admin_bid_sheet to authenticated;
grant select on public.admin_supplier_sheet to authenticated;

grant execute on function public.search_listings(text, text, text, boolean, boolean) to anon, authenticated;
grant execute on function public.awarded_supplier(uuid) to authenticated;
grant execute on function public.routed_buyer(uuid) to authenticated;
grant execute on function public.brand_stock(text) to anon, authenticated;
grant execute on function private.brand_stock(text) to anon, authenticated;
grant execute on function private.awarded_supplier(uuid) to authenticated;
grant execute on function private.routed_buyer(uuid) to authenticated;
grant execute on function private.is_admin() to authenticated;
grant execute on function private.current_supplier_id() to authenticated;
grant execute on function private.current_buyer_id() to authenticated;
grant execute on function private.current_manufacturer_id() to authenticated;
grant execute on function private.owns_listing(uuid) to authenticated;
grant execute on function private.owns_bid(uuid) to authenticated;
grant execute on function private.buyer_can_see_bid(uuid) to authenticated;
grant execute on function private.bid_awarded_to_current_buyer(uuid) to authenticated;
grant execute on function private.supplier_is_verified(uuid) to authenticated;
grant execute on function private.gstin_ok(text) to authenticated;

create or replace function private.protect_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' and new.role not in ('buyer', 'supplier', 'manufacturer') and not private.is_admin() then
    raise exception 'That role cannot be self-assigned';
  end if;
  if tg_op = 'UPDATE' and new.role is distinct from old.role and not private.is_admin() then
    raise exception 'Role changes are limited to an administrator';
  end if;
  return new;
end;
$$;

create trigger profiles_protect_role
before insert or update on public.profiles
for each row execute function private.protect_profile_role();

create policy profiles_select on public.profiles
for select to authenticated
using (id = auth.uid() or private.is_admin());

create policy profiles_insert on public.profiles
for insert to authenticated
with check (id = auth.uid() and role in ('buyer', 'supplier', 'manufacturer'));

create policy profiles_update on public.profiles
for update to authenticated
using (id = auth.uid() or private.is_admin())
with check (id = auth.uid() or private.is_admin());

create policy suppliers_select_anon on public.suppliers
for select to anon
using (
  status = 'verified' and exists (
    select 1 from public.authorisations a where a.supplier_id = suppliers.id
  )
);

create policy suppliers_select_auth on public.suppliers
for select to authenticated
using (
  private.is_admin()
  or id = private.current_supplier_id()
  or (
    status = 'verified' and exists (
      select 1 from public.authorisations a where a.supplier_id = suppliers.id
    )
  )
  or exists (
    select 1
    from public.bid_owners o
    join public.bids b on b.id = o.bid_id
    join public.rfq_lines l on l.id = b.rfq_line_id and l.awarded_bid_id = b.id
    join public.rfqs r on r.id = l.rfq_id
    where o.supplier_id = suppliers.id and r.buyer_id = private.current_buyer_id()
  )
);

create policy suppliers_insert on public.suppliers
for insert to authenticated
with check (private.current_supplier_id() is null or private.is_admin());

create policy suppliers_update on public.suppliers
for update to authenticated
using (id = private.current_supplier_id() or private.is_admin())
with check (id = private.current_supplier_id() or private.is_admin());

create or replace function private.protect_supplier_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is distinct from old.status and not private.is_admin() then
    raise exception 'Only an administrator can change supplier status';
  end if;
  return new;
end;
$$;

create trigger suppliers_protect_status
before update on public.suppliers
for each row execute function private.protect_supplier_status();

create policy supplier_private_all on public.supplier_private
for all to authenticated
using (user_id = auth.uid() or private.is_admin())
with check (user_id = auth.uid() or private.is_admin());

create policy buyers_all on public.buyers
for all to authenticated
using (user_id = auth.uid() or private.is_admin())
with check (user_id = auth.uid() or private.is_admin());

create policy manufacturers_select on public.manufacturers
for select to anon, authenticated
using (true);

create policy manufacturers_write on public.manufacturers
for insert to authenticated
with check (true);

create policy manufacturers_update on public.manufacturers
for update to authenticated
using (id = private.current_manufacturer_id() or private.is_admin())
with check (id = private.current_manufacturer_id() or private.is_admin());

create policy manufacturer_accounts_all on public.manufacturer_accounts
for all to authenticated
using (user_id = auth.uid() or private.is_admin())
with check (user_id = auth.uid() or private.is_admin());

create policy authorisations_select on public.authorisations
for select to anon, authenticated
using (true);

create policy authorisations_write on public.authorisations
for insert to authenticated
with check (private.is_admin());

create policy authorisations_delete on public.authorisations
for delete to authenticated
using (private.is_admin());

create policy listings_select on public.listings
for select to anon, authenticated
using (true);

create policy listings_insert on public.listings
for insert to authenticated
with check (private.current_supplier_id() is not null or private.is_admin());

create policy listings_update on public.listings
for update to authenticated
using (private.owns_listing(id) or private.is_admin())
with check (private.owns_listing(id) or private.is_admin());

create policy listings_delete on public.listings
for delete to authenticated
using (private.owns_listing(id) or private.is_admin());

create policy listing_owners_select on public.listing_owners
for select to authenticated
using (supplier_id = private.current_supplier_id() or private.is_admin());

create policy listing_prices_all on public.listing_prices
for all to authenticated
using (private.owns_listing(listing_id) or private.is_admin())
with check (private.owns_listing(listing_id) or private.is_admin());

create policy boms_all on public.boms
for all to authenticated
using (buyer_id = private.current_buyer_id() or private.is_admin())
with check (buyer_id = private.current_buyer_id() or private.is_admin());

create policy bom_revisions_all on public.bom_revisions
for all to authenticated
using (
  private.is_admin() or exists (
    select 1 from public.boms b
    where b.id = bom_revisions.bom_id and b.buyer_id = private.current_buyer_id()
  )
)
with check (
  private.is_admin() or exists (
    select 1 from public.boms b
    where b.id = bom_revisions.bom_id and b.buyer_id = private.current_buyer_id()
  )
);

create policy bom_lines_all on public.bom_lines
for all to authenticated
using (
  private.is_admin() or exists (
    select 1 from public.bom_revisions rev
    join public.boms b on b.id = rev.bom_id
    where rev.id = bom_lines.revision_id and b.buyer_id = private.current_buyer_id()
  )
)
with check (
  private.is_admin() or exists (
    select 1 from public.bom_revisions rev
    join public.boms b on b.id = rev.bom_id
    where rev.id = bom_lines.revision_id and b.buyer_id = private.current_buyer_id()
  )
);

create policy rfqs_select on public.rfqs
for select to authenticated
using (
  buyer_id = private.current_buyer_id()
  or private.is_admin()
  or exists (
    select 1 from public.rfq_routes rt
    where rt.rfq_id = rfqs.id and rt.supplier_id = private.current_supplier_id()
  )
);

create policy rfqs_insert on public.rfqs
for insert to authenticated
with check (buyer_id = private.current_buyer_id());

create policy rfqs_update on public.rfqs
for update to authenticated
using (buyer_id = private.current_buyer_id() or private.is_admin())
with check (buyer_id = private.current_buyer_id() or private.is_admin());

create policy rfq_lines_select on public.rfq_lines
for select to authenticated
using (
  private.is_admin()
  or exists (
    select 1 from public.rfqs r
    where r.id = rfq_lines.rfq_id and (
      r.buyer_id = private.current_buyer_id()
      or exists (
        select 1 from public.rfq_routes rt
        where rt.rfq_id = r.id and rt.supplier_id = private.current_supplier_id()
      )
    )
  )
);

create policy rfq_lines_insert on public.rfq_lines
for insert to authenticated
with check (
  exists (
    select 1 from public.rfqs r
    where r.id = rfq_lines.rfq_id and r.buyer_id = private.current_buyer_id()
  )
);

create policy rfq_lines_update on public.rfq_lines
for update to authenticated
using (private.is_admin())
with check (private.is_admin());

create policy rfq_routes_select on public.rfq_routes
for select to authenticated
using (supplier_id = private.current_supplier_id() or private.is_admin());

create policy rfq_routes_insert on public.rfq_routes
for insert to authenticated
with check (private.is_admin());

-- SEALED: a supplier reads only bids they own. A buyer reads quotes on their
-- RFQ but not bid_owners, so the supplier name stays hidden until award.
create policy bids_select on public.bids
for select to authenticated
using (
  private.is_admin()
  or private.owns_bid(id)
  or private.buyer_can_see_bid(id)
);

create policy bids_insert on public.bids
for insert to authenticated
with check (private.current_supplier_id() is not null);

create policy bids_update on public.bids
for update to authenticated
using (private.owns_bid(id) and not exists (
  select 1 from public.rfq_lines l where l.id = bids.rfq_line_id and l.awarded_bid_id is not null
))
with check (private.owns_bid(id));

create policy bid_owners_select on public.bid_owners
for select to authenticated
using (
  supplier_id = private.current_supplier_id()
  or private.is_admin()
  or private.bid_awarded_to_current_buyer(bid_id)
);

create policy flags_admin on public.fraud_flags
for select to authenticated
using (private.is_admin());

create policy flags_admin_update on public.fraud_flags
for update to authenticated
using (private.is_admin())
with check (private.is_admin());

-- ---------------------------------------------------------------------------
-- Private storage. Objects are not public. Clients use signed URLs.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit)
values ('bid-attachments', 'bid-attachments', false, 5242880)
on conflict (id) do update set public = false, file_size_limit = 5242880;

create or replace function private.can_read_bid_file(object_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.bids b
    join public.bid_owners o on o.bid_id = b.id
    join public.rfq_lines l on l.id = b.rfq_line_id
    join public.rfqs r on r.id = l.rfq_id
    where b.attachment_path = object_name
      and (
        o.supplier_id = private.current_supplier_id()
        or r.buyer_id = private.current_buyer_id()
        or private.is_admin()
      )
  );
$$;

grant execute on function private.can_read_bid_file(text) to authenticated;

create policy bid_attachments_insert on storage.objects
for insert to authenticated
with check (
  bucket_id = 'bid-attachments'
  and (storage.foldername(name))[1] = private.current_supplier_id()::text
);

create policy bid_attachments_select on storage.objects
for select to authenticated
using (
  bucket_id = 'bid-attachments'
  and private.can_read_bid_file(name)
);

create policy bid_attachments_update on storage.objects
for update to authenticated
using (
  bucket_id = 'bid-attachments'
  and (storage.foldername(name))[1] = private.current_supplier_id()::text
)
with check (
  bucket_id = 'bid-attachments'
  and (storage.foldername(name))[1] = private.current_supplier_id()::text
);
