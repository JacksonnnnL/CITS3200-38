import { describe, expect, it } from "vitest";

import {
    CONTAINER_IDS,
    UNMARKED,
    STATE_COLORS,
    STATE_LABELS,
    STATE_DOTS,
    AGE_FOLDER_MAP,
    isNonBoneId,
    folderForAge
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

    it("rejects internal wrappers", () => {
        expect(isNonBoneId("Vector_1")).toBe(true);
        expect(isNonBoneId("Group 16")).toBe(true);
        expect(isNonBoneId("clipPath123")).toBe(true);
        expect(isNonBoneId("defs1")).toBe(true);
        expect(isNonBoneId("mask2")).toBe(true);
    });

    it("accepts real bone ids", () => {
        expect(isNonBoneId("femur_left")).toBe(false);
        expect(isNonBoneId("frontal_right")).toBe(false);
        expect(isNonBoneId("cervical_3")).toBe(false);
        expect(isNonBoneId("rib_7_left")).toBe(false);
    });
});

describe("folderForAge", () => {
    it("maps adult to 'adult'", () => {
        expect(folderForAge(AGE_CATEGORIES.ADULT)).toBe("adult");
    });

    it("returns null for ages without assets", () => {
        expect(folderForAge(AGE_CATEGORIES.CHILD)).toBe(null);
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
        expect(STATE_COLORS[PRESERVATION_STATES.ABSENT]).toBe("#d32f2f");
    });
});

describe("AGE_FOLDER_MAP", () => {
    it("has an adult entry and no child/adolescent/infant entry yet", () => {
        expect(AGE_FOLDER_MAP[AGE_CATEGORIES.ADULT]).toBe("adult");
        expect(AGE_FOLDER_MAP[AGE_CATEGORIES.CHILD]).toBeUndefined();
        expect(AGE_FOLDER_MAP[AGE_CATEGORIES.ADOLESCENT]).toBeUndefined();
        expect(AGE_FOLDER_MAP[AGE_CATEGORIES.INFANT]).toBeUndefined();
    });
});