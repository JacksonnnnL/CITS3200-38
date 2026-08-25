// ========================================
// Temporary Data Storage
// ========================================
//
// localStorage is currently used so data
// persists between separate HTML pages.
//
// IndexedDB can replace this later.
// ========================================


// ========================================
// Site Operations
// ========================================

export async function createSite(
    siteCode,
    description = ""
) {

    const sites =
        JSON.parse(
            localStorage.getItem("sites")
        ) || [];


    const site = {
        id: crypto.randomUUID(),
        siteCode: siteCode,
        description: description
    };


    sites.push(site);


    localStorage.setItem(
        "sites",
        JSON.stringify(sites)
    );


    return site;
}


export async function getSites() {

    return JSON.parse(
        localStorage.getItem("sites")
    ) || [];
}


export async function getSiteById(siteId) {

    const sites =
        await getSites();


    return sites.find(
        site =>
            site.id === siteId
    );
}


// ========================================
// Individual Operations
// ========================================

export async function createIndividual(
    siteId,
    accessionNumber,
    contextGrave,
    date,
    notes,
    developmentalAge
) {

    const individuals =
        JSON.parse(
            localStorage.getItem("individuals")
        ) || [];


    const individual = {
        id: crypto.randomUUID(),
        siteId: siteId,
        accessionNumber: accessionNumber,
        contextGrave: contextGrave,
        date: date,
        notes: notes,
        developmentalAge: developmentalAge
    };


    individuals.push(individual);


    localStorage.setItem(
        "individuals",
        JSON.stringify(individuals)
    );


    return individual;
}


export async function getIndividualsBySite(
    siteId
) {

    const individuals =
        JSON.parse(
            localStorage.getItem("individuals")
        ) || [];


    return individuals.filter(
        individual =>
            individual.siteId === siteId
    );
}


// ========================================
// Delete Individual
// ========================================

export async function deleteIndividual(
    individualId
) {

    let individuals =
        JSON.parse(
            localStorage.getItem("individuals")
        ) || [];


    individuals =
        individuals.filter(
            individual =>
                individual.id !== individualId
        );


    localStorage.setItem(
        "individuals",
        JSON.stringify(individuals)
    );
}

// ========================================
// Delete Site
// ========================================

export async function deleteSite(
    siteId
) {

    let sites =
        JSON.parse(
            localStorage.getItem("sites")
        ) || [];

    let individuals =
        JSON.parse(
            localStorage.getItem("individuals")
        ) || [];


    sites =
        sites.filter(
            site =>
                site.id !== siteId
        );


    individuals =
        individuals.filter(
            individual =>
                individual.siteId !== siteId
        );


    localStorage.setItem(
        "sites",
        JSON.stringify(sites)
    );

    localStorage.setItem(
        "individuals",
        JSON.stringify(individuals)
    );
}

// ========================================
// Individual ID
// ========================================

export async function getIndividualById(
    individualId
) {

    const individuals =
        JSON.parse(
            localStorage.getItem("individuals")
        ) || [];


    return individuals.find(
        individual =>
            individual.id === individualId
    );
}