import {
    createAccession,
    createContext,
    DuplicateAccessionNumberError,
    getAccessionsBySite,
    getContextsBySite
} from "./data.js";


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
    window.location.href = "index.html";
}


// ========================================
// Back to Site Navigation
// ========================================

document
    .getElementById("back-to-site-button")
    .addEventListener(
        "click",
        () => {

            window.location.href =
                `site.html?siteId=${encodeURIComponent(siteId)}`;

        }
    );

        
// ========================================
// Create Individual Form
// ========================================

document
    .getElementById("create-individual-form")
    .addEventListener(
        "submit",
        async (event) => {

            event.preventDefault();


            const accessionNumber =
                document
                    .getElementById("accession-number")
                    .value
                    .trim();


            const contextGrave =
                document
                    .getElementById("context-grave")
                    .value
                    .trim();


            const date =
                document
                    .getElementById("individual-date")
                    .value;


            const developmentalAge =
                document
                    .getElementById("developmental-age")
                    .value;


            const notes =
                document
                    .getElementById("individual-notes")
                    .value
                    .trim();


            try {

                // Check before creating a new Context/Grave, so a rejected
                // duplicate does not leave behind an unused context record.
                const existingIndividuals = await getAccessionsBySite(siteId);
                if (existingIndividuals.some(
                    (individual) =>
                        (individual.accessionNumber || "").trim().toLowerCase() ===
                        accessionNumber.toLowerCase()
                )) {
                    throw new DuplicateAccessionNumberError(accessionNumber);
                }

                // ========================================
                // Optional Context / Grave
                // ========================================

                let contextId = null;


                if (contextGrave) {

                    const contexts =
                        await getContextsBySite(siteId);


                    // Reuse an existing context if
                    // the same code has already been created.
                    let context =
                        contexts.find(
                            (item) =>
                                item.code.toLowerCase() ===
                                contextGrave.toLowerCase()
                        );


                    // Otherwise create a new Context
                    if (!context) {

                        context =
                            await createContext({
                                siteId,
                                code: contextGrave
                            });

                    }


                    contextId = context.id;

                }


                // ========================================
                // Create Accession / Individual
                // ========================================

                await createAccession({

                    siteId,

                    contextId,

                    accessionNumber,

                    date,

                    notes,

                    ageCategory:
                        developmentalAge

                });


                // Return to selected Site
                window.location.href =
                    `site.html?siteId=${encodeURIComponent(siteId)}`;

            }
            catch (error) {

                console.error(
                    "Failed to create individual:",
                    error
                );

                alert(
                    error.message ||
                    "Unable to create individual."
                );

            }

        }
    );