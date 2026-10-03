-- ============================================================
-- SQUASHBERRYPAY V2 DATABASE
-- Business accounts are immediately active.
-- Applications/services require owner approval.
-- ============================================================

create extension if not exists pgcrypto;


-- ============================================================
-- MERCHANT / BUSINESS ACCOUNT
-- ============================================================

create table if not exists public.merchant_profiles (
    id uuid primary key default gen_random_uuid(),

    owner_user_id uuid not null unique
        references auth.users(id)
        on delete cascade,

    business_name text not null,

    business_type text,

    email text not null,

    phone text,

    website text,

    description text,

    status text not null default 'active'
        check (
            status in (
                'active',
                'suspended',
                'disabled'
            )
        ),

    created_at timestamptz not null default now(),

    updated_at timestamptz not null default now()
);


-- ============================================================
-- APPLICATIONS / SERVICES
-- THIS is what requires approval
-- ============================================================

create table if not exists public.services (
    id uuid primary key default gen_random_uuid(),

    merchant_id uuid not null
        references public.merchant_profiles(id)
        on delete cascade,

    name text not null,

    slug text not null unique,

    website_url text,

    platform_type text,

    client_id text not null unique,

    client_secret_hash text not null,

    status text not null default 'pending'
        check (
            status in (
                'pending',
                'active',
                'suspended',
                'disabled',
                'rejected'
            )
        ),

    created_at timestamptz not null default now(),

    updated_at timestamptz not null default now()
);


-- ============================================================
-- SERVICE USERS
-- ============================================================

create table if not exists public.service_users (
    id uuid primary key default gen_random_uuid(),

    service_id uuid not null
        references public.services(id)
        on delete cascade,

    external_user_id text not null,

    email text not null,

    created_at timestamptz not null default now(),

    unique (
        service_id,
        external_user_id
    )
);


-- ============================================================
-- PRODUCTS
-- ============================================================

create table if not exists public.products (
    id uuid primary key default gen_random_uuid(),

    service_id uuid not null
        references public.services(id)
        on delete cascade,

    product_code text not null,

    name text not null,

    description text,

    payment_type text not null default 'pay_now'
        check (
            payment_type in (
                'pay_now',
                'subscribe',
                'donate'
            )
        ),

    amount numeric(12,2),

    currency text not null default 'GMD',

    subscription_interval text
        check (
            subscription_interval is null
            or subscription_interval in (
                'monthly',
                'yearly'
            )
        ),

    allow_custom_amount boolean not null default false,
    
    donation_goal numeric(12,2),

    donation_minimum numeric(12,2),

    donation_maximum numeric(12,2),

    donation_presets jsonb not null default '[]'::jsonb,

    donation_goal_message text,

    donation_end_at timestamptz,

    show_donation_goal boolean not null default true,

    show_donor_count boolean not null default true,

    close_on_goal boolean not null default false,

    status text not null default 'active'
        check (
            status in (
                'active',
                'inactive'
            )
        ),

    created_at timestamptz not null default now(),

    updated_at timestamptz not null default now(),

    unique (
        service_id,
        product_code
    ),
    
    constraint products_donation_goal_positive
        check (
            donation_goal is null
            or donation_goal > 0
        ),

    constraint products_donation_minimum_positive
        check (
            donation_minimum is null
            or donation_minimum > 0
        ),

    constraint products_donation_maximum_positive
        check (
            donation_maximum is null
            or donation_maximum > 0
        ),

    constraint products_donation_range_valid
        check (
            donation_minimum is null
            or donation_maximum is null
            or donation_maximum >= donation_minimum
        ),

    constraint products_donation_presets_array
        check (
            jsonb_typeof(donation_presets) = 'array'
        )
);


-- ============================================================
-- PAYMENT METHODS
-- Each app has its own payment destinations
-- ============================================================

create table if not exists public.payment_methods (
    id uuid primary key default gen_random_uuid(),

    service_id uuid not null
        references public.services(id)
        on delete cascade,

    name text not null,

    type text not null
        check (
            type in (
                'wave',
                'aps',
                'nada',
                'bank',
                'other'
            )
        ),

    icon_path text,

    instructions text not null,

    account_name text,

    account_number text,

    bank_name text,

    phone_number text,

    enabled boolean not null default true,

    created_at timestamptz not null default now(),

    updated_at timestamptz not null default now()
);


create unique index if not exists idx_payment_method_service_name
on public.payment_methods(service_id, name);




-- ============================================================
-- HOSTED PAYMENT LINKS
-- Public checkout links/buttons that work on any website/app
-- ============================================================

create table if not exists public.payment_links (
    id uuid primary key default gen_random_uuid(),

    service_id uuid not null
        references public.services(id)
        on delete cascade,

    product_id uuid not null
        references public.products(id)
        on delete restrict,

    slug text not null unique,

    title text not null,

    description text,

    button_label text not null default 'Pay Now',

    return_url text,

    cancel_url text,

    status text not null default 'active'
        check (
            status in (
                'active',
                'inactive'
            )
        ),

    created_at timestamptz not null default now(),

    updated_at timestamptz not null default now()
);

-- ============================================================
-- PAYMENTS
-- ============================================================

create table if not exists public.payments (
    id uuid primary key default gen_random_uuid(),

    payment_reference text not null unique,

    service_id uuid not null
        references public.services(id)
        on delete restrict,

    service_user_id uuid not null
        references public.service_users(id)
        on delete restrict,

    product_id uuid
        references public.products(id)
        on delete restrict,

    payment_method_id uuid
        references public.payment_methods(id)
        on delete restrict,

    amount numeric(12,2) not null
        check (amount > 0),

    currency text not null default 'GMD',

    payment_type text not null default 'pay_now'
        check (
            payment_type in (
                'pay_now',
                'subscribe',
                'donate'
            )
        ),

    status text not null default 'pending'
        check (
            status in (
                'pending',
                'awaiting_receipt',
                'awaiting_verification',
                'approved',
                'rejected',
                'expired',
                'cancelled',
                'completed'
            )
        ),

    return_url text,

    cancel_url text,

    donor_name text,

    donor_message text,

    donor_anonymous boolean not null default false,

    receipt_path text,

    receipt_uploaded_at timestamptz,

    payment_started_at timestamptz,

    payment_deadline_at timestamptz,

    rejection_reason text,

    cancel_reason text,

    cancelled_at timestamptz,

    approved_at timestamptz,

    completed_at timestamptz,

    created_at timestamptz not null default now(),

    expires_at timestamptz



-- ============================================================
-- PAYMENT SESSIONS
-- ============================================================

create table if not exists public.payment_sessions (
    id uuid primary key default gen_random_uuid(),

    payment_id uuid not null unique
        references public.payments(id)
        on delete cascade,

    session_token_hash text not null unique,

    expires_at timestamptz not null,

    created_at timestamptz not null default now()
);


-- ============================================================
-- ONE-TIME PAYMENT TOKENS
-- ============================================================

create table if not exists public.payment_tokens (
    id uuid primary key default gen_random_uuid(),

    payment_id uuid not null unique
        references public.payments(id)
        on delete cascade,

    service_id uuid not null
        references public.services(id)
        on delete restrict,

    service_user_id uuid not null
        references public.service_users(id)
        on delete restrict,

    token_hash text not null unique,

    expires_at timestamptz not null,

    used_at timestamptz,

    created_at timestamptz not null default now()
);


-- ============================================================
-- AUDIT LOG
-- ============================================================

create table if not exists public.audit_logs (
    id uuid primary key default gen_random_uuid(),

    actor_type text not null
        check (
            actor_type in (
                'service',
                'merchant',
                'admin',
                'system'
            )
        ),

    actor_id text,

    action text not null,

    payment_id uuid
        references public.payments(id)
        on delete set null,

    metadata jsonb,

    created_at timestamptz not null default now()
);


-- ============================================================
-- ADMIN USERS
-- ============================================================

create table if not exists public.admin_users (
    id uuid primary key
        references auth.users(id)
        on delete cascade,

    email text not null,

    role text not null default 'admin'
        check (
            role in (
                'admin',
                'super_admin'
            )
        ),

    created_at timestamptz not null default now()
);



-- ============================================================
-- MERCHANT DASHBOARD OPERATIONS
-- ============================================================

create table if not exists public.merchant_refunds (
    id uuid primary key default gen_random_uuid(),
    merchant_id uuid not null references public.merchant_profiles(id) on delete cascade,
    payment_id uuid not null references public.payments(id) on delete restrict,
    amount numeric(12,2) not null check(amount > 0),
    currency text not null default 'GMD',
    reason text,
    status text not null default 'requested'
        check(status in ('requested','approved','rejected','completed')),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.merchant_disputes (
    id uuid primary key default gen_random_uuid(),
    merchant_id uuid not null references public.merchant_profiles(id) on delete cascade,
    payment_id uuid not null references public.payments(id) on delete restrict,
    reason text not null,
    description text,
    status text not null default 'open'
        check(status in ('open','under_review','resolved','closed')),
    due_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.merchant_notifications (
    id uuid primary key default gen_random_uuid(),
    merchant_id uuid not null references public.merchant_profiles(id) on delete cascade,
    title text not null,
    message text not null,
    type text not null default 'info',
    read_at timestamptz,
    created_at timestamptz not null default now()
);

create table if not exists public.merchant_webhooks (
    id uuid primary key default gen_random_uuid(),
    merchant_id uuid not null references public.merchant_profiles(id) on delete cascade,
    url text not null,
    secret_hash text,
    events jsonb not null default '["payment.completed","payment.failed"]'::jsonb,
    enabled boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.merchant_team_invitations (
    id uuid primary key default gen_random_uuid(),
    merchant_id uuid not null references public.merchant_profiles(id) on delete cascade,
    email text not null,
    role text not null default 'viewer'
        check(role in ('viewer','developer','finance','admin')),
    status text not null default 'pending'
        check(status in ('pending','accepted','revoked')),
    created_at timestamptz not null default now(),
    unique(merchant_id,email)
);

alter table public.merchant_refunds enable row level security;
alter table public.merchant_disputes enable row level security;
alter table public.merchant_notifications enable row level security;
alter table public.merchant_webhooks enable row level security;
alter table public.merchant_team_invitations enable row level security;

revoke all on public.merchant_refunds from anon, authenticated;
revoke all on public.merchant_disputes from anon, authenticated;
revoke all on public.merchant_notifications from anon, authenticated;
revoke all on public.merchant_webhooks from anon, authenticated;
revoke all on public.merchant_team_invitations from anon, authenticated;

create index if not exists idx_merchant_refunds_merchant
on public.merchant_refunds(merchant_id,created_at desc);
create index if not exists idx_merchant_disputes_merchant
on public.merchant_disputes(merchant_id,created_at desc);
create index if not exists idx_merchant_notifications_merchant
on public.merchant_notifications(merchant_id,created_at desc);
create index if not exists idx_merchant_webhooks_merchant
on public.merchant_webhooks(merchant_id);
create index if not exists idx_merchant_team_merchant
on public.merchant_team_invitations(merchant_id);

-- ============================================================
-- INDEXES
-- ============================================================

create index if not exists idx_services_merchant
on public.services(merchant_id);

create index if not exists idx_services_status
on public.services(status);

create index if not exists idx_services_slug
on public.services(slug);

create index if not exists idx_service_users_service
on public.service_users(service_id);

create index if not exists idx_products_service
on public.products(service_id);

create index if not exists idx_payment_links_service
on public.payment_links(service_id);

create index if not exists idx_payment_links_product
on public.payment_links(product_id);

create index if not exists idx_payment_links_status
on public.payment_links(status);

create index if not exists idx_payments_service
on public.payments(service_id);

create index if not exists idx_payments_user
on public.payments(service_user_id);

create index if not exists idx_payments_status
on public.payments(status);

create index if not exists idx_payments_product_status
on public.payments(product_id, status);

create index if not exists idx_payment_sessions_hash
on public.payment_sessions(session_token_hash);

create index if not exists idx_payment_tokens_hash
on public.payment_tokens(token_hash);

create index if not exists idx_payment_deadline
on public.payments(payment_deadline_at);


-- ============================================================
-- RLS
-- Backend service role handles data access
-- ============================================================

alter table public.merchant_profiles enable row level security;
alter table public.services enable row level security;
alter table public.service_users enable row level security;
alter table public.products enable row level security;
alter table public.payment_methods enable row level security;
alter table public.payment_links enable row level security;
alter table public.payments enable row level security;
alter table public.payment_sessions enable row level security;
alter table public.payment_tokens enable row level security;
alter table public.audit_logs enable row level security;
alter table public.admin_users enable row level security;


revoke all on public.merchant_profiles from anon, authenticated;
revoke all on public.services from anon, authenticated;
revoke all on public.service_users from anon, authenticated;
revoke all on public.products from anon, authenticated;
revoke all on public.payment_methods from anon, authenticated;
revoke all on public.payment_links from anon, authenticated;
revoke all on public.payments from anon, authenticated;
revoke all on public.payment_sessions from anon, authenticated;
revoke all on public.payment_tokens from anon, authenticated;
revoke all on public.audit_logs from anon, authenticated;
revoke all on public.admin_users from anon, authenticated;


-- ============================================================
-- ATOMIC TOKEN REDEMPTION
-- ============================================================

create or replace function public.redeem_payment_token(p_service_id uuid,p_external_user_id text,p_token_hash text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_token payment_tokens%rowtype; v_user_id uuid; v_payment payments%rowtype; v_service_status text; v_subscription subscription_contracts%rowtype;
begin
 select status into v_service_status from services where id=p_service_id;
 if v_service_status is null then return jsonb_build_object('success',false,'reason','SERVICE_NOT_FOUND'); end if;
 if v_service_status<>'active' then return jsonb_build_object('success',false,'reason','SERVICE_NOT_ACTIVE'); end if;
 select id into v_user_id from service_users where service_id=p_service_id and external_user_id=p_external_user_id;
 if v_user_id is null then return jsonb_build_object('success',false,'reason','USER_NOT_FOUND'); end if;
 select * into v_token from payment_tokens where token_hash=p_token_hash and service_id=p_service_id for update;
 if v_token.id is null then return jsonb_build_object('success',false,'reason','INVALID_TOKEN'); end if;
 if v_token.service_user_id<>v_user_id then return jsonb_build_object('success',false,'reason','TOKEN_USER_MISMATCH'); end if;
 if v_token.used_at is not null then return jsonb_build_object('success',false,'reason','TOKEN_ALREADY_USED'); end if;
 if v_token.expires_at<=now() then return jsonb_build_object('success',false,'reason','TOKEN_EXPIRED'); end if;
 select * into v_payment from payments where id=v_token.payment_id for update;
 if v_payment.status<>'approved' then return jsonb_build_object('success',false,'reason','PAYMENT_NOT_APPROVED'); end if;
 update payment_tokens set used_at=now() where id=v_token.id;
 update payments set status='completed',completed_at=now() where id=v_payment.id;
 select * into v_subscription from subscription_contracts where current_payment_id=v_payment.id for update;
 if v_subscription.id is not null then
   update subscription_contracts set next_due_at=case when interval='yearly' then next_due_at+interval '1 year' else next_due_at+interval '1 month' end,last_reminded_at=null,reminder_count=0,updated_at=now(),status='active' where id=v_subscription.id;
 end if;
 insert into audit_logs(actor_type,actor_id,action,payment_id,metadata) values('system',p_service_id::text,'payment_token_redeemed',v_payment.id,jsonb_build_object('external_user_id',p_external_user_id));
 return jsonb_build_object('success',true,'reason','PAYMENT_VERIFIED','payment_id',v_payment.id,'product_id',v_payment.product_id,'amount',v_payment.amount,'currency',v_payment.currency,'payment_type',v_payment.payment_type);
end; $$;
-- SECURITY: payment-token redemption is backend-only.
revoke execute
on function public.redeem_payment_token(uuid, text, text)
from public, anon, authenticated;

-- SECURITY: RLS helper is not a public RPC.
revoke execute
on function public.rls_auto_enable()
from public, anon, authenticated;

-- SQUASHBERRYPAY PAYMENT OPERATIONS EXTENSION
alter table public.payments alter column service_id drop not null;
alter table public.payments alter column product_id drop not null;
alter table public.payments alter column service_user_id drop not null;
alter table public.payments add column if not exists customer_reference text;
alter table public.payments add column if not exists customer_email text;
alter table public.payments add column if not exists processing_page_id text;
alter table public.payments add column if not exists donation_campaign_id uuid;
create unique index if not exists idx_payments_processing_page_id on public.payments(processing_page_id) where processing_page_id is not null;
create index if not exists idx_payments_customer_reference on public.payments(customer_reference) where customer_reference is not null;
create table if not exists public.subscription_contracts (id uuid primary key default gen_random_uuid(),merchant_id uuid not null references public.merchant_profiles(id) on delete cascade,service_id uuid not null references public.services(id) on delete restrict,product_id uuid not null references public.products(id) on delete restrict,service_user_id uuid not null references public.service_users(id) on delete restrict,initial_payment_id uuid references public.payments(id) on delete set null,current_payment_id uuid references public.payments(id) on delete set null,status text not null default 'active' check(status in ('active','past_due','cancelled','completed')),interval text not null check(interval in ('monthly','yearly')),next_due_at timestamptz not null,last_reminded_at timestamptz,reminder_count integer not null default 0,cancelled_at timestamptz,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create index if not exists idx_subscription_contracts_due on public.subscription_contracts(status,next_due_at);
create table if not exists public.donation_campaigns (id uuid primary key default gen_random_uuid(),merchant_id uuid not null references public.merchant_profiles(id) on delete cascade,slug text not null unique,name text not null,description text,currency text not null default 'GMD',allow_custom_amount boolean not null default true,fixed_amount numeric(12,2),minimum_amount numeric(12,2),maximum_amount numeric(12,2),presets jsonb not null default '[]'::jsonb,goal numeric(12,2),goal_message text,end_at timestamptz,status text not null default 'active' check(status in ('active','inactive','completed')),created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create index if not exists idx_donation_campaigns_merchant on public.donation_campaigns(merchant_id,status);
alter table public.payments add constraint payments_donation_campaign_fk foreign key (donation_campaign_id) references public.donation_campaigns(id) on delete restrict;
create table if not exists public.donation_payment_methods (id uuid primary key default gen_random_uuid(),merchant_id uuid not null references public.merchant_profiles(id) on delete cascade,name text not null,type text not null,instructions text not null,account_name text,account_number text,bank_name text,phone_number text,enabled boolean not null default true,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create index if not exists idx_donation_payment_methods_merchant on public.donation_payment_methods(merchant_id,enabled);
alter table public.subscription_contracts enable row level security;alter table public.donation_campaigns enable row level security;alter table public.donation_payment_methods enable row level security;revoke all on public.subscription_contracts from anon,authenticated;revoke all on public.donation_campaigns from anon,authenticated;revoke all on public.donation_payment_methods from anon,authenticated;

-- ============================================================
-- APPLICATION CONFIGURATION / PAYMENT LIFECYCLE EXTENSION
-- ============================================================

alter table public.services
  add column if not exists environment text not null default 'live';

alter table public.services
  add column if not exists allowed_origins jsonb not null default '[]'::jsonb;

alter table public.services
  add column if not exists allowed_package_ids jsonb not null default '[]'::jsonb;

alter table public.services
  add column if not exists webhook_url text;

alter table public.services
  drop constraint if exists services_environment_check;

alter table public.services
  add constraint services_environment_check
  check(environment in ('live','test'));

alter table public.services
  add column if not exists last_api_used_at timestamptz;

alter table public.payments
  add column if not exists payment_state text;

alter table public.payments
  add column if not exists code_issued_at timestamptz;

alter table public.payments
  add column if not exists redeemed_at timestamptz;

alter table public.payments
  drop constraint if exists payments_payment_state_check;

alter table public.payments
  add constraint payments_payment_state_check
  check(payment_state in (
    'created','awaiting_payment','payment_submitted',
    'awaiting_verification','approved','code_issued',
    'redeemed','completed','rejected','expired','cancelled'
  ));

create table if not exists public.payment_verification_attempts (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.services(id) on delete cascade,
  service_user_id uuid references public.service_users(id) on delete cascade,
  attempt_key_hash text,
  success boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.payment_verification_attempts enable row level security;
revoke all on public.payment_verification_attempts from anon, authenticated;

create index if not exists idx_payment_verification_attempts_key_time
on public.payment_verification_attempts(attempt_key_hash,created_at desc);

create index if not exists idx_payments_payment_state
on public.payments(payment_state);

create index if not exists idx_services_last_api_used
on public.services(last_api_used_at);

-- Receipt uploads are private; the Worker serves signed merchant/admin links.
update storage.buckets
set
  public = false,
  file_size_limit = 8388608,
  allowed_mime_types = array[
    'image/jpeg','image/png','image/webp','image/jpg','application/pdf'
  ]::text[]
where id = 'payment-receipts';



-- ============================================================
-- EMBEDDED SDK / RELIABILITY LAYER
-- ============================================================

alter table public.services
  add column if not exists webhook_secret text,
  add column if not exists publishable_key_hash text,
  add column if not exists publishable_key_prefix text,
  add column if not exists publishable_key_created_at timestamptz;

create unique index if not exists idx_services_publishable_key_hash
  on public.services(publishable_key_hash)
  where publishable_key_hash is not null;

create table if not exists public.api_idempotency_keys (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.services(id) on delete cascade,
  route text not null,
  idempotency_key_hash text not null,
  request_hash text not null,
  response_status integer,
  response_body jsonb,
  resource_id uuid,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours'),
  unique(service_id,route,idempotency_key_hash)
);

create index if not exists idx_api_idempotency_expiry
  on public.api_idempotency_keys(expires_at);

create table if not exists public.payment_events (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments(id) on delete cascade,
  service_id uuid references public.services(id) on delete set null,
  event_type text not null,
  from_state text,
  to_state text,
  actor_type text,
  actor_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_payment_events_payment
  on public.payment_events(payment_id,created_at);

create table if not exists public.webhook_deliveries (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid references public.merchant_profiles(id) on delete cascade,
  service_id uuid references public.services(id) on delete cascade,
  event_id text not null unique,
  event_type text not null,
  url text not null,
  secret_value text,
  payload jsonb not null,
  status text not null default 'pending'
    check(status in ('pending','delivered','failed')),
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  last_error text,
  delivered_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_webhook_deliveries_due
  on public.webhook_deliveries(status,next_attempt_at);

alter table public.subscription_contracts
  drop constraint if exists subscription_contracts_status_check;

alter table public.subscription_contracts
  add constraint subscription_contracts_status_check
  check(status in ('active','paused','past_due','cancelled','completed'));

alter table public.api_idempotency_keys enable row level security;
alter table public.payment_events enable row level security;
alter table public.webhook_deliveries enable row level security;

revoke all on public.api_idempotency_keys from anon,authenticated;
revoke all on public.payment_events from anon,authenticated;
revoke all on public.webhook_deliveries from anon,authenticated;
