import {
    describe,
    expect,
    it
} from "vitest";

import {
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
// Bone Conversion
// ========================================

describe("buildExportRows", () => {

    it("converts a stored bone state into an export row", () => {

        const zoneStates = [
            {
                bone: "FEM_R",
                side: "",
                zone: "FEM_R",
                state:
                    PRESERVATION_STATES.PRESENT_COMPLETE
            }
        ];


        const rows =
            buildExportRows(zoneStates);


        expect(rows).toHaveLength(1);

        expect(rows[0]).toEqual({
            bone_id: "FEM_R",
            element_code: "FEM_R",
            element_label: "Right femur",
            state_code: 2
        });
    });


    it("keeps non-MNI bones but leaves MNI fields blank", () => {

        const zoneStates = [
            {
                bone: "MAL_L",
                side: "",
                zone: "MAL_L",
                state:
                    PRESERVATION_STATES.PRESENT_COMPLETE
            }
        ];


        const rows =
            buildExportRows(zoneStates);


        expect(rows).toHaveLength(1);

        expect(rows[0]).toEqual({
            bone_id: "MAL_L",
            element_code: "",
            element_label: "",
            state_code: 2
        });
    });

});


// ========================================
// CSV Value Formatting
// ========================================

describe("escapeCsvValue", () => {

    it("leaves simple text unchanged", () => {

        expect(
            escapeCsvValue("FEM_R")
        ).toBe("FEM_R");
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


    it("returns blank for null values", () => {

        expect(
            escapeCsvValue(null)
        ).toBe("");
    });

});


// ========================================
// CSV String Creation
// ========================================

describe("rowsToCsv", () => {

    it("creates CSV headers and data rows", () => {

        const rows = [
            {
                bone_id: "FEM_R",
                element_code: "FEM_R",
                element_label: "Right femur",
                state_code: 2
            },

            {
                bone_id: "TIB_L",
                element_code: "TIB_L",
                element_label: "Left tibia",
                state_code: 1
            }
        ];


        const csv =
            rowsToCsv(rows);


        expect(csv).toContain(
            "bone_id,element_code,element_label,state_code"
        );

        expect(csv).toContain(
            "FEM_R,FEM_R,Right femur,2"
        );

        expect(csv).toContain(
            "TIB_L,TIB_L,Left tibia,1"
        );
    });


    it("supports rows with no MNI mapping", () => {

        const rows = [
            {
                bone_id: "MAL_L",
                element_code: "",
                element_label: "",
                state_code: 2
            }
        ];


        const csv =
            rowsToCsv(rows);


        expect(csv).toContain(
            "MAL_L,,,2"
        );
    });

});