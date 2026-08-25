import {
    createSite
} from "./data.js";


// ========================================
// Create Site Form
// ========================================

document
    .getElementById("create-site-form")
    .addEventListener("submit", async (event) => {

        event.preventDefault();

        const siteCode =
            document
                .getElementById("site-code")
                .value
                .trim();

        const description =
            document
                .getElementById("site-description")
                .value
                .trim();


        await createSite(
            siteCode,
            description
        );


        window.location.href =
            "index.html";
    });