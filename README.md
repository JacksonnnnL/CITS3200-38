# CITS3200-38 — OsteoMap

OsteoMap is a digital skeletal inventory application developed as part of the **CITS3200 Professional Computing** unit at the University of Western Australia.

The application is designed to assist researchers and anthropologists with recording and visualising the preservation of human skeletal remains. It replaces traditional paper-based skeletal inventory recording with an interactive digital interface where users can manage archaeological sites, individuals, and skeletal preservation records.

OsteoMap is designed as a **mobile-friendly Progressive Web Application (PWA)** with local data storage, allowing skeletal records to be created and accessed without relying on cloud-based storage.

---

## Features

OsteoMap currently supports:

- Creating and managing archaeological **sites**.
- Creating **individual records** associated with a site.
- Recording contextual information for individuals, including grave or context information where applicable.
- Viewing individuals associated with a selected site.
- Viewing an interactive skeletal inventory for an individual.
- Selecting individual bones and anatomical bone zones.
- Recording skeletal preservation states.
- Storing application data locally using **IndexedDB**.
- Exporting skeletal inventory data for further analysis.
- Navigating between site, individual, and skeletal inventory records through a mobile-friendly interface.

### Preservation States

Each bone or bone zone can be assigned one of three preservation states:

- **Present** — the bone or zone is present and complete.
- **Fragmented** — the bone or zone is present but incomplete or fragmented.
- **Absent** — the bone or zone is not present.

These states are visually represented within the skeletal interface to allow users to quickly identify the preservation of different anatomical elements.

---

## Record Structure

OsteoMap organises skeletal records using the following general hierarchy:

```text
Site
└── Grave / Context / Site Subdivision (optional)
    └── Individual
        └── Bone
            └── Bone Zone
                └── Preservation State
```

A **site** represents an excavation or research location.

Each site may optionally contain graves, contexts, or other subdivisions depending on the structure of the archaeological site. Smaller sites are not required to use this additional level of categorisation.

An **individual** represents a set of human skeletal remains recorded within a site. Individuals are associated with their parent site and may additionally be associated with a grave or context.

Each individual's skeletal inventory records the preservation state of individual bones and anatomical zones.

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
Record Bone / Zone Preservation
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

The skeletal inventory provides an interactive representation of an individual's skeleton.

Each skeletal element can be selected to record its preservation state.

### Opening the Skeletal Inventory

1. Open the required individual.
2. Navigate to the individual's skeletal inventory.
3. The skeletal overview will display the available skeletal elements.
4. Select a bone to begin recording its preservation.

---

## 4. Recording Bone Preservation

The application uses three preservation states:

- **Present** — the bone or zone is present and complete.
- **Fragmented** — the bone or zone is present but incomplete or fragmented.
- **Absent** — the bone or zone is not present.

### Recording a Bone

1. Select the required bone from the skeletal overview.
2. The selected bone will open for more detailed recording.
3. Select the required anatomical zone, or mark the applicable zones as complete before changing individual zones to **Fragmented** or **Absent** where required.
4. Assign the appropriate preservation state.
5. Continue through the required zones until the bone has been recorded.
6. Return to the skeletal overview to select another bone.

Repeat this process for each skeletal element that needs to be recorded.

---

## 5. Recording Bone Zones

Where applicable, bones are divided into anatomical zones to provide more detailed preservation information.

For example, a bone may be partially preserved even though some individual zones remain complete. Recording preservation at the zone level allows this difference to be represented within the inventory.

To record a zone:

1. Open the required bone.
2. Select the anatomical zone.
3. Assign **Present**, **Fragmented**, or **Absent**.
4. Repeat the process for the remaining zones.

The visual state of the bone will update to reflect the preservation information that has been recorded.

---

## 6. Navigating the Skeletal Interface

The skeletal interface is designed for touchscreen and mobile use.

When interacting with the skeletal diagram:

- **Tap** a skeletal element to select it.
- Use the available bone controls to record preservation.
- **Zoom** when a closer view of the skeletal diagram is required.
- **Pan** across the diagram when viewing the skeleton at a larger scale.
- Return to the skeletal overview when you have finished recording a particular bone.

When using OsteoMap on a touchscreen device, zooming and panning can be performed using standard touch gestures.

---

## 7. Minimum Number of Individuals (MNI)

When determining the **Minimum Number of Individuals (MNI)** from the recorded skeletal inventory, only skeletal elements recorded as **Present** contribute to the MNI count.

| Preservation State | Included in MNI |
| ------------------ | --------------- |
| Present            | Yes             |
| Fragmented         | No              |
| Absent             | No              |

A skeletal element marked as **Fragmented** or **Absent** is therefore not counted when determining MNI.

Users should ensure that preservation states have been recorded correctly before interpreting MNI results.

---

## 8. Exporting Data

OsteoMap allows recorded skeletal information to be exported for external storage or further analysis.

To export data:

1. Open the record containing the skeletal information you want to export.
2. Select the available **Export** option.
3. OsteoMap will generate the corresponding export file.
4. Save the generated file to the required location on the device.

Preservation states are represented numerically in exported skeletal data:

| Preservation State | Export Code |
| ------------------ | ----------: |
| Absent             |           0 |
| Fragmented         |           1 |
| Present / Complete |           2 |

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
| Record preservation  | Individual → Skeletal Inventory → Select Bone  |
| Record bone zones    | Select Bone → Select Zone → Preservation State |
| Review MNI           | Individual / skeletal inventory MNI output     |
| Export records       | Individual / Skeletal Inventory → Export       |
| Delete a site        | Available Sites → Delete mode                  |
| Delete an individual | Site → Delete mode                             |

---

# Android Installation (WIP)

OsteoMap is intended to be installed and used on an Android device. The final Android installation process is currently being finalised and may change before the completed application is released.

The final installation guide will provide the complete steps required to obtain, install, and verify OsteoMap on a supported Android device.

## Current Installation Process

The Android installation procedure is still under development. Once the final Android build has been prepared, this section will explain how to:

1. Obtain the OsteoMap Android installation package.
2. Transfer or download the installation package to the Android device.
3. Allow installation from the required source if prompted by Android.
4. Install OsteoMap.
5. Open OsteoMap for the first time.
6. Confirm that the application starts correctly.
7. Confirm that local data storage is functioning.
8. Confirm that the application can be used without an active internet connection where appropriate.

The exact installation steps should be updated once the final Android distribution method has been confirmed.

## Installation Limitations

Because the Android installation process is still being finalised:

- Installation instructions may change before the final release.
- The final Android package and supported installation method are still to be confirmed.
- Users should not rely on the current development installation process as the final client installation procedure.

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
| Fragmented         |    1 |
| Present / Complete |    2 |

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
