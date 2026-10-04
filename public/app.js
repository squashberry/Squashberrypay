"use strict";

const SITE_BASE="/Squashberrypay";
const SITE_URL=location.origin+SITE_BASE;

const apiBase =
    String(
        window.SQUASHBERRYPAY_API_BASE ||
        "https://squashberrypay.squashberrypay.workers.dev"
    ).replace(/\/+$/, "");



const state = {
    token: null,

    payment: null,

    service: null,

    methods: [],

    pageExpiresAt: null,

    paymentDeadlineAt: null,

    pageTimer: null,

    paymentTimer: null,

    pollTimer: null,

    notificationTimer: null,

    returning: false
};


const $ =
    selector =>
        document.querySelector(
            selector
        );


const welcomeView =
    $("#welcomeView");

const paymentView =
    $("#paymentView");

const notification =
    $("#notification");

const methodContainer =
    $("#methodContainer");

const detailsContainer =
    $("#detailsContainer");

const verificationContainer =
    $("#verificationContainer");

const methodsElement =
    $("#methods");

const paymentDetails =
    $("#paymentDetails");

const submitReceiptBtn =
    $("#submitReceipt");

const cancelPaymentBtn =
    $("#cancelPayment");

const paymentAttemptTimer =
    $("#paymentAttemptTimer");

const paymentAttemptBox =
    $("#paymentAttemptBox");

const expiryTimer =
    $("#expiryTimer");

const expiryBox =
    $(".page-expiry");

const receiptInput =
    $("#receipt");

const selectedFile =
    $("#selectedFile");

const approvedMessage =
    $("#approvedMessage");

const waitingApprovalBox =
    $("#waitingApprovalBox");


if ($("#year")) {
    $("#year").textContent =
        new Date().getFullYear();
}


function showCustomerSessionLoader(){
    let loader=document.getElementById("customerSessionLoader");
    if(loader)return;
    loader=document.createElement("div");
    loader.id="customerSessionLoader";
    loader.className="customer-session-loader";
    loader.innerHTML='<div class="customer-session-loader-card" role="status" aria-live="polite"><span class="customer-loader-mark">S</span><span class="customer-loader-eyebrow">SECURE CHECKOUT</span><strong>Preparing your payment</strong><p>Connecting to the merchant and checking payment details.</p><span class="customer-loader-spinner" aria-hidden="true"></span></div>';
    document.body.appendChild(loader);
    requestAnimationFrame(()=>loader.classList.add("is-visible"));
}
async function finishCustomerSessionLoader(startedAt){
    const remaining=2000-(performance.now()-startedAt);
    if(remaining>0)await new Promise(resolve=>setTimeout(resolve,remaining));
    const loader=document.getElementById("customerSessionLoader");
    if(!loader)return;
    loader.classList.add("is-leaving");
    setTimeout(()=>loader.remove(),280);
}


/* ============================================================
   TOAST
============================================================ */

function notify(
    message,
    type = "normal",
    duration = 4200
) {

    if (!notification) {
        return;
    }


    clearTimeout(
        state.notificationTimer
    );


    notification.className =
        "notification";


    if (
        type ===
        "error"
    ) {
        notification.classList.add(
            "error"
        );
    }


    if (
        type ===
        "success"
    ) {
        notification.classList.add(
            "success"
        );
    }


    if (
        type ===
        "warning"
    ) {
        notification.classList.add(
            "warning"
        );
    }


    notification.textContent =
        message;

    notification.hidden =
        false;


    state.notificationTimer =
        setTimeout(
            () => {

                notification.classList.add(
                    "hide"
                );


                setTimeout(
                    () => {
                        notification.hidden =
                            true;

                        notification.classList.remove(
                            "hide"
                        );
                    },
                    280
                );

            },
            duration
        );
}


/* ============================================================
   HELPERS
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


function formatMoney(
    amount,
    currency
) {

    return `${currency} ${Number(
        amount || 0
    ).toLocaleString(
        undefined,
        {
            minimumFractionDigits:
                2,

            maximumFractionDigits:
                2
        }
    )}`;
}


function getToken() {
    const query = new URLSearchParams(window.location.search);
    if (query.get("pay")) return query.get("pay");
    const parts = window.location.pathname.split("/").filter(Boolean);
    const i = parts.indexOf("pay");
    return i >= 0 ? parts[i + 1] || null : null;
}


function animateState(
    element
) {

    if (!element) {
        return;
    }


    element.classList.remove(
        "state-enter"
    );


    void element.offsetWidth;


    element.classList.add(
        "state-enter"
    );
}


/* ============================================================
   BUTTON LOADING
============================================================ */

function setButtonLoading(
    button,
    loadingText
) {

    if (!button) {
        return;
    }


    if (!button.dataset.originalHtml) {
        button.dataset.originalHtml =
            button.innerHTML;
    }


    button.disabled =
        true;

    button.classList.add(
        "is-loading"
    );


    button.innerHTML =
        `
            <span class="spinner"></span>

            <span class="button-label">
                ${escapeHtml(
                    loadingText
                )}
            </span>
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


    button.classList.remove(
        "is-loading"
    );


    if (
        button.dataset.originalHtml
    ) {
        button.innerHTML =
            button.dataset.originalHtml;
    }
}


/* ============================================================
   WELCOME
============================================================ */

function showWelcome(
    message = null
) {

    clearInterval(
        state.pageTimer
    );

    clearInterval(
        state.paymentTimer
    );

    clearInterval(
        state.pollTimer
    );


    paymentView.hidden =
        true;

    welcomeView.hidden =
        false;


    animateState(
        welcomeView
    );


    if (message) {
        notify(
            message,
            "error"
        );
    }
}


/* ============================================================
   SESSION
============================================================ */

async function loadSession() {

    const sessionLoaderStartedAt=performance.now();

    const token =
        getToken();


    if (!token) {

        showWelcome();

        return;
    }

    showCustomerSessionLoader();

    state.token =
        token;


    try {

        const response =
            await fetch(
                apiBase + `/api/public/session/${encodeURIComponent(
                    token
                )}`
            );


        const data =
            await response.json();


        if (
            response.status ===
                404 ||
            response.status ===
                410
        ) {

            window.history.replaceState(
                {},
                "",
                SITE_BASE + "/"
            );


            await finishCustomerSessionLoader(sessionLoaderStartedAt);
            showWelcome(
                "This payment page has expired. Please return to the app and start a new payment."
            );

            return;
        }


        if (!response.ok) {
            throw new Error(
                data.error ||
                "Could not load payment."
            );
        }


        if (data.cancelled) {

            window.history.replaceState(
                {},
                "",
                SITE_BASE + "/"
            );


            await finishCustomerSessionLoader(sessionLoaderStartedAt);
            showWelcome(
                "This payment has been cancelled."
            );

            return;
        }


        state.payment =
            data.payment;

        state.service =
            data.service;

        state.methods =
            data.payment_methods || [];

        state.pageExpiresAt =
            new Date(
                data.session.expires_at
            );

        state.paymentDeadlineAt =
            data.payment.payment_deadline_at
                ? new Date(
                    data.payment.payment_deadline_at
                )
                : null;


        await finishCustomerSessionLoader(sessionLoaderStartedAt);
        renderPayment();

    } catch (error) {

        console.error(
            error
        );


        await finishCustomerSessionLoader(sessionLoaderStartedAt);
        showWelcome(
            error.message ||
            "Could not load payment session."
        );
    }
}


/* ============================================================
   PAYMENT
============================================================ */

function renderPayment() {

    welcomeView.hidden =
        true;

    paymentView.hidden =
        false;


    animateState(
        paymentView
    );


    $("#serviceLabel")
        .textContent =
        `${(
            state.service.name ||
            "PAYMENT"
        ).toUpperCase()} CHECKOUT`;


    $("#paymentTitle")
        .textContent =
        getPaymentTitle();


    $("#paymentDescription")
        .textContent =
        getPaymentDescription();


    $("#paymentAmount")
        .textContent =
        formatMoney(
            state.payment.amount,
            state.payment.currency
        );


    $("#paymentProduct")
        .textContent =
        state.payment.product?.name ||
        "Payment";


    $("#paymentReference")
        .textContent =
        state.payment.reference;


    renderMethods();

    startPageTimer();

    startPolling();


    if (
        state.payment.status ===
            "awaiting_receipt" &&
        state.paymentDeadlineAt
    ) {

        showExistingAttempt();

        return;
    }


    if (
        [
            "awaiting_verification",
            "approved",
            "completed"
        ].includes(
            state.payment.status
        )
    ) {

        showVerification();
    }
}


function getPaymentTitle() {

    const product =
        state.payment.product?.name ||
        "Payment";


    switch (
        state.payment.payment_type
    ) {

        case "subscribe":
            return `Subscribe to ${product}`;

        case "donate":
            return `Donate to ${product}`;

        default:
            return `Pay for ${product}`;
    }
}


function getPaymentDescription() {

    switch (
        state.payment.payment_type
    ) {

        case "subscribe":
            return "Complete your subscription payment using one of the available methods.";

        case "donate":
            return "Complete your donation using one of the available methods.";

        default:
            return "Choose a payment method and follow the instructions.";
    }
}


/* ============================================================
   METHODS
============================================================ */

function renderMethods() {

    if(!methodsElement){
        return;
    }

    methodsElement.innerHTML =
        "";


    if (
        state.methods.length ===
        0
    ) {

        methodsElement.innerHTML =
            `
                <p>
                    No payment methods are
                    currently available.
                </p>
            `;

        return;
    }


    state.methods.forEach(
        (method, index) => {

            const button =
                document.createElement(
                    "button"
                );


            button.type =
                "button";

            button.className =
                "checkout-method item-enter";


            button.style.animationDelay =
                `${index * 45}ms`;


            const icon =
                method.type ===
                    "wave"
                    ? "W"
                    : method.type ===
                        "aps"
                        ? "A"
                        : method.type ===
                            "nada"
                            ? "N"
                            : "";


            const description =
                method.type ===
                    "wave"
                    ? "Mobile payment"
                    : method.type ===
                        "aps"
                        ? "Mobile payment"
                        : method.type ===
                            "nada"
                            ? "Mobile payment"
                            : "Bank transfer";


            button.innerHTML =
                `
                    <div class="method-top">

                        <span
                            class="method-icon"
                        >
                            ${icon}
                        </span>

                        <span>
                            →
                        </span>

                    </div>

                    <h3>
                        ${escapeHtml(
                            method.name
                        )}
                    </h3>

                    <p>
                        ${description}
                    </p>
                `;


            button.addEventListener(
                "click",
                () => {
                    openMethod(
                        method,
                        button
                    );
                }
            );


            methodsElement.appendChild(
                button
            );
        }
    );
}


/* ============================================================
   OPEN METHOD
============================================================ */

async function openMethod(
    method,
    button
) {

    setButtonLoading(
        button,
        "Opening…"
    );


    try {

        const response =
            await fetch(
                apiBase + `/api/public/session/${encodeURIComponent(
                    state.token
                )}/method/${encodeURIComponent(
                    method.id
                )}`
            );


        const data =
            await response.json();


        if (
            response.status ===
                410
        ) {

            expirePage();

            return;
        }


        if (!response.ok) {
            throw new Error(
                data.error ||
                "Could not open payment details."
            );
        }


        state.paymentDeadlineAt =
            new Date(
                data.payment_attempt.deadline_at
            );


        state.payment.payment_started_at =
            data.payment_attempt.started_at;


        state.payment.payment_deadline_at =
            data.payment_attempt.deadline_at;


        state.payment.payment_method_id =
            method.id;


        state.payment.status =
            "awaiting_receipt";


        renderDetails(
            data.method
        );


        startPaymentTimer();


        notify(
            "Payment timer started.",
            "success"
        );

    } catch (error) {

        button?.classList.add(
            "error-shake"
        );


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


/* ============================================================
   DETAILS
============================================================ */

function paymentDetailRow(label,value){
    return '<div class="detail-row item-enter"><span>'+escapeHtml(label)+'</span><strong>'+escapeHtml(value)+'</strong><button class="detail-copy" type="button" data-copy-payment-detail="'+escapeHtml(value)+'">Copy</button></div>';
}

function renderDetails(
    method
) {
    $("#selectedMethodTitle").textContent=method.name;

    const rows=[];
    if(method.bank_name)rows.push(paymentDetailRow("Bank",method.bank_name));
    if(method.account_name)rows.push(paymentDetailRow("Account name",method.account_name));
    if(method.account_number)rows.push(paymentDetailRow("Account number",method.account_number));
    if(method.phone_number)rows.push(paymentDetailRow("Phone number",method.phone_number));
    rows.push(paymentDetailRow("Amount",formatMoney(state.payment.amount,state.payment.currency)));
    rows.push(paymentDetailRow("Reference",state.payment.reference));
    rows.push('<div class="instructions item-enter"><strong>Instructions</strong><p>'+escapeHtml(method.instructions||"Follow the payment instructions provided by the merchant.")+'</p></div>');

    paymentDetails.innerHTML=rows.join("");
    methodContainer.hidden=true;
    detailsContainer.hidden=false;
    verificationContainer.hidden=true;
    animateState(detailsContainer);
}

/* ============================================================
   EXISTING ATTEMPT
============================================================ */

function showExistingAttempt() {

    methodContainer.hidden =
        true;

    detailsContainer.hidden =
        false;

    verificationContainer.hidden =
        true;


    const method =
        state.methods.find(
            item =>
                item.id ===
                state.payment.payment_method_id
        );


    if (
        method
    ) {

        /*
         * Load instructions without
         * resetting the attempt.
         */

        fetch(
            apiBase + `/api/public/session/${encodeURIComponent(
                state.token
            )}/method/${encodeURIComponent(
                method.id
            )}`
        )
            .then(
                response =>
                    response.json()
            )
            .then(
                data => {

                    if (
                        data.method
                    ) {

                        renderDetails(
                            data.method
                        );

                        startPaymentTimer();
                    }
                }
            )
            .catch(
                console.error
            );
    }
}


/* ============================================================
   RECEIPT INPUT
============================================================ */

receiptInput?.addEventListener(
    "change",
    () => {

        const file =
            receiptInput.files?.[0];


        if (!file) {

            selectedFile.hidden =
                true;

            return;
        }


        selectedFile.textContent =
            `${file.name} — ready to submit`;


        selectedFile.hidden =
            false;


        selectedFile.classList.remove(
            "item-enter"
        );


        void selectedFile.offsetWidth;


        selectedFile.classList.add(
            "item-enter"
        );


        notify(
            "Receipt selected.",
            "success",
            2200
        );
    }
);


/* ============================================================
   SUBMIT RECEIPT
============================================================ */

submitReceiptBtn?.addEventListener(
    "click",
    submitReceipt
);


async function submitReceipt() {

    const file =
        receiptInput?.files?.[0];


    if (!file) {

        submitReceiptBtn.classList.add(
            "error-shake"
        );


        setTimeout(
            () => {
                submitReceiptBtn.classList.remove(
                    "error-shake"
                );
            },
            450
        );


        notify(
            "Please select your payment receipt first.",
            "error"
        );

        return;
    }


    if (
        state.paymentDeadlineAt &&
        new Date(
            state.paymentDeadlineAt
        ) <= new Date()
    ) {

        handleAttemptExpired();

        return;
    }


    setButtonLoading(
        submitReceiptBtn,
        "Submitting receipt…"
    );


    try {

        const formData =
            new FormData();


        formData.append(
            "receipt",
            file
        );


        const response =
            await fetch(
                apiBase + `/api/public/session/${encodeURIComponent(
                    state.token
                )}/receipt`,
                {
                    method:
                        "POST",

                    body:
                        formData
                }
            );


        const data =
            await response.json();


        if (
            response.status ===
                410
        ) {

            handleAttemptExpired();

            return;
        }


        if (!response.ok) {
            throw new Error(
                data.error ||
                "Could not submit receipt."
            );
        }


        clearInterval(
            state.paymentTimer
        );


        state.payment.status =
            "awaiting_verification";


        showVerification(
            true
        );


        notify(
            "Receipt submitted successfully.",
            "success"
        );

    } catch (error) {

        submitReceiptBtn.classList.add(
            "error-shake"
        );


        notify(
            error.message,
            "error"
        );

    } finally {

        resetButton(
            submitReceiptBtn
        );
    }
}


document.addEventListener("click",async event=>{
    const button=event.target.closest("[data-copy-payment-detail]");
    if(!button)return;
    const value=button.dataset.copyPaymentDetail||"";
    const original=button.textContent;
    button.disabled=true;
    button.textContent="Copying…";
    try{
        await navigator.clipboard.writeText(value);
        button.textContent="Copied";
        notify("Payment detail copied.","success",1800);
        setTimeout(()=>{button.disabled=false;button.textContent=original},1200);
    }catch{
        button.disabled=false;
        button.textContent=original;
        notify("Could not copy that payment detail.","error");
    }
});

async function showCancelConfirmation(){
    return new Promise(resolve=>{
        const modal=document.createElement("div");
        modal.className="payment-confirm-modal";
        modal.innerHTML='<div class="payment-confirm-backdrop"></div><div class="payment-confirm-card" role="dialog" aria-modal="true" aria-labelledby="cancelPaymentTitle"><div class="payment-confirm-icon">?</div><span class="eyebrow">CANCEL PAYMENT</span><h2 id="cancelPaymentTitle">Leave this payment?</h2><p>Your current payment attempt will be cancelled and the app will receive the cancellation result.</p><div class="payment-confirm-actions"><button type="button" class="button secondary" data-cancel-stay>Keep payment</button><button type="button" class="button primary" data-cancel-leave>Cancel payment</button></div></div>';
        document.body.appendChild(modal);
        const finish=value=>{modal.remove();resolve(value)};
        modal.addEventListener("click",event=>{
            if(event.target.closest("[data-cancel-stay]"))finish(false);
            if(event.target.closest("[data-cancel-leave]"))finish(true);
        });
        setTimeout(()=>modal.querySelector("[data-cancel-stay]")?.focus(),20);
    });
}

/* ============================================================
   CANCEL
============================================================ */

cancelPaymentBtn?.addEventListener(
    "click",
    async () => {

        const confirmed=await showCancelConfirmation();
        if(!confirmed)return;


        setButtonLoading(
            cancelPaymentBtn,
            "Cancelling…"
        );


        try {

            const response =
                await fetch(
                    `/api/public/session/${encodeURIComponent(
                        state.token
                    )}/cancel`,
                    {
                        method:
                            "POST"
                    }
                );


            const data =
                await response.json();


            if (!response.ok) {
                throw new Error(
                    data.error ||
                    "Could not cancel payment."
                );
            }


            clearInterval(
                state.paymentTimer
            );

            clearInterval(
                state.pollTimer
            );


            notify(
                "Payment cancelled.",
                "success"
            );


            setTimeout(
                () => {

                    const cancelDestination =
                        data.cancel_url ||
                        data.return_url;

                    if (
                        cancelDestination
                    ) {

                        window.location.href =
                            cancelDestination;

                    } else {

                        window.location.href=SITE_BASE+"/";
                    }

                },
                650
            );

        } catch (error) {

            cancelPaymentBtn.classList.add(
                "error-shake"
            );


            notify(
                error.message,
                "error"
            );


            resetButton(
                cancelPaymentBtn
            );
        }
    }
);


/* ============================================================
   VERIFICATION
============================================================ */

function renderProcessingReceiptActions(){
    const host=approvedMessage||verificationContainer;
    if(!host||!state.payment?.processing_page_id)return;
    let box=document.getElementById("processingReceiptActions");
    if(!box){
        box=document.createElement("div");
        box.id="processingReceiptActions";
        box.className="processing-receipt-actions";
        host.appendChild(box);
    }
    const url=SITE_URL+"/receipt/"+encodeURIComponent(state.payment.processing_page_id);
    box.innerHTML='<a class="button secondary" href="'+escapeHtml(url)+'" target="_blank" rel="noopener">View processing receipt</a><button class="button secondary" type="button" id="copyProcessingReceipt">Copy receipt ID</button>';
    document.getElementById("copyProcessingReceipt")?.addEventListener("click",async()=>{try{await navigator.clipboard.writeText(state.payment.processing_page_id);notify("Processing receipt ID copied.","success",2200)}catch{notify("Could not copy the receipt ID.","error",2200)}});
}

function showVerification(
    justSubmitted = false
) {

    clearInterval(
        state.paymentTimer
    );


    methodContainer.hidden =
        true;

    detailsContainer.hidden =
        true;

    verificationContainer.hidden =
        false;


    animateState(
        verificationContainer
    );


    const icon =
        $(".verification-icon");


    if (icon) {

        icon.classList.remove(
            "animate-check"
        );


        void icon.offsetWidth;


        icon.classList.add(
            "animate-check"
        );
    }


    const heading =
        $("#verificationHeading");

    const subtext =
        $("#verificationSubtext");


    renderProcessingReceiptActions();

    if (
        state.payment.status ===
            "approved"
    ) {

        heading.textContent =
            "Payment approved.";

        subtext.textContent =
            "A one-time payment code has been sent to the email associated with this payment.";

        waitingApprovalBox.hidden =
            true;

        approvedMessage.hidden =
            false;


        animateState(
            approvedMessage
        );

        return;
    }


    if (
        state.payment.status ===
            "completed"
    ) {

        heading.textContent =
            "Payment completed.";

        waitingApprovalBox.hidden =
            true;

        approvedMessage.hidden =
            false;

        if (
            state.payment.payment_link_id
        ) {

            subtext.textContent =
                "Your payment has been confirmed successfully.";

            const messages =
                approvedMessage.querySelectorAll(
                    "p"
                );

            if (
                messages[0]
            ) {
                messages[0].textContent =
                    "Your payment has been confirmed.";
            }

            if (
                messages[1]
            ) {
                messages[1].textContent =
                    state.payment.return_url
                        ? "Returning you to the merchant…"
                        : "You may close this page.";
            }

            if (
                state.payment.return_url &&
                !state.returning
            ) {

                state.returning =
                    true;

                setTimeout(
                    () => {

                        window.location.href =
                            state.payment.return_url;

                    },
                    900
                );
            }

        } else {

            subtext.textContent =
                "This payment has already been redeemed successfully.";

        }

        return;
    }


    heading.textContent =
        "Payment is being verified.";

    subtext.textContent =
        justSubmitted
            ? "Your receipt has been received. Once approved, SquashberryPay will send your one-time payment code to your email."
            : "Your receipt has been received. Once the payment is approved, SquashberryPay will send your one-time code to your email.";

    waitingApprovalBox.hidden =
        false;

    approvedMessage.hidden =
        true;
}


/* ============================================================
   PAGE TIMER
============================================================ */

function startPageTimer() {

    clearInterval(
        state.pageTimer
    );


    function update() {

        if (
            !state.pageExpiresAt
        ) {
            return;
        }


        const remaining =
            state.pageExpiresAt.getTime() -
            Date.now();


        if (
            remaining <= 0
        ) {

            expirePage();

            return;
        }


        const seconds =
            Math.floor(
                remaining / 1000
            );


        const minutes =
            Math.floor(
                seconds / 60
            );


        const rest =
            seconds % 60;


        expiryTimer.textContent =
            `${String(
                minutes
            ).padStart(
                2,
                "0"
            )}:${String(
                rest
            ).padStart(
                2,
                "0"
            )}`;


        if (
            expiryBox
        ) {

            if (
                seconds <=
                300
            ) {

                expiryBox.classList.add(
                    "warning"
                );

            } else {

                expiryBox.classList.remove(
                    "warning"
                );
            }
        }
    }


    update();


    state.pageTimer =
        setInterval(
            update,
            1000
        );
}


/* ============================================================
   PAYMENT TIMER
============================================================ */

function startPaymentTimer() {

    clearInterval(
        state.paymentTimer
    );


    if (
        !state.paymentDeadlineAt
    ) {
        return;
    }


    function update() {

        const remaining =
            state.paymentDeadlineAt.getTime() -
            Date.now();


        if (
            remaining <= 0
        ) {

            handleAttemptExpired();

            return;
        }


        const seconds =
            Math.floor(
                remaining / 1000
            );


        const minutes =
            Math.floor(
                seconds / 60
            );


        const rest =
            seconds % 60;


        paymentAttemptTimer.textContent =
            `${String(
                minutes
            ).padStart(
                2,
                "0"
            )}:${String(
                rest
            ).padStart(
                2,
                "0"
            )}`;


        if (
            seconds <=
            300
        ) {

            paymentAttemptBox.classList.add(
                "warning"
            );

        } else {

            paymentAttemptBox.classList.remove(
                "warning"
            );
        }
    }


    update();


    state.paymentTimer =
        setInterval(
            update,
            1000
        );
}


/* ============================================================
   EXPIRE ATTEMPT
============================================================ */

function handleAttemptExpired() {

    clearInterval(
        state.paymentTimer
    );


    submitReceiptBtn.disabled =
        true;

    cancelPaymentBtn.disabled =
        true;


    notify(
        "Your payment attempt has expired. Please return to the app and start a new payment.",
        "error",
        5000
    );


    setTimeout(
        () => {

            const expiryDestination =
                state.payment?.cancel_url ||
                state.payment?.return_url;

            if (
                expiryDestination
            ) {

                window.location.href =
                    expiryDestination;

            } else {

                window.location.href=SITE_BASE+"/";
            }

        },
        2300
    );
}


/* ============================================================
   EXPIRE PAGE
============================================================ */

function expirePage() {

    clearInterval(
        state.pageTimer
    );

    clearInterval(
        state.paymentTimer
    );

    clearInterval(
        state.pollTimer
    );


    window.history.replaceState(
        {},
        "",
        SITE_BASE + "/"
    );


    showWelcome(
        "This payment page has expired. Please return to the app and start a new payment."
    );
}


/* ============================================================
   POLLING
============================================================ */

function startPolling() {

    clearInterval(
        state.pollTimer
    );


    state.pollTimer =
        setInterval(
            async () => {

                if (
                    !state.token ||
                    !state.payment
                ) {
                    return;
                }


                if (
                    [
                        "completed",
                        "cancelled",
                        "expired"
                    ].includes(
                        state.payment.status
                    )
                ) {
                    return;
                }


                try {

                    const response =
                        await fetch(
                            apiBase + `/api/public/session/${encodeURIComponent(
                                state.token
                            )}`
                        );


                    if (
                        response.status ===
                            410
                    ) {

                        expirePage();

                        return;
                    }


                    if (!response.ok) {
                        return;
                    }


                    const data =
                        await response.json();


                    if (
                        data.payment
                    ) {

                        const previous =
                            state.payment.status;


                        state.payment =
                            data.payment;


                        if (
                            data.payment
                                .payment_deadline_at
                        ) {

                            state.paymentDeadlineAt =
                                new Date(
                                    data.payment.payment_deadline_at
                                );
                        }


                        if (
                            previous !==
                            data.payment.status
                        ) {

                            if (
                                [
                                    "awaiting_verification",
                                    "approved",
                                    "completed"
                                ].includes(
                                    data.payment.status
                                )
                            ) {

                                showVerification();

                                notify(
                                    data.payment.status ===
                                        "approved"
                                        ? "Payment approved."
                                        : "Payment status updated.",
                                    "success"
                                );

                            } else if (
                                data.payment.status ===
                                    "cancelled"
                            ) {

                                showWelcome(
                                    "This payment has been cancelled."
                                );
                            }
                        }
                    }

                } catch {
                    /*
                     * Quiet polling failure.
                     */
                }

            },
            10000
        );
}


/* ============================================================
   START
============================================================ */

loadSession();