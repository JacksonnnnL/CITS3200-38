import {
    getSiteById,
    getIndividualsBySite,
    deleteIndividual
} from "./data.js";

let deleteMode = false;


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


// ========================================
// Load Selected Site
// ========================================

const site =
    await getSiteById(siteId);


if (!site) {
    window.location.href = "index.html";
}


// Display Site Code
document
    .getElementById("site-code-heading")
    .textContent =
        site.siteCode;


// ========================================
// Add Individual Link
// ========================================

document
    .getElementById("add-individual-link")
    .href =
        `addIndividual.html?siteId=${siteId}`;

        
// ========================================
// Individual Rendering
// ========================================

function renderIndividuals(individuals) {

    const individualList =
        document.getElementById("individual-list");

    individualList.innerHTML = "";


    if (individuals.length === 0) {

        individualList.innerHTML = `
            <p>No individuals created yet.</p>
        `;

        return;
    }


    individuals.forEach(individual => {

        const article =
            document.createElement("article");

        article.classList.add("individual-card");

        article.dataset.individualId =
            individual.id;


        article.innerHTML = `
            <div class="individual-card-header">

                <h3 class="accession-number">
                    ${individual.accessionNumber}
                </h3>

                <span class="individual-date">
                    Date: ${individual.date}
                </span>

            </div>

            <p class="individual-context">
                <strong>Context:</strong>
                ${individual.contextGrave || "Not specified"}
            </p>

            <p class="individual-age">
                ${individual.developmentalAge}
            </p>
        `;


        individualList.appendChild(article);
    });
}


// ========================================
// Load Individuals
// ========================================

const individuals =
    await getIndividualsBySite(siteId);

renderIndividuals(individuals);

// ========================================
// Delete Individual Mode
// ========================================

document
    .getElementById("delete-individual-button")
    .addEventListener("click", () => {

        deleteMode = !deleteMode;

    });


// ========================================
// Individual Selection
// ========================================

document
    .getElementById("individual-list")
    .addEventListener("click", async (event) => {

        const individualCard =
            event.target.closest(".individual-card");

        if (!individualCard) {
            return;
        }


        const individualId =
            individualCard.dataset.individualId;


        // Delete selected Individual
        if (deleteMode) {

            const confirmed =
                window.confirm(
                    "Delete this individual?"
                );


            if (!confirmed) {
                deleteMode = false;
                return;
            }


            await deleteIndividual(
                individualId
            );


            const individuals =
                await getIndividualsBySite(
                    siteId
                );


            renderIndividuals(
                individuals
            );


            deleteMode = false;

            return;
        }


        // Open selected Individual
        window.location.href =
            `individual.html?siteId=${siteId}&individualId=${individualId}`;
    });