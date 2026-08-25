import {
    createIndividual
} from "./data.js";


// ========================================
// Selected Site
// ========================================

const params =
    new URLSearchParams(window.location.search);

const siteId =
    params.get("siteId");

if (!siteId) {
    window.location.href = "index.html";
}

document
    .getElementById("back-to-site-link")
    .href =
        `site.html?siteId=${siteId}`;

// ========================================
// Create Individual Form
// ========================================

document
    .getElementById("create-individual-form")
    .addEventListener("submit", async (event) => {

        event.preventDefault();


        const accessionNumber =
            document
                .getElementById("accession-number")
                .value
                .trim();

        const contextGrave =
            document
                .getElementById("context-grave")
                .value
                .trim();

        const date =
            document
                .getElementById("individual-date")
                .value;

        const developmentalAge =
            document
                .getElementById("developmental-age")
                .value;

        const notes =
            document
                .getElementById("individual-notes")
                .value
                .trim();

        await createIndividual(
            siteId,
            accessionNumber,
            contextGrave,
            date,
            notes,
            developmentalAge
        );


        window.location.href =
            `site.html?siteId=${siteId}`;
    });