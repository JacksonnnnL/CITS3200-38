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

    it("includes Adult and Child SVG containers", () => {
        expect(CONTAINER_IDS.has("skeletal_system")).toBe(true);
        expect(CONTAINER_IDS.has("child_skeletal_system")).toBe(true);
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
    it("maps adult to 'adult'", () => {
        expect(folderForAge(AGE_CATEGORIES.ADULT)).toBe("adult");
    });

    it("maps child to its asset folder", () => {
        expect(folderForAge(AGE_CATEGORIES.CHILD)).toBe("child");
        expect(folderForAge("CHILD")).toBe("child");
    });

    it("returns null for ages without assets", () => {
        expect(folderForAge(AGE_CATEGORIES.ADOLESCENT)).toBe(null);
        expect(folderForAge(AGE_CATEGORIES.INFANT)).toBe(null);
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
    it("has adult and child entries; adolescent and infant remain unavailable", () => {
        expect(AGE_FOLDER_MAP[AGE_CATEGORIES.ADULT]).toBe("adult");
        expect(AGE_FOLDER_MAP[AGE_CATEGORIES.CHILD]).toBe("child");
        expect(AGE_FOLDER_MAP[AGE_CATEGORIES.ADOLESCENT]).toBeUndefined();
        expect(AGE_FOLDER_MAP[AGE_CATEGORIES.INFANT]).toBeUndefined();
    });
});

describe("overviewFileForAge", () => {
    it("keeps the Adult overview filename", () => {
        expect(overviewFileForAge("adult")).toBe("skeletal_system.svg");
    });

    it("uses the supplied Child overview filename", () => {
        expect(overviewFileForAge("child")).toBe("child_skeletal_system.svg");
        expect(overviewFileForAge("CHILD")).toBe("child_skeletal_system.svg");
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
        expect(isSelectableBoneGroup(group, "adult")).toBe(true);
        expect(isSelectableBoneGroup(group, "child")).toBe(true);
    });

    it("keeps Child parent shapes separate from nested parts", () => {
        const doc = svgDocument(`
            <g id="FEM_L">
                <g id="Vector_1"><path id="own" /></g>
                <g id="FEM_L2"><path id="part" /></g>
            </g>
        `);
        const parent = doc.getElementById("FEM_L");
        const part = doc.getElementById("FEM_L2");

        expect(hasRealBoneSubgroups(parent)).toBe(true);
        expect(boneShapesForGroup(parent, "child").map(s => s.id)).toEqual(["own"]);
        expect(boneShapesForGroup(part, "child").map(s => s.id)).toEqual(["part"]);
        expect(isSelectableBoneGroup(parent, "child")).toBe(true);
        expect(isSelectableBoneGroup(part, "child")).toBe(true);

        expect(boneShapesForGroup(parent, "adult").map(s => s.id))
            .toEqual(["own", "part"]);
        expect(isSelectableBoneGroup(parent, "adult")).toBe(false);
        expect(isSelectableBoneGroup(part, "adult")).toBe(true);
    });

    it("skips Child parents with no shapes of their own", () => {
        const doc = svgDocument(`
            <g id="FEM_L"><g id="FEM_L2"><path /></g></g>
        `);

        expect(isSelectableBoneGroup(doc.getElementById("FEM_L"), "child"))
            .toBe(false);
    });

    it("skips containers, empty groups and decorative-only Child groups", () => {
        const doc = svgDocument(`
            <g id="pelvis"><path /></g>
            <g id="FEM_L"></g>
            <g id="FEM_R"><path opacity="0.5" /><rect data-hit-zone="1" /></g>
        `);

        for (const id of ["pelvis", "FEM_L", "FEM_R"]) {
            expect(isSelectableBoneGroup(doc.getElementById(id), "child"))
                .toBe(false);
        }
    });

    it("accepts every supported visible shape type for Child", () => {
        for (const tag of ["path", "polygon", "circle", "ellipse", "rect"]) {
            const doc = svgDocument(`
                <g id="FEM_L"><${tag} opacity="1" /></g>
            `);

            expect(isSelectableBoneGroup(doc.getElementById("FEM_L"), "child"))
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

    it("leaves Adult SVGs unchanged", () => {
        const doc = svgDocument(`<path id="RSU" />`);
        const before = doc.querySelector("svg").outerHTML;

        prepareSkeletonSvg(doc, "adult");

        expect(doc.querySelector("svg").outerHTML).toBe(before);
    });

    it("leaves Child SVGs without an RSU path unchanged", () => {
        const doc = svgDocument(`<g id="RSU"><path /></g>`);
        const before = doc.querySelector("svg").outerHTML;

        prepareSkeletonSvg(doc, "child");

        expect(doc.querySelector("svg").outerHTML).toBe(before);
    });
});
