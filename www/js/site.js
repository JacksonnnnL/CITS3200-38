import {
    getSiteById,
    getAccessionsBySite,
    getContextsBySite,
    createContext,
    updateAccession,
    deleteAccession
} from "./data.js";


let deleteMode = false;
let selectedIndividualId = null;
let editingIndividualId = null;
let currentIndividuals = [];

const editContextModal =
    document.getElementById(
        "edit-context-modal"
    );

const editContextInput =
    document.getElementById(
        "edit-context-input"
    );

const cancelContextEditButton =
    document.getElementById(
        "cancel-context-edit-button"
    );

const saveContextEditButton =
    document.getElementById(
        "save-context-edit-button"
    );

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


const site =
    await getSiteById(siteId);


if (!site) {
    window.location.href =
        "index.html";

    throw new Error(
        "Site could not be found"
    );
}


document
    .getElementById("site-code-heading")
    .textContent =
        site.code;


document
    .getElementById("site-location-heading")
    .textContent =
        site.description ||
        "No description";


document
    .getElementById("back-to-sites-button")
    .addEventListener(
        "click",
        () => {

            window.location.href =
                "index.html";

        }
    );


document
    .getElementById("add-individual-button")
    .addEventListener(
        "click",
        () => {

            window.location.href =
                `addIndividual.html?siteId=${encodeURIComponent(siteId)}`;

        }
    );


let contexts =
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

                <div class="individual-context-row">

                    <p class="individual-context">
                        <strong>Context:</strong>
                        ${context || "Not specified"}
                    </p>

                    <button
                        class="context-edit-button"
                        type="button"
                        aria-label="Edit Context or Grave"
                    >
                        Edit
                    </button>

                </div>

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


const accessionCollator =
    new Intl.Collator(
        "en",
        {
            numeric: true,
            sensitivity: "base"
        }
    );


async function loadIndividuals() {

    const individuals =
        await getAccessionsBySite(
            siteId
        );


    currentIndividuals =
        [...individuals].sort(
            (a, b) =>
                accessionCollator.compare(
                    a.accessionNumber || "",
                    b.accessionNumber || ""
                )
        );


    renderIndividuals(
        currentIndividuals
    );

}


await loadIndividuals();


function closeContextEditModal() {

    editContextModal.classList.remove(
        "open"
    );

    editingIndividualId = null;
    editContextInput.value = "";

}


cancelContextEditButton.addEventListener(
    "click",
    closeContextEditModal
);


saveContextEditButton.addEventListener(
    "click",
    async () => {

        if (!editingIndividualId) {
            return;
        }


        const contextCode =
            editContextInput.value.trim();


        saveContextEditButton.disabled = true;


        try {

            let contextId = null;


            if (contextCode) {

                let context =
                    contexts.find(
                        item =>
                            item.code.toLowerCase() ===
                            contextCode.toLowerCase()
                    );


                if (!context) {

                    context =
                        await createContext({
                            siteId,
                            code: contextCode
                        });


                    contexts.push(
                        context
                    );


                    contextMap.set(
                        context.id,
                        context.code
                    );

                }


                contextId =
                    context.id;

            }


            await updateAccession(
                editingIndividualId,
                {
                    contextId
                }
            );


            closeContextEditModal();


            await loadIndividuals();

        }
        catch (error) {

            console.error(
                "Failed to update context:",
                error
            );

        }
        finally {

            saveContextEditButton.disabled = false;

        }

    }
);


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


            const individualId =
                individualCard
                    .dataset
                    .individualId;


            const contextEditButton =
                event.target.closest(
                    ".context-edit-button"
                );


            if (contextEditButton) {

                if (deleteMode) {
                    return;
                }


                const individual =
                    currentIndividuals.find(
                        item =>
                            item.id === individualId
                    );


                if (!individual) {
                    return;
                }


                editingIndividualId =
                    individualId;


                editContextInput.value =
                    individual.contextId
                        ? contextMap.get(
                            individual.contextId
                        ) || ""
                        : "";


                editContextModal.classList.add(
                    "open"
                );


                editContextInput.focus();

                return;
            }


            selectedIndividualId =
                individualId;


            if (!deleteMode) {

                window.location.href =
                    `skeletons_overview.html?accessionId=${encodeURIComponent(selectedIndividualId)}`;

                return;

            }


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