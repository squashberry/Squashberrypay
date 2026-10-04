"use strict";

async function fetchWithTimeout(input, init={}, timeoutMs=20000){const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),timeoutMs);try{return await fetch(input,{...init,signal:controller.signal})}finally{clearTimeout(timer)}}

const SITE_BASE = "/Squashberrypay";
const SITE_ORIGIN = window.location.origin;

const apiBase =
    String(
        window.SQUASHBERRYPAY_API_BASE ||
        "https://squashberrypay.squashberrypay.workers.dev"
    ).replace(/\/+$/, "");


const routeSegments = window.location.pathname.split("/").filter(Boolean);
const routeIndex = routeSegments.findIndex(part => part === "donate" || part === "checkout");
const query = new URLSearchParams(window.location.search);
const state = {
    isDonation:
        routeIndex >= 0 ? routeSegments[routeIndex] === "donate" : query.has("donation"),
    slug:
        decodeURIComponent(routeIndex >= 0 ? (routeSegments[routeIndex + 1] || "") : (query.get("donation") || query.get("checkout") || "")),
    link:
        null,

    selectedDonationAmount:
        null,
    clickId:
        null,
    mobileSheetOpen:
        false
};

const $ = selector =>
    document.querySelector(
        selector
    );

const loadingState =
    $("#loadingState");

const errorState =
    $("#errorState");

const checkoutState =
    $("#checkoutState");

const errorMessage =
    $("#errorMessage");

const retryButton =
    $("#retryButton");

const checkoutForm =
    $("#checkoutForm");

const continueButton =
    $("#continueButton");

const formError =
    $("#formError");

const donationCampaign =
    $("#donationCampaign");

const donationGoalTitle =
    $("#donationGoalTitle");

const donationGoalMessage =
    $("#donationGoalMessage");

const donationProgressPercent =
    $("#donationProgressPercent");

const donationProgressBar =
    $("#donationProgressBar");

const donationRaised =
    $("#donationRaised");

const donationRemainingStat =
    $("#donationRemainingStat");

const donationRemaining =
    $("#donationRemaining");

const donorCountStat =
    $("#donorCountStat");

const donorCount =
    $("#donorCount");

const donationPresetsWrap =
    $("#donationPresetsWrap");

const donationPresets =
    $("#donationPresets");

const donationEnded =
    $("#donationEnded");

const donationContinue =
    $("#donationContinue");

const overviewContinue =
    $("#overviewContinue");

const backToOverview =
    $("#backToOverview");

const checkoutOverview =
    $("#checkoutOverview");

const checkoutDetails =
    $("#checkoutDetails");


const checkoutStepOne =
    $("#checkoutStepOne");

const checkoutStepTwo =
    $("#checkoutStepTwo");


const donorFields =
    $("#donorFields");
function isMobileSheet(){
    return window.matchMedia("(max-width: 760px)").matches;
}
function getMobileSheetScrim(id){
    let scrim=document.getElementById(id);
    if(!scrim){
        scrim=document.createElement("div");
        scrim.id=id;
        scrim.className="mobile-bottom-sheet-scrim";
        scrim.hidden=true;
        document.body.appendChild(scrim);
    }
    return scrim;
}
function closeCheckoutMobileSheet(){
    if(!state.mobileSheetOpen)return;
    state.mobileSheetOpen=false;
    checkoutDetails?.classList.remove("mobile-bottom-sheet-open");
    document.body.classList.remove("mobile-sheet-locked");
    const scrim=getMobileSheetScrim("checkoutSheetScrim");
    scrim.classList.remove("is-visible");
    setTimeout(()=>{if(!state.mobileSheetOpen)scrim.hidden=true},260);
}
function openCheckoutMobileSheet(focusSelector){
    if(!checkoutDetails||!isMobileSheet())return false;
    state.mobileSheetOpen=true;
    checkoutDetails.hidden=false;
    checkoutDetails.classList.add("mobile-bottom-sheet-open");
    document.body.classList.add("mobile-sheet-locked");
    const scrim=getMobileSheetScrim("checkoutSheetScrim");
    scrim.hidden=false;
    requestAnimationFrame(()=>scrim.classList.add("is-visible"));
    if(focusSelector)setTimeout(()=>checkoutDetails.querySelector(focusSelector)?.focus(),360);
    return true;
}
function setCheckoutLoading(title,detail){
    if($("#checkoutLoadingTitle"))$("#checkoutLoadingTitle").textContent=title;
    if($("#checkoutLoadingDetail"))$("#checkoutLoadingDetail").textContent=detail;
}
function setCheckoutStage(step){
    if(!checkoutOverview || !checkoutDetails)return;
    const normalized=state.isDonation ? Math.max(1,Math.min(2,Number(step)||1)) : 2;
    checkoutOverview.hidden = !state.isDonation || normalized !== 1;
    checkoutDetails.hidden = normalized !== 2;
    [checkoutStepOne,checkoutStepTwo].forEach((el,i)=>{
        if(el)el.classList.toggle("active",i+1===normalized);
        if(el)el.classList.toggle("complete",i+1<normalized);
    });
    if(isMobileSheet()){
        if(normalized===1){
            closeCheckoutMobileSheet();
            checkoutOverview.hidden=false;
            checkoutDetails.hidden=true;
        }else{
            checkoutOverview.hidden=false;
            checkoutDetails.hidden=false;
        }
    }
    const activeStage=normalized===1?checkoutOverview:checkoutDetails;
    [checkoutOverview,checkoutDetails].forEach(el=>el.classList.remove("state-enter"));
    if(activeStage&&!activeStage.hidden){
        void activeStage.offsetWidth;
        activeStage.classList.add("state-enter");
    }
}
function setError(message){
    document.querySelectorAll(".checkout-session-overlay").forEach(el=>el.remove());
    loadingState.hidden=true;
    checkoutState.hidden=true;
    errorState.hidden=false;
    errorMessage.textContent=message;
}


function money(
    amount,
    currency
) {
    const value=Number(amount);
    if(!Number.isFinite(value)) return "—";
    try {
        return new Intl.NumberFormat("en-GM",{
            minimumFractionDigits:2,
            maximumFractionDigits:2
        }).format(value)+" "+currency;
    } catch {
        return value.toFixed(2)+" "+currency;
    }
}

function setFormError(
    message
) {
    formError.textContent =
        message || "";
    formError.hidden =
        !message;
}

function getVisitorId(){
    try{
        const key="sbp_checkout_visitor_id";
        let id=localStorage.getItem(key);
        if(!id){
            id=window.crypto?.randomUUID?.() || ("v_"+Math.random().toString(36).slice(2)+"_"+Date.now().toString(36));
            localStorage.setItem(key,id);
        }
        return id;
    }catch{
        return "v_"+Math.random().toString(36).slice(2)+"_"+Date.now().toString(36);
    }
}
function getDeviceType(){
    const w=window.innerWidth;
    return w<600?"mobile":w<950?"tablet":"desktop";
}
async function trackPaymentLinkClick(){
    if(state.isDonation || !state.slug)return;
    const params=new URLSearchParams(window.location.search);
    const body={
        visitor_id:getVisitorId(),
        device_type:getDeviceType(),
        referrer:document.referrer||"",
        utm_source:params.get("utm_source")||"",
        utm_medium:params.get("utm_medium")||"",
        utm_campaign:params.get("utm_campaign")||""
    };
    try{
        const response=await fetch(apiBase+"/api/public/links/"+encodeURIComponent(state.slug)+"/click",{
            method:"POST",
            headers:{"Content-Type":"application/json"},
            body:JSON.stringify(body),
            keepalive:true
        });
        const data=await response.json().catch(()=>({}));
        if(response.ok&&data.click_id)state.clickId=data.click_id;
    }catch(error){
        console.debug("Payment-link analytics unavailable:",error);
    }
}
async function loadCheckout() {
    const loaderStartedAt=performance.now();
    const minimumLoaderMs=2000;
    loadingState.hidden = false;
    errorState.hidden = true;
    checkoutState.hidden = true;
    setCheckoutLoading("Loading secure payment link…","Connecting to SquashberryPay.");

    try {
        void trackPaymentLinkClick();
        setCheckoutLoading("Checking payment details…","Verifying the payment link and product.");
        const response =
            await fetchWithTimeout(
                apiBase + (state.isDonation ? "/api/public/donations/" : "/api/public/links/") +
                encodeURIComponent(
                    state.slug
                )
            );

        let data = {};

        try {
            data =
                await response.json();
        } catch {
            data = {};
        }

        if (!response.ok) {
            throw new Error(
                data.error ||
                (state.isDonation ? "This donation page is unavailable." : "This payment link is unavailable.")
            );
        }

        if (state.isDonation) {
            if (!data.donation) throw new Error(data.error || "This donation page is unavailable.");
            const d=data.donation;
            state.link={
                title:d.name,
                description:d.description||"Support this donation campaign.",
                button_label:"Donate",
                service:{name:data.merchant?.name||"Merchant"},
                product:{name:d.name,description:d.description||"",payment_type:"donate",amount:d.fixed_amount,currency:d.currency,allow_custom_amount:d.allow_custom_amount},
                donation:{enabled:true,goal:d.goal,raised:d.raised,donor_count:d.donor_count,remaining:d.remaining,progress_percent:d.progress_percent,minimum:d.minimum_amount,maximum:d.maximum_amount,presets:d.presets||[],goal_message:d.goal_message,end_at:d.end_at,show_goal:d.goal!==null,show_donor_count:false,close_on_goal:false,goal_reached:d.goal!==null&&Number(d.raised||0)>=Number(d.goal)}
            };
        } else {
            if (!data.payment_link) throw new Error(data.error || "This payment link is unavailable.");
            state.link=data.payment_link;
        }

        setCheckoutLoading("Preparing checkout…","Your secure payment page is ready.");
        const loaderRemaining=minimumLoaderMs-(performance.now()-loaderStartedAt);
        if(loaderRemaining>0) await new Promise(resolve=>setTimeout(resolve,loaderRemaining));
        renderCheckout();

    } catch (error) {
        setError(error.name==="AbortError"?"SquashberryPay took too long to respond. Please try again.":error.message);
    }
}

function displayTitle(value){
    const text=String(value||"").trim();
    return text ? text.charAt(0).toUpperCase()+text.slice(1) : "Checkout";
}
function renderDonationCampaign(
    product,
    donation
) {
    const enabled =
        product.payment_type ===
            "donate" &&
        donation?.enabled;

    donationCampaign.hidden =
        !enabled;

    donorFields.hidden =
        !enabled;

    if (!enabled) {
        return;
    }

    const currency =
        product.currency;

    const goal=Number(donation.goal);
    const hasFiniteGoal=Number.isFinite(goal) && goal > 0;

    const showGoal=donation.show_goal && hasFiniteGoal;

    donationProgressPercent.hidden =
        !showGoal;

    donationProgressBar.parentElement.hidden =
        !showGoal;

    const raisedValue=Number(donation.raised);
    const raised=Number.isFinite(raisedValue)?raisedValue:0;

    const progress =
        Number(
            donation.progress_percent || 0
        );

    donationProgressPercent.textContent=showGoal && Number.isFinite(progress) ? String(Math.min(100,Math.max(0,progress)))+"%" : "";

    donationProgressBar.style.width=showGoal && Number.isFinite(progress) ? String(Math.min(100,Math.max(0,progress)))+"%" : "0%";

    donationRaised.textContent =
        money(
            raised,
            currency
        );

    donationRemainingStat.hidden =
        !showGoal;

    if (showGoal) {
        const remainingValue=Number(donation.remaining);
        const remaining = Number.isFinite(remainingValue) ? Math.max(0,remainingValue) : Math.max(0,goal-raised);
        donationRemaining.textContent =
            money(
                remaining,
                currency
            );

        donationGoalTitle.textContent =
            donation.goal_reached
                ? "Goal reached"
                : "Help reach " +
                    money(
                        goal,
                        currency
                    );
    } else {
        donationGoalTitle.textContent =
            "Support this campaign";
    }

    donationGoalMessage.hidden =
        !donation.goal_message;

    donationGoalMessage.textContent =
        donation.goal_message || "";

    if (donorCountStat) donorCountStat.hidden = true;

    donationPresets.innerHTML =
        "";

    const presets =
        Array.isArray(
            donation.presets
        )
            ? donation.presets
            : [];

    state.selectedDonationAmount =
        null;

    donationPresetsWrap.hidden =
        !enabled ||
        presets.length === 0;

    presets.forEach(
        value => {
            const button =
                document.createElement("button");

            button.type =
                "button";

            button.className =
                "preset-button";

            button.textContent =
                money(
                    value,
                    currency
                );

            button.dataset.amount =
                String(value);

            button.addEventListener(
                "click",
                () => {
                    state.selectedDonationAmount =
                        Number(value);

                    $("#customAmount").value =
                        String(value);
                    $("#amountLabel").textContent =
                        money(value, currency);
                    if(donationContinue){
                        donationContinue.disabled=false;
                        donationContinue.textContent="Continue with this amount";
                    }

                    if (
                        product.allow_custom_amount
                    ) {
                        $("#amountLabel")
                            .textContent =
                            money(
                                value,
                                currency
                            );
                    } else {
                        $("#amountLabel")
                            .textContent =
                            money(
                                value,
                                currency
                            );
                    }

                    document
                        .querySelectorAll(".preset-button")
                        .forEach(item => {
                            item.dataset.active =
                                item === button
                                    ? "true"
                                    : "false";
                        });
                }
            );

            donationPresets.appendChild(button);
        }
    );

    const hasEndDate =
        Boolean(donation.end_at) &&
        new Date(donation.end_at) <= new Date();

    const reachedAndClosed =
        Boolean(
            donation.close_on_goal &&
            donation.goal_reached
        );

    const ended =
        hasEndDate ||
        reachedAndClosed;

    donationEnded.hidden =
        !ended;

    continueButton.disabled =
        ended;

    if (ended) {
        $("#buttonText").textContent =
            "Donation campaign closed";
    }
}

function updateCheckoutSeo(){
 const title=state.link?.title||"Secure checkout — SquashberryPay";
 const description=state.link?.description||"Complete your payment securely with SquashberryPay.";
 document.title=title+" — SquashberryPay";
 const setMeta=(selector,attr,value)=>{let m=document.querySelector(selector);if(!m){m=document.createElement("meta");m.setAttribute(attr,"");document.head.appendChild(m)}m.setAttribute(attr==="property"?"content":"content",value);};
 const set=(key,attr,value)=>{let m=document.querySelector('meta['+attr+'="'+key+'"]');if(!m){m=document.createElement("meta");m.setAttribute(attr,key);document.head.appendChild(m)}m.setAttribute("content",value)};
 set("og:title","property",title+" — SquashberryPay");
 set("og:description","property",description);
 set("og:url","property",window.location.href);
 set("og:image","property",SITE_ORIGIN+SITE_BASE+"/og-image.svg");
 set("og:image:alt","property","SquashberryPay secure payment");
 set("twitter:title","name",title+" — SquashberryPay");
 set("twitter:description","name",description);
 set("twitter:image","name",new URL(SITE_BASE+"/og-image.svg",SITE_ORIGIN).href);
 const robots=document.querySelector('meta[name="robots"]');
 if(robots)robots.setAttribute("content",state.isDonation?"index,follow":"noindex,follow");
}
function renderCheckout() {
    const link =
        state.link;

    const product =
        link.product;

    $("#merchantName").textContent =
        link.service.name;

    $("#productName").textContent =
        product.name;

    $("#checkoutTitle").textContent =
        displayTitle(link.title);

    $("#checkoutDescription").textContent =
        link.description ||
        "Complete your payment securely with SquashberryPay.";

    $("#buttonText").textContent =
        product.payment_type === "donate"
            ? (link.button_label || "Donate")
            : (link.button_label || "Continue to payment");

    updateCheckoutSeo();
    state.donationStarted = !state.isDonation;
    if(donationContinue){
        donationContinue.hidden=!state.isDonation || donationEnded.hidden===false;
        donationContinue.disabled=state.isDonation && Boolean(product.allow_custom_amount) && !state.selectedDonationAmount;
        donationContinue.textContent=product.payment_type==="donate"?(state.selectedDonationAmount?"Continue with this amount":"Choose an amount"):"Continue";
    }
    const otherAmountButton=$("#donationOtherAmount");
    if(otherAmountButton){
        otherAmountButton.hidden=!state.isDonation || !product.allow_custom_amount || donationEnded.hidden===false;
    }
    if(overviewContinue){
        overviewContinue.hidden=state.isDonation;
        overviewContinue.textContent=product.payment_type==="donate"?(link.button_label||"Continue"):(link.button_label||"Continue to payment");
    }
    const donation=link.donation||{enabled:false};

    renderDonationCampaign(
        product,
        donation
    );

    const custom =
        product.payment_type === "donate" &&
        product.allow_custom_amount;

    const summaryAmount = $("#amountLabel")?.parentElement;
    if (summaryAmount) summaryAmount.hidden = false;

    $("#customAmountWrap").hidden =
        !custom;

    $("#amountHelp").hidden =
        !custom;

    $("#currencyPrefix").textContent =
        product.currency;

    if (custom) {
        $("#amountLabel").textContent = state.selectedDonationAmount ? money(state.selectedDonationAmount, product.currency) : "Choose amount";
        $("#customAmountLabel").textContent =
            "Donation amount";

        const minimum =
            donation.minimum;

        const maximum =
            donation.maximum;

        $("#customAmount").min =
            minimum !== null
                ? String(minimum)
                : "0.01";

        $("#customAmount").max =
            maximum !== null
                ? String(maximum)
                : "";

        $("#amountHelp").textContent =
            minimum !== null && maximum !== null
                ? "Choose between " +
                    money(minimum, product.currency) +
                    " and " +
                    money(maximum, product.currency) +
                    "."
                : minimum !== null
                    ? "Minimum donation: " +
                        money(minimum, product.currency) +
                        "."
                    : maximum !== null
                        ? "Maximum donation: " +
                            money(maximum, product.currency) +
                            "."
                        : "Choose the amount you would like to donate.";
    } else {
        $("#amountLabel").textContent =
            money(
                product.amount,
                product.currency
            );
    }

    const params =
        new URLSearchParams(
            window.location.search
        );

    if (
        product.payment_type ===
            "donate" &&
        params.has("amount")
    ) {
        const presetAmount =
            Number(
                params.get("amount")
            );

        if (
            Number.isFinite(
                presetAmount
            ) &&
            presetAmount > 0
        ) {
            state.selectedDonationAmount =
                presetAmount;

            $("#customAmount").value =
                String(
                    presetAmount
                );
        }
    }

    loadingState.hidden=true;
    errorState.hidden=true;
    checkoutState.hidden=false;
    setCheckoutStage(state.isDonation ? 1 : 2);
}

function normalizePublicUrl(u){
    try{
        const x=new URL(String(u||""),window.location.origin);
        if(x.hostname==="squashberry.github.io" && !x.pathname.startsWith("/Squashberrypay/")){
            x.pathname="/Squashberrypay"+(x.pathname.startsWith("/")?x.pathname:"/"+x.pathname);
        }
        return x.href;
    }catch{return String(u||"")}
}

async function startPayment(
    event
) {
    event.preventDefault();
    setFormError("");

    if (!state.link) {
        return;
    }

    const email =
        $("#email").value.trim().toLowerCase();

    if (
        !email ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ) {
        setFormError("Enter a valid email address.");
        return;
    }

    const product =
        state.link.product;

    const donation =
        state.link.donation || { enabled: false };

    const body = {
        email,
        click_id: state.clickId
    };

    if (
        product.payment_type ===
            "donate"
    ) {
        const amount =
            product.allow_custom_amount
                ? Number($("#customAmount").value)
                : (
                    state.selectedDonationAmount !==
                        null
                        ? Number(
                            state.selectedDonationAmount
                        )
                        : Number(product.amount)
                );

        if (!Number.isFinite(amount) || amount <= 0) {
            setFormError("Enter a valid donation amount.");
            return;
        }

        if (
            donation.minimum !== null &&
            amount < Number(donation.minimum)
        ) {
            setFormError(
                "Minimum donation is " +
                money(donation.minimum, product.currency) +
                "."
            );
            return;
        }

        if (
            donation.maximum !== null &&
            amount > Number(donation.maximum)
        ) {
            setFormError(
                "Maximum donation is " +
                money(donation.maximum, product.currency) +
                "."
            );
            return;
        }

        body.amount =
            Math.round(amount * 100) / 100;

        body.donor_name =
            $("#donorName").value.trim().slice(0, 120);

        body.donor_message =
            $("#donorMessage").value.trim().slice(0, 500);

        body.donor_anonymous =
            $("#donorAnonymous").checked;
    } else if (
        !Number.isFinite(Number(product.amount)) ||
        Number(product.amount) <= 0
    ) {
        setFormError("This product does not have a valid amount.");
        return;
    }

    const originalText=$("#buttonText").textContent;
    continueButton.disabled=true;
    $("#buttonText").textContent="Opening payment…";

    try {
        const response =
            await fetchWithTimeout(
                apiBase + (state.isDonation ? "/api/public/donations/" : "/api/public/links/") +
                encodeURIComponent(state.slug) +
                "/payments",
                {
                    method: "POST",
                    headers: {
                        "Content-Type":
                            "application/json"
                    },
                    body:
                        JSON.stringify(body)
                }
            );

        let data = {};

        try {
            data = await response.json();
        } catch {
            data = {};
        }

        if (!response.ok || !data.payment_url) {
            throw new Error(
                data.error ||
                "Could not start checkout."
            );
        }

        const target=normalizePublicUrl(data.payment_url);
        window.location.replace(target);

    } catch (error) {
        if(!isMobileSheet())setCheckoutStage(2);
        setFormError(error.name==="AbortError"?"The payment service took too long to respond. Please try again.":error.message);
        continueButton.disabled=false;
        $("#buttonText").textContent=originalText;
    }
}

function goToDetails(){
    if(isMobileSheet()){
        const customNeedsFocus=state.isDonation && state.link?.product?.allow_custom_amount && !state.selectedDonationAmount;
        openCheckoutMobileSheet(customNeedsFocus?"#customAmount":"#email");
        return;
    }
    setCheckoutStage(2);
    setTimeout(()=>{
        if(state.isDonation && state.link?.product?.allow_custom_amount && !state.selectedDonationAmount){
            $("#customAmount")?.focus();
        }else{
            $("#email")?.focus();
        }
    },40);
}

donationContinue?.addEventListener("click",()=>{
    if(donationContinue.disabled)return;
    state.donationStarted=true;
    goToDetails();
});
$("#donationOtherAmount")?.addEventListener("click",()=>{
    state.selectedDonationAmount=null;
    $("#customAmount").value="";
    $("#amountLabel").textContent="Choose amount";
    goToDetails();
});

overviewContinue?.addEventListener("click",goToDetails);

backToOverview?.addEventListener("click",()=>{
    setFormError("");
    continueButton.disabled=false;
    closeCheckoutMobileSheet();
    setCheckoutStage(1);
});
getMobileSheetScrim("checkoutSheetScrim").addEventListener("click",closeCheckoutMobileSheet);
let checkoutSheetStartY=null;
checkoutDetails?.addEventListener("touchstart",event=>{
    if(!isMobileSheet()||!state.mobileSheetOpen)return;
    checkoutSheetStartY=event.touches[0].clientY;
},{passive:true});
checkoutDetails?.addEventListener("touchmove",event=>{
    if(!isMobileSheet()||!state.mobileSheetOpen||checkoutSheetStartY===null)return;
    const delta=event.touches[0].clientY-checkoutSheetStartY;
    if(delta>0)checkoutDetails.style.setProperty("--sheet-drag-y",Math.min(delta,180)+"px");
},{passive:true});
checkoutDetails?.addEventListener("touchend",()=>{
    if(!isMobileSheet()||checkoutSheetStartY===null)return;
    const delta=parseFloat(checkoutDetails.style.getPropertyValue("--sheet-drag-y"))||0;
    checkoutDetails.style.removeProperty("--sheet-drag-y");
    checkoutSheetStartY=null;
    if(delta>80)closeCheckoutMobileSheet();
});

retryButton?.addEventListener(
    "click",
    loadCheckout
);

checkoutForm?.addEventListener(
    "submit",
    startPayment
);

loadCheckout();
