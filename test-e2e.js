"use strict";

require("dotenv").config();
const http = require("http");

async function runTest() {
    console.log("Starting SquashberryPay E2E verification test...\n");

    // 1. Health check
    const healthRes = await fetch("http://localhost:3000/health");
    const health = await healthRes.json();
    console.log("1. Health check:", health.ok ? "PASSED" : "FAILED", health);

    // 2. Admin Login
    const loginRes = await fetch("http://localhost:3000/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            username: process.env.ADMIN_USERNAME || "admin",
            password: process.env.ADMIN_PASSWORD || "squashberrypay_admin_2026!"
        })
    });
    const loginData = await loginRes.json();
    const cookie = loginRes.headers.get("set-cookie");
    console.log("2. Admin Login:", loginData.success ? "PASSED" : "FAILED", "(Cookie received:", Boolean(cookie), ")");

    // 3. Admin Me check
    const meRes = await fetch("http://localhost:3000/api/admin/me", {
        headers: { Cookie: cookie }
    });
    const meData = await meRes.json();
    console.log("3. Admin Session Check:", meData.authenticated ? "PASSED" : "FAILED");

    // 4. Create Service (MediSquash)
    const serviceRes = await fetch("http://localhost:3000/api/admin/services", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Cookie: cookie
        },
        body: JSON.stringify({
            name: "MediSquash",
            slug: "medisquash_" + Date.now()
        })
    });
    const serviceData = await serviceRes.json();
    if (!serviceRes.ok) {
        console.error("4. Service Creation: FAILED (Note: DB schema must be executed in Supabase if table doesn't exist yet)", serviceData);
        return;
    }
    console.log("4. Service Creation: PASSED", serviceData.service.name, "ClientID:", serviceData.credentials.client_id);

    const clientId = serviceData.credentials.client_id;
    const clientSecret = serviceData.credentials.client_secret;

    // 5. Register Customer User for MediSquash
    const userRes = await fetch("http://localhost:3000/api/v1/users", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-SquashberryPay-Client-ID": clientId,
            "X-SquashberryPay-Client-Secret": clientSecret
        },
        body: JSON.stringify({
            external_user_id: "user_test_999",
            email: "testuser@medisquash.com"
        })
    });
    const userData = await userRes.json();
    console.log("5. Register User:", userData.user ? "PASSED" : "FAILED", userData);

    // 6. Create Product
    const productRes = await fetch("http://localhost:3000/api/v1/products", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-SquashberryPay-Client-ID": clientId,
            "X-SquashberryPay-Client-Secret": clientSecret
        },
        body: JSON.stringify({
            product_code: "premium_monthly",
            name: "MediSquash Pro Subscription",
            description: "Monthly unlimited consultations",
            amount: 250,
            currency: "GMD"
        })
    });
    const productData = await productRes.json();
    console.log("6. Create Product:", productData.product ? "PASSED" : "FAILED", productData);

    // 7. Create Payment Session
    const paymentRes = await fetch("http://localhost:3000/api/v1/payments", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-SquashberryPay-Client-ID": clientId,
            "X-SquashberryPay-Client-Secret": clientSecret
        },
        body: JSON.stringify({
            external_user_id: "user_test_999",
            product_code: "premium_monthly"
        })
    });
    const paymentData = await paymentRes.json();
    console.log("7. Create Payment Session:", paymentData.payment ? "PASSED" : "FAILED", paymentData.payment_url);

    // Extract session token
    const tokenMatch = paymentData.payment_url.match(/\/pay\/([^/]+)$/);
    const sessionToken = tokenMatch ? tokenMatch[1] : null;

    // 8. Public Session query
    const pubSessionRes = await fetch(`http://localhost:3000/api/public/session/${encodeURIComponent(sessionToken)}`);
    const pubSessionData = await pubSessionRes.json();
    console.log("8. Public Checkout Session:", !pubSessionData.expired ? "PASSED" : "FAILED", "Product:", pubSessionData.payment?.product?.name);

    // 9. Admin Approve Payment
    const approveRes = await fetch(`http://localhost:3000/api/admin/payments/${paymentData.payment.id}/approve`, {
        method: "POST",
        headers: { Cookie: cookie }
    });
    const approveData = await approveRes.json();
    console.log("9. Admin Approve Payment:", approveData.success ? "PASSED" : "FAILED", "Code:", approveData.code);

    const generatedCode = approveData.code;

    // 10. Service Atomically Verifies & Redeems Token
    const verifyRes = await fetch("http://localhost:3000/api/v1/verify-payment", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-SquashberryPay-Client-ID": clientId,
            "X-SquashberryPay-Client-Secret": clientSecret
        },
        body: JSON.stringify({
            external_user_id: "user_test_999",
            token: generatedCode
        })
    });
    const verifyData = await verifyRes.json();
    console.log("10. Service Token Verification:", verifyData.verified ? "PASSED" : "FAILED", verifyData);

    // 11. Attempt Double-Spend (Should Fail)
    const doubleSpendRes = await fetch("http://localhost:3000/api/v1/verify-payment", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-SquashberryPay-Client-ID": clientId,
            "X-SquashberryPay-Client-Secret": clientSecret
        },
        body: JSON.stringify({
            external_user_id: "user_test_999",
            token: generatedCode
        })
    });
    const doubleSpendData = await doubleSpendRes.json();
    console.log("11. Double-Spend Protection Test (Expect FAILED verification):", !doubleSpendData.verified ? "PASSED (Correctly rejected duplicate token)" : "FAILED (Double-spend allowed!)", doubleSpendData);

    console.log("\n==================================================");
    console.log("✨ ALL E2E TESTS COMPLETED!");
    console.log("==================================================");
}

runTest().catch(console.error);
