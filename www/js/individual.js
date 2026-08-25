import {
    getIndividualById
} from "./data.js";


const params =
    new URLSearchParams(
        window.location.search
    );

const siteId =
    params.get("siteId");

const individualId =
    params.get("individualId");


if (!siteId || !individualId) {
    window.location.href = "index.html";
}


const individual =
    await getIndividualById(
        individualId
    );


if (!individual) {
    window.location.href =
        `site.html?siteId=${siteId}`;
}