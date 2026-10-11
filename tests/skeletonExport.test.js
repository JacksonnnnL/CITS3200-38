import {
    describe,
    expect,
    it
} from "vitest";

import {
    stateToCode,
    buildExportRows,
    escapeCsvValue,
    rowsToCsv,
    saveCsvAndJpeg
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


    it("converts fragmented to 2", () => {

        expect(
            stateToCode(
                PRESERVATION_STATES.PRESENT_FRAGMENTED
            )
        ).toBe(2);
    });


    it("converts complete to 1", () => {

        expect(
            stateToCode(
                PRESERVATION_STATES.PRESENT_COMPLETE
            )
        ).toBe(1);
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
            state_code: 1
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
            state_code: 1
        });
    });

});

it("exports fragmented bones with state code 1", () => {

    const zoneStates = [
        {
            bone: "FEM_R",
            side: "",
            zone: "FEM_R",
            state: PRESERVATION_STATES.PRESENT_FRAGMENTED
        }
    ];

    const rows = buildExportRows(zoneStates);

    expect(rows[0].state_code).toBe(2);
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
                state_code: 1
            },

            {
                bone_id: "TIB_L",
                element_code: "TIB_L",
                element_label: "Left tibia",
                state_code: 2
            }
        ];


        const csv =
            rowsToCsv(rows);


        expect(csv).toContain(
            "bone_id,element_code,element_label,state_code"
        );

        expect(csv).toContain(
            "FEM_R,FEM_R,Right femur,1"
        );

        expect(csv).toContain(
            "TIB_L,TIB_L,Left tibia,2"
        );
    });


    it("supports rows with no MNI mapping", () => {

        const rows = [
            {
                bone_id: "MAL_L",
                element_code: "",
                element_label: "",
                state_code: 1
            }
        ];


        const csv =
            rowsToCsv(rows);


        expect(csv).toContain(
            "MAL_L,,,1"
        );
    });

});

describe('Two-file exports', () => {
    it('saves separate CSV and JPEG files directly to Android Downloads', async () => {
        const calls = [];
        const originalCapacitor = globalThis.Capacitor;
        const originalReader = globalThis.FileReader;
        globalThis.Capacitor = {
            getPlatform: () => 'android',
            isNativePlatform: () => true,
            Plugins: {
                OsteoMapDownloads: {
                    async save(options) {
                        calls.push(options);
                        return { directory: 'Downloads', fileName: options.fileName };
                    }
                }
            }
        };
        globalThis.FileReader = class {
            readAsDataURL(blob) {
                blob.arrayBuffer().then(buffer => {
                    const bytes = new Uint8Array(buffer);
                    this.result = 'data:' + blob.type + ';base64,' +
                        btoa(Array.from(bytes, b => String.fromCharCode(b)).join(''));
                    this.onload();
                });
            }
        };
        try {
            await saveCsvAndJpeg(
                new Blob(['bone_id,state_code\nFEM_R,2'], { type: 'text/csv' }),
                new Blob([new Uint8Array([255, 216, 255, 217])], { type: 'image/jpeg' }),
                'SITE123_IND001'
            );
            expect(calls).toHaveLength(2);
            expect(calls.map(({ fileName }) => fileName)).toEqual([
                'SITE123_IND001_data.csv',
                'SITE123_IND001_skeleton.jpg'
            ]);
            expect(calls.map(({ mimeType }) => mimeType)).toEqual(['text/csv', 'image/jpeg']);
            expect(calls.every(({ fileName }) => !fileName.endsWith('.zip'))).toBe(true);
        } finally {
            globalThis.Capacitor = originalCapacitor;
            globalThis.FileReader = originalReader;
        }
    });
});
