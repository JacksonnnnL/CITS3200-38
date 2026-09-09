import {
    createSite,
    DuplicateSiteCodeError,
    ValidationError
} from "./data.js";

const form =
    document.getElementById("create-site-form");

const siteCodeInput =
    document.getElementById("site-code");

const descriptionInput =
    document.getElementById("site-description");

const siteCodeError =
    document.getElementById("site-code-error");

function showSiteCodeError(message) {
    siteCodeError.textContent = message;
}

function clearSiteCodeError() {
    siteCodeError.textContent = "";
}

siteCodeInput.addEventListener(
    "input",
    clearSiteCodeError
);

form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const code =
        siteCodeInput.value.trim();

    const description =
        descriptionInput.value.trim();

    if (!code) {
        showSiteCodeError(
            "Site Code is required"
        );

        siteCodeInput.focus();
        return;
    }

    try {
        await createSite({
            code,
            description
        });

        window.location.href =
            "index.html";

    } catch (error) {
        if (error instanceof DuplicateSiteCodeError) {
            showSiteCodeError(
                "Site Code already exists"
            );

            siteCodeInput.focus();
            return;
        }

        if (error instanceof ValidationError) {
            showSiteCodeError(
                error.message
            );

            siteCodeInput.focus();
            return;
        }

        console.error(
            "Failed to create site:",
            error
        );

        window.alert(
            "The site could not be created."
        );
    }
});