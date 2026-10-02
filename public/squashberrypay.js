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

    function checkoutUrl(
        slug,
        options
    ) {
        const url =
            new URL(
                "/checkout/" +
                encodeURIComponent(
                    slug
                ),
                baseUrl
            );

        const config =
            options || {};

        if (
            config.amount !==
                undefined &&
            config.amount !==
                null
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
        if (!slug) {
            return;
        }

        const config =
            options || {};

        const target =
            config.target === "_blank"
                ? "_blank"
                : "_self";

        if (target === "_blank") {
            window.open(
                checkoutUrl(
                    slug,
                    config
                ),
                "_blank",
                "noopener,noreferrer"
            );
            return;
        }

        window.location.href =
            checkoutUrl(
                slug,
                config
            );
    }

    document.addEventListener(
        "click",
        function (event) {
            const element =
                event.target.closest(
                    "[data-squashberrypay]"
                );

            if (!element) {
                return;
            }

            const slug =
                element.getAttribute(
                    "data-squashberrypay"
                );

            if (!slug) {
                return;
            }

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
        },
        false
    );

    window.SquashberryPay = {
        version:
            "1.0.0",
        url:
            checkoutUrl,
        open
    };
})();
