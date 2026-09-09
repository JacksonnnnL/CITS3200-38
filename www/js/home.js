import {
    getSites,
    getAccessionsBySite,
    deleteSite
} from "./data.js";

const siteList =
    document.getElementById("site-list");

const deleteSiteButton =
    document.getElementById("delete-site-button");

const deleteModal =
    document.getElementById("delete-site-modal");

const deleteModalMessage =
    document.getElementById("delete-site-message");

const cancelDeleteButton =
    document.getElementById("cancel-delete-button");

const confirmDeleteButton =
    document.getElementById("confirm-delete-button");

let deleteMode = false;
let selectedSiteId = null;

async function loadSites() {
    const sites =
        await getSites();

    const sitesWithCounts =
        await Promise.all(
            sites.map(async (site) => {
                const accessions =
                    await getAccessionsBySite(site.id);

                return {
                    site,
                    individualCount: accessions.length
                };
            })
        );

    renderSites(sitesWithCounts);
}

function renderSites(sitesWithCounts) {
    siteList.innerHTML = "";

    if (sitesWithCounts.length === 0) {
        const emptyMessage =
            document.createElement("p");

        emptyMessage.textContent =
            "No sites created yet.";

        siteList.appendChild(emptyMessage);

        return;
    }

    sitesWithCounts.forEach(
        ({ site, individualCount }) => {
            const article =
                document.createElement("article");

            article.classList.add("site-card");

            article.dataset.siteId =
                site.id;

            const header =
                document.createElement("div");

            header.classList.add(
                "site-card-header"
            );

            const titleArea =
                document.createElement("div");

            titleArea.classList.add(
                "site-title-area"
            );

            const dot =
                document.createElement("span");

            dot.classList.add("site-dot");

            const code =
                document.createElement("h3");

            code.classList.add("site-code");

            code.textContent =
                site.code;

            titleArea.append(
                dot,
                code
            );

            header.appendChild(titleArea);

            const description =
                document.createElement("p");

            description.classList.add(
                "site-notes"
            );

            description.textContent =
                site.description ||
                "No description";

            const footer =
                document.createElement("div");

            footer.classList.add(
                "site-card-footer"
            );

            const count =
                document.createElement("span");

            count.classList.add(
                "individual-count"
            );

            count.textContent =
                `${individualCount} ${
                    individualCount === 1
                        ? "Individual"
                        : "Individuals"
                }`;

            footer.appendChild(count);

            article.append(
                header,
                description,
                footer
            );

            siteList.appendChild(article);
        }
    );
}

function setDeleteMode(enabled) {
    deleteMode = enabled;

    const siteCards =
        document.querySelectorAll(".site-card");

    siteCards.forEach((card) => {
        card.classList.toggle(
            "delete-target",
            deleteMode
        );
    });

    deleteSiteButton.classList.toggle(
        "delete-mode-active",
        deleteMode
    );
}

deleteSiteButton.addEventListener(
    "click",
    () => {
        setDeleteMode(!deleteMode);
    }
);

siteList.addEventListener(
    "click",
    (event) => {
        const siteCard =
            event.target.closest(".site-card");

        if (!siteCard) {
            return;
        }

        if (!deleteMode) {
            return;
        }

        selectedSiteId =
            siteCard.dataset.siteId;

        const siteCode =
            siteCard
                .querySelector(".site-code")
                .textContent;

        deleteModalMessage.textContent =
            `Are you sure you want to delete Site ${siteCode}?`;

        deleteModal.classList.add("open");
    }
);

cancelDeleteButton.addEventListener(
    "click",
    () => {
        deleteModal.classList.remove("open");

        selectedSiteId = null;

        setDeleteMode(false);
    }
);

confirmDeleteButton.addEventListener(
    "click",
    async () => {
        if (!selectedSiteId) {
            return;
        }

        try {
            await deleteSite(
                selectedSiteId
            );

            deleteModal.classList.remove(
                "open"
            );

            selectedSiteId = null;

            setDeleteMode(false);

            await loadSites();

        } catch (error) {
            console.error(
                "Failed to delete site:",
                error
            );
        }
    }
);

try {
    await loadSites();

} catch (error) {
    console.error(
        "Failed to load sites:",
        error
    );

    siteList.textContent =
        "Sites could not be loaded.";
}