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

    returning: false,
    selectedMethod: null
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


function isMobilePaymentSheet(){
    return window.matchMedia("(max-width: 760px)").matches;
}
function getPaymentSheetScrim(){
    let scrim=document.getElementById("paymentSheetScrim");
    if(!scrim){
        scrim=document.createElement("div");
        scrim.id="paymentSheetScrim";
        scrim.className="mobile-bottom-sheet-scrim";
        scrim.hidden=true;
        document.body.appendChild(scrim);
    }
    return scrim;
}
function closePaymentMobileSheet(){
    detailsContainer?.classList.remove("payment-sheet-open","mobile-bottom-sheet-open");
    document.body.classList.remove("mobile-sheet-locked");
    const scrim=getPaymentSheetScrim();
    scrim.classList.remove("is-visible");
    scrim.hidden=true;
}
function openPaymentMobileSheet(){
    if(!detailsContainer)return false;
    detailsContainer.hidden=false;
    detailsContainer.classList.add("payment-sheet-open","mobile-bottom-sheet-open");
    document.body.classList.add("mobile-sheet-locked");
    const scrim=getPaymentSheetScrim();
    scrim.hidden=false;
    requestAnimationFrame(()=>scrim.classList.add("is-visible"));
    return true;
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
                ? new Date(data.payment.payment_deadline_at)
                : null;

    state.payment.payment_method_id =
        data.payment.payment_method_id ||
        data.payment.donation_payment_method_id ||
        null;


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
        state.payment.status === "awaiting_receipt" &&
        state.paymentDeadlineAt &&
        state.payment.payment_method_id
    ) {
        showExistingAttempt();
        return;
    }


    if (
        [
            "awaiting_verification",
            "approved",
            "completed",
            "rejected"
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


            const rawMethodType = String(method.type || "").toLowerCase();
            const rawMethodName = String(method.name || "").toLowerCase();
            const methodKey = rawMethodType === "bank" || rawMethodName.includes("bank")
                ? "bank"
                : rawMethodType === "wave" || rawMethodName.includes("wave")
                    ? "wave"
                    : rawMethodType === "afrimoney" || rawMethodName.includes("afrimoney")
                        ? "afrimoney"
                        : rawMethodType;

            const isMobileMoney = ["wave","afrimoney","aps","nada"].includes(methodKey);
            const description = isMobileMoney ? "Mobile payment" : "Bank transfer";

            const logoUrls = {
                wave: "https://www.wave.com/img/nav-logo.png",
                afrimoney: "https://pbs.twimg.com/profile_images/1834585432111136768/KdqVOYmu_400x400.jpg"
            };

            const backendIcon = String(method.icon_path || "").trim();
            const logoUrl = /^https?:\/\//i.test(backendIcon)
                ? backendIcon
                : (logoUrls[methodKey] || "");

            const fallbackLetter =
                methodKey === "wave" ? "W" :
                methodKey === "aps" ? "A" :
                methodKey === "nada" ? "N" :
                methodKey === "afrimoney" ? "A" :
                "D";

            const fallbackMarkup = methodKey === "bank"
                ? '<span class="method-brand-dalasi" aria-hidden="true">D</span>'
                : escapeHtml(fallbackLetter);

            button.innerHTML =
                `
                    <div class="method-top">
                        <span class="method-brand-wrap">
                            ${logoUrl
                                ? `<img class="method-brand-image" data-method-logo src="${logoUrl}" alt="" loading="lazy" referrerpolicy="no-referrer">`
                                : `<span class="method-brand-fallback" data-type="${escapeHtml(methodKey)}" aria-hidden="true">${fallbackMarkup}</span>`}
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

            const methodLogo = button.querySelector("[data-method-logo]");
            methodLogo?.addEventListener("error",()=>{
                const wrap=methodLogo.parentElement;
                if(!wrap)return;
                wrap.innerHTML='<span class="method-brand-fallback" data-type="'+escapeHtml(methodKey)+'" aria-hidden="true">'+fallbackMarkup+"</span>";
            });

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
            /*
             * A hosted checkout can outlive a payment-method edit or a
             * concurrent click. Refresh the authoritative session once so
             * the customer is never trapped on a stale method UUID.
             */
            if (response.status !== 410) {
                await bindCheckoutActionButtons();
loadSession();
                if (
                    state.payment?.status === "awaiting_receipt" &&
                    state.paymentDeadlineAt &&
                    state.payment.payment_method_id
                ) {
                    return;
                }
            }

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
    rows.push(paymentDetailRow("Amount",formatMoney(state.payment.amount,state.payment.currency)));
    rows.push(paymentDetailRow("Reference",state.payment.reference));
    rows.push('<div class="instructions item-enter"><strong>Instructions</strong><p>'+escapeHtml(method.instructions||"Follow the payment instructions provided by the merchant.")+'</p></div>');

    paymentDetails.innerHTML=rows.join("");
    ensurePaymentContactAction();
    setReceiptStage(false);
    methodContainer.hidden=true;
    detailsContainer.hidden=false;
    verificationContainer.hidden=true;
    openPaymentMobileSheet();
    if(!isMobilePaymentSheet()){
        detailsContainer.classList.add("payment-sheet-desktop");
    }else{
        detailsContainer.classList.remove("payment-sheet-desktop");
    }
    bindCheckoutActionButtons();
    if(false){
        animateState(detailsContainer);
    }
}

/* ============================================================
   PAYMENT CONTACT + RECEIPT STAGES
============================================================ */

function ensurePaymentTopCancel(){
    const box=document.getElementById("paymentAttemptBox");
    const original=document.getElementById("cancelPayment");
    if(!box||!original||document.getElementById("cancelPaymentTop"))return;
    const button=document.createElement("button");
    button.id="cancelPaymentTop";
    button.type="button";
    button.className="payment-top-cancel";
    button.textContent="Cancel";
    button.addEventListener("click",()=>original.click());
    const timerWrap=box.querySelector(":scope > div");
    if(timerWrap){
        timerWrap.style.display="flex";
        timerWrap.style.alignItems="center";
        timerWrap.style.justifyContent="space-between";
        timerWrap.style.gap="12px";
        timerWrap.appendChild(button);
    }else{
        box.appendChild(button);
    }
}
function ensurePaymentContactAction(){
    if(!detailsContainer)return;
    let contact=document.getElementById("contactBusinessAction");
    if(!contact){
        contact=document.createElement("button");
        contact.id="contactBusinessAction";
        contact.type="button";
        contact.className="payment-contact-action";
        contact.innerHTML='<span>Need help with this payment?</span><strong>Contact the business</strong>';
        detailsContainer.insertBefore(contact,document.getElementById("paymentAttemptBox"));
        contact.addEventListener("click",showBusinessContact);
    }
}

function showBusinessContact(){
    const phone=String(state.service?.phone||state.selectedMethod?.phone_number||"").trim();
    const name=String(state.service?.business_name||state.service?.name||"the business").trim();
    let modal=document.getElementById("businessContactModal");
    if(modal)modal.remove();
    modal=document.createElement("div");
    modal.id="businessContactModal";
    modal.className="payment-contact-modal";
    modal.innerHTML='<div class="payment-contact-backdrop"></div><div class="payment-contact-card" role="dialog" aria-modal="true" aria-labelledby="businessContactTitle"><span class="eyebrow">PAYMENT SUPPORT</span><h2 id="businessContactTitle">Contact '+escapeHtml(name)+'</h2><p>If you are having an issue with the transfer, contact the business directly. SquashberryPay does not handle the merchant’s transfer account.</p>'+(phone?'<a class="button primary full" href="tel:'+escapeHtml(phone)+'">Call '+escapeHtml(phone)+'</a>':'<div class="payment-contact-empty">The business has not provided a support phone number.</div>')+'<button class="button secondary full" type="button" data-close-business-contact>Close</button></div>';
    document.body.appendChild(modal);
    modal.addEventListener("click",e=>{if(e.target.closest("[data-close-business-contact]")||e.target.classList.contains("payment-contact-backdrop"))modal.remove()});
}

function closeReceiptUploadModal(){document.getElementById("receiptUploadModal")?.remove();}
function openReceiptUploadModal(){
    if(document.getElementById("receiptUploadModal"))return;
    const modal=document.createElement("div");
    modal.id="receiptUploadModal";modal.className="receipt-upload-modal";
    modal.innerHTML='<div class="receipt-upload-backdrop"></div><div class="receipt-upload-card" role="dialog" aria-modal="true" aria-labelledby="receiptUploadTitle"><div class="receipt-upload-head"><div><span class="eyebrow">RECEIPT</span><h2 id="receiptUploadTitle">Upload your payment receipt</h2><p>Select your receipt first. Nothing is submitted until you tap “Submit receipt”.</p></div><button type="button" class="receipt-upload-close" aria-label="Close">×</button></div><div class="receipt-upload-body"><label class="receipt-upload-picker" for="receiptModalInput"><strong>Choose receipt image</strong><span>JPG, PNG or WEBP · Max 8 MB</span><input id="receiptModalInput" type="file" accept="image/jpeg,image/png,image/webp,image/jpg" hidden></label></div><div class="receipt-upload-actions"><button type="button" class="button secondary" data-receipt-close>Close</button></div></div>';
    document.body.appendChild(modal);
    const input=modal.querySelector("#receiptModalInput");
    const body=modal.querySelector(".receipt-upload-body");
    const actions=modal.querySelector(".receipt-upload-actions");
    let selectedReceiptFile=null;
    let previewUrl=null;

    const close=()=>closeReceiptUploadModal();
    const revokePreview=()=>{if(previewUrl){URL.revokeObjectURL(previewUrl);previewUrl=null;}};
    modal.querySelector(".receipt-upload-close")?.addEventListener("click",close);
    modal.querySelector(".receipt-upload-backdrop")?.addEventListener("click",close);

    const renderPicker=()=>{
        revokePreview();
        selectedReceiptFile=null;
        if(input)input.value="";
        if(body)body.innerHTML='<label class="receipt-upload-picker" for="receiptModalInput"><strong>Choose receipt image</strong><span>JPG, PNG or WEBP · Max 8 MB</span></label>';
        if(actions)actions.innerHTML='<button type="button" class="button secondary" data-receipt-close>Close</button>';
        body?.querySelector(".receipt-upload-picker")?.appendChild(input);
        actions?.querySelector("[data-receipt-close]")?.addEventListener("click",close);
    };

    input?.addEventListener("change",e=>{
        const file=e.target.files?.[0];
        if(!file)return;
        const allowed=["image/jpeg","image/jpg","image/png","image/webp"];
        if(!allowed.includes(String(file.type||"").toLowerCase())){
            e.target.value="";
            notify("Only JPG, PNG or WEBP receipt images are supported.","error");
            return;
        }
        if(file.size>8*1024*1024){
            e.target.value="";
            notify("Receipt images must be 8 MB or smaller.","error");
            return;
        }

        revokePreview();
        selectedReceiptFile=file;
        previewUrl=URL.createObjectURL(file);
        body.innerHTML='<div class="receipt-preview receipt-modal-selected-preview"><img src="'+previewUrl+'" alt="Selected payment receipt preview"><div class="receipt-preview-meta"><strong>'+escapeHtml(file.name)+'</strong><span>'+(file.size/1024/1024).toFixed(2)+' MB · Ready to submit</span></div></div>';
        body.appendChild(input);
        input.style.display="none";
        actions.innerHTML='<button type="button" class="button secondary" data-receipt-change>Change image</button><button type="button" class="button primary receipt-upload-submit" data-receipt-submit>Submit receipt</button>';
        actions.querySelector("[data-receipt-change]")?.addEventListener("click",()=>{input.value="";input.click();});
        actions.querySelector("[data-receipt-submit]")?.addEventListener("click",async()=>{
            if(!selectedReceiptFile)return;
            const fileToSubmit=selectedReceiptFile;
            await uploadReceiptFile(fileToSubmit);
        });
        notify("Receipt image selected. Review it, then tap Submit receipt.","success",2600);
    });
}
function setReceiptStage(show){const paid=document.getElementById("ivePaidButton");if(paid)paid.hidden=Boolean(show);}
/* ============================================================
   EXISTING ATTEMPT
============================================================ */

function showExistingAttempt() {

    methodContainer.hidden = true;

    detailsContainer.hidden = false;

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

        renderDetails(method);
        startPaymentTimer();
    }
}


function bindCheckoutActionButtons(){
    const paid=document.getElementById("ivePaidButton");
    const topCancel=document.getElementById("cancelPaymentTop");
    const mainCancel=document.getElementById("cancelPayment");

    if(paid)paid.dataset.bound="delegated";
    if(topCancel)topCancel.dataset.bound="delegated";
    if(mainCancel)mainCancel.dataset.bound="delegated";
}

document.addEventListener("click",event=>{
    if(event.defaultPrevented)return;
    const paid=event.target.closest("#ivePaidButton");
    if(paid){
        event.preventDefault();
        if(!paid.disabled){
            openReceiptUploadModal();
        }
        return;
    }

    const topCancel=event.target.closest("#cancelPaymentTop");
    if(topCancel){
        event.preventDefault();
        const mainCancel=document.getElementById("cancelPayment");
        if(mainCancel && !mainCancel.disabled){
            handleCancelPayment(event);
        }
        return;
    }

    const mainCancel=event.target.closest("#cancelPayment");
    if(mainCancel){
        event.preventDefault();
        if(!mainCancel.disabled){
            handleCancelPayment(event);
        }
    }
});

/* ============================================================
   RECEIPT INPUT
============================================================ */

receiptInput?.addEventListener("change", async () => {
    const file=receiptInput.files?.[0];
    if(!file){if(selectedFile)selectedFile.hidden=true;return;}
    const allowed=["image/jpeg","image/jpg","image/png","image/webp"];
    if(!allowed.includes(String(file.type||"").toLowerCase())){receiptInput.value="";if(selectedFile)selectedFile.hidden=true;notify("Only JPG, PNG or WEBP receipt images are supported.","error");return;}
    if(file.size>8*1024*1024){receiptInput.value="";if(selectedFile)selectedFile.hidden=true;notify("Receipt images must be 8 MB or smaller.","error");return;}
    if(document.getElementById("receiptUploadModal")){await uploadReceiptFile(file);return;}
    selectedFile.innerHTML="";
    const preview=document.createElement("div");preview.className="receipt-preview";
    const img=document.createElement("img");img.src=URL.createObjectURL(file);img.alt="Selected payment receipt preview";
    const meta=document.createElement("div");meta.className="receipt-preview-meta";meta.innerHTML="<strong>"+escapeHtml(file.name)+"</strong><span>"+(file.size/1024/1024).toFixed(2)+" MB · Image ready</span>";
    preview.append(img,meta);selectedFile.append(preview);selectedFile.hidden=false;notify("Receipt image selected.","success",2200);
});

async function uploadReceiptFile(file){
    const modal=document.getElementById("receiptUploadModal");
    if(!modal||!file)return false;
    const body=modal.querySelector(".receipt-upload-body"),actions=modal.querySelector(".receipt-upload-actions");
    if(!body||!actions)return false;
    body.innerHTML='<div class="receipt-upload-loading" role="status" aria-live="polite"><div class="receipt-upload-spinner"></div><strong>Uploading your receipt…</strong><p>We’re securely sending the image to the business for verification. Please keep this window open.</p></div>';
    actions.innerHTML='<button type="button" class="button secondary" disabled>Uploading…</button>';
    try{
        const formData=new FormData();formData.append("receipt",file);
        const response=await fetch(apiBase+"/api/public/session/"+encodeURIComponent(state.token)+"/receipt",{method:"POST",body:formData});
        const data=await response.json().catch(()=>({}));
        if(response.status===410){handleAttemptExpired();return false;}
        if(!response.ok)throw new Error(data.error||"Could not submit receipt.");
        clearInterval(state.paymentTimer);state.payment.status="awaiting_verification";
        showVerification(true);showReceiptUploadSuccess(file);notify("Receipt uploaded successfully.","success");return true;
    }catch(error){
        body.innerHTML='<div class="receipt-upload-loading"><div class="receipt-success-check">!</div><strong>Upload failed</strong><p>'+escapeHtml(error.message||"Could not upload the receipt.")+'</p></div>';
        actions.innerHTML='<button type="button" class="button secondary" data-receipt-retry>Try again</button><button type="button" class="button primary" data-receipt-close>Close</button>';
        actions.querySelector("[data-receipt-retry]")?.addEventListener("click",()=>{closeReceiptUploadModal();openReceiptUploadModal();});
        actions.querySelector("[data-receipt-close]")?.addEventListener("click",closeReceiptUploadModal);notify(error.message||"Could not upload receipt.","error");return false;
    }
}

function showReceiptUploadSuccess(file){
    const modal=document.getElementById("receiptUploadModal");
    if(!modal||!file)return;
    const body=modal.querySelector(".receipt-upload-body");
    const actions=modal.querySelector(".receipt-upload-actions");
    if(!body||!actions)return;
    const url=URL.createObjectURL(file);
    body.innerHTML='<div class="receipt-upload-success"><div class="receipt-success-check">✓</div><span class="eyebrow">UPLOAD COMPLETE</span><h3>Receipt uploaded</h3><p>Your image was saved and sent to the business for verification.</p><div class="receipt-upload-preview"><img src="'+url+'" alt="Uploaded payment receipt preview"></div></div>';
    actions.innerHTML='<button type="button" class="button primary" data-receipt-close>Done</button>';
    actions.querySelector("[data-receipt-close]")?.addEventListener("click",closeReceiptUploadModal);
}

/* ============================================================
   SUBMIT RECEIPT
============================================================ */

submitReceiptBtn?.addEventListener(
    "click",
    submitReceipt
);


async function submitReceipt(){
    const file=receiptInput?.files?.[0];
    if(!file){notify("Please select your payment receipt first.","error");return;}
    if(state.paymentDeadlineAt && new Date(state.paymentDeadlineAt)<=new Date()){handleAttemptExpired();return;}
    await uploadReceiptFile(file);
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

const backToMethodsButton=document.getElementById("backToMethods");
backToMethodsButton?.addEventListener("click",()=>{
    closePaymentMobileSheet();
    detailsContainer.hidden=true;
    methodContainer.hidden=false;
    verificationContainer.hidden=true;
});
const mobileSheetHandle=document.querySelector(".mobile-sheet-handle");
let paymentSheetStartY=null;
mobileSheetHandle?.addEventListener("touchstart",event=>{
    if(!isMobilePaymentSheet()||!detailsContainer?.classList.contains("mobile-bottom-sheet-open"))return;
    paymentSheetStartY=event.touches[0].clientY;
},{passive:true});
mobileSheetHandle?.addEventListener("touchmove",event=>{
    if(paymentSheetStartY===null)return;
    const delta=event.touches[0].clientY-paymentSheetStartY;
    if(delta>0)detailsContainer.style.setProperty("--sheet-drag-y",Math.min(delta,180)+"px");
},{passive:true});
mobileSheetHandle?.addEventListener("touchend",()=>{
    if(paymentSheetStartY===null)return;
    const delta=parseFloat(detailsContainer.style.getPropertyValue("--sheet-drag-y"))||0;
    detailsContainer.style.removeProperty("--sheet-drag-y");
    paymentSheetStartY=null;
    if(delta>80){
        closePaymentMobileSheet();
        detailsContainer.hidden=true;
        methodContainer.hidden=false;
    }
});

/* ============================================================
   CANCEL
============================================================ */

async function handleCancelPayment(event){
    event?.preventDefault?.();

    const button=document.getElementById("cancelPayment");
    if(!button || button.disabled)return;

    const confirmed=await showCancelConfirmation();
    if(!confirmed)return;

    setButtonLoading(button,"Cancelling…");

    try{
        const response=await fetch(
            apiBase + `/api/public/session/${encodeURIComponent(state.token)}/cancel`,
            {method:"POST"}
        );
        const data=await response.json().catch(()=>({}));

        if(!response.ok){
            throw new Error(data.error||"Could not cancel payment.");
        }

        clearInterval(state.paymentTimer);
        clearInterval(state.pollTimer);
        notify("Payment cancelled.","success");

        setTimeout(()=>{
            const destination=data.cancel_url||data.return_url||SITE_BASE+"/";
            window.location.href=destination;
        },650);
    }catch(error){
        button.classList.add("error-shake");
        notify(error.message||"Could not cancel payment.","error");
        resetButton(button);
        setTimeout(()=>button.classList.remove("error-shake"),500);
    }
}

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

function playCheckoutSuccessMorph(kind="payment"){
    const existing=document.getElementById("checkoutSuccessMorph");
    existing?.remove();
    const morph=document.createElement("div");
    morph.id="checkoutSuccessMorph";
    morph.className="checkout-success-morph "+(kind==="donation"?"is-donation":"is-payment");
    morph.innerHTML='<span class="morph-liquid morph-liquid-a"></span><span class="morph-liquid morph-liquid-b"></span><span class="morph-liquid morph-liquid-c"></span><span class="morph-success-ring"><span>✓</span></span>';
    document.body.appendChild(morph);
    requestAnimationFrame(()=>morph.classList.add("is-active"));
    setTimeout(()=>morph.classList.add("is-settling"),520);
    setTimeout(()=>morph.remove(),1250);
}

function isDonationPayment(){
    return String(state.payment?.payment_type||"").toLowerCase()==="donate" || Boolean(state.payment?.donation_campaign_id);
}

function showVerification(justSubmitted=false){
    clearInterval(state.paymentTimer);
    closePaymentMobileSheet();
    methodContainer.hidden=true;
    detailsContainer.hidden=true;
    verificationContainer.hidden=false;
    verificationContainer.classList.remove("success-morph-donation","success-morph-payment","verification-waiting");
    void verificationContainer.offsetWidth;

    const icon=$(".verification-icon");
    if(icon){
        icon.classList.remove("animate-check");
        void icon.offsetWidth;
        icon.classList.add("animate-check");
    }

    const heading=$("#verificationHeading");
    const subtext=$("#verificationSubtext");
    const eyebrow=verificationContainer.querySelector(".verification-state .eyebrow");
    const donation=isDonationPayment();
    const status=String(state.payment?.status||"");
    const rejected=status==="rejected";
    const terminal=["approved","completed"].includes(status);

    renderProcessingReceiptActions();

    if(rejected){
        verificationContainer.classList.add("verification-rejected");
        if(eyebrow)eyebrow.textContent=donation?"DONATION REJECTED":"PAYMENT REJECTED";
        heading.textContent=donation?"Donation could not be confirmed.":"Payment could not be verified.";
        subtext.textContent=donation
            ? "The business could not verify this donation from the receipt you submitted."
            : "The business could not verify this payment from the receipt you submitted.";
        waitingApprovalBox.hidden=true;
        approvedMessage.hidden=false;
        approvedMessage.innerHTML='<strong>'+(donation?'Your donation was rejected.':'Your payment was rejected.')+'</strong><p>'+escapeHtml(state.payment?.rejection_reason||"The receipt could not be verified.")+'</p><p>No money was confirmed through SquashberryPay. If you believe this was a mistake, contact the business and provide your payment reference.</p>';
        verificationContainer.classList.remove("success-morph-donation","success-morph-payment");
        animateState(verificationContainer);
        animateState(approvedMessage);
        return;
    }

    if(!terminal){
        verificationContainer.classList.add("verification-waiting");
        heading.textContent="Payment is being verified.";
        subtext.textContent=justSubmitted
            ? (donation
                ? "Your donation receipt has been received. The business is verifying your donation now. You will receive a confirmation email when it is approved."
                : "Your receipt has been received. The business is verifying your payment now. You will receive another email when it is approved, and that email will contain your payment code.")
            : (donation
                ? "Your donation receipt has been received and is waiting for verification."
                : "Your receipt has been received and is waiting for payment verification.");
        if(eyebrow)eyebrow.textContent=donation?"DONATION RECEIVED":"RECEIPT SUBMITTED";
        waitingApprovalBox.hidden=false;
        approvedMessage.hidden=true;
        return;
    }

    waitingApprovalBox.hidden=true;
    approvedMessage.hidden=false;
    verificationContainer.classList.add(donation?"success-morph-donation":"success-morph-payment");
    playCheckoutSuccessMorph(donation?"donation":"payment");

    if(donation){
        heading.textContent="Donation completed.";
        subtext.textContent="Your donation has been confirmed successfully.";
        if(eyebrow)eyebrow.textContent="DONATION CONFIRMED";
        approvedMessage.innerHTML='<strong>Thank you for your support.</strong><p>Your donation has been confirmed and a confirmation email has been sent to your email address.</p><p>Keep your payment reference for your records.</p>';
    }else if(state.payment.status==="completed"){
        heading.textContent="Payment completed.";
        subtext.textContent=state.payment.payment_link_id?"Your payment has been confirmed successfully.":"Your payment code has already been redeemed successfully.";
        if(eyebrow)eyebrow.textContent="PAYMENT COMPLETED";
        approvedMessage.innerHTML='<strong>Payment completed.</strong><p>This payment has been confirmed successfully.</p><p>'+ (state.payment.return_url?"Returning you to the merchant…":"You may close this page.") +'</p>';
        if(state.payment.payment_link_id && state.payment.return_url && !state.returning){
            state.returning=true;
            setTimeout(()=>{window.location.href=state.payment.return_url;},1100);
        }
    }else{
        heading.textContent="Payment approved.";
        subtext.textContent="Your one-time payment code has been sent to the email associated with this payment.";
        if(eyebrow)eyebrow.textContent="PAYMENT APPROVED";
        approvedMessage.innerHTML='<strong>Your payment has been approved.</strong><p>Your one-time payment code has been sent to your email.</p><p>Return to the app or website where you started the payment and enter the code there.</p>';
    }

    animateState(verificationContainer);
    animateState(approvedMessage);
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

function handleAttemptExpired(){
    clearInterval(state.paymentTimer);
    if(submitReceiptBtn)submitReceiptBtn.disabled=true;
    const paid=document.getElementById("ivePaidButton");if(paid)paid.disabled=true;
    if(cancelPaymentBtn)cancelPaymentBtn.disabled=false;
    closeReceiptUploadModal();closePaymentMobileSheet();
    let overlay=document.getElementById("paymentExpiredOverlay");
    if(!overlay){
        overlay=document.createElement("div");overlay.id="paymentExpiredOverlay";overlay.className="payment-expired-overlay";
        overlay.innerHTML='<div class="payment-expired-card" role="dialog" aria-modal="true"><div class="payment-expired-icon">!</div><span class="eyebrow">PAYMENT EXPIRED</span><h2>Your payment time has expired</h2><p>The payment attempt reached its time limit before a receipt was submitted. No payment was confirmed through SquashberryPay.</p><button class="button primary full" type="button" data-expired-return>Return to app</button><button class="button secondary full" style="margin-top:8px" type="button" data-expired-close>Stay here</button></div>';
        document.body.appendChild(overlay);
        overlay.querySelector("[data-expired-return]")?.addEventListener("click",()=>{window.location.href=state.payment?.cancel_url||state.payment?.return_url||SITE_BASE+"/";});
        overlay.querySelector("[data-expired-close]")?.addEventListener("click",()=>overlay.remove());
    }
    notify("Payment time expired. Your payment was not confirmed.","error",6000);
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
                        "rejected",
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
                                    "completed",
                                    "rejected"
                                ].includes(
                                    data.payment.status
                                )
                            ) {

                                showVerification();

                                notify(
                                    data.payment.status === "rejected"
                                        ? (String(data.payment.payment_type||"").toLowerCase()==="donate" ? "Donation rejected." : "Payment rejected.")
                                        : data.payment.status === "approved"
                                            ? "Payment approved."
                                            : "Payment status updated.",
                                    data.payment.status === "rejected" ? "error" : "success"
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