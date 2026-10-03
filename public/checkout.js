"use strict";

const apiBase =
    String(
        window.SQUASHBERRYPAY_API_BASE ||
        "https://squashberrypay.squashberrypay.workers.dev"
    ).replace(/\/+$/, "");


const state = {
    slug:
        decodeURIComponent(
            window.location.pathname
                .split("/")
                .filter(Boolean)
                .pop() || ""
        ),
    link:
        null,

    selectedDonationAmount:
        null
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

const donorFields =
    $("#donorFields");

function setError(
    message
) {
    loadingState.hidden = true;
    checkoutState.hidden = true;
    errorState.hidden = false;
    errorMessage.textContent =
        message;
}

function money(
    amount,
    currency
) {
    try {
        return new Intl.NumberFormat(
            "en-GM",
            {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            }
        ).format(
            Number(amount)
        ) +
        " " +
        currency;
    } catch {
        return (
            Number(amount).toFixed(2) +
            " " +
            currency
        );
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

async function loadCheckout() {
    loadingState.hidden = false;
    errorState.hidden = true;
    checkoutState.hidden = true;

    try {
        const response =
            await fetch(
                apiBase + "/api/public/links/" +
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

        if (
            !response.ok ||
            !data.payment_link
        ) {
            throw new Error(
                data.error ||
                "This payment link is unavailable."
            );
        }

        state.link =
            data.payment_link;

        renderCheckout();

    } catch (error) {
        setError(
            error.message
        );
    }
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

    const goal =
        donation.goal;

    const showGoal =
        donation.show_goal &&
        goal !== null;

    donationProgressPercent.hidden =
        !showGoal;

    donationProgressBar.parentElement.hidden =
        !showGoal;

    const raised =
        Number(
            donation.raised || 0
        );

    const progress =
        Number(
            donation.progress_percent || 0
        );

    donationProgressPercent.textContent =
        goal !== null
            ? String(progress) + "%"
            : "";

    donationProgressBar.style.width =
        goal !== null
            ? String(Math.min(100, progress)) + "%"
            : "0%";

    donationRaised.textContent =
        money(
            raised,
            currency
        );

    donationRemainingStat.hidden =
        !showGoal;

    if (showGoal) {
        donationRemaining.textContent =
            money(
                donation.remaining,
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

    donorCountStat.hidden =
        !donation.show_donor_count;

    donorCount.textContent =
        String(
            donation.donor_count || 0
        );

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
        link.title;

    $("#checkoutDescription").textContent =
        link.description ||
        "Complete your payment securely with SquashberryPay.";

    $("#buttonText").textContent =
        product.payment_type === "donate"
            ? (link.button_label || "Donate")
            : (link.button_label || "Continue to payment");

    const donation =
        link.donation || {
            enabled: false
        };

    renderDonationCampaign(
        product,
        donation
    );

    const custom =
        product.payment_type === "donate" &&
        product.allow_custom_amount;

    $("#customAmountWrap").hidden =
        !custom;

    $("#amountHelp").hidden =
        !custom;

    $("#currencyPrefix").textContent =
        product.currency;

    if (custom) {
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

    loadingState.hidden = true;
    errorState.hidden = true;
    checkoutState.hidden = false;
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
        email
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

    const originalText =
        $("#buttonText").textContent;

    continueButton.disabled =
        true;

    $("#buttonText").textContent =
        "Starting checkout…";

    try {
        const response =
            await fetch(
                apiBase + "/api/public/links/" +
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

        window.location.href =
            data.payment_url;

    } catch (error) {
        setFormError(error.message);
        continueButton.disabled = false;
        $("#buttonText").textContent =
            originalText;
    }
}
retryButton.addEventListener(
    "click",
    loadCheckout
);

checkoutForm.addEventListener(
    "submit",
    startPayment
);

loadCheckout();
