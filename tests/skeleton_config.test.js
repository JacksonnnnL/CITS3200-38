import { describe, expect, it } from "vitest";
import { JSDOM } from "jsdom";

import {
    CONTAINER_IDS,
    UNMARKED,
    STATE_COLORS,
    STATE_LABELS,
    STATE_DOTS,
    AGE_FOLDER_MAP,
    isNonBoneId,
    folderForAge,
    overviewFileForAge,
    hasRealBoneSubgroups,
    boneShapesForGroup,
    isSelectableBoneGroup,
    prepareSkeletonSvg
} from "../www/js/skeleton_config.js";

import {
    PRESERVATION_STATES,
    AGE_CATEGORIES
} from "../www/js/data.js";

const AGE_CASES = [
    [AGE_CATEGORIES.ADULT, "adult", "skeletal_system.svg"],
    [AGE_CATEGORIES.CHILD, "child", "child_skeletal_system.svg"],
    [AGE_CATEGORIES.INFANT, "infant", "infant_skeletal_system.svg"],
    [AGE_CATEGORIES.ADOLESCENT, "adolescent", "adolescent_skeletal_system.svg"]
];

const PART_AGES = ["child", "infant", "adolescent"];

describe("isNonBoneId", () => {
    it("rejects empty / null ids", () => {
        expect(isNonBoneId("")).toBe(true);
        expect(isNonBoneId(null)).toBe(true);
        expect(isNonBoneId(undefined)).toBe(true);
    });

    it("rejects container / view roots", () => {
        for (const id of CONTAINER_IDS) {
            expect(isNonBoneId(id)).toBe(true);
        }
    });

    it("includes all four age SVG containers", () => {
        expect(CONTAINER_IDS.has("skeletal_system")).toBe(true);
        expect(CONTAINER_IDS.has("child_skeletal_system")).toBe(true);
        expect(CONTAINER_IDS.has("infant_skeletal_system")).toBe(true);
        expect(CONTAINER_IDS.has("adolescent_skeletal_system")).toBe(true);
        expect(CONTAINER_IDS.has("skull_top")).toBe(true);
        expect(CONTAINER_IDS.has("auditory_ossicles_left")).toBe(true);
        expect(CONTAINER_IDS.has("auditory_ossicles_right")).toBe(true);
        expect(isNonBoneId("skeletal_system")).toBe(true);
        expect(isNonBoneId("skull_top")).toBe(true);
        expect(isNonBoneId("auditory_ossicles_left")).toBe(true);
        expect(isNonBoneId("auditory_ossicles_right")).toBe(true);
    });

    it("rejects internal wrappers", () => {
        expect(isNonBoneId("Vector_1")).toBe(true);
        expect(isNonBoneId("Group 16")).toBe(true);
        expect(isNonBoneId("clipPath123")).toBe(true);
        expect(isNonBoneId("defs1")).toBe(true);
        expect(isNonBoneId("mask2")).toBe(true);
    });

    it("accepts Adult bone IDs", () => {
        expect(isNonBoneId("FEM_L")).toBe(false);
        expect(isNonBoneId("FEM_R")).toBe(false);
        expect(isNonBoneId("RIB_L1")).toBe(false);
        expect(isNonBoneId("RIB_R1")).toBe(false);
        expect(isNonBoneId("PEL_R")).toBe(false);
        expect(isNonBoneId("MC1_R")).toBe(false);
        expect(isNonBoneId("MT5_L")).toBe(false);
        expect(isNonBoneId("CUN_L1")).toBe(false);
        expect(isNonBoneId("PPH1_R")).toBe(false);
        expect(isNonBoneId("DPF1_L")).toBe(false);
        expect(isNonBoneId("STN")).toBe(false);
        expect(isNonBoneId("SAC")).toBe(false);
        expect(isNonBoneId("HYD")).toBe(false);
        expect(isNonBoneId("VC1")).toBe(false);
        expect(isNonBoneId("VC2")).toBe(false);

        expect(isNonBoneId("CRA_ant")).toBe(false);
        expect(isNonBoneId("PAR_R_post")).toBe(false);
        expect(isNonBoneId("TEM_L_inf")).toBe(false);
        expect(isNonBoneId("OCC_lat_r")).toBe(false);

        expect(isNonBoneId("MND")).toBe(false);
        expect(isNonBoneId("MND_L")).toBe(false);
        expect(isNonBoneId("MND_R")).toBe(false);
    });
});

describe("folderForAge", () => {
    it.each(AGE_CASES)("maps %s to its asset folder", (age, folder) => {
        expect(folderForAge(age)).toBe(folder);
        expect(folderForAge(age.toUpperCase())).toBe(folder);
    });

    it("is case-insensitive", () => {
        expect(folderForAge("ADULT")).toBe("adult");
        expect(folderForAge("Adult")).toBe("adult");
    });

    it("returns null for empty / unknown input", () => {
        expect(folderForAge("")).toBe(null);
        expect(folderForAge(null)).toBe(null);
        expect(folderForAge(undefined)).toBe(null);
        expect(folderForAge("martian")).toBe(null);
    });
});

describe("state maps", () => {
    it("STATE_COLORS has an entry for every preservation state", () => {
        for (const s of Object.values(PRESERVATION_STATES)) {
            expect(STATE_COLORS[s]).toBeTruthy();
            expect(STATE_LABELS[s]).toBeTruthy();
            expect(STATE_DOTS[s]).toBeTruthy();
        }
    });

    it("all state maps include the unmarked pseudo-state", () => {
        expect(STATE_COLORS[UNMARKED]).toBeTruthy();
        expect(STATE_LABELS[UNMARKED]).toBeTruthy();
        expect(STATE_DOTS[UNMARKED]).toBeTruthy();
    });

    it("keys are driven by data.js constants, not hardcoded strings", () => {
        expect(STATE_COLORS[PRESERVATION_STATES.PRESENT_COMPLETE]).toBe("#2e7d32");
        expect(STATE_COLORS[PRESERVATION_STATES.PRESENT_FRAGMENTED]).toBe("#ed6c02");
        expect(STATE_COLORS[PRESERVATION_STATES.ABSENT]).toBe("#9e9e9e");
        expect(STATE_COLORS[UNMARKED]).toBe("transparent");
    });
});

describe("AGE_FOLDER_MAP", () => {
    it.each(AGE_CASES)("has an asset folder for %s", (age, folder) => {
        expect(AGE_FOLDER_MAP[age]).toBe(folder);
    });
});

describe("overviewFileForAge", () => {
    it.each(AGE_CASES)("uses the correct overview filename for %s", (age, folder, file) => {
        expect(overviewFileForAge(age)).toBe(file);
        expect(overviewFileForAge(age.toUpperCase())).toBe(file);
    });
});

function svgDocument(content) {
    return new JSDOM(`<svg xmlns="http://www.w3.org/2000/svg">${content}</svg>`)
        .window.document;
}

describe("bone group helpers", () => {
    it("accepts Child bone and table IDs", () => {
        for (const id of ["FEM_L2", "PEL_L3", "SAC_2", "RT1L", "C1N", "RSU"]) {
            expect(isNonBoneId(id)).toBe(false);
        }
    });

    it("ignores editor wrappers when checking for nested bones", () => {
        const doc = svgDocument(`
            <g id="FEM_L"><g id="Vector_1"><g id="Group 16">
                <path id="own" />
            </g></g></g>
        `);
        const group = doc.getElementById("FEM_L");

        expect(hasRealBoneSubgroups(group)).toBe(false);
        for (const [age] of AGE_CASES) {
            expect(isSelectableBoneGroup(group, age)).toBe(true);
        }
    });

    it.each(PART_AGES)("keeps %s parent shapes separate from nested parts", age => {
        const doc = svgDocument(`
            <g id="FEM_L">
                <g id="Vector_1"><path id="own" /></g>
                <g id="FEM_L2"><path id="part" /></g>
            </g>
        `);
        const parent = doc.getElementById("FEM_L");
        const part = doc.getElementById("FEM_L2");

        expect(hasRealBoneSubgroups(parent)).toBe(true);
        expect(boneShapesForGroup(parent, age).map(s => s.id)).toEqual(["own"]);
        expect(boneShapesForGroup(part, age).map(s => s.id)).toEqual(["part"]);
        expect(isSelectableBoneGroup(parent, age)).toBe(true);
        expect(isSelectableBoneGroup(part, age)).toBe(true);

        expect(boneShapesForGroup(parent, "adult").map(s => s.id))
            .toEqual(["own", "part"]);
        expect(isSelectableBoneGroup(parent, "adult")).toBe(false);
        expect(isSelectableBoneGroup(part, "adult")).toBe(true);
    });

    it.each(PART_AGES)("skips %s parents with no shapes of their own", age => {
        const doc = svgDocument(`
            <g id="FEM_L"><g id="FEM_L2"><path /></g></g>
        `);

        expect(isSelectableBoneGroup(doc.getElementById("FEM_L"), age))
            .toBe(false);
    });

    it.each(PART_AGES)("skips containers, empty groups and decorative-only %s groups", age => {
        const doc = svgDocument(`
            <g id="pelvis"><path /></g>
            <g id="FEM_L"></g>
            <g id="FEM_R"><path opacity="0.5" /><rect data-hit-zone="1" /></g>
        `);

        for (const id of ["pelvis", "FEM_L", "FEM_R"]) {
            expect(isSelectableBoneGroup(doc.getElementById(id), age))
                .toBe(false);
        }
    });

    it.each(PART_AGES)("accepts every supported visible shape type for %s", age => {
        for (const tag of ["path", "polygon", "circle", "ellipse", "rect"]) {
            const doc = svgDocument(`
                <g id="FEM_L"><${tag} opacity="1" /></g>
            `);

            expect(isSelectableBoneGroup(doc.getElementById("FEM_L"), age))
                .toBe(true);
        }
    });
});

describe("prepareSkeletonSvg", () => {
    it("wraps the Child RSU path once and preserves its geometry", () => {
        const doc = svgDocument(`
            <g id="axial_skeleton">
                <path id="RSU" d="M0 0 L10 10" />
            </g>
        `);
        const path = doc.getElementById("RSU");

        prepareSkeletonSvg(doc, "child");

        const group = doc.getElementById("RSU");

        expect(group.localName).toBe("g");
        expect(group.namespaceURI).toBe("http://www.w3.org/2000/svg");
        expect(group.firstElementChild).toBe(path);
        expect(path.hasAttribute("id")).toBe(false);
        expect(path.getAttribute("d")).toBe("M0 0 L10 10");
        expect(isSelectableBoneGroup(group, "child")).toBe(true);

        prepareSkeletonSvg(doc, "child");

        expect(doc.querySelectorAll('g[id="RSU"]')).toHaveLength(1);
    });

    it.each(["adult", "infant", "adolescent"])("leaves %s SVGs unchanged", age => {
        const doc = svgDocument(`<path id="RSU" />`);
        const before = doc.querySelector("svg").outerHTML;

        prepareSkeletonSvg(doc, age);

        expect(doc.querySelector("svg").outerHTML).toBe(before);
    });

    it("leaves Child SVGs without an RSU path unchanged", () => {
        const doc = svgDocument(`<g id="RSU"><path /></g>`);
        const before = doc.querySelector("svg").outerHTML;

        prepareSkeletonSvg(doc, "child");

        expect(doc.querySelector("svg").outerHTML).toBe(before);
    });
});


describe("Infant and Adolescent bone IDs", () => {
    it.each([
        ["infant", ["ST_MAN", "ST_STE", "C2_C1", "C2_C2", "TEM_L_ENDO", "MAN_L"]],
        ["adolescent", ["CRA", "NAS_L_ant", "NAS_R_ant", "MAX_R_inf"]]
    ])("recognises the current %s groups as selectable bones", (age, ids) => {
        const doc = svgDocument(
            ids.map(id => `<g id="${id}"><path /></g>`).join("")
        );

        for (const id of ids) {
            expect(isNonBoneId(id)).toBe(false);
            expect(isSelectableBoneGroup(doc.getElementById(id), age)).toBe(true);
        }
    });
});
