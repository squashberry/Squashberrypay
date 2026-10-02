"use strict";

(function () {

    const currentScript =
        document.currentScript;

    const baseUrl =
        currentScript
            ? new URL(
                currentScript.src
            ).origin
            : window.location.origin;

    const defaultButtonLabel =
        "Pay Now";

    const renderedScripts =
        new WeakSet();

    function checkoutUrl(
        slug,
        options
    ) {

        const url =
            new URL(
                "/checkout/" +
                encodeURIComponent(
                    String(
                        slug ||
                        ""
                    )
                ),
                baseUrl
            );

        const config =
            options ||
            {};

        if (
            config.amount !==
                undefined &&
            config.amount !==
                null &&
            config.amount !==
                ""
        ) {

            url.searchParams.set(
                "amount",
                String(
                    config.amount
                )
            );
        }

        return url.toString();
    }


    function open(
        slug,
        options
    ) {

        if (
            !slug
        ) {
            return;
        }

        const config =
            options ||
            {};

        const target =
            config.target ===
                "_blank"
                ? "_blank"
                : "_self";

        const url =
            checkoutUrl(
                slug,
                config
            );

        if (
            target ===
                "_blank"
        ) {

            window.open(
                url,
                "_blank",
                "noopener,noreferrer"
            );

            return;
        }

        window.location.href =
            url;
    }


    function injectExactButtonStyles(
        shadow
    ) {

        const style =
            document.createElement(
                "style"
            );

        style.textContent =
            `
:host {
    display:
        inline-block;

    max-width:
        100%;

    font-family:
        -apple-system,
        BlinkMacSystemFont,
        "Segoe UI",
        sans-serif;
}

.wrap {
    display:
        inline-block;

    width:
        auto;

    max-width:
        100%;
}

button {
    appearance:
        none;

    -webkit-appearance:
        none;

    box-sizing:
        border-box;

    display:
        inline-flex;

    align-items:
        center;

    justify-content:
        center;

    gap:
        10px;

    min-width:
        210px;

    height:
        48px;

    padding:
        0 20px;

    border:
        0;

    border-radius:
        999px;

    background:
        #111111;

    color:
        #ffffff;

    font:
        800 14px/1
        -apple-system,
        BlinkMacSystemFont,
        "Segoe UI",
        sans-serif;

    letter-spacing:
        -.05px;

    cursor:
        pointer;

    box-shadow:
        inset 0 0 0 1px rgba(255,255,255,.10),
        0 5px 16px rgba(0,0,0,.15);

    transition:
        transform .16s ease,
        box-shadow .16s ease,
        opacity .16s ease;

    white-space:
        nowrap;
}

button:hover {
    transform:
        translateY(-1px);

    box-shadow:
        inset 0 0 0 1px rgba(255,255,255,.13),
        0 8px 22px rgba(0,0,0,.20);
}

button:focus-visible {
    outline:
        3px solid rgba(17,17,17,.20);

    outline-offset:
        4px;
}

button:active {
    transform:
        translateY(0);
}

button:disabled {
    cursor:
        wait;

    opacity:
        .66;

    transform:
        none;
}

.logo {
    width:
        24px;

    height:
        24px;

    flex:
        0 0 24px;

    display:
        grid;

    place-items:
        center;

    border-radius:
        8px;

    background:
        #ffffff;

    color:
        #111111;

    font:
        900 11px/1
        -apple-system,
        BlinkMacSystemFont,
        "Segoe UI",
        sans-serif;
}

.spinner {
    width:
        15px;

    height:
        15px;

    border:
        2px solid
        rgba(255,255,255,.32);

    border-top-color:
        #ffffff;

    border-radius:
        50%;

    animation:
        spin .7s linear infinite;
}

@keyframes spin {
    to {
        transform:
            rotate(360deg);
    }
}

@media (prefers-reduced-motion: reduce) {
    button {
        transition:
            none;
    }

    .spinner {
        animation:
            none;
    }
}
`;

        shadow.appendChild(
            style
        );
    }


    function createExactButton(
        slug,
        options
    ) {

        const config =
            options ||
            {};

        const host =
            document.createElement(
                "span"
            );

        host.setAttribute(
            "data-squashberrypay-rendered",
            "true"
        );

        const shadow =
            host.attachShadow({
                mode:
                    "closed"
            });

        injectExactButtonStyles(
            shadow
        );

        const wrap =
            document.createElement(
                "span"
            );

        wrap.className =
            "wrap";

        const button =
            document.createElement(
                "button"
            );

        button.type =
            "button";

        button.setAttribute(
            "aria-label",
            defaultButtonLabel
        );

        button.innerHTML =
            `
                <span
                    class="logo"
                    aria-hidden="true"
                >S</span>

                <span
                    class="label"
                >Pay Now</span>
            `;

        wrap.appendChild(
            button
        );

        shadow.appendChild(
            wrap
        );

        let amount =
            config.amount;

        let label =
            defaultButtonLabel;

        let ready =
            false;

        function setLabel(
            value
        ) {

            label =
                String(
                    value ||
                    defaultButtonLabel
                );

            const node =
                shadow.querySelector(
                    ".label"
                );

            if (
                node
            ) {
                node.textContent =
                    label;
            }

            button.setAttribute(
                "aria-label",
                label
            );
        }

        setLabel(
            defaultButtonLabel
        );

        button.addEventListener(
            "click",
            function () {

                if (
                    !ready
                ) {

                    return;
                }

                button.disabled =
                    true;

                button.innerHTML =
                    `
                        <span
                            class="spinner"
                            aria-hidden="true"
                        ></span>

                        <span>
                            Opening checkout…
                        </span>
                    `;

                setTimeout(
                    function () {

                        open(
                            slug,
                            {
                                amount
                            }
                        );

                    },
                    30
                );
            }
        );

        fetch(
            "/api/public/links/" +
            encodeURIComponent(
                String(
                    slug ||
                    ""
                )
            )
        )
            .then(
                response => {

                    if (
                        !response.ok
                    ) {
                        throw new Error(
                            "Unavailable"
                        );
                    }

                    return response.json();
                }
            )
            .then(
                data => {

                    const link =
                        data.payment_link;

                    if (
                        !link
                    ) {
                        throw new Error(
                            "Unavailable"
                        );
                    }

                    const product =
                        link.product ||
                        {};

                    if (
                        (
                            product.payment_type ===
                                "donate" &&
                            product.allow_custom_amount
                        ) &&
                        (
                            amount ===
                                undefined ||
                            amount ===
                                null ||
                            amount ===
                                ""
                        )
                    ) {

                        amount =
                            undefined;
                    }

                    setLabel(
                        link.button_label ||
                        (
                            product.payment_type ===
                                "subscribe"
                                ? "Subscribe"
                                : product.payment_type ===
                                    "donate"
                                    ? "Donate"
                                    : defaultButtonLabel
                        )
                    );

                    ready =
                        true;

                }
            )
            .catch(
                function () {

                    button.disabled =
                        true;

                    setLabel(
                        "Payment unavailable"
                    );
                }
            );

        return host;
    }


    function renderButton(
        target,
        slug,
        options
    ) {

        if (
            !target ||
            !slug
        ) {
            return null;
        }

        const button =
            createExactButton(
                slug,
                options
            );

        target.replaceChildren(
            button
        );

        return button;
    }


    function renderScript(
        script
    ) {

        if (
            !script ||
            renderedScripts.has(
                script
            )
        ) {

            return;
        }

        const slug =
            script.getAttribute(
                "data-squashberrypay-button"
            );

        if (
            !slug
        ) {
            return;
        }

        renderedScripts.add(
            script
        );

        const mount =
            document.createElement(
                "span"
            );

        mount.style.display =
            "inline-block";

        mount.style.maxWidth =
            "100%";

        const amount =
            script.getAttribute(
                "data-squashberrypay-amount"
            );

        const options = {
            amount:
                amount ||
                undefined
        };

        script.parentNode.insertBefore(
            mount,
            script.nextSibling
        );

        renderButton(
            mount,
            slug,
            options
        );
    }


    function renderAllScripts() {

        document
            .querySelectorAll(
                "script[data-squashberrypay-button]"
            )
            .forEach(
                renderScript
            );
    }


    function upgradeExistingButtons() {

        document
            .querySelectorAll(
                "[data-squashberrypay]"
            )
            .forEach(
                element => {

                    if (
                        element.dataset
                            .squashberrypayUpgraded ===
                        "true"
                    ) {
                        return;
                    }

                    const slug =
                        element.getAttribute(
                            "data-squashberrypay"
                        );

                    if (
                        !slug
                    ) {
                        return;
                    }

                    element.dataset
                        .squashberrypayUpgraded =
                        "true";

                    element.addEventListener(
                        "click",
                        function (
                            event
                        ) {

                            event.preventDefault();

                            open(
                                slug,
                                {
                                    amount:
                                        element.getAttribute(
                                            "data-squashberrypay-amount"
                                        ),
                                    target:
                                        element.getAttribute(
                                            "data-squashberrypay-target"
                                        )
                                }
                            );
                        }
                    );
                }
            );
    }


    const api =
        {
            version:
                "2.0.0",

            url:
                checkoutUrl,

            open,

            render:
                renderButton
        };

    window.SquashberryPay =
        api;


    function boot() {

        renderAllScripts();

        upgradeExistingButtons();

        if (
            window.MutationObserver
        ) {

            const observer =
                new MutationObserver(
                    function () {

                        renderAllScripts();

                        upgradeExistingButtons();

                    }
                );

            observer.observe(
                document.documentElement,
                {
                    childList:
                        true,
                    subtree:
                        true
                }
            );
        }
    }


    if (
        document.readyState ===
            "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            boot,
            {
                once:
                    true
            }
        );

    } else {

        boot();
    }

})();
