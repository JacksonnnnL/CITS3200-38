# CITS3200-38

## CITS3200 Objectives (C.J's recollection from the initial meeting with the client)
The OsteoMap Skeletal Inventory Project aims to digitise the process of recording and visualising human skeletal remains. The system will allow users to identify the preservation state of individual bones and specific anatomical zones using established anthropological bone-zone notation.

Each bone or bone zone will be recorded using one of three preservation states:

- Present — the bone or zone is fully preserved.
- Fragmented — only part of the bone or zone is preserved.
- Absent — the bone or zone is not present.

The skeletal inventory should be presented through an interactive visual interface. The client is comfortable with the main skeleton being displayed as a two-dimensional diagram, while the skull may be represented using a three-dimensional model. Users should be able to select individual bones or zones and assign a preservation state using colour coding.

### Proposed Record Structure

Skeletal records will generally be organised using the following hierarchy:

Site
└── Grave, context or site subdivision
    └── Individual body
        └── Bone
            └── Bone zone and preservation state

A site represents a unique excavation or research location. Depending on the characteristics of the site, it may contain graves, contexts or other subdivisions. Smaller sites may not require this additional level of categorisation.

Each individual body must be uniquely identifiable within its site. However, the same body or grave identifier may appear at different sites because identification conventions can vary between countries, organisations, legislation and individual projects. The system should therefore avoid enforcing one universal naming format and instead support flexible text-based identifiers.

The most important identification requirements are:

Every site must have a unique system identifier.
Every body must be uniquely identifiable within its associated site.
Grave, context and body labels must support different external naming conventions.
The database must support sites both with and without internal subdivisions.

Overall, the system should provide a flexible and intuitive method for recording skeletal preservation while accommodating differences in archaeological site structures and anthropological documentation practices.
