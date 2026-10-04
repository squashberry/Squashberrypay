"use strict";

const form =
    document.querySelector(
        "#applicationForm"
    );

const submitButton =
    document.querySelector(
        "#submitApplication"
    );

const formMessage =
    document.querySelector(
        "#formMessage"
    );

const successCard =
    document.querySelector(
        "#successCard"
    );


form.addEventListener(
    "submit",
    async event => {

        event.preventDefault();


        const originalSubmitHtml = submitButton.innerHTML;
        submitButton.disabled = true;
        submitButton.classList.add("is-loading");
        submitButton.innerHTML =
            '<span class="spinner" aria-hidden="true"></span><span>Submitting…</span>';


        formMessage.textContent =
            "";


        const payload = {
            business_name:
                document
                    .querySelector(
                        "#businessName"
                    )
                    .value
                    .trim(),

            business_type:
                document
                    .querySelector(
                        "#businessType"
                    )
                    .value
                    .trim(),

            website_or_app_url:
                document
                    .querySelector(
                        "#website"
                    )
                    .value
                    .trim(),

            email:
                document
                    .querySelector(
                        "#email"
                    )
                    .value
                    .trim(),

            phone:
                document
                    .querySelector(
                        "#phone"
                    )
                    .value
                    .trim(),

            description:
                document
                    .querySelector(
                        "#description"
                    )
                    .value
                    .trim()
        };


        try {

            const response =
                await fetch(
                    "/api/public/apply",
                    {
                        method:
                            "POST",

                        headers: {
                            "Content-Type":
                                "application/json"
                        },

                        body:
                            JSON.stringify(
                                payload
                            )
                    }
                );


            const data =
                await response.json();


            if (!response.ok) {
                throw new Error(
                    data.error ||
                    "Unable to submit application."
                );
            }


            form.hidden =
                true;

            successCard.hidden =
                false;


        } catch (error) {

            formMessage.textContent =
                error.message;

        } finally {

            submitButton.disabled = false;
            submitButton.classList.remove("is-loading");
            submitButton.innerHTML = originalSubmitHtml;
        }

    }
);