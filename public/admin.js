"use strict";


const $ =
    selector =>
        document.querySelector(
            selector
        );


const loginSection =
    $("#loginSection");

const dashboardSection =
    $("#dashboardSection");

const loginButton =
    $("#loginButton");

const logoutButton =
    $("#logoutButton");


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
            <span class="spinner"></span>
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
                credentials:
                    "same-origin",

                ...options
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

        throw new Error(
            data.error ||
            "Request failed."
        );
    }


    return data;
}


/* ============================================================
   LOGIN
============================================================ */

loginButton
    .addEventListener(
        "click",
        async () => {

            const username =
                $("#username")
                    .value
                    .trim();


            const password =
                $("#password")
                    .value;


            if (
                !username ||
                !password
            ) {

                loginButton.classList.add(
                    "error-shake"
                );


                setTimeout(
                    () => {
                        loginButton.classList.remove(
                            "error-shake"
                        );
                    },
                    450
                );


                return;
            }


            setLoading(
                loginButton,
                "Signing in…"
            );


            try {

                await api(
                    "/api/admin/login",
                    {
                        method:
                            "POST",

                        headers: {
                            "Content-Type":
                                "application/json"
                        },

                        body:
                            JSON.stringify({
                                username,
                                password
                            })
                    }
                );


                loginSection.hidden =
                    true;

                dashboardSection.hidden =
                    false;


                dashboardSection.classList.add(
                    "state-enter"
                );


                loadPayments();

            } catch (error) {

                loginButton.classList.add(
                    "error-shake"
                );


                alert(
                    error.message
                );


            } finally {

                setTimeout(
                    () => {
                        loginButton.classList.remove(
                            "error-shake"
                        );
                    },
                    450
                );


                resetButton(
                    loginButton
                );
            }
        }
    );


/* ============================================================
   LOGOUT
============================================================ */

logoutButton
    .addEventListener(
        "click",
        async () => {

            setLoading(
                logoutButton,
                "Signing out…"
            );


            try {

                await api(
                    "/api/admin/logout",
                    {
                        method:
                            "POST"
                    }
                );

            } finally {

                window.location.href =
                    "/";
            }
        }
    );


/* ============================================================
   TABS
============================================================ */

document
    .querySelectorAll(
        "[data-tab]"
    )
    .forEach(
        button => {

            button.addEventListener(
                "click",
                () => {

                    document
                        .querySelectorAll(
                            "[data-tab]"
                        )
                        .forEach(
                            item => {
                                item.classList.remove(
                                    "active"
                                );
                            }
                        );


                    button.classList.add(
                        "active"
                    );


                    [
                        "payments",
                        "applications",
                        "businesses"
                    ].forEach(
                        tab => {

                            const panel =
                                $(
                                    `#tab-${tab}`
                                );


                            if (
                                panel
                            ) {

                                panel.hidden =
                                    tab !==
                                    button.dataset.tab;


                                if (
                                    tab ===
                                    button.dataset.tab
                                ) {

                                    panel.classList.remove(
                                        "state-enter"
                                    );

                                    void panel.offsetWidth;

                                    panel.classList.add(
                                        "state-enter"
                                    );
                                }
                            }
                        }
                    );


                    if (
                        button.dataset.tab ===
                        "payments"
                    ) {
                        loadPayments();
                    }


                    if (
                        button.dataset.tab ===
                        "applications"
                    ) {
                        loadApplications();
                    }


                    if (
                        button.dataset.tab ===
                        "businesses"
                    ) {
                        loadBusinesses();
                    }
                }
            );
        }
    );


/* ============================================================
   PAYMENTS
============================================================ */

async function loadPayments() {

    const tbody =
        $("#paymentRows");


    tbody.innerHTML =
        `
            <tr>
                <td colspan="7">
                    Loading…
                </td>
            </tr>
        `;


    try {

        const data =
            await api(
                "/api/admin/payments"
            );


        renderPayments(
            data.payments || []
        );

    } catch (error) {

        tbody.innerHTML =
            `
                <tr>
                    <td colspan="7">
                        ${escapeHtml(
                            error.message
                        )}
                    </td>
                </tr>
            `;
    }
}


function renderPayments(
    payments
) {

    const tbody =
        $("#paymentRows");


    tbody.innerHTML =
        "";


    if (
        !payments.length
    ) {

        tbody.innerHTML =
            `
                <tr>
                    <td colspan="7">
                        No payments yet.
                    </td>
                </tr>
            `;

        return;
    }


    payments.forEach(
        (payment, index) => {

            const row =
                document.createElement(
                    "tr"
                );


            row.style.animationDelay =
                `${Math.min(
                    index * 25,
                    250
                )}ms`;


            row.innerHTML =
                `
                    <td>
                        ${escapeHtml(
                            payment.payment_reference
                        )}
                    </td>

                    <td>
                        ${escapeHtml(
                            payment.services
                                ?.merchant_profiles
                                ?.business_name ||
                            payment.services?.name ||
                            "—"
                        )}
                    </td>

                    <td>
                        ${escapeHtml(
                            payment.service_users
                                ?.email ||
                            "—"
                        )}
                    </td>

                    <td>
                        ${escapeHtml(
                            payment.currency
                        )}
                        ${Number(
                            payment.amount
                        ).toFixed(2)}
                    </td>

                    <td>
                        ${escapeHtml(
                            payment.payment_methods?.name ||
                            "—"
                        )}
                    </td>

                    <td>
                        <span
                            class="status ${escapeHtml(
                                payment.status
                            )}"
                        >
                            ${escapeHtml(
                                payment.status
                            )}
                        </span>
                    </td>

                    <td>

                        ${
                            payment.receipt_path
                                ? `
                                    <button
                                        class="small-button"
                                        data-receipt="${payment.id}"
                                    >
                                        Receipt
                                    </button>
                                `
                                : ""
                        }


                        ${
                            payment.status ===
                            "awaiting_verification"
                                ? `
                                    <button
                                        class="small-button approve"
                                        data-approve="${payment.id}"
                                    >
                                        Approve
                                    </button>

                                    <button
                                        class="small-button"
                                        data-reject="${payment.id}"
                                    >
                                        Reject
                                    </button>
                                `
                                : ""
                        }

                    </td>
                `;


            tbody.appendChild(
                row
            );
        }
    );
}


/* ============================================================
   PAYMENT ACTIONS
============================================================ */

document.addEventListener(
    "click",
    async event => {

        const approve =
            event.target.closest(
                "[data-approve]"
            );


        const reject =
            event.target.closest(
                "[data-reject]"
            );


        const receipt =
            event.target.closest(
                "[data-receipt]"
            );


        if (approve) {

            const confirmed =
                window.confirm(
                    "Approve this payment and send the one-time code to the customer?"
                );


            if (!confirmed) {
                return;
            }


            setLoading(
                approve,
                "Approving…"
            );


            try {

                const result =
                    await api(
                        `/api/admin/payments/${approve.dataset.approve}/approve`,
                        {
                            method:
                                "POST"
                        }
                    );


                alert(
                    result.message
                );


                loadPayments();

            } catch (error) {

                approve.classList.add(
                    "error-shake"
                );


                alert(
                    error.message
                );


                resetButton(
                    approve
                );
            }


            return;
        }


        if (reject) {

            const reason =
                window.prompt(
                    "Why are you rejecting this payment?"
                );


            if (
                reason ===
                null
            ) {
                return;
            }


            setLoading(
                reject,
                "Rejecting…"
            );


            try {

                await api(
                    `/api/admin/payments/${reject.dataset.reject}/reject`,
                    {
                        method:
                            "POST",

                        headers: {
                            "Content-Type":
                                "application/json"
                        },

                        body:
                            JSON.stringify({
                                reason
                            })
                    }
                );


                loadPayments();

            } catch (error) {

                alert(
                    error.message
                );

                resetButton(
                    reject
                );
            }


            return;
        }


        if (receipt) {

            try {

                const result =
                    await api(
                        `/api/admin/payments/${receipt.dataset.receipt}/receipt`
                    );


                window.open(
                    result.url,
                    "_blank",
                    "noopener,noreferrer"
                );

            } catch (error) {

                alert(
                    error.message
                );
            }
        }
    }
);


/* ============================================================
   APPLICATION APPROVAL QUEUE
============================================================ */

async function loadApplications() {

    const container =
        $("#applicationRows");


    container.innerHTML =
        `
            <p>
                Loading applications…
            </p>
        `;


    try {

        const data =
            await api(
                "/api/admin/applications"
            );


        renderApplications(
            data.applications || []
        );

    } catch (error) {

        container.innerHTML =
            `
                <p>
                    ${escapeHtml(
                        error.message
                    )}
                </p>
            `;
    }
}


function renderApplications(
    applications
) {

    const container =
        $("#applicationRows");


    container.innerHTML =
        "";


    if (
        !applications.length
    ) {

        container.innerHTML =
            `
                <div
                    class="application-card"
                >
                    <div>
                        <h3>
                            No applications
                        </h3>

                        <p>
                            There are currently no
                            registered applications.
                        </p>
                    </div>
                </div>
            `;

        return;
    }


    applications.forEach(
        (application, index) => {

            const card =
                document.createElement(
                    "article"
                );


            card.className =
                "application-card";


            card.style.animationDelay =
                `${index * 40}ms`;


            const business =
                application
                    .merchant_profiles
                    ?.business_name ||
                "Unknown business";


            const email =
                application
                    .merchant_profiles
                    ?.email ||
                "";


            const showApprove =
                application.status ===
                "pending";


            const showReject =
                application.status ===
                "pending";


            card.innerHTML =
                `
                    <div>

                        <div
                            style="
                                display:flex;
                                align-items:center;
                                gap:8px;
                            "
                        >

                            <h3>
                                ${escapeHtml(
                                    application.name
                                )}
                            </h3>

                            <span
                                class="status"
                            >
                                ${escapeHtml(
                                    application.status
                                )}
                            </span>

                        </div>


                        <p>
                            Business:
                            <strong>
                                ${escapeHtml(
                                    business
                                )}
                            </strong>
                        </p>


                        <p>
                            ${escapeHtml(
                                email
                            )}
                        </p>


                        <p>
                            ${escapeHtml(
                                application.website_url ||
                                "No website URL"
                            )}
                        </p>

                    </div>


                    <div
                        style="
                            display:flex;
                            gap:7px;
                            align-items:flex-start;
                        "
                    >

                        ${
                            showApprove
                                ? `
                                    <button
                                        class="small-button approve"
                                        data-application-approve="${application.id}"
                                    >
                                        Approve
                                    </button>
                                `
                                : ""
                        }


                        ${
                            showReject
                                ? `
                                    <button
                                        class="small-button"
                                        data-application-reject="${application.id}"
                                    >
                                        Reject
                                    </button>
                                `
                                : ""
                        }

                    </div>
                `;


            container.appendChild(
                card
            );
        }
    );
}


/* ============================================================
   APPROVE / REJECT APPLICATION
============================================================ */

document.addEventListener(
    "click",
    async event => {

        const approve =
            event.target.closest(
                "[data-application-approve]"
            );


        const reject =
            event.target.closest(
                "[data-application-reject]"
            );


        if (approve) {

            const confirmed =
                window.confirm(
                    "Approve this application? Its SquashberryPay credentials will become active."
                );


            if (!confirmed) {
                return;
            }


            setLoading(
                approve,
                "Approving…"
            );


            try {

                const result =
                    await api(
                        `/api/admin/applications/${approve.dataset.applicationApprove}/approve`,
                        {
                            method:
                                "POST"
                        }
                    );


                alert(
                    result.message
                );


                loadApplications();

                loadBusinesses();

            } catch (error) {

                alert(
                    error.message
                );


                resetButton(
                    approve
                );
            }


            return;
        }


        if (reject) {

            const confirmed =
                window.confirm(
                    "Reject this application?"
                );


            if (!confirmed) {
                return;
            }


            setLoading(
                reject,
                "Rejecting…"
            );


            try {

                await api(
                    `/api/admin/applications/${reject.dataset.applicationReject}/reject`,
                    {
                        method:
                            "POST"
                    }
                );


                loadApplications();

                loadBusinesses();

            } catch (error) {

                alert(
                    error.message
                );


                resetButton(
                    reject
                );
            }
        }
    }
);


/* ============================================================
   BUSINESSES / APPS
============================================================ */

async function loadBusinesses() {

    const tbody =
        $("#businessRows");


    tbody.innerHTML =
        `
            <tr>
                <td colspan="4">
                    Loading…
                </td>
            </tr>
        `;


    try {

        const data =
            await api(
                "/api/admin/applications"
            );


        const apps =
            data.applications || [];


        tbody.innerHTML =
            "";


        if (!apps.length) {

            tbody.innerHTML =
                `
                    <tr>
                        <td colspan="4">
                            No applications yet.
                        </td>
                    </tr>
                `;

            return;
        }


        apps.forEach(
            service => {

                const row =
                    document.createElement(
                        "tr"
                    );


                row.innerHTML =
                    `
                        <td>
                            ${escapeHtml(
                                service
                                    .merchant_profiles
                                    ?.business_name ||
                                "—"
                            )}
                        </td>

                        <td>
                            ${escapeHtml(
                                service.name
                            )}
                        </td>

                        <td>
                            ${escapeHtml(
                                service.website_url ||
                                "—"
                            )}
                        </td>

                        <td>
                            <span
                                class="status"
                            >
                                ${escapeHtml(
                                    service.status
                                )}
                            </span>
                        </td>
                    `;


                tbody.appendChild(
                    row
                );
            }
        );

    } catch (error) {

        tbody.innerHTML =
            `
                <tr>
                    <td colspan="4">
                        ${escapeHtml(
                            error.message
                        )}
                    </td>
                </tr>
            `;
    }
}


/* ============================================================
   AUTH CHECK
============================================================ */

async function checkAuth() {

    try {

        const result =
            await api(
                "/api/admin/me"
            );


        if (
            result.authenticated
        ) {

            loginSection.hidden =
                true;

            dashboardSection.hidden =
                false;

            dashboardSection.classList.add(
                "state-enter"
            );

            loadPayments();

        } else {

            loginSection.hidden =
                false;

            dashboardSection.hidden =
                true;
        }

    } catch {

        loginSection.hidden =
            false;

        dashboardSection.hidden =
            true;
    }
}


checkAuth();