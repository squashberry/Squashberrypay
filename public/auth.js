"use strict";


/* ============================================================
   STATE
============================================================ */

const state = {

    currentSignupStep:
        1,

    signupEmail:
        "",

    signupData:
        null,

    signupBusy:
        false,

    otpAutoVerifying:
        false,

    otpLength:
        6
};


/* ============================================================
   HELPERS
============================================================ */

const $ =
    selector =>
        document.querySelector(
            selector
        );


function normalizeEmail(
    value
) {

    return String(
        value || ""
    )
        .trim()
        .toLowerCase();
}


function validEmail(
    value
) {

    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        .test(
            value
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


/* ============================================================
   MESSAGE
============================================================ */

const authMessage =
    $("#authMessage");


function showMessage(
    message,
    type = "error"
) {

    if (!authMessage) {
        return;
    }


    authMessage.textContent =
        message;


    authMessage.className =
        `auth-message ${type}`;


    authMessage.hidden =
        false;


    authMessage.classList.remove(
        "state-enter"
    );


    void authMessage.offsetWidth;


    authMessage.classList.add(
        "state-enter"
    );
}


function clearMessage() {

    if (!authMessage) {
        return;
    }


    authMessage.hidden =
        true;


    authMessage.textContent =
        "";


    authMessage.className =
        "auth-message";
}


/* ============================================================
   BUTTON LOADING
============================================================ */

function setButtonLoading(
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


    button.classList.add(
        "is-loading"
    );


    button.innerHTML = `

        <span class="spinner"></span>

        <span>
            ${escapeHtml(text)}
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
   SHAKE
============================================================ */

function shake(
    element
) {

    if (!element) {
        return;
    }


    element.classList.remove(
        "error-shake"
    );


    void element.offsetWidth;


    element.classList.add(
        "error-shake"
    );


    setTimeout(
        () => {

            element.classList.remove(
                "error-shake"
            );

        },
        450
    );
}


/* ============================================================
   VALIDATION ANIMATION
============================================================ */

function setFieldState(
    input,
    valid,
    invalid = false
) {

    if (!input) {
        return;
    }


    input.classList.remove(
        "is-valid",
        "is-invalid"
    );


    if (valid) {

        input.classList.add(
            "is-valid"
        );

    } else if (
        invalid
    ) {

        input.classList.add(
            "is-invalid"
        );
    }
}


/* ============================================================
   FIELD ANIMATION / VALIDATION
============================================================ */

function attachFieldValidation(
    input,
    validator
) {

    if (!input) {
        return;
    }


    input.addEventListener(
        "input",
        () => {

            const value =
                input.value.trim();


            if (!value) {

                setFieldState(
                    input,
                    false,
                    false
                );


                return;
            }


            const result =
                validator(
                    value
                );


            setFieldState(
                input,
                result,
                !result
            );
        }
    );
}


attachFieldValidation(
    $("#businessName"),
    value =>
        value.length >= 2
);


attachFieldValidation(
    $("#businessType"),
    value =>
        value.length >= 2
);


attachFieldValidation(
    $("#website"),
    value =>
        /^https?:\/\/.+/i.test(
            value
        )
);


attachFieldValidation(
    $("#email"),
    value =>
        validEmail(
            value
        )
);


attachFieldValidation(
    $("#phone"),
    value =>
        value.length >= 6
);


attachFieldValidation(
    $("#signupPassword"),
    value =>
        value.length >= 8
);


attachFieldValidation(
    $("#confirmPassword"),
    value =>
        value.length >= 8 &&
        value ===
            (
                $("#signupPassword")
                    ?.value ||
                ""
            )
);


/* ============================================================
   PASSWORD STRENGTH
============================================================ */

const passwordInput =
    $("#signupPassword");


const passwordStrength =
    $("#passwordStrength");


function updatePasswordStrength() {

    if (
        !passwordStrength ||
        !passwordInput
    ) {
        return;
    }


    const value =
        passwordInput.value;


    passwordStrength.classList.remove(
        "weak",
        "medium",
        "strong"
    );


    if (!value) {

        passwordStrength
            .querySelector(
                "small"
            )
            .textContent =
            "Use at least 8 characters";


        return;
    }


    let score =
        0;


    if (
        value.length >= 8
    ) {
        score++;
    }


    if (
        /[A-Z]/.test(
            value
        )
    ) {
        score++;
    }


    if (
        /[0-9]/.test(
            value
        )
    ) {
        score++;
    }


    if (
        /[^A-Za-z0-9]/.test(
            value
        )
    ) {
        score++;
    }


    if (
        score <= 1
    ) {

        passwordStrength.classList.add(
            "weak"
        );


        passwordStrength
            .querySelector(
                "small"
            )
            .textContent =
            "Weak password";

    } else if (
        score <= 2
    ) {

        passwordStrength.classList.add(
            "medium"
        );


        passwordStrength
            .querySelector(
                "small"
            )
            .textContent =
            "Good password";

    } else {

        passwordStrength.classList.add(
            "strong"
        );


        passwordStrength
            .querySelector(
                "small"
            )
            .textContent =
            "Strong password";
    }
}


passwordInput?.addEventListener(
    "input",
    updatePasswordStrength
);


/* ============================================================
   PASSWORD VISIBILITY
============================================================ */

document.addEventListener(
    "click",
    event => {

        const button =
            event.target.closest(
                "[data-password-toggle]"
            );


        if (!button) {
            return;
        }


        const input =
            $(
                `#${button.dataset.passwordToggle}`
            );


        if (!input) {
            return;
        }


        if (
            input.type ===
            "password"
        ) {

            input.type =
                "text";

            button.textContent =
                "Hide";

        } else {

            input.type =
                "password";

            button.textContent =
                "Show";
        }
    }
);


/* ============================================================
   SIGNUP STEPS
============================================================ */

const signupSteps = {

    1:
        $("#signupStep1"),

    2:
        $("#signupStep2"),

    3:
        $("#signupStep3")
};


const progressSteps =
    document.querySelectorAll(
        ".progress-step"
    );


const progressLineFill =
    $("#progressLineFill");


function updateProgress(
    step
) {

    if (
        !progressSteps.length
    ) {
        return;
    }


    progressSteps.forEach(
        progress => {

            const number =
                Number(
                    progress.dataset.progress
                );


            progress.classList.toggle(
                "active",
                number === step
            );


            progress.classList.toggle(
                "complete",
                number < step
            );
        }
    );


    const percentage =
        (
            (step - 1) /
            2
        ) *
        100;


    if (
        progressLineFill
    ) {

        progressLineFill.style.width =
            `${percentage}%`;
    }
}


function showSignupStep(
    step
) {

    state.currentSignupStep =
        step;


    Object.values(
        signupSteps
    ).forEach(
        element => {

            if (!element) {
                return;
            }


            element.hidden =
                true;


            element.classList.remove(
                "active"
            );
        }
    );


    const target =
        signupSteps[step];


    if (!target) {
        return;
    }


    target.hidden =
        false;


    target.classList.remove(
        "active"
    );


    void target.offsetWidth;


    target.classList.add(
        "active"
    );


    updateProgress(
        step
    );


    clearMessage();


    window.scrollTo({
        top:
            0,

        behavior:
            "smooth"
    });
}


/* ============================================================
   STEP 1 VALIDATION
============================================================ */

const step1Next =
    $("#step1Next");


function validateStep1() {

    const businessName =
        $(
            "#businessName"
        )?.value.trim() || "";


    const businessType =
        $(
            "#businessType"
        )?.value.trim() || "";


    const website =
        $(
            "#website"
        )?.value.trim() || "";


    if (
        businessName.length <
        2
    ) {

        setFieldState(
            $("#businessName"),
            false,
            true
        );


        shake(
            $("#businessName")
        );


        showMessage(
            "Enter your business name."
        );


        return false;
    }


    if (
        businessType.length <
        2
    ) {

        setFieldState(
            $("#businessType"),
            false,
            true
        );


        shake(
            $("#businessType")
        );


        showMessage(
            "Tell us what type of business you operate."
        );


        return false;
    }


    if (
        website &&
        !/^https?:\/\/.+/i.test(
            website
        )
    ) {

        setFieldState(
            $("#website"),
            false,
            true
        );


        shake(
            $("#website")
        );


        showMessage(
            "Enter a complete website address beginning with http:// or https://."
        );


        return false;
    }


    setFieldState(
        $("#businessName"),
        true
    );


    setFieldState(
        $("#businessType"),
        true
    );


    if (website) {

        setFieldState(
            $("#website"),
            true
        );
    }


    return true;
}


step1Next?.addEventListener(
    "click",
    () => {

        if (
            validateStep1()
        ) {

            showSignupStep(
                2
            );


            $("#email")?.focus();
        }
    }
);


/* ============================================================
   STEP 2 VALIDATION
============================================================ */

const signupForm =
    $("#signupForm");


function collectSignupData() {

    return {

        business_name:
            $("#businessName")
                ?.value
                .trim() || "",

        business_type:
            $("#businessType")
                ?.value
                .trim() || "",

        email:
            normalizeEmail(
                $("#email")
                    ?.value
            ),

        phone:
            $("#phone")
                ?.value
                .trim() || "",

        website:
            $("#website")
                ?.value
                .trim() || "",

        password:
            $("#signupPassword")
                ?.value || ""
    };
}


function validateStep2() {

    const email =
        normalizeEmail(
            $("#email")
                ?.value
        );


    const phone =
        $("#phone")
            ?.value
            .trim() || "";


    const password =
        $("#signupPassword")
            ?.value || "";


    const confirmPassword =
        $("#confirmPassword")
            ?.value || "";


    if (
        !validEmail(
            email
        )
    ) {

        setFieldState(
            $("#email"),
            false,
            true
        );


        shake(
            $("#email")
        );


        showMessage(
            "Enter a valid business email."
        );


        return false;
    }


    if (
        phone &&
        phone.length < 6
    ) {

        setFieldState(
            $("#phone"),
            false,
            true
        );


        shake(
            $("#phone")
        );


        showMessage(
            "Check your phone number."
        );


        return false;
    }


    if (
        password.length <
        8
    ) {

        setFieldState(
            $("#signupPassword"),
            false,
            true
        );


        shake(
            $("#signupPassword")
        );


        showMessage(
            "Your password must contain at least 8 characters."
        );


        return false;
    }


    if (
        password !==
        confirmPassword
    ) {

        setFieldState(
            $("#confirmPassword"),
            false,
            true
        );


        shake(
            $("#confirmPassword")
        );


        showMessage(
            "Your passwords do not match."
        );


        return false;
    }


    setFieldState(
        $("#email"),
        true
    );


    setFieldState(
        $("#signupPassword"),
        true
    );


    setFieldState(
        $("#confirmPassword"),
        true
    );


    if (phone) {

        setFieldState(
            $("#phone"),
            true
        );
    }


    return true;
}


/* ============================================================
   SEND SIGNUP OTP
============================================================ */

async function sendSignupOtp() {

    const data =
        collectSignupData();


    return authRequest(
        "/api/public/auth/signup/send-otp",
        {
            method:
                "POST",

            body:
                JSON.stringify(
                    data
                )
        }
    );
}


/* ============================================================
   SUBMIT SIGNUP
============================================================ */

signupForm?.addEventListener(
    "submit",
    async event => {

        /*
         * THIS PREVENTS THE PAGE REFRESH.
         */

        event.preventDefault();
        event.stopPropagation();


        if (
            state.signupBusy
        ) {
            return;
        }


        if (
            !validateStep2()
        ) {
            return;
        }


        state.signupBusy =
            true;


        state.signupData =
            collectSignupData();


        state.signupEmail =
            state.signupData.email;


        const signupButton =
            $("#signupButton");


        setButtonLoading(
            signupButton,
            "Sending code…"
        );


        clearMessage();


        try {

            const result =
                await sendSignupOtp();


            console.log(
                "Signup OTP response:",
                result
            );


            $("#signupEmailDisplay")
                .textContent =
                state.signupEmail;


            showSignupStep(
                3
            );


            createSignupOtpInputs();


            startSignupResendTimer(
                60
            );


            setTimeout(
                () => {

                    signupOtpInputs[0]
                        ?.focus();

                },
                220
            );


            showMessage(
                "Verification code sent to your email.",
                "success"
            );

        } catch (error) {

            console.error(
                "Signup OTP error:",
                error
            );


            showMessage(
                error.message
            );


            shake(
                signupButton
            );

        } finally {

            state.signupBusy =
                false;


            resetButton(
                signupButton
            );
        }
    }
);


/* ============================================================
   BACK BUTTON
============================================================ */

document.addEventListener(
    "click",
    event => {

        const button =
            event.target.closest(
                "[data-back-step]"
            );


        if (!button) {
            return;
        }


        const step =
            Number(
                button.dataset.backStep
            );


        showSignupStep(
            step
        );
    }
);


/* ============================================================
   OTP INPUTS
============================================================ */

const signupOtpContainer =
    $("#signupOtpContainer");


let signupOtpInputs =
    [];


function createSignupOtpInputs() {

    if (
        !signupOtpContainer
    ) {
        return;
    }


    signupOtpContainer.innerHTML =
        "";


    signupOtpInputs =
        [];


    for (
        let i = 0;
        i < state.otpLength;
        i++
    ) {

        const input =
            document.createElement(
                "input"
            );


        input.type =
            "text";


        input.inputMode =
            "numeric";


        input.maxLength =
            1;


        input.className =
            "otp-digit";


        input.autocomplete =
            i === 0
                ? "one-time-code"
                : "off";


        input.setAttribute(
            "aria-label",
            `Verification digit ${i + 1}`
        );


        input.addEventListener(
            "input",
            () => {

                input.value =
                    input.value
                        .replace(
                            /\D/g,
                            ""
                        )
                        .slice(
                            0,
                            1
                        );


                if (
                    input.value
                ) {

                    input.classList.add(
                        "filled"
                    );

                } else {

                    input.classList.remove(
                        "filled"
                    );
                }


                const index =
                    signupOtpInputs.indexOf(
                        input
                    );


                if (
                    input.value &&
                    signupOtpInputs[
                        index + 1
                    ]
                ) {

                    signupOtpInputs[
                        index + 1
                    ].focus();
                }


                const otp =
                    getSignupOtp();


                /*
                 * AUTOMATIC VERIFICATION:
                 *
                 * The moment all 6 digits exist,
                 * verify automatically.
                 */

                if (
                    otp.length ===
                        state.otpLength &&
                    !state.otpAutoVerifying
                ) {

                    verifySignupOtp(
                        true
                    );
                }
            }
        );


        input.addEventListener(
            "keydown",
            event => {

                const index =
                    signupOtpInputs.indexOf(
                        input
                    );


                if (
                    event.key ===
                        "Backspace" &&
                    !input.value &&
                    signupOtpInputs[
                        index - 1
                    ]
                ) {

                    signupOtpInputs[
                        index - 1
                    ].focus();
                }
            }
        );


        input.addEventListener(
            "paste",
            event => {

                event.preventDefault();


                const pasted =
                    (
                        event.clipboardData
                            ?.getData(
                                "text"
                            ) ||
                        ""
                    )
                        .replace(
                            /\D/g,
                            ""
                        )
                        .slice(
                            0,
                            state.otpLength
                        );


                pasted
                    .split("")
                    .forEach(
                        (
                            digit,
                            index
                        ) => {

                            if (
                                signupOtpInputs[
                                    index
                                ]
                            ) {

                                signupOtpInputs[
                                    index
                                ].value =
                                    digit;

                                signupOtpInputs[
                                    index
                                ].classList.add(
                                    "filled"
                                );
                            }
                        }
                    );


                const target =
                    signupOtpInputs[
                        Math.min(
                            pasted.length,
                            state.otpLength - 1
                        )
                    ];


                target?.focus();


                if (
                    pasted.length ===
                    state.otpLength
                ) {

                    verifySignupOtp(
                        true
                    );
                }
            }
        );


        signupOtpContainer.appendChild(
            input
        );


        signupOtpInputs.push(
            input
        );
    }
}


function getSignupOtp() {

    return signupOtpInputs
        .map(
            input =>
                input.value
        )
        .join("");
}


/* ============================================================
   OTP RESEND TIMER
============================================================ */

let signupResendInterval =
    null;


function startSignupResendTimer(
    seconds
) {

    const timer =
        $("#signupResendTimer");


    const resendButton =
        $("#resendSignupButton");


    clearInterval(
        signupResendInterval
    );


    let remaining =
        seconds;


    if (
        resendButton
    ) {

        resendButton.disabled =
            true;
    }


    function update() {

        if (
            timer
        ) {

            timer.textContent =
                `${remaining}s`;
        }


        if (
            remaining <= 0
        ) {

            clearInterval(
                signupResendInterval
            );


            if (
                resendButton
            ) {

                resendButton.disabled =
                    false;
            }


            if (
                timer
            ) {

                timer.textContent =
                    "Ready";
            }


            return;
        }


        remaining--;
    }


    update();


    signupResendInterval =
        setInterval(
            update,
            1000
        );
}


/* ============================================================
   CLEAR OTP
============================================================ */

function clearSignupOtp() {

    signupOtpInputs.forEach(
        input => {

            input.value =
                "";

            input.classList.remove(
                "filled"
            );
        }
    );


    signupOtpContainer
        ?.classList.remove(
            "verifying",
            "verified",
            "error-shake"
        );


    $("#otpSuccessAnimation")
        ?.setAttribute(
            "hidden",
            ""
        );


    $("#verifySignupButton")
        ?.removeAttribute(
            "hidden"
        );


    $("#verifySignupButton").disabled =
        true;
}


/* ============================================================
   OTP ERROR
============================================================ */

function animateOtpError() {

    signupOtpContainer
        ?.classList.remove(
            "error-shake"
        );


    void signupOtpContainer
        ?.offsetWidth;


    signupOtpContainer
        ?.classList.add(
            "error-shake"
        );


    signupOtpInputs.forEach(
        input => {

            input.classList.add(
                "is-invalid"
            );
        }
    );


    setTimeout(
        () => {

            signupOtpInputs.forEach(
                input => {

                    input.classList.remove(
                        "is-invalid"
                    );
                }
            );


            clearSignupOtp();

            signupOtpInputs[0]
                ?.focus();

        },
        420
    );
}


/* ============================================================
   VERIFY SIGNUP OTP
============================================================ */

async function verifySignupOtp(
    automatic = false
) {

    if (
        state.signupBusy ||
        state.otpAutoVerifying
    ) {
        return;
    }


    const token =
        getSignupOtp();


    if (
        token.length !==
        state.otpLength
    ) {
        return;
    }


    state.otpAutoVerifying =
        true;


    const verifyButton =
        $("#verifySignupButton");


    const successAnimation =
        $("#otpSuccessAnimation");


    /*
     * Visual transition:
     *
     * [1][2][3][4][5][6]
     *
     * becomes
     *
     * ||||||    green
     *
     * then
     *
     *        ✓
     */

    signupOtpContainer
        ?.classList.add(
            "verifying"
        );


    if (
        verifyButton
    ) {

        verifyButton.disabled =
            true;
    }


    await new Promise(
        resolve =>
            setTimeout(
                resolve,
                360
            )
    );


    try {

        const data =
            await authRequest(
                "/api/public/auth/signup/verify-otp",
                {
                    method:
                        "POST",

                    body:
                        JSON.stringify({
                            email:
                                state.signupEmail,

                            token,

                            signup:
                                state.signupData
                        })
                }
            );


        signupOtpContainer
            ?.classList.remove(
                "verifying"
            );


        signupOtpContainer
            ?.classList.add(
                "verified"
            );


        if (
            successAnimation
        ) {

            successAnimation.hidden =
                false;
        }


        showMessage(
            "Email verified successfully.",
            "success"
        );


        await new Promise(
            resolve =>
                setTimeout(
                    resolve,
                    650
                )
        );


        saveMerchantSession(
            data
        );


        const success =
            $("#signupSuccess");


        if (
            success
        ) {

            success.hidden =
                false;


            success.classList.remove(
                "state-enter"
            );


            void success.offsetWidth;


            success.classList.add(
                "state-enter"
            );
        }


        $("#signupStep3")
            .hidden =
            true;


        document
            .getElementById(
                "signupProgress"
            )
            ?.setAttribute(
                "hidden",
                ""
            );


        progressSteps.forEach(
            step => {

                step.classList.add(
                    "complete"
                );

                step.classList.remove(
                    "active"
                );
            }
        );


        if (
            progressLineFill
        ) {

            progressLineFill.style.width =
                "100%";
        }


        setTimeout(
            () => {

                window.location.href =
                    "./merchant.html";

            },
            1000
        );

    } catch (error) {

        console.error(
            "Signup OTP verification error:",
            error
        );


        animateOtpError();


        showMessage(
            error.message
        );

    } finally {

        state.otpAutoVerifying =
            false;
    }
}


/* ============================================================
   VERIFY BUTTON
   (Kept as fallback, although OTP auto-submits.)
============================================================ */

$("#verifySignupButton")
    ?.addEventListener(
        "click",
        () => {

            verifySignupOtp(
                false
            );
        }
    );


/* ============================================================
   RESEND SIGNUP OTP
============================================================ */

$("#resendSignupButton")
    ?.addEventListener(
        "click",
        async () => {

            const button =
                $("#resendSignupButton");


            if (
                !button ||
                button.disabled
            ) {
                return;
            }


            setButtonLoading(
                button,
                "Sending…"
            );


            try {

                await authRequest(
                    "/api/public/auth/signup/resend-otp",
                    {
                        method:
                            "POST",

                        body:
                            JSON.stringify({
                                email:
                                    state.signupEmail
                            })
                    }
                );


                clearSignupOtp();


                startSignupResendTimer(
                    60
                );


                showMessage(
                    "A new verification code has been sent.",
                    "success"
                );


                setTimeout(
                    () => {

                        signupOtpInputs[0]
                            ?.focus();

                    },
                    100
                );

            } catch (error) {

                showMessage(
                    error.message
                );

            } finally {

                resetButton(
                    button
                );


                button.disabled =
                    true;
            }
        }
    );


/* ============================================================
   SAVE MERCHANT SESSION
============================================================ */

function saveMerchantSession(
    data
) {

    if (
        data?.access_token
    ) {

        sessionStorage.setItem(
            "sbp_access_token",
            data.access_token
        );
    }


    if (
        data?.refresh_token
    ) {

        sessionStorage.setItem(
            "sbp_refresh_token",
            data.refresh_token
        );
    }


    if (
        data?.expires_at
    ) {

        sessionStorage.setItem(
            "sbp_expires_at",
            String(
                data.expires_at
            )
        );
    }


    if (
        data?.merchant
    ) {

        sessionStorage.setItem(
            "sbp_merchant",
            JSON.stringify(
                data.merchant
            )
        );
    }
}

/* ============================================================
   SIGN-IN TWO-STATE FLOW
   Email → Continue → Password → Sign in
============================================================ */

const signinState = {
    email: ""
};

const signinEmailStep = $("#signinEmailStep");
const signinPasswordStep = $("#signinPasswordStep");
const signinEmailForm = $("#signinEmailForm");
const signinForm = $("#signinForm");
const signinEmailInput = $("#signinEmail");
const signinPasswordInput = $("#signinPassword");
const signinEmailDisplay = $("#signinEmailDisplay");

function showSigninState(stateName) {
    const showEmail = stateName === "email";

    if (signinEmailStep) {
        signinEmailStep.hidden = !showEmail;
        signinEmailStep.classList.toggle("active", showEmail);
    }

    if (signinPasswordStep) {
        signinPasswordStep.hidden = showEmail;
        signinPasswordStep.classList.toggle("active", !showEmail);
    }

    clearMessage();

    const target = showEmail
        ? signinEmailInput
        : signinPasswordInput;

    setTimeout(() => target?.focus(), 120);
}

signinEmailForm?.addEventListener("submit", event => {
    event.preventDefault();
    event.stopPropagation();

    const email = normalizeEmail(
        signinEmailInput?.value
    );

    if (!validEmail(email)) {
        setFieldState(
            signinEmailInput,
            false,
            true
        );

        shake(signinEmailInput);
        showMessage("Enter a valid business email.");
        signinEmailInput?.focus();
        return;
    }

    setFieldState(
        signinEmailInput,
        true
    );

    signinState.email = email;

    if (signinEmailInput) {
        signinEmailInput.value = email;
    }

    if (signinEmailDisplay) {
        signinEmailDisplay.textContent = email;
    }

    showSigninState("password");
});

$("#signinBackToEmail")?.addEventListener(
    "click",
    () => {
        if (signinPasswordInput) {
            signinPasswordInput.value = "";
        }

        showSigninState("email");
    }
);

$("#signinForgotFromEmail")?.addEventListener(
    "click",
    () => {
        $("#forgotPasswordLink")?.click();
    }
);

$("#signinForgotLink")?.addEventListener(
    "click",
    () => {
        $("#forgotPasswordLink")?.click();
    }
);

/* ============================================================
   AUTH API
============================================================ */

const authApiBase =
    String(
        window.SQUASHBERRYPAY_API_BASE ||
        ""
    ).replace(
        /\/+$/,
        ""
    );

function authApiUrl(path) {
    return authApiBase + path;
}

async function authRequest(
    path,
    options = {}
) {
    let response;

    try {
        response = await fetch(
            authApiUrl(path),
            {
                ...options,
                headers: {
                    "Content-Type":
                        "application/json",
                    ...(options.headers || {})
                }
            }
        );
    } catch {
        throw new Error(
            "We couldn't reach SquashberryPay right now. Check your connection and try again."
        );
    }

    let data = {};

    try {
        data = await response.json();
    } catch {
        data = {};
    }

    if (!response.ok) {
        throw new Error(
            data.error ||
            "Something went wrong. Please try again."
        );
    }

    return data;
}


/* ============================================================
   SIGN-IN SUCCESS TARGET
============================================================ */

const signinSuccess =
    $("#signinSuccess");


function hideSignin() {
    if (signinEmailStep) {
        signinEmailStep.hidden =
            true;
        signinEmailStep.classList.remove(
            "active"
        );
    }

    if (signinPasswordStep) {
        signinPasswordStep.hidden =
            true;
        signinPasswordStep.classList.remove(
            "active"
        );
    }
}


/* ============================================================
   NORMAL SIGN-IN SUBMIT
============================================================ */

signinForm?.addEventListener(
    "submit",
    async event => {
        event.preventDefault();
        event.stopPropagation();

        if (signinState.busy) {
            return;
        }

        const email =
            normalizeEmail(
                signinState.email ||
                signinEmailInput?.value
            );

        const password =
            String(
                signinPasswordInput?.value ||
                ""
            );

        if (!validEmail(email)) {
            showSigninState("email");

            setFieldState(
                signinEmailInput,
                false,
                true
            );

            shake(
                signinEmailInput
            );

            showMessage(
                "Enter a valid business email."
            );

            signinEmailInput?.focus();
            return;
        }

        if (!password) {
            setFieldState(
                signinPasswordInput,
                false,
                true
            );

            shake(
                signinPasswordInput
            );

            showMessage(
                "Enter your password."
            );

            signinPasswordInput?.focus();
            return;
        }

        signinState.busy =
            true;

        clearMessage();

        const button =
            $("#signinButton");

        setButtonLoading(
            button,
            "Signing in…"
        );

        try {
            const data =
                await authRequest(
                    "/api/public/auth/login",
                    {
                        method:
                            "POST",
                        body:
                            JSON.stringify({
                                email,
                                password
                            })
                    }
                );

            saveMerchantSession(
                data
            );

            showMessage(
                "Signed in successfully.",
                "success"
            );

            hideSignin();

            if (signinSuccess) {
                signinSuccess.hidden =
                    false;
            }

            window.setTimeout(
                () => {
                    window.location.href =
                        "./merchant.html";
                },
                650
            );

        } catch (error) {
            console.error(
                "Sign-in error:",
                error
            );

            setFieldState(
                signinPasswordInput,
                false,
                true
            );

            shake(
                signinPasswordInput
            );

            showMessage(
                error?.message ||
                "We couldn't sign you in. Please try again."
            );

            signinPasswordInput?.focus();

        } finally {
            signinState.busy =
                false;

            resetButton(
                button
            );
        }
    }
);


/* ============================================================
   PASSWORD RESET
============================================================ */

const resetState = {
    email: "",
    resetTicket: "",
    busy: false
};

const resetEmailStep =
    $("#resetEmailStep");

const resetOtpStep =
    $("#resetOtpStep");

const resetPasswordStep =
    $("#resetPasswordStep");

const resetSuccess =
    $("#resetSuccess");

const resetEmailInput =
    $("#resetEmail");

const resetEmailDisplay =
    $("#resetEmailDisplay");

const sendResetButton =
    $("#sendResetButton");

const verifyResetOtpButton =
    $("#verifyResetOtpButton");

const resendResetButton =
    $("#resendResetButton");

const resetOtpContainer =
    $("#resetOtpContainer");

const resetResendTimer =
    $("#resetResendTimer");

const newPasswordInput =
    $("#newPassword");

const confirmNewPasswordInput =
    $("#confirmNewPassword");

const saveNewPasswordButton =
    $("#saveNewPasswordButton");

let resetOtpInputs = [];

let resetResendInterval =
    null;


function showResetState(
    name
) {
    [
        resetEmailStep,
        resetOtpStep,
        resetPasswordStep,
        resetSuccess
    ].forEach(
        element => {
            if (element) {
                element.hidden =
                    true;
                element.classList.remove(
                    "active"
                );
            }
        }
    );

    const target = {
        email:
            resetEmailStep,
        otp:
            resetOtpStep,
        password:
            resetPasswordStep,
        success:
            resetSuccess
    }[name];

    if (target) {
        target.hidden =
            false;

        target.classList.remove(
            "state-enter"
        );

        void target.offsetWidth;

        target.classList.add(
            "active",
            "state-enter"
        );
    }

    clearMessage();

    if (
        name === "email"
    ) {
        window.setTimeout(
            () =>
                resetEmailInput?.focus(),
            120
        );
    }

    if (
        name === "password"
    ) {
        window.setTimeout(
            () =>
                newPasswordInput?.focus(),
            120
        );
    }
}


function createResetOtpInputs() {
    if (!resetOtpContainer) {
        return;
    }

    resetOtpContainer.innerHTML =
        "";

    resetOtpInputs = [];

    for (
        let i = 0;
        i < state.otpLength;
        i++
    ) {
        const input =
            document.createElement(
                "input"
            );

        input.type =
            "text";

        input.inputMode =
            "numeric";

        input.maxLength =
            1;

        input.className =
            "otp-digit";

        input.autocomplete =
            i === 0
                ? "one-time-code"
                : "off";

        input.setAttribute(
            "aria-label",
            "Reset code digit " +
            (i + 1)
        );

        input.addEventListener(
            "input",
            () => {
                input.value =
                    input.value
                        .replace(
                            /\D/g,
                            ""
                        )
                        .slice(
                            0,
                            1
                        );

                input.classList.toggle(
                    "filled",
                    Boolean(
                        input.value
                    )
                );

                const index =
                    resetOtpInputs.indexOf(
                        input
                    );

                if (
                    input.value &&
                    resetOtpInputs[
                        index + 1
                    ]
                ) {
                    resetOtpInputs[
                        index + 1
                    ].focus();
                }

                updateResetOtpButton();
            }
        );

        input.addEventListener(
            "keydown",
            event => {
                const index =
                    resetOtpInputs.indexOf(
                        input
                    );

                if (
                    event.key ===
                        "Backspace" &&
                    !input.value &&
                    resetOtpInputs[
                        index - 1
                    ]
                ) {
                    resetOtpInputs[
                        index - 1
                    ].focus();
                }

                if (
                    event.key ===
                        "Enter"
                ) {
                    event.preventDefault();
                    verifyResetOtp();
                }
            }
        );

        input.addEventListener(
            "paste",
            event => {
                event.preventDefault();

                const pasted =
                    (
                        event.clipboardData
                            ?.getData(
                                "text"
                            ) ||
                        ""
                    )
                        .replace(
                            /\D/g,
                            ""
                        )
                        .slice(
                            0,
                            state.otpLength
                        );

                pasted
                    .split("")
                    .forEach(
                        (
                            digit,
                            index
                        ) => {
                            if (
                                resetOtpInputs[
                                    index
                                ]
                            ) {
                                resetOtpInputs[
                                    index
                                ].value =
                                    digit;

                                resetOtpInputs[
                                    index
                                ].classList.add(
                                    "filled"
                                );
                            }
                        }
                    );

                const target =
                    resetOtpInputs[
                        Math.min(
                            pasted.length,
                            state.otpLength - 1
                        )
                    ];

                target?.focus();

                updateResetOtpButton();

                if (
                    pasted.length ===
                    state.otpLength
                ) {
                    verifyResetOtp();
                }
            }
        );

        resetOtpContainer.appendChild(
            input
        );

        resetOtpInputs.push(
            input
        );
    }

    updateResetOtpButton();
}


function getResetOtp() {
    return resetOtpInputs
        .map(
            input =>
                input.value
        )
        .join("");
}


function updateResetOtpButton() {
    if (!verifyResetOtpButton) {
        return;
    }

    verifyResetOtpButton.disabled =
        getResetOtp().length !==
        state.otpLength;
}


function startResetResendTimer(
    seconds
) {
    clearInterval(
        resetResendInterval
    );

    let remaining =
        seconds;

    if (resendResetButton) {
        resendResetButton.disabled =
            true;
    }

    const tick = () => {
        if (resetResendTimer) {
            resetResendTimer.textContent =
                String(
                    Math.max(
                        remaining,
                        0
                    )
                ) + "s";
        }

        if (remaining <= 0) {
            clearInterval(
                resetResendInterval
            );

            if (resendResetButton) {
                resendResetButton.disabled =
                    false;
            }

            return;
        }

        remaining -=
            1;
    };

    tick();

    resetResendInterval =
        window.setInterval(
            tick,
            1000
        );
}


async function sendPasswordResetOtp() {
    if (resetState.busy) {
        return;
    }

    resetState.busy =
        true;

    clearMessage();

    setButtonLoading(
        sendResetButton,
        "Sending code…"
    );

    try {
        const email =
            normalizeEmail(
                resetEmailInput?.value
            );

        if (!validEmail(email)) {
            setFieldState(
                resetEmailInput,
                false,
                true
            );

            shake(
                resetEmailInput
            );

            showMessage(
                "Enter a valid business email."
            );

            resetEmailInput?.focus();
            return;
        }

        resetState.email =
            email;

        if (resetEmailInput) {
            resetEmailInput.value =
                email;
        }

        if (resetEmailDisplay) {
            resetEmailDisplay.textContent =
                email;
        }

        await authRequest(
            "/api/public/auth/forgot-password/send-otp",
            {
                method:
                    "POST",
                body:
                    JSON.stringify({
                        email
                    })
            }
        );

        createResetOtpInputs();

        startResetResendTimer(
            60
        );

        hideSignin();

        showResetState(
            "otp"
        );

        showMessage(
            "If an account exists for this email, a reset code has been sent.",
            "success"
        );

        window.setTimeout(
            () =>
                resetOtpInputs[0]?.focus(),
            120
        );

    } catch (error) {
        console.error(
            "Password reset send error:",
            error
        );

        showMessage(
            error?.message ||
            "We couldn't send the reset code right now."
        );

        shake(
            sendResetButton
        );

    } finally {
        resetState.busy =
            false;

        resetButton(
            sendResetButton
        );
    }
}


async function verifyResetOtp() {
    if (
        resetState.busy
    ) {
        return;
    }

    const token =
        getResetOtp();

    if (
        token.length !==
        state.otpLength
    ) {
        showMessage(
            "Enter the complete 6-digit reset code."
        );

        return;
    }

    resetState.busy =
        true;

    clearMessage();

    setButtonLoading(
        verifyResetOtpButton,
        "Verifying…"
    );

    try {
        const data =
            await authRequest(
                "/api/public/auth/forgot-password/check-otp",
                {
                    method:
                        "POST",
                    body:
                        JSON.stringify({
                            email:
                                resetState.email,
                            token
                        })
                }
            );

        resetState.resetTicket =
            data.reset_ticket ||
            "";

        if (!resetState.resetTicket) {
            throw new Error(
                "We couldn't create a reset session. Please request a new code."
            );
        }

        hideSignin();

        showResetState(
            "password"
        );

        showMessage(
            "Code verified. Create your new password.",
            "success"
        );

    } catch (error) {
        console.error(
            "Password reset OTP error:",
            error
        );

        shake(
            resetOtpContainer
        );

        showMessage(
            error?.message ||
            "That reset code is invalid or expired."
        );

    } finally {
        resetState.busy =
            false;

        resetButton(
            verifyResetOtpButton
        );

        updateResetOtpButton();
    }
}


sendResetButton?.addEventListener(
    "click",
    () => {
        sendPasswordResetOtp();
    }
);

verifyResetOtpButton?.addEventListener(
    "click",
    () => {
        verifyResetOtp();
    }
);

resendResetButton?.addEventListener(
    "click",
    () => {
        if (
            resetState.busy ||
            resendResetButton.disabled
        ) {
            return;
        }

        resetEmailInput.value =
            resetState.email;

        sendPasswordResetOtp();
    }
);


saveNewPasswordButton?.addEventListener(
    "click",
    async () => {
        if (resetState.busy) {
            return;
        }

        const password =
            String(
                newPasswordInput?.value ||
                ""
            );

        const confirm =
            String(
                confirmNewPasswordInput?.value ||
                ""
            );

        if (password.length < 8) {
            setFieldState(
                newPasswordInput,
                false,
                true
            );

            shake(
                newPasswordInput
            );

            showMessage(
                "Your new password must contain at least 8 characters."
            );

            newPasswordInput?.focus();
            return;
        }

        if (password !== confirm) {
            setFieldState(
                confirmNewPasswordInput,
                false,
                true
            );

            shake(
                confirmNewPasswordInput
            );

            showMessage(
                "Your new passwords do not match."
            );

            confirmNewPasswordInput?.focus();
            return;
        }

        if (!resetState.resetTicket) {
            showMessage(
                "Your password reset session has expired. Start again."
            );

            showResetState(
                "email"
            );

            hideSignin();

            return;
        }

        resetState.busy =
            true;

        clearMessage();

        setButtonLoading(
            saveNewPasswordButton,
            "Updating password…"
        );

        try {
            await authRequest(
                "/api/public/auth/forgot-password/reset",
                {
                    method:
                        "POST",
                    body:
                        JSON.stringify({
                            reset_ticket:
                                resetState.resetTicket,
                            new_password:
                                password
                        })
                }
            );

            resetState.resetTicket =
                "";

            newPasswordInput.value =
                "";

            confirmNewPasswordInput.value =
                "";

            hideSignin();

            showResetState(
                "success"
            );

            window.setTimeout(
                () => {
                    showResetState(
                        "hidden"
                    );

                    signinState.email =
                        resetState.email;

                    signinEmailInput.value =
                        resetState.email;

                    signinEmailDisplay.textContent =
                        resetState.email;

                    showSigninState(
                        "email"
                    );

                    showMessage(
                        "Password updated. Sign in with your new password.",
                        "success"
                    );
                },
                1100
            );

        } catch (error) {
            console.error(
                "Password reset update error:",
                error
            );

            showMessage(
                error?.message ||
                "We couldn't update your password right now."
            );

            shake(
                saveNewPasswordButton
            );

        } finally {
            resetState.busy =
                false;

            resetButton(
                saveNewPasswordButton
            );
        }
    }
);


/* ============================================================
   FORGOT PASSWORD LINKS
============================================================ */

function openResetFromSignIn() {
    if (signinState.busy) {
        return;
    }

    resetState.email =
        normalizeEmail(
            signinState.email ||
            signinEmailInput?.value
        );

    if (
        resetState.email &&
        resetEmailInput
    ) {
        resetEmailInput.value =
            resetState.email;
    }

    if (
        resetState.email &&
        resetEmailDisplay
    ) {
        resetEmailDisplay.textContent =
            resetState.email;
    }

    hideSignin();

    showResetState(
        "email"
    );
}

$("#signinForgotFromEmail")?.addEventListener(
    "click",
    openResetFromSignIn
);

$("#signinForgotLink")?.addEventListener(
    "click",
    openResetFromSignIn
);

document
    .querySelectorAll(
        "[data-reset-back]"
    )
    .forEach(
        button => {
            button.addEventListener(
                "click",
                () => {
                    const destination =
                        button.dataset.resetBack;

                    if (
                        destination ===
                        "signin"
                    ) {
                        showResetState(
                            "hidden"
                        );

                        showSigninState(
                            "email"
                        );

                        return;
                    }

                    if (
                        destination ===
                        "reset-email"
                    ) {
                        showResetState(
                            "email"
                        );

                        hideSignin();

                        return;
                    }

                    if (
                        destination ===
                        "reset-otp"
                    ) {
                        showResetState(
                            "otp"
                        );

                        hideSignin();
                    }
                }
            );
        }
    );


/* ============================================================
   AUTH INITIAL STATE
============================================================ */

showResetState(
    "hidden"
);

showSigninState(
    "email"
);



/* ============================================================
   INITIAL STATE
============================================================ */

showSignupStep(
    1
);