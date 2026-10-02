"use strict";


const token =
    sessionStorage.getItem(
        "sbp_access_token"
    );


if (!token) {
    window.location.href =
        "/signin";
}


const $ =
    selector =>
        document.querySelector(
            selector
        );


let merchant = null;

let apps = [];


const notification =
    $("#merchantNotification");


function notify(
    message,
    type = "normal"
) {

    notification.textContent =
        message;

    notification.className =
        `merchant-notification ${type}`;

    notification.hidden =
        false;

    clearTimeout(
        notify.timeout
    );

    notify.timeout =
        setTimeout(
            () => {
                notification.hidden =
                    true;
            },
            4200
        );
}


function setLoading(
    button,
    text
) {

    if (!button) {
        return;
    }


    if (
        !button.dataset.originalHtml
    ) {
        button.dataset.originalHtml =
            button.innerHTML;
    }


    button.disabled =
        true;


    button.innerHTML =
        `
            <span class="spinner dark"></span>
            <span>${escapeHtml(
                text
            )}</span>
        `;
}


function resetButton(
    button
) {

    if (!button) {
        return;
    }


    button.disabled =
        false;


    if (
        button.dataset.originalHtml
    ) {
        button.innerHTML =
            button.dataset.originalHtml;
    }
}


async function api(
    url,
    options = {}
) {

    const response =
        await fetch(
            url,
            {
                ...options,

                headers: {
                    ...(options.headers || {}),

                    Authorization:
                        `Bearer ${token}`,

                    "Content-Type":
                        "application/json"
                }
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


    if (!response.ok) {

        if (
            response.status ===
            401
        ) {

            sessionStorage.clear();

            window.location.href =
                "/signin";

            return;
        }


        throw new Error(
            data.error ||
            "Request failed."
        );
    }


    return data;
}


/* ============================================================
   NAVIGATION
============================================================ */

const sections =
    [
        "overview",
        "apps",
        "products",
        "methods",
        "buttons",
        "integration",
        "settings"
    ];


function showSection(
    name
) {

    sections.forEach(
        section => {

            const element =
                $(
                    `#section-${section}`
                );


            if (!element) {
                return;
            }


            element.hidden =
                section !== name;


            element.classList.toggle(
                "active",
                section === name
            );


            if (
                section ===
                name
            ) {

                element.classList.remove(
                    "page-enter"
                );

                void element.offsetWidth;

                element.classList.add(
                    "page-enter"
                );
            }
        }
    );


    document
        .querySelectorAll(
            ".side-link"
        )
        .forEach(
            button => {

                button.classList.toggle(
                    "active",
                    button.dataset.section ===
                        name
                );
            }
        );


    if (
        name ===
        "apps"
    ) {
        loadApps();
    }


    if (
        name ===
        "products"
    ) {
        prepareProducts();
    }


    if (
        name ===
        "methods"
    ) {
        prepareMethods();
    }


    if (
        name ===
        "buttons"
    ) {
        prepareButtons();
    }


    if (
        name ===
        "settings"
    ) {
        renderProfile();
    }
}


document
    .querySelectorAll(
        ".side-link"
    )
    .forEach(
        button => {

            button.addEventListener(
                "click",
                () => {
                    showSection(
                        button.dataset.section
                    );
                }
            );
        }
    );


document
    .querySelectorAll(
        "[data-jump]"
    )
    .forEach(
        button => {

            button.addEventListener(
                "click",
                () => {

                    showSection(
                        button.dataset.jump
                    );
                }
            );
        }
    );


/* ============================================================
   MERCHANT
============================================================ */

async function loadMerchant() {

    try {

        const data =
            await api(
                "/api/merchant/me"
            );


        merchant =
            data.merchant;


        $("#merchantName")
            .textContent =
            merchant.business_name;


        $("#overviewName")
            .textContent =
            merchant.business_name;


        $("#merchantStatus")
            .textContent =
            merchant.status;


        renderProfile();

        await loadApps();

    } catch (error) {

        notify(
            error.message,
            "error"
        );
    }
}


/* ============================================================
   APPS
============================================================ */

async function loadApps() {

    try {

        const data =
            await api(
                "/api/merchant/apps"
            );


        apps =
            data.apps || [];


        $("#appCount")
            .textContent =
            apps.length;


        renderApps();

        populateAppSelects();

        loadProductCount();

    } catch (error) {

        notify(
            error.message,
            "error"
        );
    }
}


function statusDescription(
    status
) {

    switch (
        status
    ) {

        case "pending":
            return "Waiting for SquashberryPay approval.";

        case "active":
            return "Approved and ready to process payments.";

        case "rejected":
            return "This application was rejected.";

        case "suspended":
            return "Payments are temporarily disabled.";

        case "disabled":
            return "This application has been disabled.";

        default:
            return "";
    }
}


function renderApps() {

    const container =
        $("#appsList");


    container.innerHTML =
        "";


    if (
        apps.length ===
        0
    ) {

        container.innerHTML =
            `
                <div class="app-card">

                    <div>

                        <h3>
                            No applications yet
                        </h3>

                        <p>
                            Add your first website,
                            web app or mobile app.
                        </p>

                    </div>

                </div>
            `;

        return;
    }


    apps.forEach(
        (app, index) => {

            const card =
                document.createElement(
                    "article"
                );


            card.className =
                "app-card";


            card.style.animationDelay =
                `${index * 45}ms`;


            const statusClass =
                app.status ===
                "active"
                    ? "active"
                    : "pending";


            card.innerHTML =
                `
                    <div>

                        <div
                            style="
                                display:flex;
                                align-items:center;
                                gap:8px;
                                margin-bottom:7px;
                            "
                        >

                            <h3
                                style="margin:0;"
                            >
                                ${escapeHtml(
                                    app.name
                                )}
                            </h3>

                            <span
                                class="app-status ${statusClass}"
                            >
                                ${escapeHtml(
                                    app.status
                                )}
                            </span>

                        </div>


                        <p>
                            ${escapeHtml(
                                app.website_url ||
                                "No URL provided"
                            )}
                        </p>


                        <div
                            class="app-meta"
                        >

                            <span>
                                ${escapeHtml(
                                    app.platform_type ||
                                    "app"
                                )}
                            </span>

                            <span>
                                ${
                                    escapeHtml(
                                        statusDescription(
                                            app.status
                                        )
                                    )
                                }
                            </span>

                        </div>

                    </div>


                    <div
                        class="card-actions"
                    >

                        <button
                            class="small-action danger"
                            data-remove-app="${app.id}"
                        >
                            Remove
                        </button>

                    </div>
                `;


            container.appendChild(
                card
            );
        }
    );
}


function populateAppSelects() {

    [
        "#productApp",
        "#methodApp",
        "#buttonApp"
    ].forEach(
        selector => {

            const select =
                $(selector);


            if (!select) {
                return;
            }


            select.innerHTML =
                "";


            apps.forEach(
                app => {

                    const option =
                        document.createElement(
                            "option"
                        );


                    option.value =
                        app.id;


                    option.textContent =
                        `${app.name} — ${app.status}`;


                    select.appendChild(
                        option
                    );
                }
            );
        }
    );
}


/* ============================================================
   ADD APP
============================================================ */

$("#openAddApp")
    ?.addEventListener(
        "click",
        () => {

            $("#addAppPanel")
                .hidden =
                false;

            $("#addAppPanel")
                .classList.add(
                    "state-enter"
                );

            $("#newAppName")
                .focus();
        }
    );


$("#cancelAddApp")
    ?.addEventListener(
        "click",
        () => {

            $("#addAppPanel")
                .hidden =
                true;
        }
    );


$("#createApp")
    ?.addEventListener(
        "click",
        async () => {

            const button =
                $("#createApp");


            const name =
                $("#newAppName")
                    .value
                    .trim();


            const websiteUrl =
                $("#newAppUrl")
                    .value
                    .trim();


            const platform =
                $("#newAppPlatform")
                    .value;


            if (!name) {

                notify(
                    "Enter your application name.",
                    "error"
                );

                return;
            }


            setLoading(
                button,
                "Submitting…"
            );


            try {

                const data =
                    await api(
                        "/api/merchant/apps",
                        {
                            method:
                                "POST",

                            body:
                                JSON.stringify({
                                    name,

                                    website_url:
                                        websiteUrl,

                                    platform_type:
                                        platform
                                })
                        }
                    );


                alert(
                    [
                        "APPLICATION SUBMITTED",
                        "",
                        `Application: ${data.app.name}`,
                        "",
                        `Client ID: ${data.credentials.client_id}`,
                        "",
                        `Client Secret: ${data.credentials.client_secret}`,
                        "",
                        "SAVE THESE CREDENTIALS SECURELY.",
                        "",
                        "The credentials will NOT work until SquashberryPay approves this application."
                    ].join("\n")
                );


                $("#addAppPanel")
                    .hidden =
                    true;


                $("#newAppName")
                    .value =
                    "";

                $("#newAppUrl")
                    .value =
                    "";


                await loadApps();


                notify(
                    "Application submitted for approval.",
                    "success"
                );

            } catch (error) {

                notify(
                    error.message,
                    "error"
                );

            } finally {

                resetButton(
                    button
                );
            }
        }
    );


/* ============================================================
   REMOVE APP
============================================================ */

document.addEventListener(
    "click",
    async event => {

        const button =
            event.target.closest(
                "[data-remove-app]"
            );


        if (!button) {
            return;
        }


        const confirmed =
            window.confirm(
                "Remove this application? Existing payment history will remain, but this app will stop processing new payments."
            );


        if (!confirmed) {
            return;
        }


        setLoading(
            button,
            "Removing…"
        );


        try {

            await api(
                `/api/merchant/apps/${button.dataset.removeApp}`,
                {
                    method:
                        "DELETE"
                }
            );


            await loadApps();


            notify(
                "Application disabled.",
                "success"
            );

        } catch (error) {

            notify(
                error.message,
                "error"
            );


            resetButton(
                button
            );
        }
    }
);


/* ============================================================
   PRODUCTS
============================================================ */

function prepareProducts() {

    populateAppSelects();

    loadProducts();
}


$("#productApp")
    ?.addEventListener(
        "change",
        loadProducts
    );


function updateProductTypeFields() {
    const type =
        $("#productType")
            ?.value;

    $("#subscriptionIntervalGroup")
        .hidden =
        type !==
        "subscribe";

    $("#donationSettings")
        .hidden =
        type !==
        "donate";

    if (
        type ===
        "donate"
    ) {
        $("#customDonation")
            .checked =
            $("#customDonation")
                .dataset.initialized !==
                "true"
                ? true
                : $("#customDonation")
                    .checked;

        $("#customDonation")
            .dataset.initialized =
            "true";
    }
}


$("#productType")
    ?.addEventListener(
        "change",
        updateProductTypeFields
    );

updateProductTypeFields();


async function loadProducts() {

    const appId =
        $("#productApp")
            ?.value;


    if (!appId) {
        return;
    }


    try {

        const data =
            await api(
                `/api/merchant/apps/${appId}/products`
            );


        const products =
            data.products || [];


        $("#productCount")
            .textContent =
            products.length;


        renderProducts(
            products
        );


        populateButtonProducts(
            products
        );

    } catch (error) {

        notify(
            error.message,
            "error"
        );
    }
}


$("#saveProduct")
    ?.addEventListener(
        "click",
        async () => {

            const button =
                $("#saveProduct");


            const appId =
                $("#productApp")
                    .value;


            if (!appId) {

                notify(
                    "Create an application first.",
                    "error"
                );

                return;
            }


            const payload = {

                product_code:
                    $("#productCode")
                        .value
                        .trim(),

                name:
                    $("#productName")
                        .value
                        .trim(),

                description:
                    $("#productDescription")
                        .value
                        .trim(),

                payment_type:
                    $("#productType")
                        .value,

                amount:
                    $("#productAmount")
                        .value
                        ? Number(
                            $("#productAmount")
                                .value
                        )
                        : null,

                currency:
                    "GMD",

                subscription_interval:
                    $("#subscriptionInterval")
                        .value,

                allow_custom_amount:
                    $("#productType")
                        .value ===
                        "donate" &&
                    $("#customDonation")
                        .checked,

                donation_goal:
                    $("#donationGoal")
                        .value
                        ? Number(
                            $("#donationGoal")
                                .value
                        )
                        : null,

                donation_minimum:
                    $("#donationMinimum")
                        .value
                        ? Number(
                            $("#donationMinimum")
                                .value
                        )
                        : null,

                donation_maximum:
                    $("#donationMaximum")
                        .value
                        ? Number(
                            $("#donationMaximum")
                                .value
                        )
                        : null,

                donation_presets:
                    $("#donationPresets")
                        .value
                        .split(",")
                        .map(value =>
                            Number(
                                value.trim()
                            )
                        )
                        .filter(value =>
                            Number.isFinite(
                                value
                            ) &&
                            value > 0
                        ),

                donation_goal_message:
                    $("#donationGoalMessage")
                        .value
                        .trim(),

                donation_end_at:
                    $("#donationEndAt")
                        .value
                        ? new Date(
                            $("#donationEndAt")
                                .value
                        ).toISOString()
                        : null,

                show_donation_goal:
                    $("#showDonationGoal")
                        .checked,

                show_donor_count:
                    $("#showDonorCount")
                        .checked,

                close_on_goal:
                    $("#closeOnGoal")
                        .checked
            };


            if (
                !payload.product_code ||
                !payload.name
            ) {

                notify(
                    "Enter a product name and product code.",
                    "error"
                );

                return;
            }


            setLoading(
                button,
                "Saving…"
            );


            try {

                await api(
                    `/api/merchant/apps/${appId}/products`,
                    {
                        method:
                            "POST",

                        body:
                            JSON.stringify(
                                payload
                            )
                    }
                );


                notify(
                    "Product saved.",
                    "success"
                );


                [
                    "#productCode",
                    "#productName",
                    "#productDescription",
                    "#productAmount",
                    "#donationGoal",
                    "#donationMinimum",
                    "#donationMaximum",
                    "#donationPresets",
                    "#donationGoalMessage",
                    "#donationEndAt"
                ].forEach(
                    selector => {
                        $(selector)
                            .value =
                            "";
                    }
                );

                $("#customDonation")
                    .checked =
                    true;

                $("#showDonationGoal")
                    .checked =
                    true;

                $("#showDonorCount")
                    .checked =
                    true;

                $("#closeOnGoal")
                    .checked =
                    false;

                updateProductTypeFields();


                await loadProducts();

            } catch (error) {

                notify(
                    error.message,
                    "error"
                );

            } finally {

                resetButton(
                    button
                );
            }
        }
    );


function renderProducts(
    products
) {

    const container =
        $("#productsList");


    container.innerHTML =
        "";


    if (
        !products.length
    ) {

        container.innerHTML =
            `
                <div class="product-card">
                    <p>
                        No products for this
                        application yet.
                    </p>
                </div>
            `;

        return;
    }


    products.forEach(
        (product, index) => {

            const card =
                document.createElement(
                    "article"
                );


            card.className =
                "product-card";


            card.style.animationDelay =
                `${index * 40}ms`;


            const price =
                product.allow_custom_amount
                    ? "Customer chooses amount"
                    : `${product.currency} ${Number(
                        product.amount
                    ).toFixed(2)}`;


            const interval =
                product.payment_type ===
                    "subscribe"
                    ? ` / ${product.subscription_interval}`
                    : "";

            const donationDetails =
                product.payment_type ===
                    "donate"
                    ? [
                        product.donation_goal
                            ? "Goal " +
                                product.currency +
                                " " +
                                Number(
                                    product.donation_goal
                                ).toFixed(2)
                            : null,
                        product.donation_minimum
                            ? "Min " +
                                product.currency +
                                " " +
                                Number(
                                    product.donation_minimum
                                ).toFixed(2)
                            : null,
                        product.donation_maximum
                            ? "Max " +
                                product.currency +
                                " " +
                                Number(
                                    product.donation_maximum
                                ).toFixed(2)
                            : null
                    ]
                        .filter(Boolean)
                        .join(" · ")
                    : "";

            card.innerHTML =
                `
                    <h3>
                        ${escapeHtml(
                            product.name
                        )}
                    </h3>

                    <p>
                        ${escapeHtml(
                            product.payment_type
                        )}
                        ·
                        ${escapeHtml(
                            price
                        )}
                        ${interval}
                    </p>

                    ${
                        donationDetails
                            ? `
                                <p class="product-meta">
                                    ${escapeHtml(
                                        donationDetails
                                    )}
                                </p>
                            `
                            : ""
                    }
                `;


            container.appendChild(
                card
            );
        }
    );
}


/* ============================================================
   METHODS
============================================================ */

function prepareMethods() {

    populateAppSelects();

    loadMethods();
}


$("#methodApp")
    ?.addEventListener(
        "change",
        loadMethods
    );


async function loadMethods() {

    const appId =
        $("#methodApp")
            ?.value;


    if (!appId) {
        return;
    }


    try {

        const data =
            await api(
                `/api/merchant/apps/${appId}/payment-methods`
            );


        renderMethods(
            data.payment_methods || []
        );

    } catch (error) {

        notify(
            error.message,
            "error"
        );
    }
}


$("#saveMethod")
    ?.addEventListener(
        "click",
        async () => {

            const button =
                $("#saveMethod");


            const appId =
                $("#methodApp")
                    .value;


            if (!appId) {

                notify(
                    "Create an application first.",
                    "error"
                );

                return;
            }


            const payload = {

                name:
                    $("#methodName")
                        .value
                        .trim(),

                type:
                    $("#methodType")
                        .value,

                account_name:
                    $("#methodAccountName")
                        .value
                        .trim(),

                phone_number:
                    $("#methodPhone")
                        .value
                        .trim(),

                bank_name:
                    $("#methodBankName")
                        .value
                        .trim(),

                account_number:
                    $("#methodAccountNumber")
                        .value
                        .trim(),

                instructions:
                    $("#methodInstructions")
                        .value
                        .trim()
            };


            if (
                !payload.name ||
                !payload.instructions
            ) {

                notify(
                    "Enter the payment method name and instructions.",
                    "error"
                );

                return;
            }


            setLoading(
                button,
                "Saving…"
            );


            try {

                await api(
                    `/api/merchant/apps/${appId}/payment-methods`,
                    {
                        method:
                            "POST",

                        body:
                            JSON.stringify(
                                payload
                            )
                    }
                );


                notify(
                    "Payment method saved.",
                    "success"
                );


                [
                    "#methodName",
                    "#methodAccountName",
                    "#methodPhone",
                    "#methodBankName",
                    "#methodAccountNumber",
                    "#methodInstructions"
                ].forEach(
                    selector => {
                        $(selector)
                            .value =
                            "";
                    }
                );


                await loadMethods();

            } catch (error) {

                notify(
                    error.message,
                    "error"
                );

            } finally {

                resetButton(
                    button
                );
            }
        }
    );


function renderMethods(
    methods
) {

    const container =
        $("#methodsList");


    container.innerHTML =
        "";


    if (
        !methods.length
    ) {

        container.innerHTML =
            `<div class="method-card">
                <p>
                    No payment methods configured.
                </p>
            </div>`;

        return;
    }


    methods.forEach(
        (method, index) => {

            const card =
                document.createElement(
                    "article"
                );


            card.className =
                "method-card";


            card.style.animationDelay =
                `${index * 40}ms`;


            card.innerHTML =
                `
                    <h3>
                        ${escapeHtml(
                            method.name
                        )}
                    </h3>

                    <p>
                        ${escapeHtml(
                            method.type
                        )}
                        ·
                        ${escapeHtml(
                            method.account_name ||
                            method.bank_name ||
                            method.phone_number ||
                            ""
                        )}
                    </p>
                `;


            container.appendChild(
                card
            );
        }
    );
}


/* ============================================================
   BUTTON GUIDE
============================================================ */

function prepareButtons() {

    populateAppSelects();

    populateButtonProductsForCurrentApp();
}


$("#buttonApp")
    ?.addEventListener(
        "change",
        populateButtonProductsForCurrentApp
    );


async function populateButtonProductsForCurrentApp() {

    const appId =
        $("#buttonApp")
            ?.value;


    if (!appId) {
        return;
    }


    try {

        const data =
            await api(
                `/api/merchant/apps/${appId}/products`
            );


        populateButtonProducts(
            data.products || []
        );

    } catch (error) {

        notify(
            error.message,
            "error"
        );
    }
}


function populateButtonProducts(
    products
) {

    const select =
        $("#buttonProduct");


    if (!select) {
        return;
    }


    select.innerHTML =
        "";


    products.forEach(
        product => {

            const option =
                document.createElement(
                    "option"
                );


            option.value =
                product.product_code;

            option.textContent =
                `${product.name} — ${product.payment_type}`;


            option.dataset.type =
                product.payment_type;


            select.appendChild(
                option
            );
        }
    );
}



$("#generateButtonGuide")
    ?.addEventListener(
        "click",
        async () => {

            const app =
                apps.find(
                    item =>
                        item.id ===
                        $("#buttonApp")
                            .value
                );


            const option =
                $("#buttonProduct")
                    .selectedOptions[0];


            if (
                !app ||
                !option
            ) {

                notify(
                    "Choose an application and product.",
                    "error"
                );

                return;
            }

            const generator =
                $("#generateButtonGuide");

            setLoading(
                generator,
                "Preparing secure link…"
            );

            try {

                const data =
                    await api(
                        "/api/merchant/apps/" +
                        encodeURIComponent(
                            app.id
                        ) +
                        "/payment-links",
                        {
                            method:
                                "POST",

                            headers: {
                                "Content-Type":
                                    "application/json"
                            },

                            body:
                                JSON.stringify({
                                    product_id:
                                        option.value
                                })
                        }
                    );

                const paymentLink =
                    data.payment_link;

                const paymentUrl =
                    data.payment_url;

                const type =
                    option.dataset.type;

                $("#guideType")
                    .textContent =
                    type;

                $("#buttonGuide")
                    .hidden =
                    false;

                $("#buttonGuide")
                    .classList.add(
                        "state-enter"
                    );

                $("#buttonCode")
                    .textContent =
                    getButtonExample(
                        type,
                        paymentLink.slug,
                        paymentUrl,
                        paymentLink.button_label
                    );

                notify(
                    data.reused
                        ? "Existing secure payment link loaded."
                        : "Secure payment link created.",
                    "success"
                );

            } catch (error) {

                notify(
                    error.message,
                    "error"
                );

            } finally {

                resetButton(
                    generator
                );
            }
        }
    );


function getButtonExample(
    type,
    slug,
    paymentUrl,
    buttonLabel
) {

    const sdkOrigin =
        new URL(
            paymentUrl
        ).origin;

    return [
        "<!-- SquashberryPay universal button -->",
        "<script",
        "    src=" +
            JSON.stringify(
                sdkOrigin +
                "/buttons.js"
            ),
        "    data-squashberrypay-button=" +
            JSON.stringify(
                slug
            ) +
        ">",
        "</script>",
        "",
        "<!-- Hosted checkout link -->",
        paymentUrl
    ].join(
        "\n"
    );
}


$("#copyButtonCode")
    ?.addEventListener(
        "click",
        async () => {

            const code =
                $("#buttonCode")
                    ?.textContent ||
                "";

            if (
                !code
            ) {
                return;
            }

            try {

                await navigator.clipboard.writeText(
                    code
                );

                notify(
                    "Button code copied.",
                    "success"
                );

            } catch {

                notify(
                    "Could not copy the code automatically.",
                    "error"
                );
            }
        }
    );


/* ============================================================
   PROFILE
============================================================ */

function renderProfile() {

    if (!merchant) {
        return;
    }


    $("#merchantProfile")
        .innerHTML =
        `
            <h3>
                ${escapeHtml(
                    merchant.business_name
                )}
            </h3>

            <p>
                ${escapeHtml(
                    merchant.email
                )}
            </p>

            <p>
                Status:
                <strong>
                    ${escapeHtml(
                        merchant.status
                    )}
                </strong>
            </p>

            ${
                merchant.website
                    ? `
                        <p>
                            ${escapeHtml(
                                merchant.website
                            )}
                        </p>
                    `
                    : ""
            }
        `;
}


/* ============================================================
   PRODUCT COUNT
============================================================ */

async function loadProductCount() {

    if (
        !apps.length
    ) {

        $("#productCount")
            .textContent =
            "0";

        return;
    }


    let count =
        0;


    for (
        const app of apps
    ) {

        try {

            const data =
                await api(
                    `/api/merchant/apps/${app.id}/products`
                );


            count +=
                (
                    data.products ||
                    []
                ).length;

        } catch {
            /*
             * Ignore.
             */
        }
    }


    $("#productCount")
        .textContent =
        count;
}


/* ============================================================
   ESCAPE
============================================================ */

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


/* ============================================================
   SIGN OUT
============================================================ */

$("#signOut")
    ?.addEventListener(
        "click",
        () => {

            sessionStorage.clear();

            window.location.href =
                "/";
        }
    );


loadMerchant();