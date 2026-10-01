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


        submitButton.disabled =
            true;

        submitButton.textContent =
            "Submitting…";


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

            submitButton.disabled =
                false;

            submitButton.textContent =
                "Submit application";
        }

    }
);