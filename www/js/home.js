import {
    getSites,
    deleteSite
} from "./data.js";

let deleteMode = false;


// ========================================
// Site Rendering
// ========================================

function renderSites(sites) {

    const siteList =
        document.getElementById("site-list");

    siteList.innerHTML = "";


    sites.forEach(site => {

        const article =
            document.createElement("article");

        article.classList.add("site-card");

        article.dataset.siteId =
            site.id;


        article.innerHTML = `
            <div class="site-card-header">

                <div class="site-title-area">

                    <span class="site-dot"></span>

                    <h3 class="site-code">
                        ${site.siteCode}
                    </h3>

                </div>

            </div>

            <p class="site-notes">
                ${site.description || ""}
            </p>
        `;


        siteList.appendChild(article);
    });
}

// ========================================
// Initial Page Load
// ========================================

const sites =
    await getSites();

renderSites(sites);


// ========================================
// Delete Mode
// ========================================

document
    .getElementById("delete-site-button")
    .addEventListener("click", () => {

        deleteMode = !deleteMode;

    });


// ========================================
// Site Selection
// ========================================

document
    .getElementById("site-list")
    .addEventListener("click", async (event) => {

        const siteCard =
            event.target.closest(".site-card");

        if (!siteCard) {
            return;
        }


        const siteId =
            siteCard.dataset.siteId;


        // Delete selected Site
        if (deleteMode) {

            const confirmed =
                window.confirm(
                    "Delete this site?"
                );


            if (!confirmed) {
                deleteMode = false;
                return;
            }


            await deleteSite(siteId);


            const sites =
                await getSites();

            renderSites(sites);


            deleteMode = false;

            return;
        }
       // Open selected Site
        window.location.href =
            `site.html?siteId=${siteId}`;
    });