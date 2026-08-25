import {
    getSites
} from "./data.js";


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