# CITS3200-38 — OsteoMap

OsteoMap is a digital skeletal inventory application developed as part of the **CITS3200 Professional Computing** unit at the University of Western Australia.

The application is designed to assist researchers and anthropologists with recording and visualising the preservation of human skeletal remains. It replaces traditional paper-based skeletal inventory recording with an interactive digital interface where users can manage archaeological sites, individuals, and skeletal preservation records.

OsteoMap is designed as an **offline-capable Android application (using web technologies)** with local data storage, allowing skeletal records to be created and accessed without relying on cloud-based storage.

---

## Features

OsteoMap currently supports:

- Creating and managing archaeological **sites**, including editing a site's description.
- Creating **individual records** associated with a site, with an optional grave or context, and editing an individual's context afterwards.
- Filtering a site's individuals by developmental age, listed in order of accession number.
- Skeleton diagrams for **adult, adolescent, child and infant** individuals.
- Recording the preservation state of each bone by tapping it on the skeleton diagram, with tools to mark a whole segment as Present, reset it, and undo the last change.
- Zooming and panning the diagrams on a touchscreen.
- A **Site Bone Summary** showing the Minimum Number of Individuals (MNI) and the most frequently present bones for the whole site.
- Exporting an individual's record as a **CSV data file** and a **JPEG image** of the skeleton.
- Storing application data locally on the device using **IndexedDB**, so the app works offline.

### Preservation States

Each bone can be assigned one of three preservation states. A bone with no state recorded is shown as **Unmarked**.

- **Present** (green) — at least 50% of the bone is present. Counted in MNI.
- **Fragmented** (orange) — less than 50% of the bone is present. Recorded for inventory purposes only and not counted in MNI.
- **Absent** (grey) — the bone is not present.
- **Unmarked** (white) — no state has been recorded yet.

These states are shown by colour on the skeleton diagram so that the preservation of different bones can be seen at a glance.

---

## Record Structure

OsteoMap organises skeletal records using the following general hierarchy:

```text
Site
└── Grave / Context / Site Subdivision (optional)
    └── Individual
        └── Bone
            └── Preservation State
```

A **site** represents an excavation or research location.

Each site may optionally contain graves, contexts, or other subdivisions depending on the structure of the archaeological site. Smaller sites are not required to use this additional level of categorisation.

An **individual** represents a set of human skeletal remains recorded within a site. Individuals are associated with their parent site and may additionally be associated with a grave or context.

Each individual's skeletal inventory records the preservation state of individual bones. Each bone is recorded as a whole. Recording preservation for separate zones within a bone is not available in this version.

---

# User Guide

This guide explains how to use OsteoMap to create archaeological sites and individuals, record skeletal preservation, and export recorded data.

## Quick Start

A typical OsteoMap recording session follows this process:

```text
Open OsteoMap
      ↓
Create or Select a Site
      ↓
Create or Select an Individual
      ↓
Review Individual Details
      ↓
Open Skeletal Inventory
      ↓
Select a Bone
      ↓
Record Bone Preservation
      ↓
Repeat for Remaining Skeletal Elements
      ↓
Review the Completed Inventory
      ↓
Export Data
```

Users can return to previous screens at any stage to work with other sites, individuals, or skeletal records.

---

## 1. Managing Sites

### Creating a Site

1. Open OsteoMap to access the **Available Sites** page.
2. Select **Add New Site**.
3. Enter a unique **Site Code**.
4. Enter a description of the site if required.
5. Select **Create Site**.
6. The application will return to the Available Sites page and the newly created site will appear in the list.

Site codes are used to distinguish archaeological or research locations within OsteoMap.

### Opening a Site

1. Locate the required site on the **Available Sites** page.
2. Select the site.
3. The site's page will open and display the individuals currently associated with that site.

### Deleting a Site

1. From the **Available Sites** page, enter the site deletion mode.
2. Select the site that you want to remove.
3. Confirm the deletion when prompted.

> **Warning:** Deleting a site may also remove records associated with that site. Ensure that any required information has been exported before deleting a site.

---

## 2. Managing Individuals

Individuals are stored within a site. An individual represents a set of skeletal remains being recorded.

### Creating an Individual

1. Open the site where the individual should be recorded.
2. Select **Add Individual**.
3. Enter the individual's **Accession Number**.
4. Enter the required date.
5. Select the appropriate **Developmental Age**.
6. Enter any additional notes if required.
7. Enter or select a **Grave/Context** if the individual belongs to one.
8. Create the individual.

After creation, the application will return to the selected site and the individual will appear in its list of individuals.

Two rules apply when creating an individual:

- **Accession numbers must be unique within a site.** A number that differs only by capital letters or spaces (for example `acc01` and `ACC01`) is treated as a duplicate and is not accepted.
- **Developmental Age is required** (adult, adolescent, child or infant). It decides which skeleton diagram is shown for the individual.

### Editing and Filtering

- On a site's page, use the **Edit** button beside the site code to change the site's description.
- On an individual's card, use **Edit** to change the individual's grave or context.
- Use the **Age** filter above the list to show only individuals of one developmental age. The list is ordered by accession number.

### Grave and Context Information

Grave or context information can be used to represent subdivisions within an archaeological site.

This information is optional because not every site requires an internal subdivision. Individuals can therefore be recorded either directly within a site or within a particular grave or context.

### Opening an Individual

1. Open the appropriate site.
2. Locate the required individual.
3. Select the individual to open their record.
4. The individual's details and skeletal inventory can then be accessed.

### Deleting an Individual

1. Open the site containing the individual.
2. Enter the individual deletion mode.
3. Select the individual to remove.
4. Confirm the deletion when prompted.

> **Warning:** Deleting an individual may permanently remove skeletal preservation information associated with that record.

---

## 3. Using the Skeletal Inventory

The skeletal inventory provides an interactive representation of an individual's skeleton. The diagram matches the individual's developmental age (adult, adolescent, child or infant).

### Opening the Skeletal Inventory

1. Open the required individual from the site's page.
2. The individual's page shows the date, a **Notes** box, the colour key, and the whole skeleton with each bone coloured by its recorded state.
3. Tap part of the skeleton to open that **segment** for recording. There are seven segments: Cranium, Axial (spine, ribs and sternum), Pelvis, Right Upper Limb, Left Upper Limb, Right Lower Limb and Left Lower Limb.
4. You can also switch between segments using the tabs at the top of the recording page.
5. Tap a bone to begin recording its preservation.

---

## 4. Recording Bone Preservation

The application uses three preservation states:

- **Present** — at least 50% of the bone is present. Counted in MNI.
- **Fragmented** — less than 50% of the bone is present. Not counted in MNI.
- **Absent** — the bone is not present.

### Recording a Bone

1. On the recording page, tap the bone on the diagram. It is outlined and a panel opens showing the bone's name and its current state.
2. Tap **Present**, **Fragmented** or **Absent**. Each button shows a short reminder of what it means, including whether it counts towards MNI.
3. The bone changes colour straight away and the state is saved on the device.
4. To clear a bone back to **Unmarked**, tap the same state again.
5. Tap another bone to continue, or close the panel.

Repeat this for each bone that needs to be recorded. Each bone is recorded as a whole.

---

## 5. Marking Several Bones at Once

Three buttons above the diagram work on the **segment you are viewing**:

- **All Present** — marks every bone in the segment as Present. The app asks you to confirm first, and this replaces any states already recorded in that segment.
- **Reset States** — clears every bone in the segment back to Unmarked, after confirmation.
- **Undo Change** — reverses the most recent change, including a whole-segment action. Only the latest change can be undone, and the undo is cleared when you move to another segment.

**Bones shown in several views.** Some bones, mainly in the cranium, appear in more than one view on the diagram. Marking one view of a bone marks that bone's other views as well, so you only need to mark it once.

---

## 6. Navigating the Skeletal Interface

The skeletal interface is designed for touchscreen and mobile use.

When interacting with the skeletal diagram:

- **Tap** a bone to select it and record its preservation.
- **Pinch** with two fingers to zoom in or out.
- **Drag** with one finger to move around a zoomed diagram. Dragging does not select a bone.
- Tap **Reset Zoom** to return to the full view of the segment.
- Use the back arrow at the top left to return to the individual's page, and again to return to the site.

Small bones are easier to select when zoomed in.

---

## 7. Minimum Number of Individuals (MNI)

OsteoMap calculates the **Minimum Number of Individuals (MNI)** for a whole site. It appears on the site's page, in the **Site Bone Summary** card below the list of individuals.

The card shows:

- the **MNI** for the site, and
- the **most frequently present bones** (up to five), each with its code and how many of the site's individuals have it, for example "Right femur — 2 of 3".

**How it is calculated.** For each bone, OsteoMap counts the individuals in the site who have it recorded as **Present**. The highest of these counts is the MNI. Left and right bones are counted separately, and individuals of every developmental age are counted together. The summary is recalculated from the saved records each time the page opens, so it always reflects the latest changes, including added or deleted individuals.

| Preservation State | Included in MNI |
| ------------------ | --------------- |
| Present            | Yes             |
| Fragmented         | No              |
| Absent             | No              |
| Unmarked           | No              |

A bone marked **Fragmented** (less than 50% present) is recorded for inventory but not counted when determining MNI.

**Which bones count.** Only the bones on the client's element list are counted: the skull, mandible, hyoid, sternum, sacrum, the first rib, the first two cervical vertebrae (C1 and C2), the pelvis, the long bones, and the carpal, tarsal, metacarpal, metatarsal and thumb and big-toe phalanx bones. The skull counts as **one element**: if any cranial bone is marked Present, the skull is counted as present for that individual. The remaining ribs and vertebrae can be recorded on the diagram but do not affect the MNI.

Users should ensure that preservation states have been recorded correctly before interpreting MNI results.

---

## 8. Exporting Data

OsteoMap allows an individual's recorded skeletal information to be exported for external storage or further analysis. Export is per individual. Exporting a whole site in one step is not available in this version.

> **Requirement:** saving exports to the Downloads folder needs **Android 10 or newer**.

To export data:

1. Open the individual whose skeletal information you want to export.
2. Tap **Export** and select **CSV Data**, **JPEG Image**, or both.
3. In the Android app, the selected files are saved directly to the device's **Downloads** folder.
4. If both are selected, two separate files are saved: a `.csv` and a `.jpg` (not a ZIP).

Preservation states are represented numerically in exported skeletal data:

| Preservation State | Export Code |
| ------------------ | ----------: |
| Absent             |           0 |
| Fragmented         |           2 |
| Present / Complete |           1 |

The CSV has one row for each bone that has a recorded state, with its bone code, element code, label and state code. Bones that are Unmarked are not listed. The JPEG is an A4 image of the whole skeleton coloured by state, with a colour legend.

These codes allow exported records to be used more easily in statistical analysis or other research software.

---

## 9. Saving and Local Data Storage

OsteoMap stores records locally on the device using **IndexedDB**.

Changes made to sites, individuals, and skeletal preservation records are stored on the device running the application. A remote internet connection is therefore not required for normal data recording.

> **Important — Local Data Storage**
>
> OsteoMap does not automatically back up locally stored records to a remote server or cloud service.
>
> Clearing the application's browser or site data, removing application storage, or uninstalling the application may result in locally stored records being permanently lost.
>
> Important records should be exported regularly and stored in an appropriate backup location.

Data stored on one device should not be assumed to automatically appear on another device.

OsteoMap does not currently have an import or restore function. Exported CSV and JPEG files are for analysis and records. They cannot be loaded back into the app.

---

## 10. Offline Use

OsteoMap is designed to support fieldwork where a reliable internet connection may not be available.

Once the application has been installed and its required resources are available on the device, records can be created and modified locally without relying on cloud storage.

Users should confirm that OsteoMap is installed and functioning correctly on the intended device before beginning fieldwork.

---

## 11. Data Management Recommendations

When using OsteoMap for research or fieldwork:

- Use consistent site and accession naming conventions within the same project.
- Check that the correct site and individual are selected before recording skeletal information.
- Review preservation states before completing an inventory.
- Export important records regularly.
- Avoid clearing application storage while records are still required.
- Keep exported files in an appropriate backup location.
- Confirm exported records before deleting sites or individuals.

---

## Quick Reference

| Task                 | Location                                       |
| -------------------- | ---------------------------------------------- |
| Create a site        | Available Sites → Add New Site                 |
| View a site          | Available Sites → Select Site                  |
| Add an individual    | Site → Add Individual                          |
| View an individual   | Site → Select Individual                       |
| Record preservation  | Individual → Tap a segment → Tap a bone → Present / Fragmented / Absent |
| Clear a bone         | Tap the bone → tap its current state again     |
| Mark a whole segment | Segment page → All Present                     |
| Clear a whole segment | Segment page → Reset States                   |
| Undo the last change | Segment page → Undo Change                     |
| Zoom                 | Pinch; Reset Zoom button                       |
| Review MNI           | Site → Site Bone Summary                       |
| Filter individuals   | Site → Age filter                              |
| Edit a site description | Site → Edit (top right)                     |
| Edit an individual's context | Site → Edit on the individual's card   |
| Export records       | Individual → Export (CSV, JPEG, or both)       |
| Delete a site        | Available Sites → Delete mode                  |
| Delete an individual | Site → Delete mode                             |

---

# Android Installation and Handover

The production deliverable is an installable Android APK. Give the client the
final APK together with this README and verify installation on their device.
OsteoMap's custom native Downloads plugin supports **Android 10 or later**.

**Installing the APK:** Transfer the approved APK to the Android phone; open
it in Downloads/Files, approve installation from that source if prompted,
and install OsteoMap. Open the app, create a test individual, mark a bone,
reopen it and export both CSV and JPEG while offline. Save copies of both files outside the phone and check they open correctly.

**Rebuilding from source:** This repository does **not** contain a complete,
tracked Capacitor/Android Gradle project or a release signing configuration.
The final Android builder must retain the matching Capacitor app/project,
copy `www/` into that project, register the Java downloads plugin using
`native-android/SETUP.txt`, and install the custom icon resources stored in
`native-android/launcher-res/res/`. Then run `npx cap sync android` and build
and test a fresh APK. The existing emulator ID `com.cits3200.osteomaptest`
is for testing only; keep the final client app's package ID unchanged during
upgrades or its IndexedDB records will not automatically transfer. Keep the
release signing key safely: Android app upgrades also require the same signing
identity. Do not uninstall an old client app to fix an upgrade error; that
may permanently delete its IndexedDB records.

**Data retention warning:** All editable records exist only in this device's
IndexedDB. CSV and JPEG exports are **not** full database backups and the app
currently has no import/restore function. Uninstalling, clearing storage,
losing or replacing the device can permanently destroy editable records.
Preserve regular copies of exported data in another safe location, and do not
wipe the original device without a verified recovery plan. Long-term client
use requires a separately verified backup/restore process and update policy.

**CSV code mapping:** 0 = Absent, 1 = Present / Complete, 2 = Fragmented.
Some visual SVG bone IDs have no client MNI-element metadata; their CSV
`element_code`/`element_label` cells are left blank, even though `bone_id`
and `state_code` are exported. Confirm the client's required export schema
before relying on these columns for research analysis.

---

# Developer Documentation

The following sections are intended for developers maintaining, testing, or extending OsteoMap. They are not required for normal use of the application.

---

## Development Setup

Install the project's dependencies:

```bash
npm install
```

Run the test suite once:

```bash
npm test
```

Run the test suite automatically whenever relevant files change:

```bash
npm run test:watch
```

Developers should install the required dependencies before attempting to run or test the project locally.

---

## Testing

Automated tests are used to verify core application functionality.

Tests run automatically on every push or pull request to `main` using GitHub Actions.

The workflow is defined in:

```text
.github/workflows/test.yml
```

Developers should also run the test suite locally before submitting changes:

```bash
npm test
```

This helps identify problems before changes are pushed or submitted through a pull request.

---

## Technical Data Storage

OsteoMap uses **IndexedDB** for local data persistence.

The application's data layer manages records including:

- Sites.
- Contexts.
- Individuals/accessions.
- Bones and bone zones.
- Preservation states.

Application data is stored locally rather than being uploaded to a remote cloud database.

This design supports offline operation but also means that developers should consider the lifecycle of local application storage when modifying the application's data model.

---

## Data Export Format

OsteoMap supports exporting skeletal inventory information for use outside the application.

Preservation states are represented numerically during export:

| Preservation State | Code |
| ------------------ | ---: |
| Absent             |    0 |
| Fragmented         |    2 |
| Present / Complete |    1 |

These numerical values provide a consistent representation of skeletal preservation states for exported records.

---

## Original Project Objectives

The OsteoMap Skeletal Inventory Project was proposed to digitise the process of recording and visualising human skeletal remains.

The system aims to allow researchers to identify the preservation state of individual bones and specific anatomical zones using established anthropological bone-zone notation.

The skeletal inventory is presented through an interactive visual interface where users can select skeletal elements and record their preservation state.

The application was also designed to accommodate differences between archaeological projects. Naming conventions for sites, graves, contexts, and individuals may differ between countries, organisations, and research projects.

For this reason, OsteoMap avoids enforcing a single universal archaeological naming convention and instead provides flexible identifiers while maintaining the relationships between records.

The key identification requirements are:

- Every site must have a unique system identifier.
- Every individual must be uniquely identifiable within its associated site.
- Grave, context, and individual labels should support different external naming conventions.
- Sites must be able to operate both with and without internal subdivisions.

Overall, OsteoMap aims to provide a flexible and intuitive method for recording skeletal preservation while accommodating different archaeological site structures and anthropological documentation practices.
