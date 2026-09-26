import { getSiteBoneStats } from "./bone_counts.js";


// ========================================
// Site Bone Summary
// ========================================
//
// Shows the site's MNI and its top skeletal elements on the site page.
// Kept separate from site.js so the two can change independently.

const container =
    document.getElementById("site-stats");

const individualList =
    document.getElementById("individual-list");

const siteId =
    new URLSearchParams(
        window.location.search
    ).get("siteId");


function createElement(tag, className, text) {
    const element =
        document.createElement(tag);

    if (className) {
        element.className = className;
    }

    if (text !== undefined) {
        element.textContent = text;
    }

    return element;
}


function renderStats(stats) {
    container.replaceChildren();

    container.append(
        createElement(
            "h2",
            "site-stats-title",
            "Site Bone Summary"
        )
    );

    const mni =
        createElement("div", "site-stats-mni");

    mni.append(
        createElement(
            "span",
            "site-stats-mni-value",
            String(stats.mni)
        ),
        createElement(
            "span",
            "site-stats-mni-label",
            "Minimum Number of Individuals (MNI)"
        )
    );

    container.append(mni);

    if (stats.topElements.length === 0) {
        container.append(
            createElement(
                "p",
                "site-stats-empty",
                "No bones have been recorded as present yet."
            )
        );

        return;
    }

    container.append(
        createElement(
            "h3",
            "site-stats-subtitle",
            `Top ${stats.topElements.length} most frequently present`
        )
    );

    const list =
        createElement("ol", "site-stats-list");

    stats.topElements.forEach((element) => {
        const item =
            createElement("li", "site-stats-item");

        const name =
            createElement("span", "site-stats-name");

        name.append(
            createElement(
                "span",
                "site-stats-code",
                element.code
            ),
            createElement(
                "span",
                "site-stats-label",
                element.label
            )
        );

        item.append(
            name,
            createElement(
                "span",
                "site-stats-count",
                `${element.count} of ${stats.individualCount}`
            )
        );

        list.append(item);
    });

    container.append(list);
}


function renderError() {
    container.replaceChildren(
        createElement(
            "p",
            "site-stats-empty",
            "The bone summary could not be loaded."
        )
    );
}


// Only the most recent request may draw, so a slow older one can't
// overwrite newer numbers.
let latestRequest = 0;

async function refresh() {
    const request =
        ++latestRequest;

    try {
        const stats =
            await getSiteBoneStats(siteId);

        if (request === latestRequest) {
            renderStats(stats);
        }

    } catch (error) {
        console.error(
            "Failed to load site bone summary:",
            error
        );

        if (request === latestRequest) {
            renderError();
        }
    }
}


// Several list changes in a row (clear + re-add) collapse into one refresh.
let refreshScheduled = false;

function scheduleRefresh() {
    if (refreshScheduled) {
        return;
    }

    refreshScheduled = true;

    // A timer rather than requestAnimationFrame: animation frames are
    // paused whenever the page isn't being painted, and this refresh
    // must still run then.
    setTimeout(() => {
        refreshScheduled = false;
        refresh();
    }, 0);
}


if (container && siteId) {
    await refresh();

    // site.js re-renders the individual list after an individual is
    // added or deleted, so a change there means the counts changed too.
    if (individualList) {
        new MutationObserver(scheduleRefresh)
            .observe(
                individualList,
                { childList: true }
            );
    }

    // Coming back with the browser's back button can restore the page
    // as it was; bone states may have changed while away.
    window.addEventListener(
        "pageshow",
        (event) => {
            if (event.persisted) {
                refresh();
            }
        }
    );
}
