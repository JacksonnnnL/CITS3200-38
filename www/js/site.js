import {
    getSiteById,
    getAccessionsBySite,
    getContextsBySite,
    deleteAccession
} from "./data.js";


let deleteMode = false;
let selectedIndividualId = null;

const deleteIndividualButton =
    document.getElementById(
        "delete-individual-button"
    );

const deleteIndividualModal =
    document.getElementById(
        "delete-individual-modal"
    );

const deleteIndividualMessage =
    document.getElementById(
        "delete-individual-message"
    );

const cancelIndividualDeleteButton =
    document.getElementById(
        "cancel-individual-delete-button"
    );

const confirmIndividualDeleteButton =
    document.getElementById(
        "confirm-individual-delete-button"
    );


// ========================================
// Selected Site
// ========================================

const params =
    new URLSearchParams(
        window.location.search
    );

const siteId =
    params.get("siteId");


if (!siteId) {
    window.location.href =
        "index.html";

    throw new Error(
        "No siteId provided"
    );
}


// ========================================
// Load Selected Site
// ========================================

const site =
    await getSiteById(siteId);


if (!site) {
    window.location.href =
        "index.html";

    throw new Error(
        "Site could not be found"
    );
}


// Current IndexedDB field is "code"
document
    .getElementById("site-code-heading")
    .textContent =
        site.code;


// Current Site records contain
// description rather than location
document
    .getElementById("site-location-heading")
    .textContent =
        site.description ||
        "No description";


// ========================================
// Back to Sites Navigation
// ========================================

document
    .getElementById("back-to-sites-button")
    .addEventListener(
        "click",
        () => {

            window.location.href =
                "index.html";

        }
    );

// ========================================
// Add Individual Navigation
// ========================================

document
    .getElementById("add-individual-button")
    .addEventListener(
        "click",
        () => {

            window.location.href =
                `addIndividual.html?siteId=${encodeURIComponent(siteId)}`;

        }
    );

        
// ========================================
// Context Lookup
// ========================================

const contexts =
    await getContextsBySite(siteId);


const contextMap =
    new Map(
        contexts.map(
            context => [
                context.id,
                context.code
            ]
        )
    );


// ========================================
// Individual Rendering
// ========================================

function renderIndividuals(individuals) {

    const individualList =
        document.getElementById(
            "individual-list"
        );


    individualList.innerHTML = "";


    if (individuals.length === 0) {

        individualList.innerHTML = `
            <p>No individuals created yet.</p>
        `;

        return;
    }


    individuals.forEach(
        individual => {

            const article =
                document.createElement(
                    "article"
                );


            article.classList.add(
                "individual-card"
            );


            article.dataset.individualId =
                individual.id;


            const context =
                individual.contextId
                    ? contextMap.get(
                        individual.contextId
                    )
                    : null;


            const age =
                individual.ageCategory
                    ? individual.ageCategory
                        .charAt(0)
                        .toUpperCase()
                        +
                        individual.ageCategory
                        .slice(1)
                    : "Not specified";


            article.innerHTML = `
                <div class="individual-card-header">

                    <h3 class="accession-number">
                        ${individual.accessionNumber}
                    </h3>

                    <span class="individual-date">
                        Date:
                        ${individual.date || "Not specified"}
                    </span>

                </div>

                <p class="individual-context">
                    <strong>Context:</strong>
                    ${context || "Not specified"}
                </p>

                <p class="individual-age">
                    ${age}
                </p>
            `;


            individualList.appendChild(
                article
            );

        }
    );

}


// ========================================
// Load Individuals
// ========================================

async function loadIndividuals() {

    const individuals =
        await getAccessionsBySite(
            siteId
        );


    renderIndividuals(
        individuals
    );

}


await loadIndividuals();

// ========================================
// Delete Individual Mode
// ========================================

function setDeleteMode(enabled) {

    deleteMode = enabled;


    const individualCards =
        document.querySelectorAll(
            ".individual-card"
        );


    individualCards.forEach(
        (card) => {

            card.classList.toggle(
                "delete-target",
                deleteMode
            );

        }
    );


    deleteIndividualButton.classList.toggle(
        "delete-mode-active",
        deleteMode
    );

}


deleteIndividualButton.addEventListener(
    "click",
    () => {

        setDeleteMode(
            !deleteMode
        );

    }
);


// ========================================
// Individual Selection
// ========================================

document
    .getElementById("individual-list")
    .addEventListener(
        "click",
        (event) => {

            const individualCard =
                event.target.closest(
                    ".individual-card"
                );


            if (!individualCard) {
                return;
            }


            // Normal mode
            if (!deleteMode) {
                return;
            }


            selectedIndividualId =
                individualCard
                    .dataset
                    .individualId;


            const accessionNumber =
                individualCard
                    .querySelector(
                        ".accession-number"
                    )
                    .textContent
                    .trim();


            deleteIndividualMessage.textContent =
                `Are you sure you want to delete Individual ${accessionNumber}?`;


            deleteIndividualModal.classList.add(
                "open"
            );

        }
    );


// ========================================
// Cancel Individual Deletion
// ========================================

cancelIndividualDeleteButton.addEventListener(
    "click",
    () => {

        deleteIndividualModal.classList.remove(
            "open"
        );


        selectedIndividualId = null;


        setDeleteMode(false);

    }
);


// ========================================
// Confirm Individual Deletion
// ========================================

confirmIndividualDeleteButton.addEventListener(
    "click",
    async () => {

        if (!selectedIndividualId) {
            return;
        }


        try {

            await deleteAccession(
                selectedIndividualId
            );


            deleteIndividualModal.classList.remove(
                "open"
            );


            selectedIndividualId = null;


            setDeleteMode(false);


            await loadIndividuals();

        }
        catch (error) {

            console.error(
                "Failed to delete individual:",
                error
            );

        }

    }
);