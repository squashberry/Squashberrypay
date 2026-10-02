"use strict";

const state = {
    slug:
        decodeURIComponent(
            window.location.pathname
                .split("/")
                .filter(Boolean)
                .pop() || ""
        ),
    link:
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
                "/api/public/links/" +
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

function renderCheckout() {
    const link =
        state.link;

    const product =
        link.product;

    $("#merchantName")
        .textContent =
        link.service.name;

    $("#productName")
        .textContent =
        product.name;

    $("#checkoutTitle")
        .textContent =
        link.title;

    $("#checkoutDescription")
        .textContent =
        link.description ||
        "Complete your payment securely with SquashberryPay.";

    $("#buttonText")
        .textContent =
        link.button_label ||
        "Continue to payment";

    const custom =
        product.payment_type ===
            "donate" &&
        product.allow_custom_amount;

    $("#customAmountWrap")
        .hidden =
        !custom;

    $("#amountHelp")
        .hidden =
        !custom;

    $("#currencyPrefix")
        .textContent =
        product.currency;

    if (custom) {
        $("#amountLabel")
            .textContent =
            "Choose an amount";
    } else {
        $("#amountLabel")
            .textContent =
            money(
                product.amount,
                product.currency
            );
    }

    const params =
        new URLSearchParams(
            window.location.search
        );

    if (custom && params.has("amount")) {
        $("#customAmount")
            .value =
            params.get("amount");
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
        $("#email")
            .value
            .trim()
            .toLowerCase();

    if (
        !email ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
            email
        )
    ) {
        setFormError(
            "Enter a valid email address."
        );
        return;
    }

    const product =
        state.link.product;

    const body = {
        email
    };

    if (
        product.payment_type ===
            "donate" &&
        product.allow_custom_amount
    ) {
        const amount =
            Number(
                $("#customAmount")
                    .value
            );

        if (
            !Number.isFinite(amount) ||
            amount <= 0
        ) {
            setFormError(
                "Enter a valid amount."
            );
            return;
        }

        body.amount =
            Math.round(
                amount * 100
            ) / 100;
    }

    const originalText =
        $("#buttonText")
            .textContent;

    continueButton.disabled =
        true;

    $("#buttonText")
        .textContent =
        "Starting checkout…";

    try {
        const response =
            await fetch(
                "/api/public/links/" +
                encodeURIComponent(
                    state.slug
                ) +
                "/payments",
                {
                    method:
                        "POST",
                    headers: {
                        "Content-Type":
                            "application/json"
                    },
                    body:
                        JSON.stringify(
                            body
                        )
                }
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
            !data.payment_url
        ) {
            throw new Error(
                data.error ||
                "Could not start checkout."
            );
        }

        window.location.href =
            data.payment_url;

    } catch (error) {
        setFormError(
            error.message
        );

        continueButton.disabled =
            false;

        $("#buttonText")
            .textContent =
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
