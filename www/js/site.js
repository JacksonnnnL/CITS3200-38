import {
    getSiteById,
    getIndividualsBySite
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