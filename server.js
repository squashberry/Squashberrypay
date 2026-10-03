"use strict";

require("dotenv").config();

const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const multer = require("multer");
const path = require("path");

// Cloudflare Workers do not expose Node's CommonJS __dirname global.
// The Worker serves the frontend from GitHub Pages, so this is only used
// by legacy static-file routes and keeps the module Worker-compatible.
const __dirname = process.cwd();

const {
    createClient
} = require("@supabase/supabase-js");


/* ============================================================
   APP
============================================================ */

const app =
    express();

app.set(
    "trust proxy",
    1
);


/* ============================================================
   CONFIG
============================================================ */

const PORT =
    Number(
        process.env.PORT || 3000
    );

const SUPABASE_URL =
    process.env.SUPABASE_URL;

const SUPABASE_ANON_KEY =
    process.env.SUPABASE_ANON_KEY;

const SUPABASE_SERVICE_ROLE_KEY =
    process.env.SUPABASE_SERVICE_ROLE_KEY;

const BASE_URL =
    process.env.SQUASHBERRYPAY_URL ||
    `http://localhost:${PORT}`;

const configuredPublicSiteUrl =
    String(process.env.SQUASHBERRYPAY_PUBLIC_URL || "").replace(/\/+$/, "");
const githubPagesOrigin = "https://squashberry.github.io";
const githubPagesBase = githubPagesOrigin + "/Squashberrypay";
const PUBLIC_SITE_URL =
    !configuredPublicSiteUrl ||
    configuredPublicSiteUrl === githubPagesOrigin ||
    configuredPublicSiteUrl.toLowerCase() === githubPagesOrigin + "/squashberrypay"
        ? githubPagesBase
        : configuredPublicSiteUrl;

const PAYMENT_SESSION_MINUTES =
    Number(
        process.env.PAYMENT_SESSION_MINUTES || 60
    );

const PAYMENT_ATTEMPT_MINUTES =
    Number(
        process.env.PAYMENT_ATTEMPT_MINUTES || 20
    );

const PAYMENT_TOKEN_MINUTES =
    Number(
        process.env.PAYMENT_TOKEN_MINUTES ||
        (Number(process.env.PAYMENT_TOKEN_HOURS || 1) * 60)
    );

const PAYMENT_VERIFICATION_MAX_ATTEMPTS =
    Number(process.env.PAYMENT_VERIFICATION_MAX_ATTEMPTS || 8);

const PAYMENT_VERIFICATION_WINDOW_MINUTES =
    Number(process.env.PAYMENT_VERIFICATION_WINDOW_MINUTES || 15);

const ADMIN_SECRET =
    process.env.ADMIN_SESSION_SECRET;


/* ============================================================
   CUSTOM AUTH OTP CONFIG
============================================================ */

const AUTH_OTP_MINUTES =
    Number(
        process.env.AUTH_OTP_MINUTES || 10
    );

const AUTH_OTP_RESEND_SECONDS =
    Number(
        process.env.AUTH_OTP_RESEND_SECONDS || 60
    );

const AUTH_OTP_MAX_ATTEMPTS =
    Number(
        process.env.AUTH_OTP_MAX_ATTEMPTS || 5
    );

const RESEND_API_KEY =
    process.env.RESEND_API_KEY ||
    "";

const RESEND_FROM_EMAIL =
    process.env.RESEND_FROM_EMAIL ||
    "SquashberryPay <onboarding@resend.dev>";


/* ============================================================
   VALIDATE ENV
============================================================ */

if (
    !SUPABASE_URL ||
    !SUPABASE_ANON_KEY ||
    !SUPABASE_SERVICE_ROLE_KEY ||
    !ADMIN_SECRET
) {

    console.error(
        "\nFATAL: Missing required environment variables.\n"
    );

    process.exit(1);
}


/* ============================================================
   SUPABASE CLIENTS
============================================================ */

const supabase =
    createClient(
        SUPABASE_URL,
        SUPABASE_SERVICE_ROLE_KEY,
        {
            auth: {
                autoRefreshToken:
                    false,

                persistSession:
                    false
            }
        }
    );


const authClient =
    createClient(
        SUPABASE_URL,
        SUPABASE_ANON_KEY,
        {
            auth: {
                autoRefreshToken:
                    false,

                persistSession:
                    false
            }
        }
    );


/* ============================================================
   MIDDLEWARE
============================================================ */

app.use(
    cors({
        origin:
            true,

        credentials:
            true
    })
);

app.use(
    express.json({
        limit:
            "2mb"
    })
);

app.use(
    express.urlencoded({
        extended:
            true
    })
);

app.use(
    express.static(
        path.join(
            __dirname,
            "public"
        )
    )
);


/* ============================================================
   RECEIPT UPLOAD
============================================================ */

const upload =
    multer({

        storage:
            multer.memoryStorage(),

        limits: {
            fileSize:
                8 *
                1024 *
                1024
        },

        fileFilter(
            req,
            file,
            callback
        ) {

            const allowed = [
                "image/jpeg",
                "image/png",
                "image/webp",
                "image/jpg",
                "application/pdf"
            ];

            if (
                !allowed.includes(
                    file.mimetype
                )
            ) {

                return callback(
                    new Error(
                        "Only JPG, PNG, WEBP and PDF files are allowed."
                    )
                );
            }

            callback(
                null,
                true
            );
        }
    });


/* ============================================================
   GENERAL HELPERS
============================================================ */

function randomHex(
    bytes = 32
) {

    return crypto
        .randomBytes(
            bytes
        )
        .toString(
            "hex"
        );
}


function randomToken() {

    return crypto
        .randomBytes(
            32
        )
        .toString(
            "base64url"
        );
}


function hash(
    value
) {

    return crypto
        .createHash(
            "sha256"
        )
        .update(
            String(
                value
            )
        )
        .digest(
            "hex"
        );
}


function generateReference() {

    return (
        "SBP-" +
        crypto
            .randomBytes(
                6
            )
            .toString(
                "hex"
            )
            .toUpperCase()
    );
}


function generatePaymentCode() {

    const parts =
        [];

    for (
        let i = 0;
        i < 4;
        i++
    ) {

        parts.push(
            crypto
                .randomBytes(
                    2
                )
                .toString(
                    "hex"
                )
                .toUpperCase()
        );
    }

    return (
        `SBP-${parts.join("-")}`
    );
}


function addMinutes(
    minutes
) {

    return new Date(
        Date.now() +
        minutes *
        60 *
        1000
    ).toISOString();
}


function addHours(
    hours
) {

    return new Date(
        Date.now() +
        hours *
        60 *
        60 *
        1000
    ).toISOString();
}


function cleanSlug(
    value
) {

    return String(
        value
    )
        .trim()
        .toLowerCase()
        .replace(
            /[^a-z0-9]+/g,
            "-"
        )
        .replace(
            /-+/g,
            "-"
        )
        .replace(
            /^-|-$/g,
            ""
        )
        .slice(
            0,
            50
        );
}


function escapeHtml(
    value
) {

    return String(
        value ?? ""
    )
        .replace(
            /&/g,
            "&amp;"
        )
        .replace(
            /</g,
            "&lt;"
        )
        .replace(
            />/g,
            "&gt;"
        )
        .replace(
            /"/g,
            "&quot;"
        )
        .replace(
            /'/g,
            "&#039;"
        );
}


function normalizeEmail(
    email
) {

    return String(
        email || ""
    )
        .trim()
        .toLowerCase();
}


function isValidEmail(
    email
) {

    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        .test(
            email
        );
}


/* ============================================================
   SAFE PUBLIC ERROR
============================================================ */

/*
 * Internal errors stay in the terminal.
 *
 * Only the safe message reaches the browser.
 */

function publicError(
    message
) {

    const error =
        new Error(
            message
        );

    error.publicMessage =
        message;

    return error;
}



/* ============================================================
   SECURITY / REDIRECT / SESSION HELPERS
============================================================ */

function parseBearerToken(req) {

    const header =
        String(
            req.get("Authorization") ||
            ""
        ).trim();

    if (
        !header ||
        !/^Bearer\s+/i.test(header)
    ) {
        return null;
    }

    return header
        .replace(
            /^Bearer\s+/i,
            ""
        )
        .trim() || null;
}


function createAdminCookie() {

    const issuedAt =
        String(
            Date.now()
        );

    const nonce =
        randomToken();

    const payload =
        issuedAt +
        "." +
        nonce;

    const signature =
        crypto
            .createHmac(
                "sha256",
                ADMIN_SECRET
            )
            .update(
                payload
            )
            .digest(
                "hex"
            );

    return Buffer
        .from(
            payload +
            "." +
            signature
        )
        .toString(
            "base64url"
        );
}


function verifyAdminCookie(value) {

    try {

        const decoded =
            Buffer
                .from(
                    String(
                        value ||
                        ""
                    ),
                    "base64url"
                )
                .toString(
                    "utf8"
                );

        const parts =
            decoded.split(".");

        if (
            parts.length !==
            3
        ) {
            return false;
        }

        const issuedAt =
            parts[0];

        const nonce =
            parts[1];

        const signature =
            parts[2];

        const issued =
            Number(
                issuedAt
            );

        if (
            !Number.isFinite(
                issued
            )
        ) {
            return false;
        }

        const age =
            Date.now() -
            issued;

        if (
            age <
                -5 * 60 * 1000 ||
            age >
                8 * 60 * 60 * 1000
        ) {
            return false;
        }

        const expected =
            crypto
                .createHmac(
                    "sha256",
                    ADMIN_SECRET
                )
                .update(
                    issuedAt +
                    "." +
                    nonce
                )
                .digest(
                    "hex"
                );

        const expectedBuffer =
            Buffer.from(
                expected,
                "hex"
            );

        const actualBuffer =
            Buffer.from(
                signature,
                "hex"
            );

        return (
            expectedBuffer.length ===
                actualBuffer.length &&
            crypto.timingSafeEqual(
                expectedBuffer,
                actualBuffer
            )
        );

    } catch {

        return false;
    }
}


function normalizeRedirectUrl(
    value,
    fieldName
) {

    const raw =
        String(
            value ||
            ""
        ).trim();

    if (
        !raw
    ) {
        return null;
    }

    let parsed;

    try {

        parsed =
            new URL(
                raw
            );

    } catch {

        throw publicError(
            (fieldName || "redirect_url") +
            " is invalid."
        );
    }

    const protocol =
        String(
            parsed.protocol ||
            ""
        ).toLowerCase();

    if (
        protocol ===
        "https:"
    ) {

        return parsed.toString();
    }

    if (
        protocol ===
            "http:" &&
        (
            parsed.hostname ===
                "localhost" ||
            parsed.hostname ===
                "127.0.0.1" ||
            parsed.hostname ===
                "::1"
        )
    ) {

        return parsed.toString();
    }

    const blockedSchemes = [
        "javascript:",
        "data:",
        "vbscript:"
    ];

    if (
        /^[a-z][a-z0-9+.-]*:$/.test(
            protocol
        ) &&
        !blockedSchemes.includes(
            protocol
        ) &&
        protocol !==
            "http:" &&
        protocol !==
            "https:"
    ) {

        return raw;
    }

    throw publicError(
        (fieldName || "redirect_url") +
        " must use HTTPS or a supported app deep-link scheme."
    );
}


function generatePaymentLinkSlug(
    serviceSlug,
    productCode
) {

    const base =
        cleanSlug(
            String(
                serviceSlug ||
                ""
            ) +
            "-" +
            String(
                productCode ||
                ""
            )
        ) ||
        "payment";

    return (
        base +
        "-" +
        crypto
            .randomBytes(
                3
            )
            .toString(
                "hex"
            )
    );
}


/* ============================================================
   MERCHANT AUTHENTICATION
============================================================ */

async function authenticateMerchant(
    req,
    res,
    next
) {

    try {

        const token =
            parseBearerToken(
                req
            );

        if (
            !token
        ) {

            return res.status(
                401
            ).json({
                error:
                    "Merchant authentication required."
            });
        }

        const {
            data,
            error
        } =
            await authClient
                .auth
                .getUser(
                    token
                );

        if (
            error ||
            !data?.user
        ) {

            return res.status(
                401
            ).json({
                error:
                    "Your merchant session is invalid or expired."
            });
        }

        const {
            data: merchant,
            error:
                merchantError
        } =
            await supabase
                .from(
                    "merchant_profiles"
                )
                .select(
                    "*"
                )
                .eq(
                    "owner_user_id",
                    data.user.id
                )
                .maybeSingle();

        if (
            merchantError
        ) {

            console.error(
                "Merchant authentication lookup error:",
                merchantError
            );

            return res.status(
                500
            ).json({
                error:
                    "Could not verify your merchant account."
            });
        }

        if (
            !merchant
        ) {

            return res.status(
                403
            ).json({
                error:
                    "No merchant profile is attached to this account."
            });
        }

        req.user =
            data.user;

        req.merchant =
            merchant;

        next();

    } catch (error) {

        console.error(
            "Merchant authentication error:",
            error
        );

        res.status(
            500
        ).json({
            error:
                "Could not authenticate merchant."
        });
    }
}



async function authenticateSdk(req,res,next){
  try{
    const clientId=String(
      req.get("X-SquashberryPay-Client-ID")||
      req.get("X-SquashberryPay-Publishable-Key")||
      ""
    ).trim();
    if(!clientId){
      return res.status(401).json({error:"SquashberryPay client ID is required."});
    }
    const {data:service,error}=await supabase
      .from("services")
      .select("*")
      .eq("client_id",clientId)
      .maybeSingle();
    if(error)throw error;
    if(!service)return res.status(401).json({error:"Invalid SquashberryPay client ID."});
    if(service.status!=="active")return res.status(403).json({error:"This application is not active."});

    const allowed=Array.isArray(service.allowed_origins)?
      service.allowed_origins.map(x=>String(x||"").trim().replace(/\/$/,"")).filter(Boolean):[];
    let origin=String(req.get("Origin")||"").trim().replace(/\/$/,"");
    if(!origin){
      const ref=String(req.get("Referer")||"").trim();
      if(ref){try{origin=new URL(ref).origin}catch{}}
    }
    if(origin&&allowed.length&&!allowed.includes(origin)){
      return res.status(403).json({error:"This application is not authorized for this origin."});
    }

    req.service=service;
    next();
  }catch(error){
    console.error("SDK authentication error:",error);
    return res.status(500).json({error:"Could not authenticate application."});
  }
}

async function persistPaymentEvent(payment,eventType,fromState,toState,metadata={}){
  try{
    await supabase.from("payment_events").insert({
      payment_id:payment?.id,
      service_id:payment?.service_id||null,
      event_type:eventType,
      from_state:fromState||null,
      to_state:toState||null,
      actor_type:"system",
      metadata
    });
  }catch(error){console.error("Payment event error:",error);}
}

async function enqueueWebhookEvent(eventType,payment,metadata={}){
  try{
    const serviceId=payment?.service_id;
    if(!serviceId)return;
    const {data:service}=await supabase.from("services")
      .select("id,merchant_id,environment,webhook_url,webhook_secret")
      .eq("id",serviceId).maybeSingle();
    if(!service?.webhook_url||!service?.webhook_secret)return;

    const eventId="evt_"+randomHex(16);
    const payload={
      id:eventId,
      type:eventType,
      created_at:new Date().toISOString(),
      livemode:service.environment!=="test",
      data:{
        payment_id:payment.id,
        payment_reference:payment.payment_reference,
        processing_page_id:payment.processing_page_id||null,
        amount:payment.amount,
        currency:payment.currency,
        payment_type:payment.payment_type,
        status:payment.status,
        payment_state:payment.payment_state||null,
        product_id:payment.product_id||null,
        service_id:serviceId,
        ...metadata
      }
    };

    await supabase.from("webhook_deliveries").insert({
      merchant_id:service.merchant_id,
      service_id:serviceId,
      event_id:eventId,
      event_type:eventType,
      url:service.webhook_url,
      secret_value:service.webhook_secret,
      payload,
      status:"pending",
      attempts:0,
      next_attempt_at:new Date().toISOString()
    });
  }catch(error){console.error("Webhook enqueue error:",error);}
}

export async function runWebhookDeliveryJob(){
  const {data:rows,error}=await supabase.from("webhook_deliveries")
    .select("*")
    .in("status",["pending","failed"])
    .lte("next_attempt_at",new Date().toISOString())
    .order("created_at",{ascending:true})
    .limit(50);
  if(error){console.error("Webhook query error:",error);return{delivered:0,failed:0};}

  let delivered=0,failed=0;
  for(const row of rows||[]){
    const attempt=Number(row.attempts||0)+1;
    try{
      if(attempt>8)throw new Error("Maximum webhook attempts exceeded.");
      const timestamp=Math.floor(Date.now()/1000);
      const body=JSON.stringify(row.payload);
      const signature=crypto.createHmac("sha256",String(row.secret_value||""))
        .update(String(timestamp)+"."+body).digest("hex");
      const response=await fetch(row.url,{
        method:"POST",
        headers:{
          "Content-Type":"application/json",
          "X-SquashberryPay-Event-ID":row.event_id,
          "X-SquashberryPay-Event":row.event_type,
          "X-SquashberryPay-Timestamp":String(timestamp),
          "X-SquashberryPay-Signature":"sha256="+signature
        },
        body
      });
      if(!response.ok)throw new Error("HTTP "+response.status);
      await supabase.from("webhook_deliveries").update({
        status:"delivered",
        attempts:attempt,
        delivered_at:new Date().toISOString(),
        last_error:null
      }).eq("id",row.id);
      delivered++;
    }catch(error){
      failed++;
      const delay=Math.min(240,Math.pow(2,Math.max(0,attempt-1)));
      await supabase.from("webhook_deliveries").update({
        status:"failed",
        attempts:attempt,
        last_error:String(error?.message||error).slice(0,1000),
        next_attempt_at:new Date(Date.now()+delay*60000).toISOString()
      }).eq("id",row.id);
    }
  }
  return{delivered,failed};
}

function idempotencyMiddleware(route){
  return async(req,res,next)=>{
    const key=String(req.get("Idempotency-Key")||"").trim();
    if(!key)return next();
    const serviceId=req.service?.id;
    if(!serviceId)return next();
    if(key.length>255)return res.status(400).json({error:"Idempotency-Key is too long."});
    const keyHash=hash(key);
    const reqHash=hash(JSON.stringify(req.body||{}));
    const lookup=await supabase.from("api_idempotency_keys")
      .select("request_hash,response_status,response_body")
      .eq("service_id",serviceId)
      .eq("route",route)
      .eq("idempotency_key_hash",keyHash)
      .maybeSingle();
    if(lookup.error)return res.status(500).json({error:"Could not process idempotent request."});
    if(lookup.data){
      if(lookup.data.request_hash!==reqHash)return res.status(409).json({error:"This Idempotency-Key was already used with a different request."});
      if(lookup.data.response_body!==null&&lookup.data.response_status){
        return res.status(lookup.data.response_status).json(lookup.data.response_body);
      }
    }else{
      const inserted=await supabase.from("api_idempotency_keys").insert({
        service_id:serviceId,route,idempotency_key_hash:keyHash,request_hash:reqHash
      });
      if(inserted.error){
        const retry=await supabase.from("api_idempotency_keys")
          .select("request_hash,response_status,response_body")
          .eq("service_id",serviceId).eq("route",route).eq("idempotency_key_hash",keyHash)
          .maybeSingle();
        if(retry.data?.response_body!==null&&retry.data?.response_status){
          return res.status(retry.data.response_status).json(retry.data.response_body);
        }
      }
    }
    const oldJson=res.json.bind(res);
    res.json=async body=>{
      if(res.statusCode<500){
        await supabase.from("api_idempotency_keys").update({
          response_status:res.statusCode,response_body:body
        }).eq("service_id",serviceId).eq("route",route).eq("idempotency_key_hash",keyHash);
      }
      return oldJson(body);
    };
    next();
  };
}

async function authenticateService(
    req,
    res,
    next
) {

    try {

        const clientId =
            String(
                req.get(
                    "X-SquashberryPay-Client-ID"
                ) ||
                ""
            ).trim();

        const clientSecret =
            String(
                req.get(
                    "X-SquashberryPay-Client-Secret"
                ) ||
                ""
            ).trim();

        if (
            !clientId ||
            !clientSecret
        ) {

            return res.status(
                401
            ).json({
                error:
                    "SquashberryPay client credentials are required."
            });
        }

        const {
            data: service,
            error
        } =
            await supabase
                .from(
                    "services"
                )
                .select(
                    "*"
                )
                .eq(
                    "client_id",
                    clientId
                )
                .maybeSingle();

        if (
            error
        ) {

            console.error(
                "Service authentication lookup error:",
                error
            );

            return res.status(
                500
            ).json({
                error:
                    "Could not authenticate application."
            });
        }

        if (
            !service
        ) {

            return res.status(
                401
            ).json({
                error:
                    "Invalid SquashberryPay client credentials."
            });
        }

        if (
            service.status !==
            "active"
        ) {

            return res.status(
                403
            ).json({
                error:
                    "This application is not active."
            });
        }

        const matches =
            await bcrypt.compare(
                clientSecret,
                service.client_secret_hash
            );

        if (
            !matches
        ) {

            return res.status(
                401
            ).json({
                error:
                    "Invalid SquashberryPay client credentials."
            });
        }

        req.service =
            service;

        try {
            await supabase
                .from("services")
                .update({ last_api_used_at: new Date().toISOString() })
                .eq("id", service.id);
        } catch (activityError) {
            console.error("Service API activity update error:", activityError);
        }

        next();

    } catch (error) {

        console.error(
            "Service authentication error:",
            error
        );

        res.status(
            500
        ).json({
            error:
                "Could not authenticate application."
        });
    }
}


function requireAdmin(
    req,
    res,
    next
) {

    const cookies =
        String(
            req.headers.cookie ||
            ""
        );

    const match =
        cookies.match(
            /(?:^|;\s*)sbp_admin=([^;]+)/
        );

    if (
        !match ||
        !verifyAdminCookie(
            match[1]
        )
    ) {

        return res.status(
            401
        ).json({
            error:
                "Administrator authentication required."
        });
    }

    req.admin =
        true;

    next();
}


/* ============================================================
   AUTH OTP STORES
============================================================ */

const authOtpStore =
    new Map();

const pendingSignupStore =
    new Map();

const passwordResetTickets =
    new Map();


/* ============================================================
   CUSTOM AUTH OTP
============================================================ */

function generateAuthOtp() {

    return String(
        crypto.randomInt(
            100000,
            1000000
        )
    );
}


function hashAuthOtp(
    otp
) {

    return crypto
        .createHash(
            "sha256"
        )
        .update(
            String(
                otp
            )
        )
        .digest(
            "hex"
        );
}


/* ============================================================
   RESEND EMAIL
============================================================ */

async function sendResendEmail({
    to,
    subject,
    html,
    text
}) {

    if (
        !RESEND_API_KEY
    ) {

        console.error(
            "RESEND ERROR: RESEND_API_KEY is missing."
        );

        throw publicError(
            "We couldn't send your verification code right now. Please try again in a moment."
        );
    }


    if (
        !RESEND_FROM_EMAIL
    ) {

        console.error(
            "RESEND ERROR: RESEND_FROM_EMAIL is missing."
        );

        throw publicError(
            "We couldn't send your verification code right now. Please try again in a moment."
        );
    }


    try {

        const response =
            await fetch(
                "https://api.resend.com/emails",
                {

                    method:
                        "POST",

                    headers: {

                        Authorization:
                            `Bearer ${RESEND_API_KEY}`,

                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify({

                            from:
                                RESEND_FROM_EMAIL,

                            to: [
                                to
                            ],

                            subject,

                            html,

                            text
                        })
                }
            );


        let data =
            {};

        try {

            data =
                await response.json();

        } catch {

            data =
                {};
        }


        if (
            !response.ok
        ) {

            /*
             * REAL PROVIDER ERROR:
             * terminal only.
             */

            console.error(
                "\n========== RESEND DELIVERY ERROR =========="
            );

            console.error(
                "HTTP:",
                response.status
            );

            console.error(
                "DATA:",
                data
            );

            console.error(
                "============================================\n"
            );


            /*
             * SAFE USER ERROR.
             */

            throw publicError(
                "We couldn't send your verification code right now. Please try again in a moment."
            );
        }


        return data;

    } catch (error) {

        /*
         * Preserve our safe public error.
         */

        if (
            error.publicMessage
        ) {

            throw error;
        }


        console.error(
            "\n========== RESEND NETWORK ERROR =========="
        );

        console.error(
            error
        );

        console.error(
            "===========================================\n"
        );


        throw publicError(
            "We couldn't send your verification code right now. Please try again in a moment."
        );
    }
}


/* ============================================================
   OTP EMAIL TEMPLATE
============================================================ */

function buildAuthOtpEmail({
    otp,
    title,
    description,
    purpose
}) {

    const safeOtp =
        escapeHtml(otp);

    const safeTitle =
        escapeHtml(title);

    const safeDescription =
        escapeHtml(description);

    const safePurpose =
        escapeHtml(purpose);

    return `<!DOCTYPE html>
<html lang="en" dir="ltr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<title>${safeTitle}</title>
</head>

<body style="margin:0;padding:0;background-color:#f3f3f0;color:#111111;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" style="width:100%;background-color:#f3f3f0;">
<tr>
<td align="center" style="padding-top:36px;padding-right:16px;padding-bottom:36px;padding-left:16px;">

<table width="600" cellpadding="0" cellspacing="0" border="0" role="presentation" style="width:100%;max-width:600px;background-color:#ffffff;border:1px solid #ddddda;border-radius:22px;">
<tr>
<td style="padding-top:34px;padding-right:34px;padding-bottom:34px;padding-left:34px;">

<table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation">
<tr>
<td style="padding-bottom:24px;">

<table cellpadding="0" cellspacing="0" border="0" role="presentation">
<tr>
<td width="44" height="44" align="center" valign="middle" bgcolor="#111111" style="width:44px;height:44px;background-color:#111111;border-radius:12px;color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:18px;line-height:44px;font-weight:800;">
S
</td>
<td style="padding-left:12px;">
<div style="font-size:16px;line-height:20px;color:#111111;font-weight:800;">SquashberryPay</div>
<div style="font-size:11px;line-height:16px;color:#888888;font-weight:600;">Secure business payments</div>
</td>
</tr>
</table>

</td>
</tr>

<tr>
<td style="padding-bottom:10px;font-size:10px;line-height:14px;color:#777777;font-weight:800;letter-spacing:2px;">
${safePurpose}
</td>
</tr>

<tr>
<td style="padding-bottom:12px;font-size:28px;line-height:34px;color:#111111;font-weight:800;letter-spacing:-0.8px;">
${safeTitle}
</td>
</tr>

<tr>
<td style="padding-bottom:24px;font-size:15px;line-height:25px;color:#666666;">
${safeDescription}
</td>
</tr>

<tr>
<td style="padding-top:2px;padding-right:22px;padding-bottom:22px;padding-left:22px;background-color:#f7f7f4;border:1px solid #e2e2dc;border-radius:18px;">

<table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation">
<tr>
<td align="center" style="padding-top:22px;padding-bottom:9px;font-size:10px;line-height:14px;color:#777777;font-weight:800;letter-spacing:2px;">
YOUR VERIFICATION CODE
</td>
</tr>
<tr>
<td align="center" style="padding-top:2px;padding-bottom:16px;font-family:Consolas,Monaco,'Courier New',monospace;font-size:36px;line-height:42px;color:#111111;font-weight:800;letter-spacing:8px;">
${safeOtp}
</td>
</tr>
<tr>
<td align="center" style="font-size:12px;line-height:18px;color:#888888;">
This code expires in ${AUTH_OTP_MINUTES} minutes.
</td>
</tr>
</table>

</td>
</tr>

<tr>
<td style="padding-top:24px;font-size:13px;line-height:21px;color:#666666;">
For your security, never share this code. SquashberryPay support will never ask you for your verification code.
</td>
</tr>

<tr>
<td style="padding-top:24px;border-top:1px solid #eeeeea;font-size:11px;line-height:18px;color:#999999;">
This is an automated security email from SquashberryPay. If you did not request this code, you can safely ignore this message.
</td>
</tr>

</table>

</td>
</tr>
</table>

<table width="600" cellpadding="0" cellspacing="0" border="0" role="presentation" style="width:100%;max-width:600px;">
<tr>
<td align="center" style="padding-top:16px;font-size:11px;line-height:17px;color:#999999;">
SquashberryPay Secure Authentication
</td>
</tr>
</table>

</td>
</tr>
</table>
</body>
</html>`;
}


/* ============================================================
   ISSUE AUTH OTP
============================================================ */

async function issueAuthOtp({
    email,
    purpose
}) {

    const normalizedEmail =
        normalizeEmail(
            email
        );


    const key =
        `${purpose}:${normalizedEmail}`;


    const existing =
        authOtpStore.get(
            key
        );


    if (
        existing &&
        (
            Date.now() -
            existing.last_sent_at
        ) <
        (
            AUTH_OTP_RESEND_SECONDS *
            1000
        )
    ) {

        const seconds =
            Math.ceil(

                (
                    (
                        AUTH_OTP_RESEND_SECONDS *
                        1000
                    ) -

                    (
                        Date.now() -
                        existing.last_sent_at
                    )
                ) / 1000
            );


        const error =
            publicError(
                `Please wait ${seconds} seconds before requesting another code.`
            );


        error.code =
            "OTP_COOLDOWN";


        throw error;
    }


    const otp =
        generateAuthOtp();


    const record = {

        email:
            normalizedEmail,

        otp_hash:
            hashAuthOtp(
                otp
            ),

        expires_at:
            Date.now() +
            (
                AUTH_OTP_MINUTES *
                60 *
                1000
            ),

        attempts:
            0,

        last_sent_at:
            Date.now(),

        purpose
    };


    authOtpStore.set(
        key,
        record
    );


    let title =
        "Verify your email";


    let description =
        "Enter this code in SquashberryPay to continue.";


    let purposeLabel =
        "SECURE AUTHENTICATION";


    if (
        purpose ===
        "signup"
    ) {

        title =
            "Verify your business email";


        description =
            "Enter this code in SquashberryPay to verify your business email and complete your account setup.";


        purposeLabel =
            "SQUASHBERRYPAY ACCOUNT";
    }


    if (
        purpose ===
        "password_reset"
    ) {

        title =
            "Reset your password";


        description =
            "Enter this code in SquashberryPay to verify your identity before setting a new password.";


        purposeLabel =
            "PASSWORD RESET";
    }


    try {

        await sendResendEmail({

            to:
                normalizedEmail,

            subject:
                "Your SquashberryPay verification code",

            html:
                buildAuthOtpEmail({

                    otp,

                    title,

                    description,

                    purpose:
                        purposeLabel
                }),

            text:
                `${title}\n\n${description}\n\nYour verification code is: ${otp}\n\nThis code expires in ${AUTH_OTP_MINUTES} minutes.`
        });


        console.log(
            `[AUTH] ${purpose} OTP sent to ${normalizedEmail}`
        );


        return {

            success:
                true,

            expires_in:
                AUTH_OTP_MINUTES *
                60
        };

    } catch (error) {

        /*
         * Don't keep an OTP if delivery failed.
         */

        authOtpStore.delete(
            key
        );

        throw error;
    }
}


/* ============================================================
   VERIFY AUTH OTP
============================================================ */

function verifyAuthOtp({
    email,
    token,
    purpose
}) {

    const normalizedEmail =
        normalizeEmail(
            email
        );


    const key =
        `${purpose}:${normalizedEmail}`;


    const record =
        authOtpStore.get(
            key
        );


    if (
        !record
    ) {

        const error =
            publicError(
                "No active verification code was found. Request a new code."
            );


        error.code =
            "OTP_NOT_FOUND";


        throw error;
    }


    if (
        record.expires_at <=
        Date.now()
    ) {

        authOtpStore.delete(
            key
        );


        const error =
            publicError(
                "This verification code has expired. Request a new code."
            );


        error.code =
            "OTP_EXPIRED";


        throw error;
    }


    if (
        record.attempts >=
        AUTH_OTP_MAX_ATTEMPTS
    ) {

        authOtpStore.delete(
            key
        );


        const error =
            publicError(
                "Too many incorrect attempts. Request a new code."
            );


        error.code =
            "OTP_TOO_MANY_ATTEMPTS";


        throw error;
    }


    const normalizedToken =
        String(
            token || ""
        )
            .replace(
                /\D/g,
                ""
            );


    if (
        normalizedToken.length !==
        6
    ) {

        const error =
            publicError(
                "Enter the complete 6-digit code."
            );


        error.code =
            "OTP_INVALID";


        throw error;
    }


    const expectedHash =
        hashAuthOtp(
            normalizedToken
        );


    const expected =
        Buffer.from(
            record.otp_hash,
            "hex"
        );


    const actual =
        Buffer.from(
            expectedHash,
            "hex"
        );


    if (
        expected.length !==
            actual.length ||
        !crypto.timingSafeEqual(
            expected,
            actual
        )
    ) {

        record.attempts +=
            1;


        const remaining =
            Math.max(
                0,
                AUTH_OTP_MAX_ATTEMPTS -
                record.attempts
            );


        if (
            remaining <=
            0
        ) {

            authOtpStore.delete(
                key
            );
        }


        const error =
            publicError(

                remaining > 0

                    ? `Incorrect verification code. ${remaining} attempt${remaining === 1 ? "" : "s"} remaining.`

                    : "Too many incorrect attempts. Request a new code."
            );


        error.code =
            remaining > 0
                ? "OTP_INVALID"
                : "OTP_TOO_MANY_ATTEMPTS";


        throw error;
    }


    /*
     * ONE-TIME USE.
     */

    authOtpStore.delete(
        key
    );


    return {

        success:
            true,

        email:
            normalizedEmail
    };
}


/* ============================================================
   FIND AUTH USER
============================================================ */

async function findAuthUserByEmail(
    email
) {

    const normalizedEmail =
        normalizeEmail(
            email
        );


    const {
        data,
        error
    } = await supabase
        .auth
        .admin
        .listUsers({

            page:
                1,

            perPage:
                1000
        });


    if (
        error
    ) {

        console.error(
            "Supabase listUsers error:",
            error
        );

        throw new Error(
            "Unable to check account."
        );
    }


    return (
        data?.users?.find(
            user =>
                normalizeEmail(
                    user.email
                ) ===
                normalizedEmail
        ) ||
        null
    );
}


/* ============================================================
   HEALTH
============================================================ */

app.get(
    "/health",
    (req, res) => {

        res.json({

            ok:
                true,

            service:
                "SquashberryPay",

            version:
                "2.3.0",

            time:
                new Date()
                    .toISOString()
        });
    }
);


/* ============================================================
   SIGNUP — SEND OTP
============================================================ */

app.post(
    "/api/public/auth/signup/send-otp",
    async (
        req,
        res
    ) => {

        try {

            const email =
                normalizeEmail(
                    req.body?.email
                );

            const customerReference =
                String(req.body?.customer_reference || "").trim().slice(0,160) || null;


            const businessName =
                String(
                    req.body?.business_name ||
                    ""
                ).trim();


            const businessType =
                String(
                    req.body?.business_type ||
                    ""
                ).trim();


            const phone =
                String(
                    req.body?.phone ||
                    ""
                ).trim();


            const website =
                String(
                    req.body?.website ||
                    ""
                ).trim();


            const password =
                String(
                    req.body?.password ||
                    ""
                );


            if (
                !isValidEmail(
                    email
                )
            ) {

                return res.status(400).json({
                    error:
                        "Enter a valid business email."
                });
            }


            if (
                businessName.length < 2
            ) {

                return res.status(400).json({
                    error:
                        "Enter your profile name."
                });
            }


            if (
                password.length < 8
            ) {

                return res.status(400).json({
                    error:
                        "Password must contain at least 8 characters."
                });
            }


            const {
                data: existingMerchant,
                error:
                    merchantError
            } = await supabase
                .from(
                    "merchant_profiles"
                )
                .select(
                    "id"
                )
                .eq(
                    "email",
                    email
                )
                .maybeSingle();


            if (
                merchantError
            ) {

                console.error(
                    "Signup merchant lookup error:",
                    merchantError
                );


                return res.status(500).json({
                    error:
                        "We couldn't check your account right now. Please try again."
                });
            }


            if (
                existingMerchant
            ) {

                return res.status(409).json({
                    error:
                        "An account with this email already exists. Please sign in instead."
                });
            }


            pendingSignupStore.set(
                email,
                {

                    business_name:
                        businessName,

                    business_type:
                        businessType ||
                        null,

                    phone:
                        phone ||
                        null,

                    website:
                        website ||
                        null,

                    password,

                    expires_at:
                        Date.now() +
                        (
                            AUTH_OTP_MINUTES *
                            60 *
                            1000
                        )
                }
            );


            await issueAuthOtp({

                email,

                purpose:
                    "signup"
            });


            res.json({

                success:
                    true,

                message:
                    "Verification code sent to your email.",

                expires_in:
                    AUTH_OTP_MINUTES *
                    60
            });

        } catch (error) {

            console.error(
                "\nSIGNUP OTP ERROR:",
                error
            );


            res.status(
                error.code ===
                    "OTP_COOLDOWN"
                    ? 429
                    : 500
            ).json({

                error:
                    error.publicMessage ||
                    (
                        error.code ===
                        "OTP_COOLDOWN"
                            ? error.message
                            : "We couldn't send your verification code right now. Please try again in a moment."
                    )
            });
        }
    }
);


/* ============================================================
   SIGNUP — RESEND OTP
============================================================ */

app.post(
    "/api/public/auth/signup/resend-otp",
    async (
        req,
        res
    ) => {

        try {

            const email =
                normalizeEmail(
                    req.body?.email
                );


            const pending =
                pendingSignupStore.get(
                    email
                );


            if (
                !pending
            ) {

                return res.status(400).json({
                    error:
                        "Your signup session has expired. Start signup again."
                });
            }


            if (
                pending.expires_at <=
                Date.now()
            ) {

                pendingSignupStore.delete(
                    email
                );


                return res.status(400).json({
                    error:
                        "Your signup session has expired. Start signup again."
                });
            }


            pending.expires_at =
                Date.now() +
                (
                    AUTH_OTP_MINUTES *
                    60 *
                    1000
                );


            await issueAuthOtp({

                email,

                purpose:
                    "signup"
            });


            res.json({

                success:
                    true,

                message:
                    "A new verification code has been sent."
            });

        } catch (error) {

            console.error(
                "\nSIGNUP RESEND ERROR:",
                error
            );


            res.status(
                error.code ===
                    "OTP_COOLDOWN"
                    ? 429
                    : 500
            ).json({

                error:
                    error.publicMessage ||
                    (
                        error.code ===
                        "OTP_COOLDOWN"
                            ? error.message
                            : "We couldn't resend your verification code right now. Please try again."
                    )
            });
        }
    }
);


/* ============================================================
   SIGNUP — VERIFY OTP
============================================================ */

app.post(
    "/api/public/auth/signup/verify-otp",
    async (
        req,
        res
    ) => {

        try {

            const email =
                normalizeEmail(
                    req.body?.email
                );


            const token =
                String(
                    req.body?.token ||
                    ""
                );


            const pending =
                pendingSignupStore.get(
                    email
                );


            if (
                !pending
            ) {

                return res.status(400).json({
                    error:
                        "Your signup session has expired. Start signup again."
                });
            }


            if (
                pending.expires_at <=
                Date.now()
            ) {

                pendingSignupStore.delete(
                    email
                );


                return res.status(400).json({
                    error:
                        "Your signup session has expired. Start signup again."
                });
            }


            verifyAuthOtp({

                email,

                token,

                purpose:
                    "signup"
            });


            const {
                data: existingMerchant,
                error:
                    merchantLookupError
            } = await supabase
                .from(
                    "merchant_profiles"
                )
                .select(
                    "id"
                )
                .eq(
                    "email",
                    email
                )
                .maybeSingle();


            if (
                merchantLookupError
            ) {

                console.error(
                    "Merchant lookup after OTP error:",
                    merchantLookupError
                );

                return res.status(500).json({
                    error:
                        "Your email was verified, but we couldn't complete account setup. Please try again."
                });
            }


            if (
                existingMerchant
            ) {

                pendingSignupStore.delete(
                    email
                );


                return res.status(409).json({
                    error:
                        "An account with this email already exists. Please sign in instead."
                });
            }


            let authUser =
                await findAuthUserByEmail(
                    email
                );


            if (
                !authUser
            ) {

                const {
                    data:
                        createdUser,
                    error:
                        createUserError
                } = await supabase
                    .auth
                    .admin
                    .createUser({

                        email,

                        password:
                            pending.password,

                        email_confirm:
                            true
                    });


                if (
                    createUserError
                ) {

                    console.error(
                        "Supabase createUser error:",
                        createUserError
                    );


                    return res.status(500).json({

                        error:
                            "Your email was verified, but we couldn't finish creating your account. Please try again."
                    });
                }


                authUser =
                    createdUser.user;

            } else {

                const {
                    data:
                        updatedUser,
                    error:
                        updateUserError
                } = await supabase
                    .auth
                    .admin
                    .updateUserById(
                        authUser.id,
                        {

                            password:
                                pending.password,

                            email_confirm:
                                true
                        }
                    );


                if (
                    updateUserError
                ) {

                    console.error(
                        "Supabase updateUser error:",
                        updateUserError
                    );


                    return res.status(500).json({

                        error:
                            "Your email was verified, but we couldn't finish setting up your account."
                    });
                }


                authUser =
                    updatedUser.user;
            }


            const {
                data: merchant,
                error:
                    merchantError
            } = await supabase
                .from(
                    "merchant_profiles"
                )
                .insert({

                    owner_user_id:
                        authUser.id,

                    business_name:
                        pending.business_name,

                    business_type:
                        pending.business_type,

                    email:
                        email,

                    phone:
                        pending.phone,

                    website:
                        pending.website,

                    status:
                        "active"
                })
                .select(
                    "*"
                )
                .single();


            if (
                merchantError
            ) {

                console.error(
                    "Merchant profile creation error:",
                    merchantError
                );


                try {

                    await supabase
                        .auth
                        .admin
                        .deleteUser(
                            authUser.id
                        );

                } catch (
                    rollbackError
                ) {

                    console.error(
                        "Signup rollback error:",
                        rollbackError
                    );
                }


                return res.status(500).json({

                    error:
                        "Your email was verified, but we couldn't finish creating your SquashberryPay account."
                });
            }


            pendingSignupStore.delete(
                email
            );


            await supabase
                .from(
                    "audit_logs"
                )
                .insert({

                    actor_type:
                        "merchant",

                    actor_id:
                        merchant.id,

                    action:
                        "merchant_account_created",

                    metadata: {

                        authentication:
                            "custom_resend_otp",

                        account_status:
                            "active"
                    }
                });


            const {
                data:
                    loginData,
                error:
                    loginError
            } = await authClient
                .auth
                .signInWithPassword({

                    email,

                    password:
                        pending.password
                });


            if (
                loginError ||
                !loginData?.session
            ) {

                console.error(
                    "Automatic signup login error:",
                    loginError
                );


                return res.status(201).json({

                    success:
                        true,

                    account_created:
                        true,

                    merchant,

                    message:
                        "Your SquashberryPay account has been created. Please sign in."
                });
            }


            res.status(201).json({

                success:
                    true,

                account_created:
                    true,

                access_token:
                    loginData.session
                        .access_token,

                refresh_token:
                    loginData.session
                        .refresh_token,

                expires_at:
                    loginData.session
                        .expires_at,

                merchant,

                message:
                    "Your SquashberryPay account is active."
            });

        } catch (error) {

            console.error(
                "\nSIGNUP VERIFY ERROR:",
                error
            );


            const otpError =
                [
                    "OTP_INVALID",
                    "OTP_EXPIRED",
                    "OTP_NOT_FOUND",
                    "OTP_TOO_MANY_ATTEMPTS"
                ].includes(
                    error.code
                );


            res.status(
                otpError
                    ? 400
                    : 500
            ).json({

                error:
                    error.publicMessage ||
                    (
                        otpError
                            ? error.message
                            : "We couldn't complete your signup right now. Please try again."
                    )
            });
        }
    }
);


/* ============================================================
   NORMAL LOGIN — NO OTP
============================================================ */

app.post(
    "/api/public/auth/login",
    async (
        req,
        res
    ) => {

        try {

            const email =
                normalizeEmail(
                    req.body?.email
                );


            const password =
                String(
                    req.body?.password ||
                    ""
                );


            if (
                !isValidEmail(
                    email
                )
            ) {

                return res.status(400).json({
                    error:
                        "Enter a valid email address."
                });
            }


            if (
                !password
            ) {

                return res.status(400).json({
                    error:
                        "Enter your password."
                });
            }


            const {
                data,
                error
            } = await authClient
                .auth
                .signInWithPassword({

                    email,

                    password
                });


            if (
                error ||
                !data?.user ||
                !data?.session
            ) {

                return res.status(401).json({
                    error:
                        "Incorrect email or password."
                });
            }


            const {
                data: merchant,
                error:
                    merchantError
            } = await supabase
                .from(
                    "merchant_profiles"
                )
                .select(
                    `
                    id,
                    owner_user_id,
                    business_name,
                    business_type,
                    email,
                    phone,
                    website,
                    description,
                    status,
                    created_at,
                    updated_at
                    `
                )
                .eq(
                    "owner_user_id",
                    data.user.id
                )
                .maybeSingle();


            if (
                merchantError
            ) {

                console.error(
                    "Login merchant lookup error:",
                    merchantError
                );


                return res.status(500).json({
                    error:
                        "We couldn't load your SquashberryPay account right now. Please try again."
                });
            }


            if (
                !merchant
            ) {

                return res.status(403).json({
                    error:
                        "This account does not have a SquashberryPay profile."
                });
            }


            if (
                merchant.status !==
                "active"
            ) {

                return res.status(403).json({
                    error:
                        "Your SquashberryPay account is currently unavailable."
                });
            }


            await supabase
                .from(
                    "audit_logs"
                )
                .insert({

                    actor_type:
                        "merchant",

                    actor_id:
                        merchant.id,

                    action:
                        "merchant_signed_in",

                    metadata: {

                        authentication:
                            "password"
                    }
                });


            res.json({

                success:
                    true,

                access_token:
                    data.session
                        .access_token,

                refresh_token:
                    data.session
                        .refresh_token,

                expires_at:
                    data.session
                        .expires_at,

                merchant
            });

        } catch (error) {

            console.error(
                "LOGIN ERROR:",
                error
            );


            res.status(500).json({
                error:
                    "We couldn't sign you in right now. Please try again."
            });
        }
    }
);


/* ============================================================
   FORGOT PASSWORD — SEND OTP
============================================================ */

app.post(
    "/api/public/auth/forgot-password/send-otp",
    async (
        req,
        res
    ) => {

        try {

            const email =
                normalizeEmail(
                    req.body?.email
                );


            if (
                !isValidEmail(
                    email
                )
            ) {

                return res.status(400).json({
                    error:
                        "Enter a valid email address."
                });
            }


            const user =
                await findAuthUserByEmail(
                    email
                );


            /*
             * Don't expose account existence.
             */

            if (
                !user
            ) {

                return res.json({

                    success:
                        true,

                    message:
                        "If an account exists for this email, a reset code has been sent."
                });
            }


            const {
                data: merchant,
                error:
                    merchantError
            } = await supabase
                .from(
                    "merchant_profiles"
                )
                .select(
                    "id,status"
                )
                .eq(
                    "owner_user_id",
                    user.id
                )
                .maybeSingle();


            if (
                merchantError
            ) {

                console.error(
                    "Forgot-password merchant lookup error:",
                    merchantError
                );


                return res.status(500).json({
                    error:
                        "We couldn't process your request right now. Please try again."
                });
            }


            if (
                !merchant ||
                merchant.status !==
                    "active"
            ) {

                return res.json({

                    success:
                        true,

                    message:
                        "If an account exists for this email, a reset code has been sent."
                });
            }


            await issueAuthOtp({

                email,

                purpose:
                    "password_reset"
            });


            res.json({

                success:
                    true,

                message:
                    "Password reset code sent to your email."
            });

        } catch (error) {

            console.error(
                "RESET SEND OTP ERROR:",
                error
            );


            res.status(
                error.code ===
                    "OTP_COOLDOWN"
                    ? 429
                    : 500
            ).json({

                error:
                    error.publicMessage ||
                    (
                        error.code ===
                        "OTP_COOLDOWN"
                            ? error.message
                            : "We couldn't send your reset code right now. Please try again."
                    )
            });
        }
    }
);


/* ============================================================
   FORGOT PASSWORD — VERIFY OTP
============================================================ */

app.post(
    "/api/public/auth/forgot-password/check-otp",
    async (
        req,
        res
    ) => {

        try {

            const email =
                normalizeEmail(
                    req.body?.email
                );


            const token =
                String(
                    req.body?.token ||
                    ""
                );


            if (
                !isValidEmail(
                    email
                )
            ) {

                return res.status(400).json({
                    error:
                        "Invalid email address."
                });
            }


            const user =
                await findAuthUserByEmail(
                    email
                );


            if (
                !user
            ) {

                return res.status(400).json({
                    error:
                        "Invalid or expired reset code."
                });
            }


            verifyAuthOtp({

                email,

                token,

                purpose:
                    "password_reset"
            });


            const {
                data: merchant,
                error:
                    merchantError
            } = await supabase
                .from(
                    "merchant_profiles"
                )
                .select(
                    "id,status"
                )
                .eq(
                    "owner_user_id",
                    user.id
                )
                .maybeSingle();


            if (
                merchantError
            ) {

                console.error(
                    "Reset merchant lookup error:",
                    merchantError
                );


                return res.status(500).json({
                    error:
                        "We couldn't verify your reset request right now."
                });
            }


            if (
                !merchant ||
                merchant.status !==
                    "active"
            ) {

                return res.status(403).json({
                    error:
                        "This account is unavailable."
                });
            }


            const resetTicket =
                crypto
                    .randomBytes(
                        32
                    )
                    .toString(
                        "base64url"
                    );


            passwordResetTickets.set(
                resetTicket,
                {

                    userId:
                        user.id,

                    email,

                    expiresAt:
                        Date.now() +
                        (
                            10 *
                            60 *
                            1000
                        ),

                    used:
                        false
                }
            );


            res.json({

                success:
                    true,

                reset_ticket:
                    resetTicket
            });

        } catch (error) {

            console.error(
                "RESET CHECK OTP ERROR:",
                error
            );


            const otpError =
                [
                    "OTP_INVALID",
                    "OTP_EXPIRED",
                    "OTP_NOT_FOUND",
                    "OTP_TOO_MANY_ATTEMPTS"
                ].includes(
                    error.code
                );


            res.status(
                otpError
                    ? 400
                    : 500
            ).json({

                error:
                    error.publicMessage ||
                    (
                        otpError
                            ? error.message
                            : "We couldn't verify the reset code right now."
                    )
            });
        }
    }
);


/* ============================================================
   FORGOT PASSWORD — SET PASSWORD
============================================================ */

app.post(
    "/api/public/auth/forgot-password/reset",
    async (
        req,
        res
    ) => {

        try {

            const resetTicket =
                String(
                    req.body?.reset_ticket ||
                    ""
                ).trim();


            const newPassword =
                String(
                    req.body?.new_password ||
                    ""
                );


            if (
                !resetTicket
            ) {

                return res.status(400).json({
                    error:
                        "Password reset session is missing."
                });
            }


            if (
                newPassword.length <
                8
            ) {

                return res.status(400).json({
                    error:
                        "Password must contain at least 8 characters."
                });
            }


            const ticket =
                passwordResetTickets.get(
                    resetTicket
                );


            if (
                !ticket
            ) {

                return res.status(400).json({
                    error:
                        "This password reset session is invalid or expired."
                });
            }


            if (
                ticket.used
            ) {

                return res.status(400).json({
                    error:
                        "This password reset session has already been used."
                });
            }


            if (
                ticket.expiresAt <=
                Date.now()
            ) {

                passwordResetTickets.delete(
                    resetTicket
                );


                return res.status(400).json({
                    error:
                        "This password reset session has expired."
                });
            }


            const {
                error
            } = await supabase
                .auth
                .admin
                .updateUserById(
                    ticket.userId,
                    {

                        password:
                            newPassword
                    }
                );


            if (
                error
            ) {

                console.error(
                    "Supabase password update error:",
                    error
                );


                return res.status(500).json({
                    error:
                        "We couldn't update your password right now. Please try again."
                });
            }


            passwordResetTickets.delete(
                resetTicket
            );


            await supabase
                .from(
                    "audit_logs"
                )
                .insert({

                    actor_type:
                        "merchant",

                    actor_id:
                        ticket.userId,

                    action:
                        "merchant_password_reset",

                    metadata: {

                        authentication:
                            "custom_resend_otp"
                    }
                });


            res.json({

                success:
                    true,

                message:
                    "Your password has been updated successfully."
            });

        } catch (error) {

            console.error(
                "PASSWORD RESET ERROR:",
                error
            );


            res.status(500).json({

                error:
                    "We couldn't update your password right now. Please try again."
            });
        }
    }
);


/* ============================================================
   TEMPORARY AUTH DATA

   Cloudflare Workers disallow process-wide timers during module
   initialization. Expiration is checked when each record is used,
   so no global setInterval is required here.
============================================================ */


/* ============================================================
   MERCHANT PROFILE
============================================================ */

app.get(
    "/api/merchant/me",
    authenticateMerchant,
    (req, res) => {

        res.json({

            merchant:
                req.merchant
        });
    }
);


/* ============================================================
   MERCHANT APPS
============================================================ */

app.get(
    "/api/merchant/apps",
    authenticateMerchant,
    async (
        req,
        res
    ) => {

        try {

            const {
                data,
                error
            } = await supabase
                .from(
                    "services"
                )
                .select(
                    `
                    id,
                    name,
                    slug,
                    website_url,
                    platform_type,
                    client_id,
                    status,
                    created_at,
                    updated_at
                    `
                )
                .eq(
                    "merchant_id",
                    req.merchant.id
                )
                .order(
                    "created_at",
                    {
                        ascending:
                            false
                    }
                );


            if (
                error
            ) {

                console.error(
                    "Merchant apps query error:",
                    error
                );

                return res.status(500).json({
                    error:
                        "Could not load your applications."
                });
            }


            res.json({

                apps:
                    data || []
            });

        } catch (error) {

            console.error(
                error
            );


            res.status(500).json({
                error:
                    "Could not load your applications."
            });
        }
    }
);


/* ============================================================
   MERCHANT CREATE APP
============================================================ */

app.post(
    "/api/merchant/apps",
    authenticateMerchant,
    async (
        req,
        res
    ) => {

        try {

            const {
                name,
                website_url,
                platform_type,
                environment,
                allowed_origins,
                allowed_package_ids,
                webhook_url
            } = req.body;

            const appEnvironment =
                environment === "test"
                    ? "test"
                    : "live";

            const normalizeList = value =>
                Array.isArray(value)
                    ? value
                        .map(item => String(item || "").trim())
                        .filter(Boolean)
                        .slice(0, 30)
                    : String(value || "")
                        .split(/[,\n]/)
                        .map(item => item.trim())
                        .filter(Boolean)
                        .slice(0, 30);


            if (
                !name
            ) {

                return res.status(400).json({
                    error:
                        "Application name is required."
                });
            }


            let slug =
                cleanSlug(
                    name
                );


            const {
                data: existingSlug
            } = await supabase
                .from(
                    "services"
                )
                .select(
                    "id"
                )
                .eq(
                    "slug",
                    slug
                )
                .maybeSingle();


            if (
                existingSlug
            ) {

                slug =
                    `${slug}-${randomHex(3)}`;
            }


            const clientId =
                "sbp_" +
                appEnvironment +
                "_" +
                randomHex(18);


            const clientSecret =
                `sbps_${randomHex(32)}`;


            const clientSecretHash =
                await bcrypt.hash(
                    clientSecret,
                    12
                );
            
            const generatedWebhookSecret =
                webhook_url
                    ? "whsec_" + randomHex(32)
                    : null;


            const {
                data: service,
                error
            } = await supabase
                .from(
                    "services"
                )
                .insert({

                    merchant_id:
                        req.merchant.id,

                    name:
                        String(
                            name
                        ).trim(),

                    slug,

                    website_url:
                        website_url
                            ? String(
                                website_url
                            ).trim()
                            : null,

                    platform_type:
                        platform_type
                            ? String(
                                platform_type
                            ).trim()
                            : null,

                    environment:
                        appEnvironment,

                    allowed_origins:
                        normalizeList(
                            allowed_origins
                        ),

                    allowed_package_ids:
                        normalizeList(
                            allowed_package_ids
                        ),

                    webhook_url:
                        webhook_url
                            ? String(
                                webhook_url
                            ).trim()
                            : null,

                    client_id:
                        clientId,

                    client_secret_hash:
                        clientSecretHash,

                    webhook_secret:
                        generatedWebhookSecret,

                    status:
                        "pending"
                })
                .select(
                    `
                    id,
                    name,
                    slug,
                    website_url,
                    platform_type,
                    environment,
                    allowed_origins,
                    allowed_package_ids,
                    webhook_url,
                    last_api_used_at,
                    client_id,
                    status,
                    created_at
                    `
                )
                .single();


            if (
                error
            ) {

                console.error(
                    "Create app database error:",

                    error
                );


                return res.status(500).json({
                    error:
                        "Could not submit application."
                });
            }


            await supabase
                .from(
                    "audit_logs"
                )
                .insert({

                    actor_type:
                        "merchant",

                    actor_id:
                        req.merchant.id,

                    action:
                        "application_submitted",

                    metadata: {

                        service_id:
                            service.id,

                        service_name:
                            service.name
                    }
                });


            res.status(201).json({

                app:
                    service,

                approval_required:
                    true,

                credentials: {

                    client_id:
                        clientId,

                    client_secret:
                        clientSecret,

                    webhook_secret:
                        generatedWebhookSecret
                },

                message:
                    "Application submitted for approval. Save these credentials securely. They become usable after approval."
            });

        } catch (error) {

            console.error(
                "Create app error:",
                error
            );


            res.status(500).json({

                error:
                    "Could not submit application."
            });
        }
    }
);


/* ============================================================
   MERCHANT ROTATE APPLICATION SECRET
============================================================ */

app.post(
    "/api/merchant/apps/:id/rotate-secret",
    authenticateMerchant,
    async (
        req,
        res
    ) => {
        try {
            const {
                data:service,
                error
            } =
                await supabase
                    .from("services")
                    .select(
                        "id,name,client_id,status"
                    )
                    .eq(
                        "id",
                        req.params.id
                    )
                    .eq(
                        "merchant_id",
                        req.merchant.id
                    )
                    .maybeSingle();

            if(error) throw error;

            if(!service){
                return res.status(404).json({
                    error:
                        "Application not found."
                });
            }

            const clientSecret =
                "sbps_" +
                randomHex(32);

            const clientSecretHash =
                await bcrypt.hash(
                    clientSecret,
                    12
                );

            const {
                error:updateError
            } =
                await supabase
                    .from("services")
                    .update({
                        client_secret_hash:
                            clientSecretHash,
                        updated_at:
                            new Date().toISOString()
                    })
                    .eq(
                        "id",
                        service.id
                    )
                    .eq(
                        "merchant_id",
                        req.merchant.id
                    );

            if(updateError) throw updateError;

            await supabase
                .from("audit_logs")
                .insert({
                    actor_type:
                        "merchant",
                    actor_id:
                        req.merchant.id,
                    action:
                        "application_secret_rotated",
                    metadata:{
                        service_id:
                            service.id
                    }
                });

            return res.json({
                success:
                    true,
                credentials:{
                    client_id:
                        service.client_id,
                    client_secret:
                        clientSecret
                },
                message:
                    "Application secret rotated. The previous secret is now invalid."
            });
        }catch(error){
            console.error(
                "Rotate application secret error:",
                error
            );

            return res.status(500).json({
                error:
                    "Could not rotate application secret."
            });
        }
    }
);



app.post(
    "/api/merchant/apps/:id/rotate-webhook-secret",
    authenticateMerchant,
    async (req,res)=>{
        try{
            const {data:service,error}=await supabase
                .from("services")
                .select("id,webhook_url")
                .eq("id",req.params.id)
                .eq("merchant_id",req.merchant.id)
                .maybeSingle();

            if(error)throw error;
            if(!service){
                return res.status(404).json({
                    error:"Application not found."
                });
            }
            if(!service.webhook_url){
                return res.status(400).json({
                    error:"Configure the application webhook URL first."
                });
            }

            const secret="whsec_"+randomHex(32);
            const {error:updateError}=await supabase
                .from("services")
                .update({
                    webhook_secret:secret,
                    updated_at:new Date().toISOString()
                })
                .eq("id",service.id)
                .eq("merchant_id",req.merchant.id);

            if(updateError)throw updateError;

            res.json({
                success:true,
                webhook_secret:secret,
                message:"Webhook secret rotated. Update your endpoint before the next event."
            });
        }catch(error){
            console.error("Rotate webhook secret error:",error);
            res.status(500).json({
                error:"Could not rotate webhook secret."
            });
        }
    }
);

/* ============================================================
   MERCHANT REMOVE APP
============================================================ */

app.delete(
    "/api/merchant/apps/:id",
    authenticateMerchant,
    async (
        req,
        res
    ) => {

        try {

            const {
                data: service,
                error:
                    lookupError
            } = await supabase
                .from(
                    "services"
                )
                .select(
                    "id,name,status"
                )
                .eq(
                    "id",
                    req.params.id
                )
                .eq(
                    "merchant_id",
                    req.merchant.id
                )
                .maybeSingle();


            if (
                lookupError
            ) {

                console.error(
                    "Remove app lookup error:",
                    lookupError
                );


                return res.status(500).json({
                    error:
                        "Could not remove application."
                });
            }


            if (
                !service
            ) {

                return res.status(404).json({
                    error:
                        "Application not found."
                });
            }


            const {
                error
            } = await supabase
                .from(
                    "services"
                )
                .update({

                    status:
                        "disabled",

                    updated_at:
                        new Date()
                            .toISOString()
                })
                .eq(
                    "id",
                    service.id
                );


            if (
                error
            ) {

                console.error(
                    "Disable app error:",
                    error
                );


                return res.status(500).json({
                    error:
                        "Could not remove application."
                });
            }


            await supabase
                .from(
                    "audit_logs"
                )
                .insert({

                    actor_type:
                        "merchant",

                    actor_id:
                        req.merchant.id,

                    action:
                        "application_disabled",

                    metadata: {

                        service_id:
                            service.id
                    }
                });


            res.json({

                success:
                    true
            });

        } catch (error) {

            console.error(
                error
            );


            res.status(500).json({

                error:
                    "Could not remove application."
            });
        }
    }
);


/* ============================================================
   MERCHANT PRODUCTS
============================================================ */

app.get(
    "/api/merchant/apps/:id/products",
    authenticateMerchant,
    async (
        req,
        res
    ) => {

        try {

            const {
                data: service
            } = await supabase
                .from(
                    "services"
                )
                .select(
                    "id,status"
                )
                .eq(
                    "id",
                    req.params.id
                )
                .eq(
                    "merchant_id",
                    req.merchant.id
                )
                .maybeSingle();


            if (
                !service
            ) {

                return res.status(404).json({
                    error:
                        "Application not found."
                });
            }


            const {
                data,
                error
            } = await supabase
                .from(
                    "products"
                )
                .select(
                    "*"
                )
                .eq(
                    "service_id",
                    service.id
                )
                .order(
                    "created_at",
                    {
                        ascending:
                            false
                    }
                );


            if (
                error
            ) {

                console.error(
                    "Load products error:",
                    error
                );


                return res.status(500).json({
                    error:
                        "Could not load products."
                });
            }


            res.json({

                products:
                    data || []
            });

        } catch (error) {

            console.error(
                error
            );


            res.status(500).json({

                error:
                    "Could not load products."
            });
        }
    }
);


/* ============================================================
   MERCHANT CREATE / UPDATE PRODUCT
============================================================ */

app.post(
    "/api/merchant/apps/:id/products",
    authenticateMerchant,
    async (
        req,
        res
    ) => {

        try {

            const {
                data: service
            } = await supabase
                .from(
                    "services"
                )
                .select(
                    "id,status"
                )
                .eq(
                    "id",
                    req.params.id
                )
                .eq(
                    "merchant_id",
                    req.merchant.id
                )
                .maybeSingle();


            if (
                !service
            ) {

                return res.status(404).json({
                    error:
                        "Application not found."
                });
            }


            const {
                product_code,
                name,
                description,
                payment_type,
                amount,
                currency,
                subscription_interval,
                allow_custom_amount,
                donation_goal,
                donation_minimum,
                donation_maximum,
                donation_presets,
                donation_goal_message,
                donation_end_at,
                show_donation_goal,
                show_donor_count,
                close_on_goal
            } = req.body;


            if (
                !product_code ||
                !name ||
                !payment_type
            ) {

                return res.status(400).json({
                    error:
                        "Product code, name and payment type are required."
                });
            }


            if (
                (
                    payment_type !==
                        "donate" ||
                    !allow_custom_amount
                ) &&
                (
                    amount === undefined ||
                    amount === null ||
                    amount === "" ||
                    Number(amount) <= 0
                )
            ) {

                return res.status(400).json({
                    error:
                        "A positive amount is required."
                });
            }


            if (
                payment_type ===
                    "subscribe" &&
                ![
                    "monthly",
                    "yearly"
                ].includes(
                    subscription_interval
                )
            ) {

                return res.status(400).json({
                    error:
                        "Choose monthly or yearly billing."
                });
            }


            let normalizedDonationGoal =
                null;

            let normalizedDonationMinimum =
                null;

            let normalizedDonationMaximum =
                null;

            let normalizedDonationPresets =
                [];

            let normalizedDonationEndAt =
                null;

            if (
                payment_type ===
                    "donate"
            ) {

                if (
                    donation_goal !== null &&
                    donation_goal !== undefined &&
                    donation_goal !== ""
                ) {
                    normalizedDonationGoal =
                        Number(
                            donation_goal
                        );

                    if (
                        !Number.isFinite(
                            normalizedDonationGoal
                        ) ||
                        normalizedDonationGoal <= 0
                    ) {
                        return res.status(400).json({
                            error:
                                "Donation goal must be greater than zero."
                        });
                    }

                    normalizedDonationGoal =
                        Math.round(
                            normalizedDonationGoal * 100
                        ) / 100;
                }

                if (
                    donation_minimum !== null &&
                    donation_minimum !== undefined &&
                    donation_minimum !== ""
                ) {
                    normalizedDonationMinimum =
                        Number(
                            donation_minimum
                        );

                    if (
                        !Number.isFinite(
                            normalizedDonationMinimum
                        ) ||
                        normalizedDonationMinimum <= 0
                    ) {
                        return res.status(400).json({
                            error:
                                "Minimum donation must be greater than zero."
                        });
                    }

                    normalizedDonationMinimum =
                        Math.round(
                            normalizedDonationMinimum * 100
                        ) / 100;
                }

                if (
                    donation_maximum !== null &&
                    donation_maximum !== undefined &&
                    donation_maximum !== ""
                ) {
                    normalizedDonationMaximum =
                        Number(
                            donation_maximum
                        );

                    if (
                        !Number.isFinite(
                            normalizedDonationMaximum
                        ) ||
                        normalizedDonationMaximum <= 0
                    ) {
                        return res.status(400).json({
                            error:
                                "Maximum donation must be greater than zero."
                        });
                    }

                    normalizedDonationMaximum =
                        Math.round(
                            normalizedDonationMaximum * 100
                        ) / 100;
                }

                if (
                    normalizedDonationMinimum !== null &&
                    normalizedDonationMaximum !== null &&
                    normalizedDonationMaximum <
                        normalizedDonationMinimum
                ) {
                    return res.status(400).json({
                        error:
                            "Maximum donation cannot be lower than the minimum."
                    });
                }

                if (
                    Array.isArray(
                        donation_presets
                    )
                ) {
                    normalizedDonationPresets =
                        [...new Set(
                            donation_presets
                                .map(value => Number(value))
                                .filter(value =>
                                    Number.isFinite(value) &&
                                    value > 0
                                )
                                .map(value =>
                                    Math.round(
                                        value * 100
                                    ) / 100
                                )
                        )]
                        .sort(
                            (a, b) => a - b
                        )
                        .slice(
                            0,
                            8
                        );
                }

                if (
                    normalizedDonationMinimum !== null &&
                    normalizedDonationPresets.some(
                        value =>
                            value <
                            normalizedDonationMinimum
                    )
                ) {
                    return res.status(400).json({
                        error:
                            "Donation presets cannot be below the minimum donation."
                    });
                }

                if (
                    normalizedDonationMaximum !== null &&
                    normalizedDonationPresets.some(
                        value =>
                            value >
                            normalizedDonationMaximum
                    )
                ) {
                    return res.status(400).json({
                        error:
                            "Donation presets cannot exceed the maximum donation."
                    });
                }

                if (
                    donation_end_at
                ) {
                    const parsedEnd =
                        new Date(
                            donation_end_at
                        );

                    if (
                        Number.isNaN(
                            parsedEnd.getTime()
                        )
                    ) {
                        return res.status(400).json({
                            error:
                                "Donation end date is invalid."
                        });
                    }

                    normalizedDonationEndAt =
                        parsedEnd.toISOString();
                }
            }


            const {
                data,
                error
            } = await supabase
                .from(
                    "products"
                )
                .upsert({

                    service_id:
                        service.id,

                    product_code:
                        String(
                            product_code
                        )
                            .trim()
                            .toLowerCase(),

                    name:
                        String(
                            name
                        ).trim(),

                    description:
                        description
                            ? String(
                                description
                            ).trim()
                            : null,

                    payment_type,

                    amount:
                        (
                            payment_type ===
                                "donate" &&
                            allow_custom_amount
                        )
                            ? (
                                amount
                                    ? Number(
                                        amount
                                    )
                                    : null
                            )
                            : Number(
                                amount
                            ),

                    currency:
                        (
                            currency ||
                            "GMD"
                        ).toUpperCase(),

                    subscription_interval:
                        payment_type ===
                            "subscribe"
                            ? subscription_interval
                            : null,

                    allow_custom_amount:
                        payment_type ===
                            "donate"
                            ? Boolean(
                                allow_custom_amount
                            )
                            : false,

                    donation_goal:
                        payment_type ===
                            "donate"
                            ? normalizedDonationGoal
                            : null,

                    donation_minimum:
                        payment_type ===
                            "donate"
                            ? normalizedDonationMinimum
                            : null,

                    donation_maximum:
                        payment_type ===
                            "donate"
                            ? normalizedDonationMaximum
                            : null,

                    donation_presets:
                        payment_type ===
                            "donate"
                            ? normalizedDonationPresets
                            : [],

                    donation_goal_message:
                        payment_type ===
                            "donate"
                            ? (
                                donation_goal_message
                                    ? String(
                                        donation_goal_message
                                    ).trim().slice(
                                        0,
                                        240
                                    )
                                    : null
                            )
                            : null,

                    donation_end_at:
                        payment_type ===
                            "donate"
                            ? normalizedDonationEndAt
                            : null,

                    show_donation_goal:
                        payment_type ===
                            "donate"
                            ? donation_goal !==
                                null &&
                                show_donation_goal !==
                                false
                            : false,

                    show_donor_count:
                        payment_type ===
                            "donate"
                            ? show_donor_count !==
                                false
                            : false,

                    close_on_goal:
                        payment_type ===
                            "donate"
                            ? Boolean(
                                close_on_goal
                            )
                            : false,

                    status:
                        "active",

                    updated_at:
                        new Date()
                            .toISOString()

                }, {

                    onConflict:
                        "service_id,product_code"
                })
                .select(
                    "*"
                )
                .single();


            if (
                error
            ) {

                console.error(
                    "Save product error:",
                    error
                );


                return res.status(500).json({
                    error:
                        "Could not save product."
                });
            }


            res.status(201).json({

                product:
                    data
            });

        } catch (error) {

            console.error(
                error
            );


            res.status(500).json({
                error:
                    "Could not save product."
            });
        }
    }
);


/* ============================================================
   MERCHANT PAYMENT METHODS
============================================================ */

app.get(
    "/api/merchant/apps/:id/payment-methods",
    authenticateMerchant,
    async (
        req,
        res
    ) => {

        try {

            const {
                data: service
            } = await supabase
                .from(
                    "services"
                )
                .select(
                    "id"
                )
                .eq(
                    "id",
                    req.params.id
                )
                .eq(
                    "merchant_id",
                    req.merchant.id
                )
                .maybeSingle();


            if (
                !service
            ) {

                return res.status(404).json({
                    error:
                        "Application not found."
                });
            }


            const {
                data,
                error
            } = await supabase
                .from(
                    "payment_methods"
                )
                .select(
                    "*"
                )
                .eq(
                    "service_id",
                    service.id
                )
                .order(
                    "name"
                );


            if (
                error
            ) {

                console.error(
                    "Load payment methods error:",
                    error
                );


                return res.status(500).json({
                    error:
                        "Could not load payment methods."
                });
            }


            res.json({

                payment_methods:
                    data || []
            });

        } catch (error) {

            console.error(
                error
            );


            res.status(500).json({

                error:
                    "Could not load payment methods."
            });
        }
    }
);


app.post(
    "/api/merchant/apps/:id/payment-methods",
    authenticateMerchant,
    async (
        req,
        res
    ) => {

        try {

            const {
                data: service
            } = await supabase
                .from(
                    "services"
                )
                .select(
                    "id"
                )
                .eq(
                    "id",
                    req.params.id
                )
                .eq(
                    "merchant_id",
                    req.merchant.id
                )
                .maybeSingle();


            if (
                !service
            ) {

                return res.status(404).json({
                    error:
                        "Application not found."
                });
            }


            const {
                name,
                type,
                instructions,
                account_name,
                account_number,
                bank_name,
                phone_number
            } = req.body;


            if (
                !name ||
                !type ||
                !instructions
            ) {

                return res.status(400).json({
                    error:
                        "Name, type and instructions are required."
                });
            }


            const icons = {

                wave:
                    "/assets/payment-methods/wave.svg",

                aps:
                    "/assets/payment-methods/aps.svg",

                nada:
                    "/assets/payment-methods/nada.svg",

                bank:
                    null,

                other:
                    null
            };


            const {
                data,
                error
            } = await supabase
                .from(
                    "payment_methods"
                )
                .insert({

                    service_id:
                        service.id,

                    name:
                        String(
                            name
                        ).trim(),

                    type,

                    icon_path:
                        icons[type] ||
                        null,

                    instructions:
                        String(
                            instructions
                        ).trim(),

                    account_name:
                        account_name
                            ? String(
                                account_name
                            ).trim()
                            : null,

                    account_number:
                        account_number
                            ? String(
                                account_number
                            ).trim()
                            : null,

                    bank_name:
                        bank_name
                            ? String(
                                bank_name
                            ).trim()
                            : null,

                    phone_number:
                        phone_number
                            ? String(
                                phone_number
                            ).trim()
                            : null,

                    enabled:
                        true
                })
                .select(
                    "*"
                )
                .single();


            if (
                error
            ) {

                console.error(
                    "Save payment method error:",
                    error
                );


                return res.status(500).json({
                    error:
                        "Could not save payment method."
                });
            }


            res.status(201).json({

                payment_method:
                    data
            });

        } catch (error) {

            console.error(
                error
            );


            res.status(500).json({
                error:
                    "Could not save payment method."
            });
        }
    }
);



/* ============================================================
   MERCHANT HOSTED PAYMENT LINKS
============================================================ */

async function loadMerchantService(
    req,
    serviceId
) {
    const {
        data: service,
        error
    } =
        await supabase
            .from("services")
            .select("*")
            .eq("id", serviceId)
            .eq("merchant_id", req.merchant.id)
            .maybeSingle();

    return {
        service,
        error
    };
}


app.get(
    "/api/merchant/apps/:id/payment-links",
    authenticateMerchant,
    async (req, res) => {
        try {
            const result =
                await loadMerchantService(
                    req,
                    req.params.id
                );

            if (result.error) {
                console.error(
                    "Payment-link service lookup error:",
                    result.error
                );
                return res.status(500).json({
                    error:
                        "Could not load payment links."
                });
            }

            if (!result.service) {
                return res.status(404).json({
                    error:
                        "Application not found."
                });
            }

            const {
                data,
                error
            } =
                await supabase
                    .from("payment_links")
                    .select(`
                        id,
                        slug,
                        title,
                        description,
                        button_label,
                        return_url,
                        cancel_url,
                        status,
                        created_at,
                        updated_at,
                        products (
                            id,
                            name,
                            product_code,
                            amount,
                            currency,
                            payment_type,
                            subscription_interval,
                            allow_custom_amount
                        )
                    `)
                    .eq(
                        "service_id",
                        result.service.id
                    )
                    .order(
                        "created_at",
                        {
                            ascending:
                                false
                        }
                    );

            if (error) {
                console.error(
                    "Payment-link list error:",
                    error
                );
                return res.status(500).json({
                    error:
                        "Could not load payment links."
                });
            }

            res.json({
                payment_links:
                    data || []
            });

        } catch (error) {
            console.error(
                "Payment-link list route error:",
                error
            );
            res.status(500).json({
                error:
                    "Could not load payment links."
            });
        }
    }
);


app.post(
    "/api/merchant/apps/:id/payment-links",
    authenticateMerchant,
    async (req, res) => {

        try {

            const result =
                await loadMerchantService(
                    req,
                    req.params.id
                );

            if (result.error) {
                console.error(
                    "Payment-link service lookup error:",
                    result.error
                );
                return res.status(500).json({
                    error:
                        "Could not create payment link."
                });
            }

            if (!result.service) {
                return res.status(404).json({
                    error:
                        "Application not found."
                });
            }

            if (
                result.service.status !==
                "active"
            ) {
                return res.status(409).json({
                    error:
                        "The application must be approved before payment links can be used."
                });
            }

            const productId =
                String(
                    req.body?.product_id ||
                    ""
                ).trim();

            if (!productId) {
                return res.status(400).json({
                    error:
                        "product_id is required."
                });
            }

            const {
                data: product,
                error: productError
            } =
                await supabase
                    .from("products")
                    .select("*")
                    .eq("id", productId)
                    .eq(
                        "service_id",
                        result.service.id
                    )
                    .eq("status", "active")
                    .maybeSingle();

            if (
                productError ||
                !product
            ) {
                return res.status(404).json({
                    error:
                        "Active product not found for this application."
                });
            }

            let returnUrl =
                null;

            let cancelUrl =
                null;

            try {
                returnUrl =
                    normalizeRedirectUrl(
                        req.body?.return_url,
                        "return_url"
                    );

                cancelUrl =
                    normalizeRedirectUrl(
                        req.body?.cancel_url,
                        "cancel_url"
                    );

            } catch (error) {
                return res.status(400).json({
                    error:
                        error.publicMessage ||
                        error.message
                });
            }

            const defaultButtonLabel =
                product.payment_type ===
                    "subscribe"
                    ? "Subscribe"
                    : product.payment_type ===
                        "donate"
                        ? "Donate"
                        : "Pay Now";

            let slug = generatePaymentLinkSlug(
                result.service.slug,
                product.product_code
            );
            for (let attempt = 0; attempt < 5; attempt++) {
                const { data: slugMatch } = await supabase
                    .from("payment_links")
                    .select("id")
                    .eq("slug", slug)
                    .maybeSingle();
                if (!slugMatch) break;
                slug = generatePaymentLinkSlug(result.service.slug, product.product_code);
            }

            const {
                data,
                error
            } =
                await supabase
                    .from("payment_links")
                    .insert({
                        service_id:
                            result.service.id,
                        product_id:
                            product.id,
                        slug,
                        title:
                            String(
                                req.body?.title ||
                                product.name
                            )
                                .trim()
                                .slice(0, 120),
                        description:
                            String(
                                req.body?.description ||
                                product.description ||
                                ""
                            )
                                .trim()
                                .slice(0, 500) ||
                            null,
                        button_label:
                            String(
                                req.body?.button_label ||
                                defaultButtonLabel
                            )
                                .trim()
                                .slice(0, 40) ||
                            defaultButtonLabel,
                        return_url:
                            returnUrl,
                        cancel_url:
                            cancelUrl,
                        status:
                            "active"
                    })
                    .select("*")
                    .single();

            if (error) {
                console.error(
                    "Create payment-link database error:",
                    error
                );
                return res.status(500).json({
                    error:
                        "Could not create payment link."
                });
            }

            res.status(201).json({
                payment_link:
                    data,
                payment_url:
                    PUBLIC_SITE_URL +
                    "/checkout/" +
                    encodeURIComponent(
                        data.slug
                    )
            });

        } catch (error) {
            console.error(
                "Create payment-link route error:",
                error
            );
            res.status(500).json({
                error:
                    error.publicMessage ||
                    "Could not create payment link."
            });
        }
    }
);

/* ============================================================
   V1 REGISTER USER
============================================================ */

app.post(
    "/api/v1/users",
    authenticateService,
    async (
        req,
        res
    ) => {

        try {

            const {
                external_user_id,
                email
            } = req.body;


            if (
                !external_user_id ||
                !email
            ) {

                return res.status(400).json({
                    error:
                        "external_user_id and email are required."
                });
            }


            const {
                data,
                error
            } = await supabase
                .from(
                    "service_users"
                )
                .upsert({

                    service_id:
                        req.service.id,

                    external_user_id:
                        String(
                            external_user_id
                        ),

                    email:
                        normalizeEmail(
                            email
                        )

                }, {

                    onConflict:
                        "service_id,external_user_id"
                })
                .select(
                    "id,external_user_id,email,created_at"
                )
                .single();


            if (
                error
            ) {

                console.error(
                    "Register user error:",
                    error
                );


                return res.status(500).json({
                    error:
                        "Could not register customer."
                });
            }


            res.json({

                user:
                    data
            });

        } catch (error) {

            console.error(
                error
            );


            res.status(500).json({

                error:
                    "Could not register customer."
            });
        }
    }
);


/* ============================================================
   V1 CREATE PAYMENT
============================================================ */

async function handleV1CreatePayment(
    req,
    res
) {

        try {

            const {
                external_user_id,
                product_code,
                return_url,
                amount,
                customer_reference
            } = req.body;


            if (
                !external_user_id ||
                !product_code
            ) {

                return res.status(400).json({
                    error:
                        "external_user_id and product_code are required."
                });
            }


            const {
                data: user
            } = await supabase
                .from(
                    "service_users"
                )
                .select(
                    "*"
                )
                .eq(
                    "service_id",
                    req.service.id
                )
                .eq(
                    "external_user_id",
                    String(
                        external_user_id
                    )
                )
                .maybeSingle();


            if (
                !user
            ) {

                return res.status(404).json({
                    error:
                        "Customer has not been registered."
                });
            }


            const {
                data: product,
                error:
                    productError
            } = await supabase
                .from(
                    "products"
                )
                .select(
                    "*"
                )
                .eq(
                    "service_id",
                    req.service.id
                )
                .eq(
                    "product_code",
                    String(
                        product_code
                    )
                        .trim()
                        .toLowerCase()
                )
                .eq(
                    "status",
                    "active"
                )
                .maybeSingle();


            if (
                productError ||
                !product
            ) {

                return res.status(404).json({
                    error:
                        "Active product not found."
                });
            }


            let finalAmount;


            if (
                product.payment_type ===
                    "donate" &&
                product.allow_custom_amount
            ) {

                finalAmount =
                    Number(
                        amount
                    );

            } else {

                finalAmount =
                    Number(
                        product.amount
                    );
            }


            if (
                !Number.isFinite(
                    finalAmount
                ) ||
                finalAmount <=
                    0
            ) {

                return res.status(400).json({
                    error:
                        "Invalid payment amount."
                });
            }


            let normalizedReturnUrl =
                null;


            if (
                return_url
            ) {
                try {
                    const normalized =
                        normalizeRedirectUrl(
                            return_url,
                            "return_url"
                        );

                    if (
                        /^https?:$/i.test(
                            new URL(normalized).protocol
                        )
                    ) {
                        const allowedOrigins =
                            Array.isArray(
                                req.service.allowed_origins
                            )
                                ? req.service.allowed_origins
                                    .map(
                                        value =>
                                            String(
                                                value || ""
                                            )
                                                .trim()
                                                .replace(
                                                    /\/$/,
                                                    ""
                                                )
                                    )
                                    .filter(Boolean)
                                : [];

                        if (
                            allowedOrigins.length &&
                            !allowedOrigins.includes(
                                new URL(
                                    normalized
                                ).origin.replace(
                                    /\/$/,
                                    ""
                                )
                            )
                        ) {
                            return res.status(400).json({
                                error:
                                    "return_url is not allowed for this application."
                            });
                        }
                    }

                    normalizedReturnUrl =
                        normalized;
                } catch (error) {
                    return res.status(400).json({
                        error:
                            error.publicMessage ||
                            "Invalid return_url."
                    });
                }
            }

            const expiresAt =
                addMinutes(
                    PAYMENT_SESSION_MINUTES
                );


            const {
                data: payment,
                error:
                    paymentError
            } = await supabase
                .from(
                    "payments"
                )
                .insert({

                    payment_reference:
                        generateReference(),

                    processing_page_id:
                        "SPP-" + randomHex(10).toUpperCase(),

                    customer_reference:
                        customer_reference ? String(customer_reference).trim().slice(0,160) : null,

                    service_id:
                        req.service.id,

                    service_user_id:
                        user.id,

                    product_id:
                        product.id,

                    amount:
                        finalAmount,

                    currency:
                        product.currency,

                    payment_type:
                        product.payment_type,

                    status:
                        "pending",

                    payment_state:
                        "awaiting_payment",

                    return_url:
                        normalizedReturnUrl,

                    expires_at:
                        expiresAt
                })
                .select(
                    `
                    id,
                    payment_reference,
                    processing_page_id,
                    customer_reference,
                    amount,
                    currency,
                    payment_type,
                    status,
                    expires_at
                    `
                )
                .single();


            if (
                paymentError
            ) {

                console.error(
                    "Create payment database error:",
                    paymentError
                );


                return res.status(500).json({
                    error:
                        "Could not create payment session."
                });
            }


            const rawSessionToken =
                randomToken();


            const {
                error:
                    sessionError
            } = await supabase
                .from(
                    "payment_sessions"
                )
                .insert({

                    payment_id:
                        payment.id,

                    session_token_hash:
                        hash(
                            rawSessionToken
                        ),

                    expires_at:
                        expiresAt
                });


            if (
                sessionError
            ) {

                console.error(
                    "Create payment session error:",
                    sessionError
                );


                return res.status(500).json({
                    error:
                        "Could not create payment session."
                });
            }


            await persistPaymentEvent(
                {
                    ...payment,
                    service_id:
                        req.service.id,
                    payment_state:
                        "awaiting_payment"
                },
                "payment.created",
                "created",
                "awaiting_payment"
            );

            await enqueueWebhookEvent(
                "payment.created",
                {
                    ...payment,
                    service_id:
                        req.service.id,
                    payment_state:
                        "awaiting_payment"
                }
            );

            res.status(201).json({

                payment: {
                    ...payment,
                    payment_state: "awaiting_payment"
                },

                payment_url:
                    PUBLIC_SITE_URL + "/index.html?pay=" + rawSessionToken,

                receipt_url:
                    PUBLIC_SITE_URL + "/receipt/" + encodeURIComponent(payment.processing_page_id)
            });

        } catch (error) {

            console.error(
                "Create payment session error:",
                error
            );


            res.status(500).json({
                error:
                    "Could not create payment session."
            });
        }
}


app.post(
    "/api/v1/payments",
    authenticateService,
    idempotencyMiddleware(
        "/api/v1/payments"
    ),
    handleV1CreatePayment
);

app.post(
    "/api/v1/public/payments",
    authenticateSdk,
    idempotencyMiddleware(
        "/api/v1/public/payments"
    ),
    async (req,res)=>{
        try{
            const externalUserId=String(
                req.body?.external_user_id||""
            ).trim();
            const email=normalizeEmail(req.body?.email);

            if(
                !externalUserId||
                !email||
                !isValidEmail(email)
            ){
                return res.status(400).json({
                    error:
                        "external_user_id and a valid email are required."
                });
            }

            const {error:userError}=await supabase
                .from("service_users")
                .upsert(
                    {
                        service_id:req.service.id,
                        external_user_id:externalUserId,
                        email
                    },
                    {
                        onConflict:
                            "service_id,external_user_id"
                    }
                );

            if(userError)throw userError;

            req.body={
                ...(req.body||{}),
                external_user_id:
                    externalUserId
            };

            return handleV1CreatePayment(
                req,
                res
            );
        }catch(error){
            console.error(
                "Public SDK payment creation error:",
                error
            );
            return res.status(500).json({
                error:
                    "Could not create payment."
            });
        }
    }
);

app.get(
    "/api/v1/public/payments/:paymentId",
    authenticateSdk,
    async(req,res)=>{
        try{
            const {data:payment,error}=await supabase
                .from("payments")
                .select(
                    "id,payment_reference,processing_page_id,customer_reference,amount,currency,payment_type,status,payment_state,receipt_uploaded_at,approved_at,completed_at,code_issued_at,redeemed_at,rejection_reason,cancelled_at,expires_at,return_url,service_id,product_id,products(name,product_code,subscription_interval)"
                )
                .eq("id",req.params.paymentId)
                .eq("service_id",req.service.id)
                .maybeSingle();

            if(error)throw error;
            if(!payment){
                return res.status(404).json({
                    error:"Payment not found."
                });
            }

            const {data:token}=await supabase
                .from("payment_tokens")
                .select("expires_at")
                .eq("payment_id",payment.id)
                .maybeSingle();

            res.json({
                payment:{
                    ...payment,
                    receipt_url:
                        payment.processing_page_id
                            ? PUBLIC_SITE_URL+"/receipt/"+encodeURIComponent(payment.processing_page_id)
                            : null,
                    code_expires_at:
                        token?.expires_at||null
                }
            });
        }catch(error){
            console.error(
                "Public payment status error:",
                error
            );
            res.status(500).json({
                error:
                    "Could not load payment status."
            });
        }
    }
);

/* ============================================================
   V1 VERIFY PAYMENT
============================================================ */


async function handleVerifyPayment(
    req,
    res
) {
        try {
            const externalUserId = String(req.body?.external_user_id || "").trim();
            const rawToken = String(req.body?.token || "").trim().toUpperCase();

            const requestedPaymentId = String(
                req.body?.payment_id || ""
            ).trim();

            if (!externalUserId || !rawToken) {
                return res.status(400).json({
                    error:
                        "external_user_id and token are required."
                });
            }

            if (
                externalUserId.length > 160 ||
                !/^SBP-[A-Z0-9-]{8,64}$/.test(rawToken)
            ) {
                return res.status(400).json({
                    verified:false,
                    reason:"INVALID_TOKEN_FORMAT"
                });
            }

            if(requestedPaymentId){
                const {data:boundToken}=await supabase
                    .from("payment_tokens")
                    .select("payment_id")
                    .eq("service_id",req.service.id)
                    .eq("token_hash",hash(rawToken))
                    .maybeSingle();

                if(
                    !boundToken ||
                    boundToken.payment_id!==requestedPaymentId
                ){
                    return res.status(400).json({
                        verified:false,
                        reason:"PAYMENT_CODE_MISMATCH"
                    });
                }
            }

            const {data:serviceUser} = await supabase
                .from("service_users")
                .select("id")
                .eq("service_id",req.service.id)
                .eq("external_user_id",externalUserId)
                .maybeSingle();

            const sourceIp = String(
                req.get("CF-Connecting-IP") ||
                req.ip ||
                "unknown"
            );

            const attemptKeyHash = hash(
                [
                    req.service.id,
                    externalUserId,
                    sourceIp
                ].join(":")
            );

            const windowStart = new Date(
                Date.now() -
                PAYMENT_VERIFICATION_WINDOW_MINUTES *
                60 *
                1000
            ).toISOString();

            const {
                count:failedAttempts,
                error:attemptCountError
            } = await supabase
                .from("payment_verification_attempts")
                .select(
                    "id",
                    {
                        count:"exact",
                        head:true
                    }
                )
                .eq("service_id",req.service.id)
                .eq("attempt_key_hash",attemptKeyHash)
                .eq("success",false)
                .gte("created_at",windowStart);

            if(attemptCountError){
                console.error(
                    "Payment verification rate-limit lookup error:",
                    attemptCountError
                );

                return res.status(500).json({
                    error:
                        "Payment verification failed."
                });
            }

            if(
                Number(failedAttempts || 0) >=
                PAYMENT_VERIFICATION_MAX_ATTEMPTS
            ){
                return res.status(429).json({
                    verified:false,
                    reason:"TOO_MANY_ATTEMPTS",
                    retry_after_seconds:
                        PAYMENT_VERIFICATION_WINDOW_MINUTES * 60
                });
            }

            const result = await supabase.rpc(
                "redeem_payment_token",
                {
                    p_service_id:
                        req.service.id,

                    p_external_user_id:
                        externalUserId,

                    p_token_hash:
                        hash(rawToken)
                }
            );

            if(result.error){
                console.error(
                    "Redeem token RPC error:",
                    result.error
                );

                return res.status(500).json({
                    error:
                        "Payment verification failed."
                });
            }

            const verified =
                Boolean(result.data?.success);

            if (verified) {
                const {
                    error:
                        completionError
                } = await supabase
                    .from("payments")
                    .update({
                        payment_state:
                            "completed"
                    })
                    .eq(
                        "id",
                        result.data.payment_id
                    )
                    .eq(
                        "service_id",
                        req.service.id
                    )
                    .eq(
                        "payment_state",
                        "redeemed"
                    );

                if (completionError) {
                    console.error(
                        "Payment completion state update error:",
                        completionError
                    );
                    return res.status(500).json({
                        error:
                            "Payment verification completed but could not finalize the payment state."
                    });
                }

                const {
                    data:completedPayment
                } = await supabase
                    .from("payments")
                    .select("*")
                    .eq("id",result.data.payment_id)
                    .maybeSingle();

                if(completedPayment){
                    await persistPaymentEvent(
                        completedPayment,
                        "payment.redeemed",
                        "approved",
                        "completed",
                        {
                            external_user_id:
                                externalUserId
                        }
                    );

                    await enqueueWebhookEvent(
                        "payment.completed",
                        completedPayment,
                        {
                            external_user_id:
                                externalUserId
                        }
                    );
                }
            }

            await supabase
                .from("payment_verification_attempts")
                .insert({
                    service_id:
                        req.service.id,

                    service_user_id:
                        serviceUser?.id || null,

                    attempt_key_hash:
                        attemptKeyHash,

                    success:
                        verified
                });

            if(!verified){
                return res.status(400).json({
                    verified:false,
                    reason:
                        result.data?.reason ||
                        "VERIFICATION_FAILED"
                });
            }

            return res.json({
                verified:true,
                payment_id:
                    result.data.payment_id,
                product_id:
                    result.data.product_id,
                amount:
                    result.data.amount,
                currency:
                    result.data.currency,
                payment_type:
                    result.data.payment_type,
                status:
                    "completed",
                unlocked:
                    true
            });
        }catch(error){
            console.error(
                "Verify payment error:",
                error
            );

            return res.status(500).json({
                error:
                    "Payment verification failed."
            });
        }
}


app.post(
    "/api/v1/verify-payment",
    authenticateService,
    idempotencyMiddleware(
        "/api/v1/verify-payment"
    ),
    handleVerifyPayment
);

app.post(
    "/api/v1/public/payments/:paymentId/redeem",
    authenticateSdk,
    idempotencyMiddleware(
        "/api/v1/public/payments/:paymentId/redeem"
    ),
    async(req,res)=>{
        req.body={
            ...(req.body||{}),
            payment_id:
                req.params.paymentId
        };
        return handleVerifyPayment(req,res);
    }
);

/* ============================================================
   V1 PAYMENT LOOKUP
============================================================ */

app.get(
    "/api/v1/payments/:paymentId",
    authenticateService,
    async (req,res) => {
        try{
            const {
                data:payment,
                error
            } = await supabase
                .from("payments")
                .select(
                    "id,payment_reference,processing_page_id,customer_reference,amount,currency,payment_type,status,payment_state,code_issued_at,redeemed_at,created_at,approved_at,completed_at,rejection_reason,cancelled_at,expires_at,service_id"
                )
                .eq(
                    "id",
                    req.params.paymentId
                )
                .eq(
                    "service_id",
                    req.service.id
                )
                .maybeSingle();

            if(error) throw error;

            if(!payment){
                return res.status(404).json({
                    error:
                        "Payment not found."
                });
            }

            return res.json({
                payment:{
                    ...payment,

                    receipt_url:
                        payment.processing_page_id
                            ? PUBLIC_SITE_URL +
                              "/receipt/" +
                              encodeURIComponent(
                                  payment.processing_page_id
                              )
                            : null
                }
            });
        }catch(error){
            console.error(
                "Payment lookup error:",
                error
            );

            return res.status(500).json({
                error:
                    "Could not load payment."
            });
        }
    }
);


/* ============================================================
   V1 CANCEL PAYMENT
============================================================ */

async function handleV1CancelPayment(
    req,
    res
) {
        try{
            const {
                data:payment,
                error
            } = await supabase
                .from("payments")
                .select(
                    "id,status,return_url,cancel_url,processing_page_id"
                )
                .eq(
                    "id",
                    req.params.paymentId
                )
                .eq(
                    "service_id",
                    req.service.id
                )
                .maybeSingle();

            if(error) throw error;

            if(!payment){
                return res.status(404).json({
                    error:
                        "Payment not found."
                });
            }

            if(
                ![
                    "pending",
                    "awaiting_receipt"
                ].includes(payment.status)
            ){
                return res.status(409).json({
                    error:
                        "Only payments still awaiting payment can be cancelled."
                });
            }

            const {
                error:updateError
            } = await supabase
                .from("payments")
                .update({
                    status:
                        "cancelled",

                    payment_state:
                        "cancelled",

                    cancel_reason:
                        "Application cancelled payment.",

                    cancelled_at:
                        new Date().toISOString()
                })
                .eq(
                    "id",
                    payment.id
                )
                .eq(
                    "service_id",
                    req.service.id
                )
                .eq(
                    "status",
                    payment.status
                );

            if(updateError) throw updateError;

            await supabase
                .from("audit_logs")
                .insert({
                    actor_type:
                        "service",
                    actor_id:
                        req.service.id,
                    action:
                        "payment_cancelled",
                    payment_id:
                        payment.id,
                    metadata:{
                        reason:
                            "service_cancelled"
                    }
                });

            await persistPaymentEvent(
                {
                    id:
                        payment.id,
                    service_id:
                        req.service.id,
                    status:
                        "cancelled",
                    payment_state:
                        "cancelled"
                },
                "payment.cancelled",
                payment.status,
                "cancelled"
            );

            await enqueueWebhookEvent(
                "payment.cancelled",
                {
                    id:
                        payment.id,
                    service_id:
                        req.service.id,
                    payment_reference:
                        null,
                    status:
                        "cancelled",
                    payment_state:
                        "cancelled",
                    payment_type:
                        null,
                    amount:
                        null,
                    currency:
                        null,
                    product_id:
                        null
                },
                {
                    reason:
                        "service_cancelled"
                }
            );

            return res.json({
                success:true,
                status:
                    "cancelled",
                return_url:
                    payment.return_url,
                cancel_url:
                    payment.cancel_url ||
                    payment.return_url,
                receipt_url:
                    payment.processing_page_id
                        ? PUBLIC_SITE_URL +
                          "/receipt/" +
                          encodeURIComponent(
                              payment.processing_page_id
                          )
                        : null
            });
        }catch(error){
            console.error(
                "API payment cancellation error:",
                error
            );

            return res.status(500).json({
                error:
                    "Could not cancel payment."
            });
        }
}


app.post(
    "/api/v1/payments/:paymentId/cancel",
    authenticateService,
    idempotencyMiddleware(
        "/api/v1/payments/:paymentId/cancel"
    ),
    handleV1CancelPayment
);

app.post(
    "/api/v1/public/payments/:paymentId/cancel",
    authenticateSdk,
    idempotencyMiddleware(
        "/api/v1/public/payments/:paymentId/cancel"
    ),
    handleV1CancelPayment
);

/* ============================================================
   DONATION CAMPAIGN HELPERS
============================================================ */

async function getDonationStats(
    productId
) {
    const {
        data,
        error
    } =
        await supabase
            .from("payments")
            .select(
                "amount"
            )
            .eq(
                "product_id",
                productId
            )
            .eq(
                "payment_type",
                "donate"
            )
            .eq(
                "status",
                "completed"
            );

    if (error) {
        throw error;
    }

    const rows =
        data || [];

    const raised =
        Math.round(
            rows.reduce(
                (total, row) =>
                    total +
                    Number(
                        row.amount ||
                        0
                    ),
                0
            ) * 100
        ) / 100;

    return {
        raised,
        donorCount:
            rows.length
    };
}


function serializeDonationCampaign(
    product,
    stats
) {
    const goal =
        product.donation_goal !== null &&
        product.donation_goal !== undefined
            ? Number(
                product.donation_goal
            )
            : null;

    const raised =
        Number(
            stats?.raised || 0
        );

    return {
        enabled:
            product.payment_type ===
                "donate",
        goal,
        raised,
        remaining:
            goal !== null
                ? Math.max(
                    0,
                    Math.round(
                        (goal - raised) * 100
                    ) / 100
                )
                : null,
        progress_percent:
            goal !== null && goal > 0
                ? Math.min(
                    100,
                    Math.round(
                        (raised / goal) * 1000
                    ) / 10
                )
                : null,
        donor_count:
            Number(
                stats?.donorCount || 0
            ),
        minimum:
            product.donation_minimum !== null
                ? Number(
                    product.donation_minimum
                )
                : null,
        maximum:
            product.donation_maximum !== null
                ? Number(
                    product.donation_maximum
                )
                : null,
        presets:
            Array.isArray(
                product.donation_presets
            )
                ? product.donation_presets
                    .map(value => Number(value))
                    .filter(value =>
                        Number.isFinite(value) &&
                        value > 0
                    )
                : [],
        goal_message:
            product.donation_goal_message ||
            null,
        end_at:
            product.donation_end_at ||
            null,
        show_goal:
            Boolean(
                product.show_donation_goal
            ),
        show_donor_count:
            Boolean(
                product.show_donor_count
            ),
        close_on_goal:
            Boolean(
                product.close_on_goal
            ),
        goal_reached:
            goal !== null &&
            raised >= goal
    };
}


/* ============================================================
   PUBLIC DONATIONS — NO APP INTEGRATION
============================================================ */
app.get("/api/public/donations/:slug",async(req,res)=>{
  try{
    const {data:c,error}=await supabase.from("donation_campaigns").select("*").eq("slug",String(req.params.slug||"").trim().toLowerCase()).eq("status","active").maybeSingle();
    if(error)throw error;if(!c)return res.status(404).json({error:"Donation campaign not found."});
    const {data:methods}=await supabase.from("donation_payment_methods").select("id,name,type,icon_path").eq("merchant_id",c.merchant_id).eq("enabled",true).order("name");
    const {data:rows}=await supabase.from("payments").select("amount,status").eq("donation_campaign_id",c.id);
    const done=(rows||[]).filter(x=>x.status==="completed");const raised=done.reduce((a,x)=>a+Number(x.amount||0),0);
    const {data:merchant}=await supabase.from("merchant_profiles").select("business_name").eq("id",c.merchant_id).maybeSingle();
    res.json({donation:{id:c.id,slug:c.slug,name:c.name,description:c.description,currency:c.currency,allow_custom_amount:c.allow_custom_amount,fixed_amount:c.fixed_amount,minimum_amount:c.minimum_amount,maximum_amount:c.maximum_amount,presets:c.presets,goal:c.goal,goal_message:c.goal_message,end_at:c.end_at,raised,donor_count:done.length,remaining:c.goal===null?null:Math.max(0,Number(c.goal)-raised),progress_percent:c.goal===null?null:Math.min(100,raised/Number(c.goal)*100),goal_reached:c.goal!==null&&raised>=Number(c.goal)},merchant:{name:merchant?.business_name||"Merchant"},payment_methods:methods||[]});
  }catch(e){console.error(e);res.status(500).json({error:"Could not load donation campaign."});}
});
app.post("/api/public/donations/:slug/payments",async(req,res)=>{
  try{
    const email=normalizeEmail(req.body?.email);if(!isValidEmail(email))return res.status(400).json({error:"Enter a valid email address."});
    const {data:c,error}=await supabase.from("donation_campaigns").select("*").eq("slug",String(req.params.slug||"").trim().toLowerCase()).eq("status","active").maybeSingle();if(error)throw error;if(!c)return res.status(404).json({error:"Donation campaign not found."});
    if(c.end_at&&new Date(c.end_at)<=new Date())return res.status(410).json({error:"This donation campaign has ended."});
    const amount=c.allow_custom_amount?Number(req.body?.amount):Number(c.fixed_amount);
    if(!Number.isFinite(amount)||amount<=0)return res.status(400).json({error:"Enter a valid donation amount."});
    if(c.minimum_amount!==null&&amount<Number(c.minimum_amount))return res.status(400).json({error:"Donation is below the minimum allowed amount."});
    if(c.maximum_amount!==null&&amount>Number(c.maximum_amount))return res.status(400).json({error:"Donation exceeds the maximum allowed amount."});
    const expiresAt=addMinutes(PAYMENT_SESSION_MINUTES);
    const {data:p,error:pe}=await supabase.from("payments").insert({payment_reference:generateReference(),processing_page_id:"SPP-"+randomHex(10).toUpperCase(),customer_reference:String(req.body?.customer_reference||"").trim().slice(0,160)||null,customer_email:email,service_id:null,service_user_id:null,product_id:null,donation_campaign_id:c.id,amount:Math.round(amount*100)/100,currency:c.currency,payment_type:"donate",status:"pending",payment_state:"awaiting_payment",donor_name:req.body?.donor_anonymous?null:String(req.body?.donor_name||"").trim().slice(0,120)||null,donor_message:String(req.body?.donor_message||"").trim().slice(0,500)||null,donor_anonymous:Boolean(req.body?.donor_anonymous),expires_at:expiresAt}).select("id,payment_reference,processing_page_id,customer_reference,amount,currency,payment_type,status,expires_at").single();
    if(pe)throw pe;
    const rawSessionToken=randomToken();const {error:se}=await supabase.from("payment_sessions").insert({payment_id:p.id,session_token_hash:hash(rawSessionToken),expires_at:expiresAt});if(se)throw se;
    res.status(201).json({payment:p,payment_url:PUBLIC_SITE_URL+"/index.html?pay="+rawSessionToken});
  }catch(e){console.error("Donation payment error:",e);res.status(500).json({error:"Could not start donation."});}
});

/* ============================================================
   PUBLIC HOSTED PAYMENT LINKS
============================================================ */

app.get(
    "/api/public/links/:slug",
    async (req, res) => {

        try {

            const {
                data: link,
                error
            } =
                await supabase
                    .from("payment_links")
                    .select(`
                        id,
                        slug,
                        title,
                        description,
                        button_label,
                        status,
                        products (
                            id,
                            name,
                            description,
                            payment_type,
                            amount,
                            currency,
                            subscription_interval,
                            allow_custom_amount,
                            donation_goal,
                            donation_minimum,
                            donation_maximum,
                            donation_presets,
                            donation_goal_message,
                            donation_end_at,
                            show_donation_goal,
                            show_donor_count,
                            close_on_goal,
                            status
                        ),
                        services (
                            name,
                            slug,
                            status
                        ),
                        donation_campaigns (
                            name,
                            slug,
                            merchant_id,
                            status
                        )
                    `)
                    .eq(
                        "slug",
                        String(
                            req.params.slug ||
                            ""
                        ).trim().toLowerCase()
                    )
                    .eq(
                        "status",
                        "active"
                    )
                    .maybeSingle();

            if (error) {
                console.error(
                    "Public payment-link lookup error:",
                    error
                );
                return res.status(500).json({
                    error:
                        "Could not load this payment link."
                });
            }

            if (
                !link ||
                link.services?.status !==
                    "active" ||
                link.products?.status !==
                    "active"
            ) {
                return res.status(404).json({
                    error:
                        "This payment link is no longer available."
                });
            }

            let donationStats = {
                raised:
                    0,
                donorCount:
                    0
            };

            if (
                link.products?.payment_type ===
                    "donate"
            ) {
                try {
                    donationStats =
                        await getDonationStats(
                            link.products.id
                        );
                } catch (statsError) {
                    console.error(
                        "Donation stats lookup error:",
                        statsError
                    );
                }
            }

            res.json({
                payment_link: {
                    id:
                        link.id,
                    slug:
                        link.slug,
                    title:
                        link.title,
                    description:
                        link.description,
                    button_label:
                        link.button_label,
                    product:
                        link.products,
                    donation:
                        serializeDonationCampaign(
                            link.products,
                            donationStats
                        ),
                    service: {
                        name:
                            link.services.name,
                        slug:
                            link.services.slug
                    }
                }
            });

        } catch (error) {
            console.error(
                "Public payment-link lookup route error:",
                error
            );
            res.status(500).json({
                error:
                    "Could not load this payment link."
            });
        }
    }
);


app.post(
    "/api/public/links/:slug/payments",
    async (req, res) => {

        try {

            const email =
                normalizeEmail(
                    req.body?.email
                );

            if (
                !email ||
                !isValidEmail(email)
            ) {
                return res.status(400).json({
                    error:
                        "Enter a valid email address."
                });
            }

            const {
                data: link,
                error
            } =
                await supabase
                    .from("payment_links")
                    .select(`
                        id,
                        service_id,
                        return_url,
                        cancel_url,
                        status,
                        products (
                            id,
                            name,
                            description,
                            payment_type,
                            amount,
                            currency,
                            allow_custom_amount,
                            donation_goal,
                            donation_minimum,
                            donation_maximum,
                            donation_presets,
                            donation_goal_message,
                            donation_end_at,
                            show_donation_goal,
                            show_donor_count,
                            close_on_goal,
                            status
                        ),
                        services (
                            name,
                            status
                        )
                    `)
                    .eq(
                        "slug",
                        String(
                            req.params.slug ||
                            ""
                        ).trim().toLowerCase()
                    )
                    .eq(
                        "status",
                        "active"
                    )
                    .maybeSingle();

            if (error) {
                console.error(
                    "Hosted payment-link lookup error:",
                    error
                );
                return res.status(500).json({
                    error:
                        "Could not start payment."
                });
            }

            if (
                !link ||
                link.services?.status !==
                    "active" ||
                link.products?.status !==
                    "active"
            ) {
                return res.status(404).json({
                    error:
                        "This payment link is no longer available."
                });
            }

            const product =
                link.products;

            let donationStats = {
                raised:
                    0,
                donorCount:
                    0
            };

            if (
                product.payment_type ===
                    "donate"
            ) {
                try {
                    donationStats =
                        await getDonationStats(
                            product.id
                        );
                } catch (statsError) {
                    console.error(
                        "Donation stats lookup error:",
                        statsError
                    );

                    return res.status(500).json({
                        error:
                            "Could not load donation campaign."
                    });
                }

                const campaignEnd =
                    product.donation_end_at
                        ? new Date(
                            product.donation_end_at
                        )
                        : null;

                if (
                    campaignEnd &&
                    campaignEnd <=
                        new Date()
                ) {
                    return res.status(410).json({
                        error:
                            "This donation campaign has ended."
                    });
                }

                if (
                    product.close_on_goal &&
                    product.donation_goal &&
                    donationStats.raised >=
                        Number(
                            product.donation_goal
                        )
                ) {
                    return res.status(409).json({
                        error:
                            "This donation campaign has reached its goal."
                    });
                }
            }

            let amount =
                Number(
                    product.amount
                );

            if (
                product.payment_type ===
                    "donate" &&
                product.allow_custom_amount
            ) {
                amount =
                    Number(
                        req.body?.amount
                    );
            }

            if (
                !Number.isFinite(amount) ||
                amount <= 0 ||
                amount > 100000000
            ) {
                return res.status(400).json({
                    error:
                        "Enter a valid payment amount."
                });
            }

            amount =
                Math.round(
                    amount * 100
                ) / 100;

            if (
                product.payment_type ===
                    "donate"
            ) {
                if (
                    product.donation_minimum !==
                        null &&
                    amount <
                        Number(
                            product.donation_minimum
                        )
                ) {
                    return res.status(400).json({
                        error:
                            "The donation is below the minimum allowed amount."
                    });
                }

                if (
                    product.donation_maximum !==
                        null &&
                    amount >
                        Number(
                            product.donation_maximum
                        )
                ) {
                    return res.status(400).json({
                        error:
                            "The donation exceeds the maximum allowed amount."
                    });
                }
            }

            const donorAnonymous =
                Boolean(
                    req.body?.donor_anonymous
                );

            const donorName =
                donorAnonymous
                    ? null
                    : String(
                        req.body?.donor_name ||
                        ""
                    )
                        .trim()
                        .slice(
                            0,
                            120
                        ) ||
                        null;

            const donorMessage =
                String(
                    req.body?.donor_message ||
                    ""
                )
                    .trim()
                    .slice(
                        0,
                        500
                    ) ||
                    null;

            const externalUserId =
                "checkout_" +
                hash(
                    email
                ).slice(
                    0,
                    32
                );

            const {
                data: user,
                error: userError
            } =
                await supabase
                    .from("service_users")
                    .upsert({
                        service_id:
                            link.service_id,
                        external_user_id:
                            externalUserId,
                        email
                    }, {
                        onConflict:
                            "service_id,external_user_id"
                    })
                    .select(
                        "id,external_user_id,email"
                    )
                    .single();

            if (
                userError ||
                !user
            ) {
                console.error(
                    "Hosted payment-link customer error:",
                    userError
                );
                return res.status(500).json({
                    error:
                        "Could not create customer checkout session."
                });
            }

            const expiresAt =
                addMinutes(
                    PAYMENT_SESSION_MINUTES
                );

            const {
                data: payment,
                error: paymentError
            } =
                await supabase
                    .from("payments")
                    .insert({
                        payment_reference:
                            generateReference(),
                        processing_page_id:
                            "SPP-" + randomHex(10).toUpperCase(),
                        customer_reference:
                            customerReference,
                        service_id:
                            link.service_id,
                        service_user_id:
                            user.id,
                        product_id:
                            product.id,
                        amount,
                        currency:
                            product.currency,
                        payment_type:
                            product.payment_type,
                        status:
                            "pending",
                        return_url:
                            link.return_url,
                        cancel_url:
                            link.cancel_url,
                        payment_link_id:
                            link.id,
                        donor_name:
                            donorName,
                        donor_message:
                            donorMessage,
                        donor_anonymous:
                            donorAnonymous,
                        expires_at:
                            expiresAt
                    })
                    .select(`
                        id,
                        payment_reference,
                        processing_page_id,
                        customer_reference,
                        amount,
                        currency,
                        payment_type,
                        status,
                        payment_state,
                        expires_at
                    `)
                    .single();

            if (paymentError) {
                console.error(
                    "Hosted payment-link payment database error:",
                    paymentError
                );
                return res.status(500).json({
                    error:
                        "Could not create payment session."
                });
            }

            const rawSessionToken =
                randomToken();

            const {
                error: sessionError
            } =
                await supabase
                    .from("payment_sessions")
                    .insert({
                        payment_id:
                            payment.id,
                        session_token_hash:
                            hash(
                                rawSessionToken
                            ),
                        expires_at:
                            expiresAt
                    });

            if (sessionError) {
                console.error(
                    "Hosted payment-link session error:",
                    sessionError
                );
                return res.status(500).json({
                    error:
                        "Could not create payment session."
                });
            }

            res.status(201).json({
                payment,
                payment_url:
                    PUBLIC_SITE_URL +
                    "/index.html?pay=" +
                    rawSessionToken
            });

        } catch (error) {
            console.error(
                "Hosted payment-link payment route error:",
                error
            );
            res.status(500).json({
                error:
                    error.publicMessage ||
                    "Could not start payment."
            });
        }
    }
);


/* ============================================================
   PUBLIC PAYMENT SESSION
============================================================ */

app.get(
    "/api/public/session/:token",
    async (
        req,
        res
    ) => {

        try {

            const {
                data: session,
                error
            } = await supabase
                .from(
                    "payment_sessions"
                )
                .select(
                    `
                    id,
                    payment_id,
                    expires_at,

                    payments (
                        id,
                        payment_reference,
                        amount,
                        currency,
                        payment_type,
                        status,
                        receipt_uploaded_at,
                        service_id,
                        service_user_id,
                        donation_campaign_id,
                        payment_method_id,
                        payment_started_at,
                        payment_deadline_at,
                        return_url,
                        cancel_url,
                        payment_link_id,

                        payment_links (
                            title,
                            slug,
                            button_label
                        ),

                        products (
                            name,
                            product_code,
                            description,
                            payment_type,
                            subscription_interval,
                            allow_custom_amount
                        ),

                        services (
                            name,
                            slug,
                            status
                        ),
                        donation_campaigns (
                            name,
                            slug,
                            merchant_id,
                            status
                        )
                    )
                    `
                )
                .eq(
                    "session_token_hash",
                    hash(
                        req.params.token
                    )
                )
                .maybeSingle();


            if (
                error
            ) {

                console.error(
                    "Get payment session error:",
                    error
                );


                return res.status(500).json({
                    error:
                        "Could not load payment session."
                });
            }


            if (
                !session
            ) {

                return res.status(404).json({
                    expired:
                        true,
                    error:
                        "Payment session not found."
                });
            }


            if (
                new Date(
                    session.expires_at
                ) <=
                new Date()
            ) {

                return res.status(410).json({
                    expired:
                        true,
                    error:
                        "This payment session has expired."
                });
            }


            const payment =
                session.payments;


            if (
                !payment
            ) {

                return res.status(404).json({
                    error:
                        "Payment record not found."
                });
            }


            if (payment.donation_campaign_id) {
                if (!payment.donation_campaigns || payment.donation_campaigns.status !== "active") return res.status(403).json({error:"This donation campaign is no longer active."});
            } else if (payment.services?.status !== "active") {
                return res.status(403).json({error:"This application is no longer active."});
            }


            if (
                payment.status ===
                "cancelled"
            ) {

                return res.status(409).json({
                    cancelled:
                        true
                });
            }


            let methods = [];
            let methodsError = null;
            if (payment.donation_campaign_id) {
                const result = await supabase.from("donation_payment_methods").select("id,name,type,icon_path,instructions,account_name,account_number,bank_name,phone_number").eq("merchant_id",payment.donation_campaigns.merchant_id).eq("enabled",true).order("name");
                methods = result.data || [];
                methodsError = result.error;
            } else {
                const result = await supabase.from("payment_methods").select("id,name,type,icon_path").eq("service_id",payment.service_id).eq("enabled",true).order("name");
                methods = result.data || [];
                methodsError = result.error;
            }


            if (
                methodsError
            ) {

                console.error(
                    "Payment methods load error:",
                    methodsError
                );


                return res.status(500).json({
                    error:
                        "Could not load payment methods."
                });
            }


            res.json({

                expired:
                    false,

                session: {

                    expires_at:
                        session.expires_at
                },

                payment: {

                    id:
                        payment.id,

                    reference:
                        payment.payment_reference,

                    processing_page_id:
                        payment.processing_page_id,

                    customer_reference:
                        payment.customer_reference,

                    amount:
                        payment.amount,

                    currency:
                        payment.currency,

                    payment_type:
                        payment.payment_type,

                    status:
                        payment.status,

                    receipt_uploaded:
                        Boolean(
                            payment.receipt_uploaded_at
                        ),

                    payment_started_at:
                        payment.payment_started_at,

                    payment_deadline_at:
                        payment.payment_deadline_at,

                    return_url:
                        payment.return_url,

                    product:
                        payment.products
                },

                service: payment.donation_campaign_id
                    ? {name: payment.donation_campaigns.name, slug: payment.donation_campaigns.slug}
                    : {name: payment.services.name, slug: payment.services.slug},

                payment_methods:
                    methods || []
            });

        } catch (error) {

            console.error(
                "Public session error:",
                error
            );


            res.status(500).json({
                error:
                    "Could not load payment session."
            });
        }
    }
);


/* ============================================================
   PUBLIC PAYMENT METHOD
============================================================ */

app.get(
    "/api/public/session/:token/method/:methodId",
    async (
        req,
        res
    ) => {

        try {

            const {
                data: session,
                error
            } = await supabase
                .from(
                    "payment_sessions"
                )
                .select(
                    `
                    payment_id,
                    expires_at,

                    payments (
                        id,
                        service_id,
                        status,
                        payment_method_id,
                        donation_campaign_id,
                        payment_started_at,
                        payment_deadline_at,

                        services (
                            status
                        ),
                        donation_campaigns (
                            merchant_id,
                            status
                        )
                    )
                    `
                )
                .eq(
                    "session_token_hash",
                    hash(
                        req.params.token
                    )
                )
                .maybeSingle();


            if (
                error
            ) {

                console.error(
                    "Payment method session query error:",
                    error
                );


                return res.status(500).json({
                    error:
                        "Could not load payment method."
                });
            }


            if (
                !session
            ) {

                return res.status(404).json({
                    error:
                        "Payment session not found."
                });
            }


            if (
                new Date(
                    session.expires_at
                ) <=
                new Date()
            ) {

                return res.status(410).json({
                    expired:
                        true
                });
            }


            const payment =
                session.payments;


            if (
                !payment
            ) {

                return res.status(404).json({
                    error:
                        "Payment not found."
                });
            }


            if (payment.donation_campaign_id) {
                if (!payment.donation_campaigns || payment.donation_campaigns.status !== "active") return res.status(403).json({error:"This donation campaign is no longer active."});
            } else if (payment.services?.status !== "active") {
                return res.status(403).json({error:"This application is no longer active."});
            }


            if (
                ![
                    "pending",
                    "awaiting_receipt"
                ].includes(
                    payment.status
                )
            ) {

                return res.status(409).json({
                    error:
                        "This payment is no longer at the payment stage."
                });
            }


            let method;
            let methodError;
            if (payment.donation_campaign_id) {
                const result = await supabase.from("donation_payment_methods").select("id,name,type,icon_path,instructions,account_name,account_number,bank_name,phone_number").eq("id",req.params.methodId).eq("merchant_id",payment.donation_campaigns.merchant_id).eq("enabled",true).maybeSingle();
                method=result.data; methodError=result.error;
            } else {
                const result = await supabase.from("payment_methods").select("id,name,type,icon_path,instructions,account_name,account_number,bank_name,phone_number").eq("id",req.params.methodId).eq("service_id",payment.service_id).eq("enabled",true).maybeSingle();
                method=result.data; methodError=result.error;
            }

            if (
                methodError
            ) {

                console.error(
                    "Payment method lookup error:",
                    methodError
                );


                return res.status(500).json({
                    error:
                        "Could not load payment method."
                });
            }


            if (
                !method
            ) {

                return res.status(404).json({
                    error:
                        "Payment method not found."
                });
            }


            let startedAt =
                payment.payment_started_at;


            let deadlineAt =
                payment.payment_deadline_at;


            /*
             * Start payment attempt countdown
             * when account details are opened.
             */

            if (
                !startedAt
            ) {

                startedAt =
                    new Date()
                        .toISOString();


                deadlineAt =
                    addMinutes(
                        PAYMENT_ATTEMPT_MINUTES
                    );


                const {
                    error:
                        updateError
                } = await supabase
                    .from(
                        "payments"
                    )
                    .update({

                        payment_method_id:
                            method.id,

                        payment_started_at:
                            startedAt,

                        payment_deadline_at:
                            deadlineAt,

                        status:
                            "awaiting_receipt",

                        payment_state:
                            "awaiting_payment"
                    })
                    .eq(
                        "id",
                        payment.id
                    )
                    .eq(
                        "status",
                        "pending"
                    );


                if (
                    updateError
                ) {

                    console.error(
                        "Start payment attempt error:",
                        updateError
                    );


                    return res.status(500).json({
                        error:
                            "Could not start payment."
                    });
                }
            }


            if (
                new Date(
                    deadlineAt
                ) <=
                new Date()
            ) {

                await supabase
                    .from(
                        "payments"
                    )
                    .update({

                        status:
                            "expired"
                    })
                    .eq(
                        "id",
                        payment.id
                    );


                return res.status(410).json({
                    expired:
                        true
                });
            }


            res.json({

                method,

                payment_attempt: {

                    started_at:
                        startedAt,

                    deadline_at:
                        deadlineAt
                }
            });

        } catch (error) {

            console.error(
                "Public payment method error:",
                error
            );


            res.status(500).json({
                error:
                    "Could not load payment method."
            });
        }
    }
);


/* ============================================================
   RECEIPT UPLOAD
============================================================ */

app.post(
    "/api/public/session/:token/receipt",
    upload.single(
        "receipt"
    ),
    async (
        req,
        res
    ) => {

        try {

            if (
                !req.file
            ) {

                return res.status(400).json({
                    error:
                        "Please choose a payment receipt."
                });
            }


            const {
                data: session
            } = await supabase
                .from(
                    "payment_sessions"
                )
                .select(
                    "payment_id,expires_at"
                )
                .eq(
                    "session_token_hash",
                    hash(
                        req.params.token
                    )
                )
                .maybeSingle();


            if (
                !session
            ) {

                return res.status(404).json({
                    error:
                        "Payment session not found."
                });
            }


            if (
                new Date(
                    session.expires_at
                ) <=
                new Date()
            ) {

                return res.status(410).json({
                    expired:
                        true
                });
            }


            const {
                data: payment
            } = await supabase
                .from(
                    "payments"
                )
                .select(
                    `
                    id,
                    processing_page_id,
                    service_id,
                    status,
                    payment_deadline_at
                    `
                )
                .eq(
                    "id",
                    session.payment_id
                )
                .maybeSingle();


            if (
                !payment
            ) {

                return res.status(404).json({
                    error:
                        "Payment not found."
                });
            }


            if (
                payment.status !==
                "awaiting_receipt"
            ) {

                return res.status(409).json({
                    error:
                        "This payment is not accepting a receipt."
                });
            }


            if (
                payment.payment_deadline_at &&
                new Date(
                    payment.payment_deadline_at
                ) <=
                new Date()
            ) {

                await supabase
                    .from(
                        "payments"
                    )
                    .update({

                        status:
                            "expired"
                    })
                    .eq(
                        "id",
                        payment.id
                    );


                return res.status(410).json({
                    expired:
                        true
                });
            }


            const extensionMap = {
                "image/jpeg": "jpg",
                "image/jpg": "jpg",
                "image/png": "png",
                "image/webp": "webp",
                "application/pdf": "pdf"
            };

            const extension =
                extensionMap[req.file.mimetype] ||
                "bin";


            const storagePath =
                `${payment.id}/${randomHex(12)}.${extension}`;


            const {
                error:
                    uploadError
            } = await supabase
                .storage
                .from(
                    "payment-receipts"
                )
                .upload(
                    storagePath,
                    req.file.buffer,
                    {

                        contentType:
                            req.file.mimetype,

                        upsert:
                            false
                    }
                );


            if (
                uploadError
            ) {

                console.error(
                    "Receipt storage error:",
                    uploadError
                );


                return res.status(500).json({
                    error:
                        "We couldn't save your receipt. Please try again."
                });
            }


            const {
                error:
                    updateError
            } = await supabase
                .from(
                    "payments"
                )
                .update({

                    receipt_path:
                        storagePath,

                    receipt_uploaded_at:
                        new Date()
                            .toISOString(),

                    status:
                        "awaiting_verification",

                    payment_state:
                        "payment_submitted"
                })
                .eq(
                    "id",
                    payment.id
                )
                .eq(
                    "status",
                    "awaiting_receipt"
                );


            if (
                updateError
            ) {

                console.error(
                    "Receipt database update error:",
                    updateError
                );


                return res.status(500).json({
                    error:
                        "We couldn't submit your receipt. Please try again."
                });
            }


            await supabase
                .from(
                    "audit_logs"
                )
                .insert({

                    actor_type:
                        "system",

                    action:
                        "receipt_uploaded",

                    payment_id:
                        payment.id,

                    metadata: {

                        receipt_path:
                            storagePath,

                        mimetype:
                            req.file.mimetype,

                        size_bytes:
                            req.file.size
                    }
                });


            await persistPaymentEvent(
                {
                    ...payment,
                    service_id:
                        payment.service_id,
                    payment_state:
                        "payment_submitted"
                },
                "payment.receipt_submitted",
                "awaiting_payment",
                "payment_submitted"
            );

            await enqueueWebhookEvent(
                "payment.receipt_submitted",
                {
                    ...payment,
                    payment_state:
                        "payment_submitted",
                    status:
                        "awaiting_verification"
                }
            );

            res.json({

                success:
                    true,

                message:
                    "Receipt submitted for verification.",

                receipt_url:
                    payment.processing_page_id
                        ? PUBLIC_SITE_URL +
                          "/receipt/" +
                          encodeURIComponent(
                              payment.processing_page_id
                          )
                        : null
            });

        } catch (error) {

            console.error(
                "Receipt upload error:",
                error
            );


            res.status(500).json({
                error:
                    "We couldn't submit your receipt. Please try again."
            });
        }
    }
);


/* ============================================================
   CANCEL PAYMENT
============================================================ */

app.post(
    "/api/public/session/:token/cancel",
    async (
        req,
        res
    ) => {

        try {

            const {
                data: session
            } = await supabase
                .from(
                    "payment_sessions"
                )
                .select(
                    `
                    payment_id,
                    expires_at,

                    payments (
                        id,
                        status,
                        return_url,
                        cancel_url
                    )
                    `
                )
                .eq(
                    "session_token_hash",
                    hash(
                        req.params.token
                    )
                )
                .maybeSingle();


            if (
                !session
            ) {

                return res.status(404).json({
                    error:
                        "Payment session not found."
                });
            }


            if (
                new Date(
                    session.expires_at
                ) <=
                new Date()
            ) {

                return res.status(410).json({
                    expired:
                        true
                });
            }


            const payment =
                session.payments;


            if (
                !payment
            ) {

                return res.status(404).json({
                    error:
                        "Payment not found."
                });
            }


            if (
                [
                    "awaiting_verification",
                    "approved",
                    "completed"
                ].includes(
                    payment.status
                )
            ) {

                return res.status(409).json({
                    error:
                        "This payment can no longer be cancelled."
                });
            }


            const {
                error
            } = await supabase
                .from(
                    "payments"
                )
                .update({

                    status:
                        "cancelled",

                    payment_state:
                        "cancelled",

                    cancel_reason:
                        "Customer cancelled payment.",

                    cancelled_at:
                        new Date()
                            .toISOString()

                })
                .eq(
                    "id",
                    payment.id
                );


            if (
                error
            ) {

                console.error(
                    "Cancel payment database error:",
                    error
                );


                return res.status(500).json({
                    error:
                        "Could not cancel this payment."
                });
            }


            await supabase
                .from(
                    "audit_logs"
                )
                .insert({

                    actor_type:
                        "system",

                    action:
                        "payment_cancelled",

                    payment_id:
                        payment.id,

                    metadata: {

                        reason:
                            "customer_cancelled"
                    }
                });


            res.json({

                success:
                    true,

                return_url:
                    payment.return_url,

                cancel_url:
                    payment.cancel_url ||
                    payment.return_url
            });

        } catch (error) {

            console.error(
                "Cancel payment error:",
                error
            );


            res.status(500).json({
                error:
                    "Could not cancel this payment."
            });
        }
    }
);


/* ============================================================
   CUSTOMER PROCESSING RECEIPT + MERCHANT VERIFICATION
============================================================ */
app.get("/api/public/receipts/:reference",async(req,res)=>{
  try{
    const key=String(req.params.reference||"").trim();
    const {data:p,error}=await supabase.from("payments").select("id,payment_reference,processing_page_id,customer_reference,amount,currency,payment_type,status,created_at,approved_at,completed_at,rejection_reason,services(name,slug),products(name,product_code,subscription_interval),donation_campaigns(name,slug)").or("payment_reference.eq."+key+",processing_page_id.eq."+key).maybeSingle();
    if(error)throw error;if(!p)return res.status(404).json({error:"Processing receipt not found."});
    res.json({receipt:{reference:p.payment_reference,processing_page_id:p.processing_page_id,customer_reference:p.customer_reference,amount:p.amount,currency:p.currency,payment_type:p.payment_type,status:p.status,created_at:p.created_at,approved_at:p.approved_at,completed_at:p.completed_at,rejection_reason:p.rejection_reason,service:p.services?{name:p.services.name,slug:p.services.slug}:null,product:p.products?{name:p.products.name,code:p.products.product_code,interval:p.products.subscription_interval}:null,donation:p.donation_campaigns?{name:p.donation_campaigns.name,slug:p.donation_campaigns.slug}:null}});
  }catch(e){console.error(e);res.status(500).json({error:"Could not load processing receipt."});}
});
app.get("/receipt/:reference",(req,res)=>res.sendFile(path.join(__dirname,"public","receipt.html")));
async function ensureSubscriptionContract(payment){
  if(payment.payment_type!=="subscribe"||!payment.service_id||!payment.service_user_id||!payment.product_id)return null;
  let {data:existing}=await supabase.from("subscription_contracts").select("*").eq("current_payment_id",payment.id).maybeSingle();if(existing)return existing;
  ({data:existing}=await supabase.from("subscription_contracts").select("*").eq("initial_payment_id",payment.id).maybeSingle());if(existing)return existing;
  const {data:service}=await supabase.from("services").select("merchant_id").eq("id",payment.service_id).maybeSingle();const {data:product}=await supabase.from("products").select("subscription_interval").eq("id",payment.product_id).maybeSingle();if(!service?.merchant_id||!product?.subscription_interval)return null;
  const due=new Date();product.subscription_interval==="yearly"?due.setFullYear(due.getFullYear()+1):due.setMonth(due.getMonth()+1);
  const {data:contract,error}=await supabase.from("subscription_contracts").insert({merchant_id:service.merchant_id,service_id:payment.service_id,product_id:payment.product_id,service_user_id:payment.service_user_id,initial_payment_id:payment.id,current_payment_id:payment.id,status:"active",interval:product.subscription_interval,next_due_at:due.toISOString()}).select("*").single();if(error)throw error;return contract;
}
async function sendDonationSuccessEmail({email,name,amount,currency,reference,customerReference}){if(!email)return;await sendResendEmail({to:email,subject:"Donation confirmed — "+reference,text:"Your donation to "+(name||"this campaign")+" has been successfully confirmed.\n\nAmount: "+currency+" "+amount+"\nReference: "+reference+(customerReference?"\nYour reference: "+customerReference:"")+"\n\nProcessing receipt: "+PUBLIC_SITE_URL+"/receipt/"+encodeURIComponent(reference)+"\n\nThank you for your support.",html:"<div style=\"font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:32px\"><div style=\"background:#fff;border:1px solid #e5e5df;border-radius:20px;padding:28px\"><b>SquashberryPay</b><h1>Donation confirmed</h1><p>Your donation to "+escapeHtml(name||"this campaign")+" has been successfully confirmed.</p><p><b>Amount:</b> "+escapeHtml(currency)+" "+Number(amount).toFixed(2)+"<br><b>Reference:</b> "+escapeHtml(reference)+"</p><p>Keep this email as your receipt.</p></div></div>"});}

async function approveMerchantPayment(paymentId,merchantId){
  const {data:p,error}=await supabase
    .from("payments")
    .select("*,service_users(email,external_user_id),services(name,status,merchant_id),products(name,product_code,subscription_interval),donation_campaigns(name,merchant_id,status)")
    .eq("id",paymentId)
    .maybeSingle();

  if(error) throw error;
  if(!p) return {status:404,body:{error:"Payment not found."}};

  const owner=
    p.donation_campaign_id
      ? p.donation_campaigns?.merchant_id
      : p.services?.merchant_id;

  if(owner!==merchantId){
    return {status:404,body:{error:"Payment not found."}};
  }

  if(p.status!=="awaiting_verification"){
    return {
      status:409,
      body:{
        error:
          "Only payments awaiting verification can be approved."
      }
    };
  }

  const now=new Date().toISOString();

  if(p.donation_campaign_id){
    const {
      error:e
    } = await supabase
      .from("payments")
      .update({
        status:
          "completed",
        payment_state:
          "completed",
        approved_at:
          now,
        completed_at:
          now
      })
      .eq(
        "id",
        p.id
      )
      .eq(
        "status",
        "awaiting_verification"
      );

    if(e) throw e;

    await sendDonationSuccessEmail({
      email:
        p.customer_email ||
        p.service_users?.email,
      name:
        p.donation_campaigns?.name,
      amount:
        p.amount,
      currency:
        p.currency,
      reference:
        p.payment_reference,
      customerReference:
        p.customer_reference
    });

    return {
      status:200,
      body:{
        success:true,
        type:
          "donation",
        message:
          "Donation confirmed and success email sent."
      }
    };
  }

  if(p.services?.status!=="active"){
    return {
      status:403,
      body:{
        error:
          "The application associated with this payment is not active."
      }
    };
  }

  const rawCode =
    generatePaymentCode();

  const tokenExpiresAt =
    addMinutes(
      PAYMENT_TOKEN_MINUTES
    );

  const {
    error:
      tokenError
  } = await supabase
    .from("payment_tokens")
    .upsert({
      payment_id:
        p.id,
      service_id:
        p.service_id,
      service_user_id:
        p.service_user_id,
      token_hash:
        hash(rawCode),
      expires_at:
        tokenExpiresAt,
      used_at:
        null
    },{
      onConflict:
        "payment_id"
    });

  if(tokenError) throw tokenError;

  const {
    data:approvedPayment,
    error:
      approveError
  } = await supabase
    .from("payments")
    .update({
      status:
        "approved",
      payment_state:
        "code_issued",
      approved_at:
        now,
      code_issued_at:
        now
    })
    .eq(
      "id",
      p.id
    )
    .eq(
      "status",
      "awaiting_verification"
    )
    .select("id,status,payment_state")
    .maybeSingle();

  if(approveError){
    await supabase
      .from("payment_tokens")
      .delete()
      .eq(
        "payment_id",
        p.id
      );

    throw approveError;
  }

  if(!approvedPayment){
    return {
      status:409,
      body:{
        error:
          "This payment has already been processed."
      }
    };
  }

  await persistPaymentEvent(
    p,
    "payment.approved",
    "awaiting_verification",
    "approved",
    {
      merchant_id:merchantId
    }
  );

  try{
    if(
      p.payment_type==="subscribe"
    ){
      await ensureSubscriptionContract(
        p
      );
    }

    await sendPaymentCodeEmail({
      email:
        p.service_users?.email,
      code:
        rawCode,
      serviceName:
        p.services?.name,
      amount:
        p.amount,
      currency:
        p.currency,
      reference:
        p.payment_reference
    });
  }catch(emailError){
    await supabase
      .from("payment_tokens")
      .delete()
      .eq(
        "payment_id",
        p.id
      );

    await supabase
      .from("payments")
      .update({
        status:
          "awaiting_verification",
        payment_state:
          "awaiting_verification",
        approved_at:
          null,
        code_issued_at:
          null
      })
      .eq(
        "id",
        p.id
      )
      .eq(
        "status",
        "approved"
      );

    throw emailError;
  }

  await enqueueWebhookEvent(
    "payment.approved",
    {
      ...p,
      status:"approved",
      payment_state:"approved"
    }
  );

  await persistPaymentEvent(
    p,
    "payment.code_issued",
    "approved",
    "code_issued",
    {
      code_expires_at:
        tokenExpiresAt
    }
  );

  await enqueueWebhookEvent(
    "payment.code_issued",
    {
      ...p,
      status:"approved",
      payment_state:"code_issued"
    },
    {
      code_expires_at:
        tokenExpiresAt
    }
  );

  return {
    status:200,
    body:{
      success:true,
      type:
        p.payment_type,
      message:
        "Payment approved and one-time code emailed.",
      code_expires_at:
        tokenExpiresAt
    }
  };
}
app.get("/api/merchant/payment-requests",authenticateMerchant,async(req,res)=>{try{const {data:services}=await merchantServices(req);const ids=(services||[]).map(s=>s.id);const {data:campaigns}=await supabase.from("donation_campaigns").select("id").eq("merchant_id",req.merchant.id);const cids=(campaigns||[]).map(c=>c.id);const qs=[];if(ids.length)qs.push(supabase.from("payments").select("*,service_users(email,external_user_id),services(name,slug),products(name,product_code,subscription_interval),payment_methods(name,type)").in("service_id",ids).eq("status","awaiting_verification"));if(cids.length)qs.push(supabase.from("payments").select("*,service_users(email,external_user_id),donation_campaigns(name,slug)").in("donation_campaign_id",cids).eq("status","awaiting_verification"));const rs=await Promise.all(qs);res.json({payments:rs.flatMap(x=>x.data||[]).sort((a,b)=>new Date(b.created_at)-new Date(a.created_at))});}catch(e){console.error(e);res.status(500).json({error:"Could not load payment requests."})}});
app.get("/api/merchant/payments/:paymentId/receipt",authenticateMerchant,async(req,res)=>{try{const {data:p}=await supabase.from("payments").select("id,service_id,donation_campaign_id,receipt_path").eq("id",req.params.paymentId).maybeSingle();if(!p?.receipt_path)return res.status(404).json({error:"Receipt not found."});let allowed=false;if(p.service_id){const {data:x}=await supabase.from("services").select("id").eq("id",p.service_id).eq("merchant_id",req.merchant.id).maybeSingle();allowed=!!x}if(p.donation_campaign_id){const {data:x}=await supabase.from("donation_campaigns").select("id").eq("id",p.donation_campaign_id).eq("merchant_id",req.merchant.id).maybeSingle();allowed=!!x}if(!allowed)return res.status(404).json({error:"Receipt not found."});const {data,error}=await supabase.storage.from("payment-receipts").createSignedUrl(p.receipt_path,300);if(error)throw error;res.json({url:data?.signedUrl||data?.signedURL});}catch(e){console.error(e);res.status(500).json({error:"Could not open receipt."})}});
app.post("/api/merchant/payments/:paymentId/approve",authenticateMerchant,async(req,res)=>{try{const r=await approveMerchantPayment(req.params.paymentId,req.merchant.id);res.status(r.status).json(r.body)}catch(e){console.error(e);res.status(500).json({error:"Could not approve payment."})}});
app.post("/api/merchant/payments/:paymentId/reject",authenticateMerchant,async(req,res)=>{try{const reason=String(req.body?.reason||"Payment could not be verified.").trim().slice(0,500);const {data:p}=await supabase.from("payments").select("id,service_id,donation_campaign_id,status").eq("id",req.params.paymentId).maybeSingle();if(!p)return res.status(404).json({error:"Payment not found."});let allowed=false;if(p.service_id){const {data:x}=await supabase.from("services").select("id").eq("id",p.service_id).eq("merchant_id",req.merchant.id).maybeSingle();allowed=!!x}if(p.donation_campaign_id){const {data:x}=await supabase.from("donation_campaigns").select("id").eq("id",p.donation_campaign_id).eq("merchant_id",req.merchant.id).maybeSingle();allowed=!!x}if(!allowed)return res.status(404).json({error:"Payment not found."});if(p.status!=="awaiting_verification")return res.status(409).json({error:"Only payments awaiting verification can be rejected."});const {error}=await supabase.from("payments").update({status:"rejected",payment_state:"rejected",rejection_reason:reason}).eq("id",p.id).eq("status","awaiting_verification");if(error)throw error;try{
  const {data:ep}=await supabase.from("payments").select("id,service_id,payment_reference,customer_email").eq("id",req.params.paymentId).maybeSingle();
  if(ep){
    await persistPaymentEvent(ep,"payment.rejected","awaiting_verification","rejected",{reason});
    await enqueueWebhookEvent("payment.rejected",{...ep,status:"rejected",payment_state:"rejected"},{reason});
  }
}catch(eventError){console.error("Reject event error:",eventError);}
res.json({success:true});}catch(e){console.error(e);res.status(500).json({error:"Could not reject payment."})}});

/* ============================================================
   ADMIN LOGIN
============================================================ */

app.post(
    "/api/admin/login",
    (req, res) => {

        const {
            username,
            password
        } = req.body;


        if (
            username !==
                process.env.ADMIN_USERNAME ||
            password !==
                process.env.ADMIN_PASSWORD
        ) {

            return res.status(401).json({
                error:
                    "Invalid administrator credentials."
            });
        }


        const cookie =
            createAdminCookie();


        res.setHeader(
            "Set-Cookie",
            [
                `sbp_admin=${cookie}`,
                "HttpOnly",
                "Path=/",
                "SameSite=Strict",
                "Max-Age=28800"
            ].join(
                "; "
            )
        );


        res.json({

            success:
                true
        });
    }
);


/* ============================================================
   ADMIN LOGOUT
============================================================ */

app.post(
    "/api/admin/logout",
    (req, res) => {

        res.setHeader(
            "Set-Cookie",
            [
                "sbp_admin=",
                "HttpOnly",
                "Path=/",
                "SameSite=Strict",
                "Max-Age=0"
            ].join(
                "; "
            )
        );


        res.json({

            success:
                true
        });
    }
);


/* ============================================================
   ADMIN ME
============================================================ */

app.get(
    "/api/admin/me",
    (req, res) => {

        const cookies =
            req.headers.cookie ||
            "";


        const match =
            cookies.match(
                /sbp_admin=([^;]+)/
            );


        res.json({

            authenticated:
                Boolean(
                    match &&
                    verifyAdminCookie(
                        match[1]
                    )
                )
        });
    }
);


/* ============================================================
   ADMIN APPLICATION QUEUE
============================================================ */

app.get(
    "/api/admin/applications",
    requireAdmin,
    async (
        req,
        res
    ) => {

        try {

            const {
                data,
                error
            } = await supabase
                .from(
                    "services"
                )
                .select(
                    `
                    id,
                    name,
                    slug,
                    website_url,
                    platform_type,
                    client_id,
                    status,
                    created_at,

                    merchant_profiles (
                        id,
                        business_name,
                        email,
                        phone,
                        website
                    )
                    `
                )
                .order(
                    "created_at",
                    {
                        ascending:
                            false
                    }
                );


            if (
                error
            ) {

                console.error(
                    "Admin applications error:",
                    error
                );


                return res.status(500).json({
                    error:
                        "Could not load application queue."
                });
            }


            res.json({

                applications:
                    data || []
            });

        } catch (error) {

            console.error(
                error
            );


            res.status(500).json({

                error:
                    "Could not load application queue."
            });
        }
    }
);



/* ============================================================
   MERCHANT DASHBOARD API
   Operational data for the merchant workspace.
============================================================ */

async function merchantServices(req) {
    const { data, error } = await supabase
        .from("services")
        .select("id,name,slug,status,environment,website_url,platform_type,allowed_origins,allowed_package_ids,webhook_url,last_api_used_at,client_id,created_at")
        .eq("merchant_id", req.merchant.id)
        .order("created_at", { ascending: false });
    return { data: data || [], error };
}

app.get("/api/merchant/me", authenticateMerchant, async (req,res) => {
    res.json({
        merchant: {
            id: req.merchant.id,
            business_name: req.merchant.business_name,
            business_type: req.merchant.business_type,
            email: req.merchant.email,
            phone: req.merchant.phone,
            website: req.merchant.website,
            description: req.merchant.description,
            status: req.merchant.status
        }
    });
});

app.get("/api/merchant/dashboard", authenticateMerchant, async (req,res) => {
  try{
    const {data:services,error:serviceError}=await merchantServices(req);if(serviceError)throw serviceError;
    const ids=(services||[]).map(s=>s.id);
    const {data:products}=ids.length?await supabase.from("products").select("*").in("service_id",ids).order("created_at",{ascending:false}):{data:[]};
    const {data:methods}=ids.length?await supabase.from("payment_methods").select("*").in("service_id",ids).order("created_at",{ascending:false}):{data:[]};
    const {data:links}=ids.length?await supabase.from("payment_links").select("id,service_id,product_id,slug,title,description,button_label,status,created_at,updated_at,products(name,amount,currency,payment_type)").in("service_id",ids).order("created_at",{ascending:false}):{data:[]};
    const {data:servicePayments}=ids.length?await supabase.from("payments").select("*,service_users(email,external_user_id),products(name,product_code,subscription_interval),payment_methods(name,type),services(name,slug)").in("service_id",ids).order("created_at",{ascending:false}).limit(1000):{data:[]};
    const {data:campaigns}=await supabase.from("donation_campaigns").select("*").eq("merchant_id",req.merchant.id).order("created_at",{ascending:false});
    const cids=(campaigns||[]).map(c=>c.id);
    const {data:donationPayments}=cids.length?await supabase.from("payments").select("*,service_users(email,external_user_id),donation_campaigns(name,slug)").in("donation_campaign_id",cids).order("created_at",{ascending:false}).limit(1000):{data:[]};
    const payments=[...(servicePayments||[]),...(donationPayments||[])].sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
    const completed=payments.filter(p=>p.status==="completed"),pending=payments.filter(p=>["pending","awaiting_receipt","awaiting_verification","approved"].includes(p.status)),failed=payments.filter(p=>["rejected","expired","cancelled"].includes(p.status));
    const revenue=completed.reduce((a,p)=>a+Number(p.amount||0),0),pendingAmount=pending.reduce((a,p)=>a+Number(p.amount||0),0);
    const users=ids.length?(await supabase.from("service_users").select("id,service_id,email,external_user_id,created_at").in("service_id",ids).order("created_at",{ascending:false}).limit(1000)).data||[]:[];
    const userMap=new Map(users.map(u=>[u.id,u]));
    const normalized=payments.map(p=>({...p,customer:userMap.get(p.service_user_id)||p.service_users||null,app:p.services||null,product:p.products||null}));
    const dayMap={};completed.forEach(p=>{const d=String(p.completed_at||p.created_at).slice(0,10);dayMap[d]=(dayMap[d]||0)+Number(p.amount||0)});
    const trend=Object.entries(dayMap).sort(([a],[b])=>a.localeCompare(b)).slice(-30).map(([date,amount])=>({date,amount}));
    const {data:notifications}=await supabase.from("merchant_notifications").select("id,title,message,type,read_at,created_at").eq("merchant_id",req.merchant.id).order("created_at",{ascending:false}).limit(20);
    const {data:contracts}=await supabase.from("subscription_contracts").select("id,status,next_due_at,service_id,product_id,service_user_id,products(name,product_code,subscription_interval,amount,currency),service_users(email,external_user_id)").eq("merchant_id",req.merchant.id);
    const donationStats=(campaigns||[]).map(c=>{const rows=payments.filter(p=>p.donation_campaign_id===c.id&&p.status==="completed");return {...c,raised:rows.reduce((a,p)=>a+Number(p.amount||0),0),donor_count:rows.length}});
    res.json({summary:{gross_collected:revenue,pending_amount:pendingAmount,pending_verification_count:pending.filter(p=>p.status==="awaiting_verification").length,successful_count:completed.length,failed_count:failed.length,refunded_count:0,transaction_count:payments.length,customer_count:users.length},apps:services||[],services:services||[],products:products||[],payment_methods:methods||[],payment_links:links||[],payments:normalized,recent_payments:normalized.slice(0,12),customers:users,notifications:notifications||[],donation_campaigns:donationStats,subscription_contracts:contracts||[],trend,generated_at:new Date().toISOString()});
  }catch(e){console.error("Merchant dashboard error:",e);res.status(500).json({error:"Could not load dashboard."});}
});

app.get("/api/merchant/payments", authenticateMerchant, async (req,res) => {
    try {
        const {data:services,error:se}=await merchantServices(req); if(se) return res.status(500).json({error:"Could not load payments."});
        const ids=services.map(s=>s.id); if(!ids.length) return res.json({payments:[]});
        let q=supabase.from("payments").select("*,service_users(email,external_user_id),products(name,product_code),payment_methods(name,type),services(name,slug)").in("service_id",ids).order("created_at",{ascending:false}).limit(500);
        if(req.query.status) q=q.eq("status",String(req.query.status));
        const {data,error}=await q; if(error) return res.status(500).json({error:"Could not load payments."});
        res.json({payments:data||[]});
    } catch(e){console.error(e);res.status(500).json({error:"Could not load payments."});}
});

app.get("/api/merchant/customers", authenticateMerchant, async (req,res) => {
    try {
        const {data:services,error:se}=await merchantServices(req); if(se) return res.status(500).json({error:"Could not load customers."});
        const ids=services.map(s=>s.id); if(!ids.length) return res.json({customers:[]});
        const {data:users,error}=await supabase.from("service_users").select("id,service_id,email,external_user_id,created_at").in("service_id",ids).order("created_at",{ascending:false});
        if(error) return res.status(500).json({error:"Could not load customers."});
        const {data:payments}=await supabase.from("payments").select("service_user_id,amount,currency,status,created_at").in("service_id",ids);
        const grouped=new Map();
        (payments||[]).forEach(p=>{let x=grouped.get(p.service_user_id)||{count:0,total:0,last:null}; if(p.status==="completed"){x.count++;x.total+=Number(p.amount||0);} if(!x.last||p.created_at>x.last)x.last=p.created_at;grouped.set(p.service_user_id,x);});
        res.json({customers:(users||[]).map(u=>({...u,...(grouped.get(u.id)||{count:0,total:0,last:null})}))});
    } catch(e){console.error(e);res.status(500).json({error:"Could not load customers."});}
});

app.get("/api/merchant/balances", authenticateMerchant, async (req,res) => {
    try {
        const {data:services,error:se}=await merchantServices(req); if(se) return res.status(500).json({error:"Could not load balances."});
        const ids=services.map(s=>s.id); if(!ids.length) return res.json({available:0,pending:0,processed:0,refunds:0,payouts:[]});
        const {data:payments,error}=await supabase.from("payments").select("amount,currency,status").in("service_id",ids);
        if(error) return res.status(500).json({error:"Could not load balances."});
        const rows=payments||[], completed=rows.filter(p=>p.status==="completed"), pending=rows.filter(p=>["pending","awaiting_receipt","awaiting_verification","approved"].includes(p.status));
        const sum=a=>a.reduce((n,p)=>n+Number(p.amount||0),0);
        const {data:refunds}=await supabase.from("merchant_refunds").select("amount,currency,status,created_at").eq("merchant_id",req.merchant.id).order("created_at",{ascending:false}).limit(100);
        res.json({available:sum(completed),pending:sum(pending),processed:sum(completed),refunds:sum((refunds||[]).filter(r=>r.status==="completed")),payouts:[],refund_requests:refunds||[],note:"Payout rails are not connected yet; available balance is calculated from completed payments."});
    } catch(e){console.error(e);res.status(500).json({error:"Could not load balances."});}
});

app.get("/api/merchant/analytics", authenticateMerchant, async (req,res) => {
    try {
        const {data:services,error:se}=await merchantServices(req); if(se) return res.status(500).json({error:"Could not load analytics."});
        const ids=services.map(s=>s.id); if(!ids.length) return res.json({totals:{revenue:0,transactions:0,average:0},by_product:[],by_method:[],trend:[]});
        const {data:payments,error}=await supabase.from("payments").select("amount,currency,status,product_id,payment_method_id,created_at,completed_at,products(name),payment_methods(name,type)").in("service_id",ids).limit(5000);
        if(error) return res.status(500).json({error:"Could not load analytics."});
        const done=(payments||[]).filter(p=>p.status==="completed"), sum=done.reduce((a,p)=>a+Number(p.amount||0),0);
        const aggregate=(key,label)=>{const m={};done.forEach(p=>{const k=p[key]||"unknown";m[k]=m[k]||{name:p[label]?.name||"Unknown",amount:0,count:0};m[k].amount+=Number(p.amount||0);m[k].count++;});return Object.values(m).sort((a,b)=>b.amount-a.amount);};
        const dm={};done.forEach(p=>{const d=String(p.completed_at||p.created_at).slice(0,10);dm[d]=(dm[d]||0)+Number(p.amount||0);});
        res.json({totals:{revenue:sum,transactions:done.length,average:done.length?sum/done.length:0},by_product:aggregate("product_id","products"),by_method:aggregate("payment_method_id","payment_methods"),trend:Object.entries(dm).sort(([a],[b])=>a.localeCompare(b)).slice(-90).map(([date,amount])=>({date,amount}))});
    } catch(e){console.error(e);res.status(500).json({error:"Could not load analytics."});}
});

app.get("/api/merchant/payment-links", authenticateMerchant, async (req,res) => {
    try {
        const {data:services,error:se}=await merchantServices(req); if(se) return res.status(500).json({error:"Could not load links."});
        const ids=services.map(s=>s.id); if(!ids.length)return res.json({payment_links:[]});
        const {data,error}=await supabase.from("payment_links").select("id,service_id,product_id,slug,title,description,button_label,status,created_at,updated_at,products(name,amount,currency,payment_type)").in("service_id",ids).order("created_at",{ascending:false});
        if(error)return res.status(500).json({error:"Could not load payment links."}); res.json({payment_links:data||[]});
    }catch(e){console.error(e);res.status(500).json({error:"Could not load payment links."});}
});

app.get("/api/merchant/subscriptions", authenticateMerchant, async (req,res) => {
    try {
        const {data:services,error:se}=await merchantServices(req); if(se)return res.status(500).json({error:"Could not load subscriptions."});
        const ids=services.map(s=>s.id); if(!ids.length)return res.json({subscriptions:[]});
        const {data,error}=await supabase.from("payments").select("id,payment_reference,amount,currency,status,created_at,service_users(email),products(name,subscription_interval)").in("service_id",ids).eq("payment_type","subscribe").order("created_at",{ascending:false});
        if(error)return res.status(500).json({error:"Could not load subscriptions."});
        res.json({subscriptions:data||[],note:"Recurring billing automation is not yet connected; these are subscription payment records."});
    }catch(e){console.error(e);res.status(500).json({error:"Could not load subscriptions."});}
});


async function getMerchantSubscription(req,id){
  const {data,error}=await supabase.from("subscription_contracts")
    .select("*")
    .eq("id",id)
    .eq("merchant_id",req.merchant.id)
    .maybeSingle();
  if(error)throw error;
  return data;
}

app.post("/api/merchant/subscriptions/:subscriptionId/pause",authenticateMerchant,async(req,res)=>{
  try{
    const sub=await getMerchantSubscription(req,req.params.subscriptionId);
    if(!sub)return res.status(404).json({error:"Subscription not found."});
    if(sub.status!=="active")return res.status(409).json({error:"Only active subscriptions can be paused."});
    const {data,error}=await supabase.from("subscription_contracts")
      .update({status:"paused",updated_at:new Date().toISOString()})
      .eq("id",sub.id).eq("status","active").select("*").single();
    if(error)throw error;
    await persistPaymentEvent({paymentId:sub.current_payment_id,serviceId:sub.service_id,eventType:"subscription.paused",fromState:"active",toState:"paused",actorType:"merchant",actorId:req.merchant.id,metadata:{subscription_id:sub.id}});
res.json({success:true,subscription:data});
  }catch(error){
    console.error("Pause subscription error:",error);
    res.status(500).json({error:"Could not pause subscription."});
  }
});

app.post("/api/merchant/subscriptions/:subscriptionId/resume",authenticateMerchant,async(req,res)=>{
  try{
    const sub=await getMerchantSubscription(req,req.params.subscriptionId);
    if(!sub)return res.status(404).json({error:"Subscription not found."});
    if(sub.status!=="paused")return res.status(409).json({error:"Only paused subscriptions can be resumed."});
    const {data:product}=await supabase.from("products")
      .select("subscription_interval,status")
      .eq("id",sub.product_id).maybeSingle();
    const interval=product?.subscription_interval||sub.interval;
    const due=new Date();
    if(interval==="yearly")due.setFullYear(due.getFullYear()+1);
    else due.setMonth(due.getMonth()+1);
    const {data,error}=await supabase.from("subscription_contracts")
      .update({status:"active",interval,next_due_at:due.toISOString(),updated_at:new Date().toISOString()})
      .eq("id",sub.id).eq("status","paused").select("*").single();
    if(error)throw error;
    await persistPaymentEvent({paymentId:sub.current_payment_id,serviceId:sub.service_id,eventType:"subscription.resumed",fromState:"paused",toState:"active",actorType:"merchant",actorId:req.merchant.id,metadata:{subscription_id:sub.id}});
res.json({success:true,subscription:data});
  }catch(error){
    console.error("Resume subscription error:",error);
    res.status(500).json({error:"Could not resume subscription."});
  }
});

app.post("/api/merchant/subscriptions/:subscriptionId/cancel",authenticateMerchant,async(req,res)=>{
  try{
    const sub=await getMerchantSubscription(req,req.params.subscriptionId);
    if(!sub)return res.status(404).json({error:"Subscription not found."});
    if(["cancelled","completed"].includes(sub.status))return res.status(409).json({error:"This subscription is already closed."});
    const now=new Date().toISOString();
    const {data,error}=await supabase.from("subscription_contracts")
      .update({status:"cancelled",cancelled_at:now,updated_at:now})
      .eq("id",sub.id).select("*").single();
    if(error)throw error;
    if(sub.current_payment_id){
      await supabase.from("payments")
        .update({status:"cancelled",payment_state:"cancelled",cancel_reason:"Subscription cancelled by merchant.",cancelled_at:now})
        .eq("id",sub.current_payment_id)
        .in("status",["pending","awaiting_receipt"]);
    }
    await persistPaymentEvent({paymentId:sub.current_payment_id,serviceId:sub.service_id,eventType:"subscription.cancelled",fromState:"active",toState:"cancelled",actorType:"merchant",actorId:req.merchant.id,metadata:{subscription_id:sub.id}});
res.json({success:true,subscription:data});
  }catch(error){
    console.error("Cancel subscription error:",error);
    res.status(500).json({error:"Could not cancel subscription."});
  }
});

app.post("/api/merchant/subscriptions/:subscriptionId/change",authenticateMerchant,async(req,res)=>{
  try{
    const sub=await getMerchantSubscription(req,req.params.subscriptionId);
    if(!sub)return res.status(404).json({error:"Subscription not found."});
    if(["cancelled","completed"].includes(sub.status))return res.status(409).json({error:"Closed subscriptions cannot be changed."});

    const productId=String(req.body?.product_id||sub.product_id).trim();
    const {data:product,error:productError}=await supabase.from("products")
      .select("id,service_id,payment_type,status,subscription_interval")
      .eq("id",productId).eq("service_id",sub.service_id).maybeSingle();
    if(productError)throw productError;
    if(!product||product.status!=="active"||product.payment_type!=="subscribe"){
      return res.status(400).json({error:"Choose an active subscription product from the same application."});
    }

    const interval=String(req.body?.interval||product.subscription_interval||sub.interval).trim();
    if(!["monthly","yearly"].includes(interval))return res.status(400).json({error:"Choose monthly or yearly billing."});

    const due=new Date();
    if(interval==="yearly")due.setFullYear(due.getFullYear()+1);
    else due.setMonth(due.getMonth()+1);

    const {data,error}=await supabase.from("subscription_contracts")
      .update({product_id:product.id,interval,next_due_at:due.toISOString(),updated_at:new Date().toISOString()})
      .eq("id",sub.id).select("*").single();
    if(error)throw error;

    await persistPaymentEvent({paymentId:sub.current_payment_id,serviceId:sub.service_id,eventType:"subscription.changed",fromState:"active",toState:"active",actorType:"merchant",actorId:req.merchant.id,metadata:{subscription_id:sub.id,product_id:data.product_id,interval:data.interval}});
res.json({success:true,subscription:data});
  }catch(error){
    console.error("Change subscription error:",error);
    res.status(500).json({error:"Could not change subscription."});
  }
});

app.get("/api/merchant/donations", authenticateMerchant, async (req,res) => {
    try {
        const {data:services,error:se}=await merchantServices(req); if(se)return res.status(500).json({error:"Could not load donations."});
        const ids=services.map(s=>s.id); if(!ids.length)return res.json({campaigns:[]});
        const {data:products}=await supabase.from("products").select("id,service_id,name,currency,donation_goal,donation_end_at,status").in("service_id",ids).eq("payment_type","donate");
        const {data:payments}=await supabase.from("payments").select("product_id,amount,status").in("service_id",ids).eq("payment_type","donate");
        const campaigns=(products||[]).map(p=>{const rows=(payments||[]).filter(x=>x.product_id===p.id&&x.status==="completed");const raised=rows.reduce((a,x)=>a+Number(x.amount||0),0);return {...p,raised,donor_count:rows.length,progress_percent:p.donation_goal?Math.min(100,raised/Number(p.donation_goal)*100):null};});
        res.json({campaigns});
    }catch(e){console.error(e);res.status(500).json({error:"Could not load donations."});}
});

/* ============================================================
   MERCHANT DONATION PAYMENT METHODS
   ============================================================ */
app.get("/api/merchant/donation-payment-methods", authenticateMerchant, async (req,res) => {
    try {
        const { data, error } = await supabase
            .from("donation_payment_methods")
            .select("*")
            .eq("merchant_id", req.merchant.id)
            .order("created_at", { ascending: false });
        if (error) {
            console.error("Load donation payment methods error:", error);
            return res.status(500).json({ error: "Could not load donation payment methods." });
        }
        res.json({ methods: data || [] });
    } catch (error) {
        console.error("Load donation payment methods exception:", error);
        res.status(500).json({ error: "Could not load donation payment methods." });
    }
});

app.post("/api/merchant/donation-payment-methods", authenticateMerchant, async (req,res) => {
    try {
        const name = String(req.body?.name || "").trim().slice(0, 120);
        const type = String(req.body?.type || "").trim().slice(0, 80);
        const account_name = String(req.body?.account_name || "").trim().slice(0, 160) || null;
        const phone_number = String(req.body?.phone_number || "").trim().slice(0, 80) || null;
        const instructions = String(req.body?.instructions || "").trim().slice(0, 2000);
        if (!name || !type || !instructions) {
            return res.status(400).json({ error: "Enter the payment method name, type and instructions." });
        }
        const { data, error } = await supabase
            .from("donation_payment_methods")
            .insert({
                merchant_id: req.merchant.id,
                name,
                type,
                account_name,
                phone_number,
                instructions,
                enabled: true
            })
            .select("*")
            .single();
        if (error) {
            console.error("Create donation payment method error:", error);
            return res.status(500).json({ error: "Could not save donation payment method." });
        }
        res.status(201).json({ method: data });
    } catch (error) {
        console.error("Create donation payment method exception:", error);
        res.status(500).json({ error: "Could not save donation payment method." });
    }
});

/* ============================================================
   MERCHANT CREATE STANDALONE DONATION CAMPAIGN
   ============================================================ */
app.post("/api/merchant/donation-campaigns", authenticateMerchant, async (req,res) => {
    try {
        const name = String(req.body?.name || "").trim().slice(0, 160);
        const description = String(req.body?.description || "").trim().slice(0, 1000) || null;
        const allowCustomAmount = Boolean(req.body?.allow_custom_amount);
        const fixedAmount = req.body?.fixed_amount === null || req.body?.fixed_amount === undefined || req.body?.fixed_amount === "" ? null : Number(req.body.fixed_amount);
        const minimumAmount = req.body?.minimum_amount === null || req.body?.minimum_amount === undefined || req.body?.minimum_amount === "" ? null : Number(req.body.minimum_amount);
        const maximumAmount = req.body?.maximum_amount === null || req.body?.maximum_amount === undefined || req.body?.maximum_amount === "" ? null : Number(req.body.maximum_amount);
        const goal = req.body?.goal === null || req.body?.goal === undefined || req.body?.goal === "" ? null : Number(req.body.goal);
        const presets = Array.isArray(req.body?.presets) ? req.body.presets.map(Number).filter(x => Number.isFinite(x) && x > 0).slice(0, 12) : [];

        if (!name) return res.status(400).json({ error: "Campaign name is required." });
        if (!allowCustomAmount && (!Number.isFinite(fixedAmount) || fixedAmount <= 0)) return res.status(400).json({ error: "A positive fixed donation amount is required when custom amounts are disabled." });
        if (allowCustomAmount && fixedAmount !== null && (!Number.isFinite(fixedAmount) || fixedAmount <= 0)) return res.status(400).json({ error: "Fixed amount must be positive when provided." });
        if (minimumAmount !== null && (!Number.isFinite(minimumAmount) || minimumAmount <= 0)) return res.status(400).json({ error: "Minimum donation must be positive." });
        if (maximumAmount !== null && (!Number.isFinite(maximumAmount) || maximumAmount <= 0)) return res.status(400).json({ error: "Maximum donation must be positive." });
        if (minimumAmount !== null && maximumAmount !== null && minimumAmount > maximumAmount) return res.status(400).json({ error: "Minimum donation cannot exceed the maximum donation." });
        if (goal !== null && (!Number.isFinite(goal) || goal <= 0)) return res.status(400).json({ error: "Donation goal must be positive." });
        if (fixedAmount !== null && minimumAmount !== null && fixedAmount < minimumAmount) return res.status(400).json({ error: "Fixed amount cannot be below the minimum donation." });
        if (fixedAmount !== null && maximumAmount !== null && fixedAmount > maximumAmount) return res.status(400).json({ error: "Fixed amount cannot exceed the maximum donation." });

        let slug = (cleanSlug(name) || "donation") + "-" + randomHex(5);
        for (let attempt = 0; attempt < 8; attempt++) {
            const { data: existingSlug } = await supabase
                .from("donation_campaigns")
                .select("id")
                .eq("slug", slug)
                .maybeSingle();
            if (!existingSlug) break;
            slug = (cleanSlug(name) || "donation") + "-" + randomHex(5);
        }

        const { data: campaign, error } = await supabase.from("donation_campaigns").insert({
            merchant_id: req.merchant.id,
            slug,
            name,
            description,
            currency: "GMD",
            allow_custom_amount: allowCustomAmount,
            fixed_amount: fixedAmount,
            minimum_amount: minimumAmount,
            maximum_amount: maximumAmount,
            presets,
            goal,
            goal_message: null,
            end_at: null,
            status: "active"
        }).select("*").single();

        if (error) {
            console.error("Create donation campaign database error:", error);
            return res.status(500).json({ error: "Could not create donation campaign." });
        }

        res.status(201).json({ campaign, payment_url: PUBLIC_SITE_URL + "/donate/" + campaign.slug });
    } catch (error) {
        console.error("Create donation campaign error:", error);
        res.status(500).json({ error: "Could not create donation campaign." });
    }
});

app.patch("/api/merchant/donation-payment-methods/:id", authenticateMerchant, async (req,res) => {
    try {
        const id=String(req.params.id||"").trim();
        const patch={name:String(req.body?.name||"").trim().slice(0,120),type:String(req.body?.type||"").trim().slice(0,80),account_name:String(req.body?.account_name||"").trim().slice(0,160)||null,account_number:String(req.body?.account_number||"").trim().slice(0,120)||null,bank_name:String(req.body?.bank_name||"").trim().slice(0,120)||null,phone_number:String(req.body?.phone_number||"").trim().slice(0,80)||null,instructions:String(req.body?.instructions||"").trim().slice(0,2000)}; if(req.body?.enabled!==undefined)patch.enabled=Boolean(req.body.enabled);
        if(!id||!patch.name||!patch.type||!patch.instructions)return res.status(400).json({error:"Payment method name, type and instructions are required."});
        const {data,error}=await supabase.from("donation_payment_methods").update(patch).eq("id",id).eq("merchant_id",req.merchant.id).select("*").single();
        if(error||!data)return res.status(404).json({error:"Donation payment method not found."});
        res.json({method:data});
    }catch(e){console.error(e);res.status(500).json({error:"Could not update donation payment method."});}
});
app.delete("/api/merchant/donation-payment-methods/:id", authenticateMerchant, async (req,res) => {
    const {data,error}=await supabase.from("donation_payment_methods").update({enabled:false}).eq("id",String(req.params.id)).eq("merchant_id",req.merchant.id).select("id,enabled").single();
    if(error||!data)return res.status(404).json({error:"Donation payment method not found."});
    res.json({success:true,method:data});
});
app.patch("/api/merchant/donation-campaigns/:id", authenticateMerchant, async (req,res) => {
    try {
        const id=String(req.params.id||"").trim(),patch={};
        if(req.body?.name!==undefined)patch.name=String(req.body.name).trim().slice(0,160);
        if(req.body?.description!==undefined)patch.description=String(req.body.description).trim().slice(0,1000)||null;
        if(req.body?.allow_custom_amount!==undefined)patch.allow_custom_amount=Boolean(req.body.allow_custom_amount);
        for(const field of ["fixed_amount","minimum_amount","maximum_amount","goal"])if(req.body?.[field]!==undefined)patch[field]=req.body[field]===""||req.body[field]===null?null:Number(req.body[field]);
        if(req.body?.presets!==undefined)patch.presets=Array.isArray(req.body.presets)?req.body.presets.map(Number).filter(x=>Number.isFinite(x)&&x>0).slice(0,12):[];
        if(req.body?.end_at!==undefined)patch.end_at=req.body.end_at||null;
        if(req.body?.goal_message!==undefined)patch.goal_message=String(req.body.goal_message||"").trim().slice(0,500)||null;
        if(!id||Object.keys(patch).length===0)return res.status(400).json({error:"Nothing to update."});
        const {data,error}=await supabase.from("donation_campaigns").update(patch).eq("id",id).eq("merchant_id",req.merchant.id).select("*").single();
        if(error||!data)return res.status(404).json({error:"Donation campaign not found."});
        res.json({campaign:data,payment_url:PUBLIC_SITE_URL+"/donate/"+data.slug});
    }catch(e){console.error(e);res.status(500).json({error:"Could not update donation campaign."});}
});
app.delete("/api/merchant/donation-campaigns/:id", authenticateMerchant, async (req,res) => {
    const {data,error}=await supabase.from("donation_campaigns").update({status:"inactive"}).eq("id",String(req.params.id)).eq("merchant_id",req.merchant.id).select("id,status").single();
    if(error||!data)return res.status(404).json({error:"Donation campaign not found."});
    res.json({success:true,campaign:data});
});
app.patch("/api/merchant/payment-links/:id", authenticateMerchant, async (req,res) => {
    try {
        const id=String(req.params.id||"").trim();
        const {data:owned,error:oe}=await supabase.from("payment_links").select("id,service_id").eq("id",id).maybeSingle();
        if(oe||!owned)return res.status(404).json({error:"Payment link not found."});
        const {data:service}=await supabase.from("services").select("id").eq("id",owned.service_id).eq("merchant_id",req.merchant.id).maybeSingle();
        if(!service)return res.status(404).json({error:"Payment link not found."});
        const patch={};for(const key of ["title","description","button_label"])if(req.body?.[key]!==undefined)patch[key]=String(req.body[key]||"").trim()||null;
        if(req.body?.status!==undefined)patch.status=["active","inactive"].includes(String(req.body.status))?String(req.body.status):"inactive";
        if(!Object.keys(patch).length)return res.status(400).json({error:"Nothing to update."});
        const {data,error}=await supabase.from("payment_links").update(patch).eq("id",id).select("*").single();
        if(error||!data)return res.status(404).json({error:"Payment link not found."});
        res.json({payment_link:data,payment_url:PUBLIC_SITE_URL+"/checkout/"+encodeURIComponent(data.slug)});
    }catch(e){console.error(e);res.status(500).json({error:"Could not update payment link."});}
});
app.delete("/api/merchant/payment-links/:id", authenticateMerchant, async (req,res) => {
    try {
        const id=String(req.params.id||"").trim();
        const {data:owned}=await supabase.from("payment_links").select("id,service_id").eq("id",id).maybeSingle();
        if(!owned)return res.status(404).json({error:"Payment link not found."});
        const {data:service}=await supabase.from("services").select("id").eq("id",owned.service_id).eq("merchant_id",req.merchant.id).maybeSingle();
        if(!service)return res.status(404).json({error:"Payment link not found."});
        const {data,error}=await supabase.from("payment_links").update({status:"inactive"}).eq("id",id).select("id,status").single();
        if(error||!data)return res.status(404).json({error:"Payment link not found."});
        res.json({success:true,payment_link:data});
    }catch(e){console.error(e);res.status(500).json({error:"Could not delete payment link."});}
});

app.get("/api/merchant/refunds", authenticateMerchant, async (req,res) => {
    const {data,error}=await supabase.from("merchant_refunds").select("*,payments(payment_reference,amount,currency,status)").eq("merchant_id",req.merchant.id).order("created_at",{ascending:false}).limit(500);
    if(error)return res.status(500).json({error:"Could not load refunds."}); res.json({refunds:data||[]});
});

app.post("/api/merchant/refunds", authenticateMerchant, async (req,res) => {
    try {
        const paymentId=String(req.body?.payment_id||""); const amount=Number(req.body?.amount);
        if(!paymentId||!Number.isFinite(amount)||amount<=0)return res.status(400).json({error:"Payment and a positive refund amount are required."});
        const {data:services}=await merchantServices(req); const ids=(services||[]).map(s=>s.id);
        const {data:p}=await supabase.from("payments").select("id,service_id,amount,currency,status").eq("id",paymentId).in("service_id",ids).maybeSingle();
        if(!p)return res.status(404).json({error:"Payment not found."}); if(p.status!=="completed")return res.status(409).json({error:"Only completed payments can be refund-requested."}); if(amount>Number(p.amount))return res.status(400).json({error:"Refund cannot exceed the payment amount."});
        const {data,error}=await supabase.from("merchant_refunds").insert({merchant_id:req.merchant.id,payment_id:p.id,amount,currency:p.currency,reason:String(req.body?.reason||"").trim()||null}).select("*").single();
        if(error)return res.status(500).json({error:"Could not create refund request."});
        await supabase.from("audit_logs").insert({actor_type:"merchant",actor_id:req.merchant.id,action:"refund_requested",payment_id:p.id,metadata:{refund_id:data.id,amount}});
        res.status(201).json({refund:data,message:"Refund request created. It is not a transfer until payout/refund rails are connected."});
    }catch(e){console.error(e);res.status(500).json({error:"Could not create refund request."});}
});

app.get("/api/merchant/disputes", authenticateMerchant, async (req,res) => {
    const {data,error}=await supabase.from("merchant_disputes").select("*,payments(payment_reference,amount,currency,status)").eq("merchant_id",req.merchant.id).order("created_at",{ascending:false}).limit(500);
    if(error)return res.status(500).json({error:"Could not load disputes."}); res.json({disputes:data||[]});
});

app.post("/api/merchant/disputes", authenticateMerchant, async (req,res) => {
    try {
        const paymentId=String(req.body?.payment_id||""); const reason=String(req.body?.reason||"").trim();
        if(!paymentId||!reason)return res.status(400).json({error:"Payment and dispute reason are required."});
        const {data:services}=await merchantServices(req); const ids=(services||[]).map(s=>s.id);
        const {data:p}=await supabase.from("payments").select("id,service_id").eq("id",paymentId).in("service_id",ids).maybeSingle(); if(!p)return res.status(404).json({error:"Payment not found."});
        const {data,error}=await supabase.from("merchant_disputes").insert({merchant_id:req.merchant.id,payment_id:p.id,reason,description:String(req.body?.description||"").trim()||null}).select("*").single();
        if(error)return res.status(500).json({error:"Could not create dispute."}); res.status(201).json({dispute:data});
    }catch(e){console.error(e);res.status(500).json({error:"Could not create dispute."});}
});

app.get("/api/merchant/developer", authenticateMerchant, async (req,res) => {
    const {data:services}=await merchantServices(req); const ids=(services||[]).map(s=>s.id);
    const {data:logs}=await supabase.from("audit_logs").select("id,action,payment_id,metadata,created_at").eq("actor_type","merchant").eq("actor_id",req.merchant.id).order("created_at",{ascending:false}).limit(200);
    const {data:webhooks}=await supabase.from("merchant_webhooks").select("id,url,events,enabled,created_at,updated_at").eq("merchant_id",req.merchant.id).order("created_at",{ascending:false});
    res.json({services:services||[],logs:logs||[],webhooks:webhooks||[],api_logs:[],note:"HTTP request logging will appear here once API request telemetry is connected."});
});

app.post("/api/merchant/webhooks", authenticateMerchant, async (req,res) => {
    const url=String(req.body?.url||"").trim(); if(!/^https?:\/\//i.test(url))return res.status(400).json({error:"Enter a valid HTTPS webhook URL."});
    const {data,error}=await supabase.from("merchant_webhooks").insert({merchant_id:req.merchant.id,url,events:Array.isArray(req.body?.events)?req.body.events:["payment.completed","payment.failed"]}).select("id,url,events,enabled,created_at").single();
    if(error)return res.status(500).json({error:"Could not save webhook."}); res.status(201).json({webhook:data});
});

app.get("/api/merchant/notifications", authenticateMerchant, async (req,res) => {
    const {data,error}=await supabase.from("merchant_notifications").select("*").eq("merchant_id",req.merchant.id).order("created_at",{ascending:false}).limit(200);
    if(error)return res.status(500).json({error:"Could not load notifications."}); res.json({notifications:data||[]});
});

app.post("/api/merchant/notifications/:id/read", authenticateMerchant, async (req,res) => {
    const {error}=await supabase.from("merchant_notifications").update({read_at:new Date().toISOString()}).eq("id",req.params.id).eq("merchant_id",req.merchant.id);
    if(error)return res.status(500).json({error:"Could not update notification."}); res.json({success:true});
});

app.get("/api/merchant/team", authenticateMerchant, async (req,res) => {
    const {data,error}=await supabase.from("merchant_team_invitations").select("id,email,role,status,created_at").eq("merchant_id",req.merchant.id).order("created_at",{ascending:false});
    if(error)return res.status(500).json({error:"Could not load team."}); res.json({members:data||[]});
});

app.post("/api/merchant/team/invite", authenticateMerchant, async (req,res) => {
    const email=normalizeEmail(req.body?.email); const role=String(req.body?.role||"viewer");
    if(!email||!isValidEmail(email))return res.status(400).json({error:"Enter a valid team member email."});
    if(!["viewer","developer","finance","admin"].includes(role))return res.status(400).json({error:"Invalid team role."});
    const {data,error}=await supabase.from("merchant_team_invitations").upsert({merchant_id:req.merchant.id,email,role,status:"pending"},{onConflict:"merchant_id,email"}).select("id,email,role,status,created_at").single();
    if(error)return res.status(500).json({error:"Could not create invitation."});
    res.status(201).json({member:data,message:"Invitation recorded. Team login/role enforcement will activate when multi-user merchant authentication is enabled."});
});


/* ============================================================
   ADMIN APPROVE APPLICATION
============================================================ */

app.post(
    "/api/admin/applications/:id/approve",
    requireAdmin,
    async (
        req,
        res
    ) => {

        try {

            const {
                data: service,
                error:
                    serviceError
            } = await supabase
                .from(
                    "services"
                )
                .select(
                    `
                    id,
                    name,
                    status,
                    merchant_id
                    `
                )
                .eq(
                    "id",
                    req.params.id
                )
                .maybeSingle();


            if (
                serviceError
            ) {

                console.error(
                    "Approve app lookup error:",
                    serviceError
                );


                return res.status(500).json({
                    error:
                        "Could not approve application."
                });
            }


            if (
                !service
            ) {

                return res.status(404).json({
                    error:
                        "Application not found."
                });
            }


            if (
                service.status ===
                "active"
            ) {

                return res.status(409).json({
                    error:
                        "This application is already active."
                });
            }


            const {
                data,
                error
            } = await supabase
                .from(
                    "services"
                )
                .update({

                    status:
                        "active",

                    updated_at:
                        new Date()
                            .toISOString()
                })
                .eq(
                    "id",
                    service.id
                )
                .select(
                    `
                    id,
                    name,
                    slug,
                    client_id,
                    status
                    `
                )
                .single();


            if (
                error
            ) {

                console.error(
                    "Approve app update error:",
                    error
                );


                return res.status(500).json({
                    error:
                        "Could not approve application."
                });
            }


            await supabase
                .from(
                    "audit_logs"
                )
                .insert({

                    actor_type:
                        "admin",

                    actor_id:
                        "admin",

                    action:
                        "application_approved",

                    metadata: {

                        service_id:
                            service.id
                    }
                });


            res.json({

                success:
                    true,

                application:
                    data,

                message:
                    "Application approved. Its credentials are now active."
            });

        } catch (error) {

            console.error(
                "Approve application error:",
                error
            );


            res.status(500).json({
                error:
                    "Could not approve application."
            });
        }
    }
);


/* ============================================================
   ADMIN REJECT APPLICATION
============================================================ */

app.post(
    "/api/admin/applications/:id/reject",
    requireAdmin,
    async (
        req,
        res
    ) => {

        try {

            const {
                error
            } = await supabase
                .from(
                    "services"
                )
                .update({

                    status:
                        "rejected",

                    updated_at:
                        new Date()
                            .toISOString()
                })
                .eq(
                    "id",
                    req.params.id
                )
                .eq(
                    "status",
                    "pending"
                );


            if (
                error
            ) {

                console.error(
                    "Reject app error:",
                    error
                );


                return res.status(500).json({
                    error:
                        "Could not reject application."
                });
            }


            await supabase
                .from(
                    "audit_logs"
                )
                .insert({

                    actor_type:
                        "admin",

                    actor_id:
                        "admin",

                    action:
                        "application_rejected",

                    metadata: {

                        service_id:
                            req.params.id
                    }
                });


            res.json({

                success:
                    true
            });

        } catch (error) {

            console.error(
                "Reject application error:",
                error
            );


            res.status(500).json({
                error:
                    "Could not reject application."
            });
        }
    }
);


/* ============================================================
   ADMIN PAYMENTS
============================================================ */

app.get(
    "/api/admin/payments",
    requireAdmin,
    async (
        req,
        res
    ) => {

        try {

            const {
                data,
                error
            } = await supabase
                .from(
                    "payments"
                )
                .select(
                    `
                    id,
                    payment_reference,
                    amount,
                    currency,
                    payment_type,
                    status,
                    donor_name,
                    donor_message,
                    donor_anonymous,
                    receipt_path,
                    receipt_uploaded_at,
                    approved_at,
                    completed_at,
                    created_at,

                    services (
                        name,
                        slug,
                        status,

                        merchant_profiles (
                            business_name
                        )
                    ),

                    service_users (
                        email,
                        external_user_id
                    ),

                    products (
                        name,
                        product_code
                    ),

                    payment_methods (
                        name,
                        type
                    )
                    `
                )
                .order(
                    "created_at",
                    {
                        ascending:
                            false
                    }
                )
                .limit(
                    500
                );


            if (
                error
            ) {

                console.error(
                    "Admin payments error:",
                    error
                );


                return res.status(500).json({
                    error:
                        "Could not load payments."
                });
            }


            res.json({

                payments:
                    data || []
            });

        } catch (error) {

            console.error(
                error
            );


            res.status(500).json({

                error:
                    "Could not load payments."
            });
        }
    }
);


/* ============================================================
   ADMIN APPROVE PAYMENT
============================================================ */

app.post(
    "/api/admin/payments/:paymentId/approve",
    requireAdmin,
    async (
        req,
        res
    ) => {

        try {

            const {
                data: payment,
                error:
                    paymentError
            } = await supabase
                .from(
                    "payments"
                )
                .select(
                    `
                    *,
                    service_users (
                        email
                    ),
                    services (
                        name,
                        status
                    )
                    `
                )
                .eq(
                    "id",
                    req.params.paymentId
                )
                .maybeSingle();


            if (
                paymentError
            ) {

                console.error(
                    "Admin payment lookup error:",
                    paymentError
                );


                return res.status(500).json({
                    error:
                        "Could not approve payment."
                });
            }


            if (
                !payment
            ) {

                return res.status(404).json({
                    error:
                        "Payment not found."
                });
            }


            if (
                payment.services.status !==
                "active"
            ) {

                return res.status(403).json({
                    error:
                        "The application associated with this payment is not active."
                });
            }


            if (
                payment.status !==
                "awaiting_verification"
            ) {

                return res.status(409).json({
                    error:
                        "Only payments awaiting verification can be approved."
                });
            }


            if (
                payment.payment_link_id
            ) {

                const {
                    error:
                        linkUpdateError
                } =
                    await supabase
                        .from(
                            "payments"
                        )
                        .update({
                            status:
                                "completed",
                            approved_at:
                                new Date()
                                    .toISOString(),
                            completed_at:
                                new Date()
                                    .toISOString()
                        })
                        .eq(
                            "id",
                            payment.id
                        )
                        .eq(
                            "status",
                            "awaiting_verification"
                        );

                if (linkUpdateError) {
                    console.error(
                        "Payment-link approval update error:",
                        linkUpdateError
                    );

                    return res.status(500).json({
                        error:
                            "Could not complete payment."
                    });
                }

                await supabase
                    .from(
                        "audit_logs"
                    )
                    .insert({
                        actor_type:
                            "admin",
                        actor_id:
                            "admin",
                        action:
                            "payment_link_completed",
                        payment_id:
                            payment.id,
                        metadata: {
                            payment_link_id:
                                payment.payment_link_id
                        }
                    });

                try {

                    await sendPaymentLinkApprovedEmail({
                        email:
                            payment
                                .service_users
                                ?.email,
                        serviceName:
                            payment
                                .services
                                ?.name,
                        amount:
                            payment.amount,
                        currency:
                            payment.currency,
                        reference:
                            payment.payment_reference,
                        returnUrl:
                            payment.return_url
                    });

                } catch (emailError) {

                    console.error(
                        "Payment-link approval email error:",
                        emailError
                    );
                }

                return res.json({
                    success:
                        true,
                    code:
                        null,
                    message:
                        "Payment approved and checkout completed."
                });
            }


            const rawCode =
                generatePaymentCode();


            const {
                error:
                    tokenError
            } =
                await supabase
                    .from(
                        "payment_tokens"
                    )
                    .upsert({

                        payment_id:
                            payment.id,

                        service_id:
                            payment.service_id,

                        service_user_id:
                            payment.service_user_id,

                        token_hash:
                            hash(
                                rawCode
                            ),

                        expires_at:
                            addHours(
                                PAYMENT_TOKEN_HOURS
                            ),

                        used_at:
                            null

                    }, {

                        onConflict:
                            "payment_id"
                    });


            if (tokenError) {

                console.error(
                    "Payment token error:",
                    tokenError
                );

                return res.status(500).json({
                    error:
                        "Could not generate the payment verification code."
                });
            }


            const {
                error:
                    updateError
            } =
                await supabase
                    .from(
                        "payments"
                    )
                    .update({
                        status:
                            "approved",
                        approved_at:
                            new Date()
                                .toISOString()
                    })
                    .eq(
                        "id",
                        payment.id
                    );


            if (updateError) {

                console.error(
                    "Approve payment update error:",
                    updateError
                );

                return res.status(500).json({
                    error:
                        "Could not approve payment."
                });
            }


            await sendPaymentCodeEmail({

                email:
                    payment
                        .service_users
                        ?.email,

                code:
                    rawCode,

                serviceName:
                    payment
                        .services
                        ?.name,

                amount:
                    payment.amount,

                currency:
                    payment.currency,

                reference:
                    payment.payment_reference
            });


            res.json({

                success:
                    true,

                message:
                    "Payment approved. The one-time payment code has been sent to the customer."
            });

        } catch (error) {

            console.error(
                "Approve payment error:",
                error
            );


            res.status(500).json({
                error:
                    error.publicMessage ||
                    "Could not approve payment."
            });
        }
    }
);


/* ============================================================
   ADMIN REJECT PAYMENT
============================================================ */

app.post(
    "/api/admin/payments/:paymentId/reject",
    requireAdmin,
    async (
        req,
        res
    ) => {

        try {

            const reason =
                String(
                    req.body?.reason ||
                    "Payment could not be verified."
                ).trim();


            const {
                error
            } = await supabase
                .from(
                    "payments"
                )
                .update({

                    status:
                        "rejected",

                    rejection_reason:
                        reason
                })
                .eq(
                    "id",
                    req.params.paymentId
                )
                .eq(
                    "status",
                    "awaiting_verification"
                );


            if (
                error
            ) {

                console.error(
                    "Reject payment error:",
                    error
                );


                return res.status(500).json({
                    error:
                        "Could not reject payment."
                });
            }


            await supabase
                .from(
                    "audit_logs"
                )
                .insert({

                    actor_type:
                        "admin",

                    actor_id:
                        "admin",

                    action:
                        "payment_rejected",

                    payment_id:
                        req.params.paymentId,

                    metadata: {

                        reason
                    }
                });


            res.json({

                success:
                    true
            });

        } catch (error) {

            console.error(
                "Reject payment error:",
                error
            );


            res.status(500).json({

                error:
                    "Could not reject payment."
            });
        }
    }
);


/* ============================================================
   ADMIN VIEW RECEIPT
============================================================ */

app.get(
    "/api/admin/payments/:paymentId/receipt",
    requireAdmin,
    async (
        req,
        res
    ) => {

        try {

            const {
                data: payment
            } = await supabase
                .from(
                    "payments"
                )
                .select(
                    "receipt_path"
                )
                .eq(
                    "id",
                    req.params.paymentId
                )
                .maybeSingle();


            if (
                !payment?.receipt_path
            ) {

                return res.status(404).json({
                    error:
                        "Receipt not found."
                });
            }


            const {
                data,
                error
            } = await supabase
                .storage
                .from(
                    "payment-receipts"
                )
                .createSignedUrl(
                    payment.receipt_path,
                    300
                );


            if (
                error
            ) {

                console.error(
                    "Receipt signed URL error:",
                    error
                );


                return res.status(500).json({
                    error:
                        "Could not open receipt."
                });
            }


            res.json({

                url:
                    data.signedUrl
            });

        } catch (error) {

            console.error(
                "Receipt viewing error:",
                error
            );


            res.status(500).json({
                error:
                    "Could not open receipt."
            });
        }
    }
);



/* ============================================================
   PAYMENT-LINK APPROVAL EMAIL
============================================================ */

async function sendPaymentLinkApprovedEmail({
    email,
    serviceName,
    amount,
    currency,
    reference,
    returnUrl
}) {

    if (!email) {
        return;
    }

    const destination =
        returnUrl ||
        PUBLIC_SITE_URL +
        "/";

    await sendResendEmail({
        to:
            email,

        subject:
            String(
                serviceName ||
                "SquashberryPay"
            ) +
            " payment confirmed — " +
            String(
                reference
            ),

        text:
            "Your payment for " +
            String(
                serviceName ||
                "the merchant"
            ) +
            " has been approved.\n\n" +
            "Reference: " +
            String(
                reference
            ) +
            "\nAmount: " +
            String(
                currency
            ) +
            " " +
            String(
                amount
            ) +
            "\n\nContinue: " +
            destination,

        html:
            `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Payment confirmed</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f2;font-family:Arial,Helvetica,sans-serif;color:#111">
<div style="max-width:560px;margin:auto;padding:40px 18px">
<div style="background:#fff;border:1px solid #e5e5df;border-radius:20px;padding:32px">
<div style="font-weight:900;font-size:18px">SquashberryPay</div>
<div style="margin-top:24px;font-size:11px;font-weight:800;letter-spacing:2px;color:#777">PAYMENT CONFIRMED</div>
<h1 style="margin:10px 0 12px;font-size:28px">Payment approved.</h1>
<p style="color:#666;line-height:1.7">Your payment to ${escapeHtml(serviceName || "the merchant")} has been verified.</p>
<div style="margin:22px 0;padding:18px;border:1px solid #e7e7e2;border-radius:14px;background:#fafaf7">
<strong>Reference</strong><br>
<span>${escapeHtml(reference)}</span>
<br><br>
<strong>Amount</strong><br>
<span>${escapeHtml(currency)} ${escapeHtml(amount)}</span>
</div>
<a href="${escapeHtml(destination)}" style="display:inline-block;padding:13px 18px;border-radius:12px;background:#111;color:#fff;text-decoration:none;font-weight:800">Continue</a>
<p style="margin-top:24px;color:#999;font-size:12px">This message was sent by SquashberryPay.</p>
</div>
</div>
</body>
</html>
`
    });
}


/* ============================================================
   PAYMENT CODE EMAIL
============================================================ */


async function sendPaymentCodeEmail({
  email,
  code,
  serviceName,
  amount,
  currency,
  reference
}) {
  if(!email){
    throw publicError(
      "No customer email is available for this payment."
    );
  }

  await sendResendEmail({
    to:
      email,

    subject:
      String(
        serviceName ||
        "SquashberryPay"
      ) +
      " payment approved — verification code",

    text:
      "Your payment for " +
      String(
        serviceName ||
        "the merchant"
      ) +
      " has been approved.\\n\\n" +
      "Reference: " +
      String(reference) +
      "\\nAmount: " +
      String(currency) +
      " " +
      String(amount) +
      "\\n\\nYour one-time payment code is: " +
      String(code) +
      "\\n\\nProcessing receipt: " +
      PUBLIC_SITE_URL +
      "/receipt/" +
      encodeURIComponent(reference) +
      "\\n\\nEnter this code in the application or website where you started the payment. Do not share this code.",

    html:
      "<div style=\"font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:32px\">" +
      "<div style=\"background:#fff;border:1px solid #e5e5df;border-radius:20px;padding:28px\">" +
      "<b>SquashberryPay</b>" +
      "<h1>Payment approved</h1>" +
      "<p>Your payment for <strong>" +
      escapeHtml(
        serviceName ||
        "the merchant"
      ) +
      "</strong> has been verified.</p>" +
      "<p><b>Reference:</b> " +
      escapeHtml(reference) +
      "<br><b>Amount:</b> " +
      escapeHtml(currency) +
      " " +
      Number(amount).toFixed(2) +
      "</p>" +
      "<div style=\"border:1px solid #deded9;border-radius:16px;padding:22px;text-align:center\">" +
      "<div style=\"font-size:11px;font-weight:800;letter-spacing:2px;color:#777\">ONE-TIME PAYMENT CODE</div>" +
      "<div style=\"margin-top:10px;font:800 28px monospace;letter-spacing:2px\">" +
      escapeHtml(code) +
      "</div></div>" +
      "<p style=\"color:#666;line-height:1.6\">Enter this code in the application where you started the payment.</p>" +
      "<p style=\"color:#999;font-size:12px\">This code is tied to this payment, expires shortly, and can only be used once.</p>" +
      "</div></div>"
  });
}


/* ============================================================
   FRONTEND ROUTES
============================================================ */

app.get(
    "/",
    (req, res) => {

        res.sendFile(
            path.join(
                __dirname,
                "public",
                "index.html"
            )
        );
    }
);


app.get(
    "/checkout/:slug",
    (req, res) => {
        res.sendFile(
            path.join(
                __dirname,
                "public",
                "checkout.html"
            )
        );
    }
);


app.get(
    "/donate/:slug",
    (req, res) => {
        res.sendFile(
            path.join(
                __dirname,
                "public",
                "checkout.html"
            )
        );
    }
);


app.get(
    "/pay/:token",
    (req, res) => {

        res.sendFile(
            path.join(
                __dirname,
                "public",
                "index.html"
            )
        );
    }
);


app.get(
    "/signup",
    (req, res) => {

        res.sendFile(
            path.join(
                __dirname,
                "public",
                "signup.html"
            )
        );
    }
);


app.get(
    "/signin",
    (req, res) => {

        res.sendFile(
            path.join(
                __dirname,
                "public",
                "signin.html"
            )
        );
    }
);


app.get(
    "/merchant",
    (req, res) => {

        res.sendFile(
            path.join(
                __dirname,
                "public",
                "merchant.html"
            )
        );
    }
);


app.get(
    "/admin",
    (req, res) => {

        res.sendFile(
            path.join(
                __dirname,
                "public",
                "admin.html"
            )
        );
    }
);


/* ============================================================
   STATIC ASSET ROUTES
============================================================ */

app.get(
    "/squashberrypay.js",
    (req, res) => {
        res.sendFile(
            path.join(
                __dirname,
                "public",
                "squashberrypay.js"
            )
        );
    }
);


app.get(
    "/buttons.js",
    (req, res) => {
        res.sendFile(
            path.join(
                __dirname,
                "public",
                "squashberrypay.js"
            )
        );
    }
);


app.get(
    "/styles.css",
    (req, res) => {

        res.sendFile(
            path.join(
                __dirname,
                "public",
                "styles.css"
            )
        );
    }
);


app.get(
    "/app.js",
    (req, res) => {

        res.sendFile(
            path.join(
                __dirname,
                "public",
                "app.js"
            )
        );
    }
);


app.get(
    "/auth.css",
    (req, res) => {

        res.sendFile(
            path.join(
                __dirname,
                "public",
                "auth.css"
            )
        );
    }
);


app.get(
    "/auth.js",
    (req, res) => {

        res.sendFile(
            path.join(
                __dirname,
                "public",
                "auth.js"
            )
        );
    }
);


app.get(
    "/merchant.css",
    (req, res) => {

        res.sendFile(
            path.join(
                __dirname,
                "public",
                "merchant.css"
            )
        );
    }
);


app.get(
    "/merchant.js",
    (req, res) => {

        res.sendFile(
            path.join(
                __dirname,
                "public",
                "merchant.js"
            )
        );
    }
);


app.get(
    "/admin.css",
    (req, res) => {

        res.sendFile(
            path.join(
                __dirname,
                "public",
                "admin.css"
            )
        );
    }
);


app.get(
    "/admin.js",
    (req, res) => {

        res.sendFile(
            path.join(
                __dirname,
                "public",
                "admin.js"
            )
        );
    }
);


app.get(
    "/pay/styles.css",
    (req, res) => {

        res.sendFile(
            path.join(
                __dirname,
                "public",
                "styles.css"
            )
        );
    }
);


app.get(
    "/pay/app.js",
    (req, res) => {

        res.sendFile(
            path.join(
                __dirname,
                "public",
                "app.js"
            )
        );
    }
);


/* ============================================================
   API 404
============================================================ */

app.use(
    "/api",
    (req, res) => {

        res.status(404).json({

            error:
                "API endpoint not found."
        });
    }
);


/* ============================================================
   FRONTEND FALLBACK
============================================================ */

app.get(
    "*",
    (req, res) => {

        if (
            req.accepts("html")
        ) {

            return res.sendFile(
                path.join(
                    __dirname,
                    "public",
                    "index.html"
                )
            );
        }


        res.status(404).json({

            error:
                "Not found."
        });
    }
);


/* ============================================================
   GLOBAL ERROR HANDLER
============================================================ */

app.use(
    (
        error,
        req,
        res,
        next
    ) => {

        console.error(
            "\n========== UNHANDLED SERVER ERROR =========="
        );

        console.error(
            error
        );

        console.error(
            "============================================\n"
        );


        if (
            res.headersSent
        ) {

            return next(
                error
            );
        }


        res.status(500).json({

            error:
                error.publicMessage ||
                "Something went wrong. Please try again."
        });
    }
);


/* ============================================================
   SUBSCRIPTION REMINDER JOB
============================================================ */
export async function runSubscriptionReminderJob(){
  const now=new Date();
  const horizon=new Date(now.getTime()+7*86400000);
  const cutoff=new Date(now.getTime()-23*3600000);
  const {data:contracts,error}=await supabase.from("subscription_contracts").select("*,services(name,status),products(name,amount,currency,subscription_interval),service_users(email)").eq("status","active").lte("next_due_at",horizon.toISOString());
  if(error){console.error("Subscription reminder query error:",error);return{sent:0,error:true};}
  let sent=0;
  for(const c of contracts||[]){
    try{
      let payment=null;
      if(c.current_payment_id){
        const result=await supabase.from("payments").select("id,payment_reference,status,amount,currency").eq("id",c.current_payment_id).maybeSingle();
        payment=result.data;
      }
      const needsNew=!payment||["completed","rejected","cancelled","expired"].includes(payment.status);
      if(needsNew){
        const expiresAt=new Date(now.getTime()+7*86400000).toISOString();
        const {data:p,error:pe}=await supabase.from("payments").insert({payment_reference:generateReference(),processing_page_id:"SPP-"+randomHex(10).toUpperCase(),service_id:c.service_id,service_user_id:c.service_user_id,product_id:c.product_id,amount:c.products.amount,currency:c.products.currency,payment_type:"subscribe",status:"pending",payment_state:"awaiting_payment",expires_at:expiresAt}).select("id,payment_reference,amount,currency,status").single();
        if(pe)throw pe;
        const raw=randomToken();const {error:se}=await supabase.from("payment_sessions").insert({payment_id:p.id,session_token_hash:hash(raw),expires_at:expiresAt});if(se)throw se;
        await supabase.from("subscription_contracts").update({current_payment_id:p.id,last_reminded_at:now.toISOString(),reminder_count:(c.reminder_count||0)+1,updated_at:now.toISOString()}).eq("id",c.id);
        await persistPaymentEvent(
          p,
          "subscription.payment_due",
          "created",
          "awaiting_payment",
          {subscription_id:c.id,next_due_at:c.next_due_at}
        );
        await enqueueWebhookEvent(
          "subscription.payment_due",
          {...p,payment_state:"awaiting_payment"},
          {subscription_id:c.id,next_due_at:c.next_due_at}
        );
        await sendResendEmail({to:c.service_users?.email,subject:"Your "+c.services?.name+" subscription is due soon",text:"Your "+c.products?.name+" subscription payment is due "+new Date(c.next_due_at).toLocaleDateString()+".\n\nAmount: "+c.products.currency+" "+c.products.amount+"\n\nPay here: "+PUBLIC_SITE_URL+"/index.html?pay="+raw,html:"<div style=\"font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:32px\"><div style=\"background:#fff;border:1px solid #e5e5df;border-radius:20px;padding:28px\"><b>SquashberryPay</b><h1>Subscription payment due</h1><p>Your next "+escapeHtml(c.products?.name||"subscription")+" payment is due soon.</p><p><b>Amount:</b> "+escapeHtml(c.products.currency)+" "+Number(c.products.amount).toFixed(2)+"</p><p><a href=\""+escapeHtml(PUBLIC_SITE_URL+"/index.html?pay="+raw)+"\">Continue subscription payment</a></p></div></div>"});
        sent++;
        continue;
      }
      if(c.last_reminded_at&&new Date(c.last_reminded_at)>cutoff)continue;
      if(["pending","awaiting_receipt","awaiting_verification","approved"].includes(payment.status)){
        const raw=randomToken();const expiresAt=new Date(now.getTime()+7*86400000).toISOString();
        await supabase.from("payment_sessions").insert({payment_id:payment.id,session_token_hash:hash(raw),expires_at:expiresAt});
        await supabase.from("subscription_contracts").update({last_reminded_at:now.toISOString(),reminder_count:(c.reminder_count||0)+1,updated_at:now.toISOString()}).eq("id",c.id);
        await sendResendEmail({to:c.service_users?.email,subject:"Reminder: "+c.services?.name+" subscription payment",text:"Your subscription payment is due "+new Date(c.next_due_at).toLocaleDateString()+".\n\nPay here: "+PUBLIC_SITE_URL+"/index.html?pay="+raw,html:"<div style=\"font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:32px\"><div style=\"background:#fff;border:1px solid #e5e5df;border-radius:20px;padding:28px\"><b>SquashberryPay</b><h1>Subscription payment reminder</h1><p>Your next subscription payment is due.</p><p><a href=\""+escapeHtml(PUBLIC_SITE_URL+"/index.html?pay="+raw)+"\">Continue payment</a></p></div></div>"});
        sent++;
      }
    }catch(e){console.error("Subscription reminder item error:",c.id,e);}
  }
  return{sent};
}
/* ============================================================
   START
============================================================ */

app.listen(
    PORT,
    () => {

        console.log(
            "\n=============================================="
        );

        console.log(
            "             SQUASHBERRYPAY"
        );

        console.log(
            "=============================================="
        );

        console.log(
            `Website:       ${BASE_URL}`
        );

        console.log(
            `Sign up:       ${BASE_URL}/signup`
        );

        console.log(
            `Sign in:       ${BASE_URL}/signin`
        );

        console.log(
            `Merchant:      ${BASE_URL}/merchant`
        );

        console.log(
            `Admin:         ${BASE_URL}/admin`
        );

        console.log(
            `Health:        ${BASE_URL}/health`
        );

        console.log(
            "----------------------------------------------"
        );

        console.log(
            `Auth OTP:      ${AUTH_OTP_MINUTES} minutes`
        );

        console.log(
            `OTP attempts:  ${AUTH_OTP_MAX_ATTEMPTS}`
        );

        console.log(
            `OTP cooldown:  ${AUTH_OTP_RESEND_SECONDS}s`
        );

        console.log(
            "----------------------------------------------"
        );

        console.log(
            "Signup OTP:    Resend"
        );

        console.log(
            "Login:         Email + Password"
        );

        console.log(
            "Reset:         Resend OTP"
        );

        console.log(
            "==============================================\n"
        );
    }
);
