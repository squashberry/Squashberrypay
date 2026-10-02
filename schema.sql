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
);


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

create or replace function public.redeem_payment_token(
    p_service_id uuid,
    p_external_user_id text,
    p_token_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_token payment_tokens%rowtype;
    v_user_id uuid;
    v_payment payments%rowtype;
    v_service_status text;
begin

    -- Service must still be active
    select status
    into v_service_status
    from services
    where id = p_service_id;


    if v_service_status is null then
        return jsonb_build_object(
            'success', false,
            'reason', 'SERVICE_NOT_FOUND'
        );
    end if;


    if v_service_status <> 'active' then
        return jsonb_build_object(
            'success', false,
            'reason', 'SERVICE_NOT_ACTIVE'
        );
    end if;


    -- Find user
    select id
    into v_user_id
    from service_users
    where service_id = p_service_id
      and external_user_id = p_external_user_id;


    if v_user_id is null then
        return jsonb_build_object(
            'success', false,
            'reason', 'USER_NOT_FOUND'
        );
    end if;


    -- Lock token
    select *
    into v_token
    from payment_tokens
    where token_hash = p_token_hash
      and service_id = p_service_id
    for update;


    if v_token.id is null then
        return jsonb_build_object(
            'success', false,
            'reason', 'INVALID_TOKEN'
        );
    end if;


    if v_token.service_user_id <> v_user_id then
        return jsonb_build_object(
            'success', false,
            'reason', 'TOKEN_USER_MISMATCH'
        );
    end if;


    if v_token.used_at is not null then
        return jsonb_build_object(
            'success', false,
            'reason', 'TOKEN_ALREADY_USED'
        );
    end if;


    if v_token.expires_at <= now() then
        return jsonb_build_object(
            'success', false,
            'reason', 'TOKEN_EXPIRED'
        );
    end if;


    select *
    into v_payment
    from payments
    where id = v_token.payment_id
    for update;


    if v_payment.status <> 'approved' then
        return jsonb_build_object(
            'success', false,
            'reason', 'PAYMENT_NOT_APPROVED'
        );
    end if;


    -- Consume exactly once
    update payment_tokens
    set used_at = now()
    where id = v_token.id;


    update payments
    set
        status = 'completed',
        completed_at = now()
    where id = v_payment.id;


    insert into audit_logs (
        actor_type,
        actor_id,
        action,
        payment_id,
        metadata
    )
    values (
        'system',
        p_service_id::text,
        'payment_token_redeemed',
        v_payment.id,
        jsonb_build_object(
            'external_user_id',
            p_external_user_id
        )
    );


    return jsonb_build_object(
        'success', true,
        'reason', 'PAYMENT_VERIFIED',
        'payment_id', v_payment.id,
        'product_id', v_payment.product_id,
        'amount', v_payment.amount,
        'currency', v_payment.currency,
        'payment_type', v_payment.payment_type
    );

end;
$$;