-- Seed for a fresh Supabase database. Demo mode does not read this file;
-- the app has its own seed when Supabase env vars are empty.
-- Run after supabase/migrations/20261031120000_init.sql.
-- Auth inserts match a local Supabase stack. If a hosted project rejects a
-- column, create the users with email OTP in the app and skip this file.

create extension if not exists pgcrypto with schema extensions;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
) values
  ('00000000-0000-0000-0000-000000000000', '11111111-1111-4111-8111-111111111111', 'authenticated', 'authenticated', 'asha@rivergate.example', extensions.crypt('unused', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '22222222-2222-4222-8222-222222222222', 'authenticated', 'authenticated', 'rohan@kiln.example', extensions.crypt('unused', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '33333333-3333-4333-8333-333333333333', 'authenticated', 'authenticated', 'priya@mehtacomponents.example', extensions.crypt('unused', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '44444444-4444-4444-8444-444444444444', 'authenticated', 'authenticated', 'arjun@punecircuit.example', extensions.crypt('unused', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '55555555-5555-4555-8555-555555555555', 'authenticated', 'authenticated', 'neha@noidasemi.example', extensions.crypt('unused', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '66666666-6666-4666-8666-666666666666', 'authenticated', 'authenticated', 'joseph@kochiharbour.example', extensions.crypt('unused', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '77777777-7777-4777-8777-777777777777', 'authenticated', 'authenticated', 'leela@northwind.example', extensions.crypt('unused', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '88888888-8888-4888-8888-888888888888', 'authenticated', 'authenticated', 'admin@sonani.example', extensions.crypt('unused', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '')
on conflict (id) do nothing;

insert into auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), id, jsonb_build_object('sub', id::text, 'email', email), 'email', id::text, now(), now(), now()
from auth.users
where email like '%@%.example'
on conflict do nothing;

insert into public.profiles (id, role, name, email) values
  ('11111111-1111-4111-8111-111111111111', 'buyer', 'Asha Iyer', 'asha@rivergate.example'),
  ('22222222-2222-4222-8222-222222222222', 'buyer', 'Rohan Desai', 'rohan@kiln.example'),
  ('33333333-3333-4333-8333-333333333333', 'supplier', 'Priya Mehta', 'priya@mehtacomponents.example'),
  ('44444444-4444-4444-8444-444444444444', 'supplier', 'Arjun Kulkarni', 'arjun@punecircuit.example'),
  ('55555555-5555-4555-8555-555555555555', 'supplier', 'Neha Sharma', 'neha@noidasemi.example'),
  ('66666666-6666-4666-8666-666666666666', 'supplier', 'Joseph Mathew', 'joseph@kochiharbour.example'),
  ('77777777-7777-4777-8777-777777777777', 'manufacturer', 'Leela Krishnan', 'leela@northwind.example'),
  ('88888888-8888-4888-8888-888888888888', 'admin', 'Sonani Admin', 'admin@sonani.example')
on conflict (id) do nothing;

insert into public.buyers (id, user_id, name, company, email, city, mobile) values
  ('b1111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111', 'Asha Iyer', 'Rivergate Systems', 'asha@rivergate.example', 'Bengaluru', '9845012345'),
  ('b2222222-2222-4222-8222-222222222222', '22222222-2222-4222-8222-222222222222', 'Rohan Desai', 'Kiln Labs', 'rohan@kiln.example', 'Pune', '9765432109')
on conflict (id) do nothing;

insert into public.suppliers (id, company_name, city, state, status) values
  ('a1111111-1111-4111-8111-111111111111', 'Mehta Components', 'Ahmedabad', 'Gujarat', 'verified'),
  ('a2222222-2222-4222-8222-222222222222', 'Pune Circuit House', 'Pune', 'Maharashtra', 'verified'),
  ('a3333333-3333-4333-8333-333333333333', 'Noida Semiconductor Desk', 'Noida', 'Uttar Pradesh', 'verified'),
  ('a4444444-4444-4444-8444-444444444444', 'Kochi Harbour Electronics', 'Kochi', 'Kerala', 'pending')
on conflict (id) do nothing;

insert into public.supplier_private (supplier_id, user_id, contact_person, mobile, email, gstin) values
  ('a1111111-1111-4111-8111-111111111111', '33333333-3333-4333-8333-333333333333', 'Priya Mehta', '9825011122', 'priya@mehtacomponents.example', '24AABCM1234R1ZE'),
  ('a2222222-2222-4222-8222-222222222222', '44444444-4444-4444-8444-444444444444', 'Arjun Kulkarni', '9881122334', 'arjun@punecircuit.example', '27AAPCP5678Q1Z5'),
  ('a3333333-3333-4333-8333-333333333333', '55555555-5555-4555-8555-555555555555', 'Neha Sharma', '9810099887', 'neha@noidasemi.example', '09AADCN2468L1Z1'),
  ('a4444444-4444-4444-8444-444444444444', '66666666-6666-4666-8666-666666666666', 'Joseph Mathew', '9847011122', 'joseph@kochiharbour.example', '32AAECK1357P1ZC')
on conflict (supplier_id) do nothing;

insert into public.manufacturers (id, brand_name, slug, description, website) values
  ('c1111111-1111-4111-8111-111111111111', 'Northwind Silicon', 'northwind-silicon', 'Northwind Silicon designs small-signal power parts. Authorised stockists publish the quantities they hold.', 'https://northwind.example')
on conflict (id) do nothing;

insert into public.manufacturer_accounts (manufacturer_id, user_id) values
  ('c1111111-1111-4111-8111-111111111111', '77777777-7777-4777-8777-777777777777')
on conflict (manufacturer_id) do nothing;

insert into public.authorisations (manufacturer_id, supplier_id) values
  ('c1111111-1111-4111-8111-111111111111', 'a1111111-1111-4111-8111-111111111111'),
  ('c1111111-1111-4111-8111-111111111111', 'a2222222-2222-4222-8222-222222222222')
on conflict do nothing;

insert into public.listings (id, mpn, manufacturer, description, category, package, qty, moq, gst_mode, lead_time, date_code, city, state, last_updated) values
  ('d1111111-1111-4111-8111-111111111111', 'STM32F103C8T6', 'STMicroelectronics', 'Cortex-M3 microcontroller', 'microcontrollers', 'LQFP-48', 2400, 10, 'extra', 'Ready stock', '2432', 'Ahmedabad', 'Gujarat', now() - interval '1 day'),
  ('d2222222-2222-4222-8222-222222222222', 'STM32F103C8T6', 'STMicroelectronics', 'Cortex-M3 microcontroller', 'microcontrollers', 'LQFP-48', 800, 5, 'inclusive', 'Ready stock', '2418', 'Pune', 'Maharashtra', now() - interval '2 days'),
  ('d3333333-3333-4333-8333-333333333333', 'NW-LDO-33', 'Northwind Silicon', '300 mA LDO, 3.3 V', 'power', 'SOIC-8', 1500, 10, 'extra', 'Ready stock', '2514', 'Ahmedabad', 'Gujarat', now() - interval '1 day'),
  ('d4444444-4444-4444-8444-444444444444', 'NW-LDO-33', 'Northwind Silicon', '300 mA LDO, 3.3 V', 'power', 'SOIC-8', 400, 10, 'inclusive', 'Ready stock', '2508', 'Pune', 'Maharashtra', now() - interval '3 days'),
  ('d5555555-5555-4555-8555-555555555555', 'BME280', 'Bosch Sensortec', 'Humidity sensor', 'sensors', 'LGA-8', 400, 5, 'extra', 'Ready stock', '2511', 'Pune', 'Maharashtra', now() - interval '1 day'),
  ('d6666666-6666-4666-8666-666666666666', 'TLP281-4', 'Toshiba', 'Quad photocoupler', 'electromechanical', 'SOP-16', 3000, 20, 'extra', 'Ready stock', '2450', 'Pune', 'Maharashtra', now() - interval '2 days'),
  ('d7777777-7777-4777-8777-777777777777', 'NE555P', 'Texas Instruments', 'Timer', 'discretes', 'PDIP-8', 2000, 10, 'extra', 'Ready stock', '2310', 'Ahmedabad', 'Gujarat', now() - interval '30 days'),
  ('d8888888-8888-4888-8888-888888888888', 'HDR-2.54-1X40', 'Local pin header', '2.54 mm pin header', 'connectors', 'TH', 500, 10, 'extra', 'Ready stock', '2509', 'Noida', 'Uttar Pradesh', now() - interval '1 day')
on conflict (id) do nothing;

insert into public.listing_owners (listing_id, supplier_id) values
  ('d1111111-1111-4111-8111-111111111111', 'a1111111-1111-4111-8111-111111111111'),
  ('d2222222-2222-4222-8222-222222222222', 'a2222222-2222-4222-8222-222222222222'),
  ('d3333333-3333-4333-8333-333333333333', 'a1111111-1111-4111-8111-111111111111'),
  ('d4444444-4444-4444-8444-444444444444', 'a2222222-2222-4222-8222-222222222222'),
  ('d5555555-5555-4555-8555-555555555555', 'a2222222-2222-4222-8222-222222222222'),
  ('d6666666-6666-4666-8666-666666666666', 'a2222222-2222-4222-8222-222222222222'),
  ('d7777777-7777-4777-8777-777777777777', 'a1111111-1111-4111-8111-111111111111'),
  ('d8888888-8888-4888-8888-888888888888', 'a3333333-3333-4333-8333-333333333333')
on conflict (listing_id) do nothing;

insert into public.listing_prices (listing_id, price_breaks) values
  ('d1111111-1111-4111-8111-111111111111', '[{"minQty":10,"rate":186.4}]'),
  ('d3333333-3333-4333-8333-333333333333', '[{"minQty":10,"rate":13.37}]'),
  ('d5555555-5555-4555-8555-555555555555', '[{"minQty":5,"rate":95}]'),
  ('d8888888-8888-4888-8888-888888888888', '[{"minQty":10,"rate":0}]')
on conflict (listing_id) do nothing;

insert into public.boms (id, buyer_id, name) values
  ('e1111111-1111-4111-8111-111111111111', 'b1111111-1111-4111-8111-111111111111', 'Gate driver board')
on conflict (id) do nothing;

insert into public.bom_revisions (id, bom_id, label, note) values
  ('f1111111-1111-4111-8111-111111111111', 'e1111111-1111-4111-8111-111111111111', 'R1', 'First spin'),
  ('f2222222-2222-4222-8222-222222222222', 'e1111111-1111-4111-8111-111111111111', 'R2', 'MCU update')
on conflict (id) do nothing;

insert into public.bom_lines (revision_id, line_no, mpn, manufacturer, description, qty, refdes, package) values
  ('f1111111-1111-4111-8111-111111111111', 1, 'STM32F103C8T6', 'STMicroelectronics', 'MCU', 2, 'U1', 'LQFP-48'),
  ('f1111111-1111-4111-8111-111111111111', 2, 'CUSTOM-CONN-9PIN', 'Local fab', 'Connector', 1, 'J1', ''),
  ('f2222222-2222-4222-8222-222222222222', 1, 'STM32G474RET6', 'STMicroelectronics', 'MCU', 1, 'U1', 'LQFP-64'),
  ('f2222222-2222-4222-8222-222222222222', 2, 'STM32F103C8T6-TR', 'STMicroelectronics', 'Tape and reel', 1, 'U5', 'LQFP-48');

insert into public.rfqs (id, buyer_id, title, status, notes, awarded_at) values
  ('91111111-1111-4111-8111-111111111111', 'b1111111-1111-4111-8111-111111111111', 'Connector and optocoupler', 'open', 'Sealed quotes for lines that are not a straight stock buy.', null),
  ('92222222-2222-4222-8222-222222222222', 'b1111111-1111-4111-8111-111111111111', 'Sensor bring-up', 'awarded', 'Awarded on the humidity sensor line.', now() - interval '1 day')
on conflict (id) do nothing;

insert into public.rfq_lines (id, rfq_id, line_no, mpn, manufacturer, description, qty) values
  ('81111111-1111-4111-8111-111111111111', '91111111-1111-4111-8111-111111111111', 1, 'CUSTOM-CONN-9PIN', 'Local fab', '9-pin connector', 50),
  ('82222222-2222-4222-8222-222222222222', '91111111-1111-4111-8111-111111111111', 2, 'TLP281-4', 'Toshiba', 'Quad photocoupler', 100),
  ('83333333-3333-4333-8333-333333333333', '92222222-2222-4222-8222-222222222222', 1, 'BME280', 'Bosch Sensortec', 'Humidity sensor', 25)
on conflict (id) do nothing;

insert into public.rfq_routes (rfq_id, supplier_id) values
  ('91111111-1111-4111-8111-111111111111', 'a1111111-1111-4111-8111-111111111111'),
  ('91111111-1111-4111-8111-111111111111', 'a2222222-2222-4222-8222-222222222222'),
  ('91111111-1111-4111-8111-111111111111', 'a3333333-3333-4333-8333-333333333333'),
  ('92222222-2222-4222-8222-222222222222', 'a1111111-1111-4111-8111-111111111111'),
  ('92222222-2222-4222-8222-222222222222', 'a2222222-2222-4222-8222-222222222222')
on conflict do nothing;

insert into public.bids (id, rfq_line_id, rate, moq, stock, lead_time, brand, date_code, validity, remarks, cant_supply) values
  ('71111111-1111-4111-8111-111111111111', '81111111-1111-4111-8111-111111111111', 17.35, 10, 40, 'Ready stock', 'As listed', '2514', '2026-11-30', 'Can offer a tooled equivalent.', false),
  ('72222222-2222-4222-8222-222222222222', '81111111-1111-4111-8111-111111111111', 41.80, 10, 40, 'Ready stock', 'As listed', '2514', '2026-11-30', 'Tooled with a partner.', false),
  ('73333333-3333-4333-8333-333333333333', '81111111-1111-4111-8111-111111111111', null, null, null, '', '', '', '', 'Cannot supply this connector.', true),
  ('74444444-4444-4444-8444-444444444444', '82222222-2222-4222-8222-222222222222', 6.25, 10, 40, 'Ready stock', 'Toshiba', '2450', '2026-11-30', 'Date code 2450 on hand.', false),
  ('75555555-5555-4555-8555-555555555555', '83333333-3333-4333-8333-333333333333', 88.40, 10, 40, 'Ready stock', 'Bosch', '2511', '2026-11-30', 'Sealed tray.', false),
  ('76666666-6666-4666-8666-666666666666', '83333333-3333-4333-8333-333333333333', 93.10, 10, 40, 'Ready stock', 'Bosch', '2511', '2026-11-30', 'Cut tape.', false)
on conflict (id) do nothing;

insert into public.bid_owners (bid_id, supplier_id) values
  ('71111111-1111-4111-8111-111111111111', 'a1111111-1111-4111-8111-111111111111'),
  ('72222222-2222-4222-8222-222222222222', 'a2222222-2222-4222-8222-222222222222'),
  ('73333333-3333-4333-8333-333333333333', 'a3333333-3333-4333-8333-333333333333'),
  ('74444444-4444-4444-8444-444444444444', 'a2222222-2222-4222-8222-222222222222'),
  ('75555555-5555-4555-8555-555555555555', 'a1111111-1111-4111-8111-111111111111'),
  ('76666666-6666-4666-8666-666666666666', 'a2222222-2222-4222-8222-222222222222')
on conflict (bid_id) do nothing;

update public.rfq_lines set awarded_bid_id = '75555555-5555-4555-8555-555555555555'
where id = '83333333-3333-4333-8333-333333333333';

insert into public.fraud_flags (entity_type, entity_id, reason)
values ('supplier', 'a4444444-4444-4444-8444-444444444444', 'Signup looked automated, and the GSTIN is not yet matched to the name on the application.')
on conflict do nothing;
