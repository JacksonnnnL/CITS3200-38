import {
    describe,
    expect,
    it
} from "vitest";

import {
    STATE_CODES,
    stateToCode,
    buildExportRows,
    escapeCsvValue,
    rowsToCsv
} from "../www/js/skeletonExport.js";

import {
    PRESERVATION_STATES
} from "../www/js/data.js";


// ========================================
// State Codes
// ========================================

describe("stateToCode", () => {

    it("converts absent to 0", () => {

        expect(
            stateToCode(
                PRESERVATION_STATES.ABSENT
            )
        ).toBe(0);
    });


    it("converts fragmented to 1", () => {

        expect(
            stateToCode(
                PRESERVATION_STATES.PRESENT_FRAGMENTED
            )
        ).toBe(1);
    });


    it("converts complete to 2", () => {

        expect(
            stateToCode(
                PRESERVATION_STATES.PRESENT_COMPLETE
            )
        ).toBe(2);
    });


    it("returns blank for unknown states", () => {

        expect(
            stateToCode("unknown")
        ).toBe("");
    });

});

// ========================================
// Bone conversion
// ========================================

describe("buildExportRows", () => {

    it("converts a stored bone state into an export row", () => {

        const zoneStates = [
            {
                bone: "femur_right",
                side: "",
                zone: "femur_right",
                state:
                    PRESERVATION_STATES.PRESENT_COMPLETE
            }
        ];


        const rows =
            buildExportRows(zoneStates);


        expect(rows).toHaveLength(1);

        expect(rows[0]).toEqual({
            bone_id: "femur_right",
            element_code: "FEM-R",
            element_label: "Right femur",
            side: "",
            zone: "femur_right",
            state_code: 2,
            state: "present-complete"
        });
    });

});

// ========================================
// Test CSV formatting
// ========================================

describe("escapeCsvValue", () => {

    it("leaves simple text unchanged", () => {

        expect(
            escapeCsvValue("femur_right")
        ).toBe("femur_right");
    });


    it("wraps values containing commas", () => {

        expect(
            escapeCsvValue("Femur, right")
        ).toBe('"Femur, right"');
    });


    it("escapes quotation marks", () => {

        expect(
            escapeCsvValue('Bone "A"')
        ).toBe('"Bone ""A"""');
    });

});

// ========================================
// Test for completing CSV string
// ========================================

describe("rowsToCsv", () => {

    it("creates CSV headers and data rows", () => {

        const rows = [
            {
                bone_id: "femur_right",
                element_code: "FEM-R",
                element_label: "Right femur",
                side: "",
                zone: "femur_right",
                state_code: 2,
                state: "present-complete"
            },

            {
                bone_id: "tibia_left",
                element_code: "TIB-L",
                element_label: "Left tibia",
                side: "",
                zone: "tibia_left",
                state_code: 1,
                state: "present-fragmented"
            }
        ];


        const csv =
            rowsToCsv(rows);


        console.log(csv);


        expect(csv).toContain(
            "bone_id,element_code,element_label,side,zone,state_code,state"
        );

        expect(csv).toContain(
            "femur_right,FEM-R,Right femur,,femur_right,2,present-complete"
        );

        expect(csv).toContain(
            "tibia_left,TIB-L,Left tibia,,tibia_left,1,present-fragmented"
        );
    });

});