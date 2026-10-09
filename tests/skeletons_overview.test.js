import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { JSDOM } from "jsdom";
import { readFileSync } from "node:fs";

const mocks = vi.hoisted(() => ({
    individual: {
        id: "testid",
        accessionNumber: "ACC1",
        siteId: "siteid1",
        ageCategory: "child",
        date: "2026-01-01",
        notes: "notes1"
    },
    rows: [],
    getAccessionById: vi.fn(),
    getSiteById: vi.fn(),
    getZoneStatesByAccession: vi.fn(),
    updateAccession: vi.fn()
}));

vi.mock("../www/js/data.js", async (importOriginal) => ({
    ...await importOriginal(),
    getAccessionById: mocks.getAccessionById,
    getSiteById: mocks.getSiteById,
    getZoneStatesByAccession: mocks.getZoneStatesByAccession,
    updateAccession: mocks.updateAccession
}));

const AGES = ["adult", "child", "infant", "adolescent"];
const PART_AGES = ["child", "infant", "adolescent"];
const OVERVIEW_FILES = [
    ["adult", "skeletal_system.svg"],
    ["child", "child_skeletal_system.svg"],
    ["infant", "infant_skeletal_system.svg"],
    ["adolescent", "adolescent_skeletal_system.svg"]
];

const GREEN = "#2e7d32";
const ORANGE = "#ed6c02";
const GREY = "#9e9e9e";

const SEGMENTS = [
    ["cranium", "cranium"],
    ["axial", "axial_skeleton"],
    ["pelvis", "pelvis"],
    ["right-upper", "right_upper_limb"],
    ["left-upper", "left_upper_limb"],
    ["right-lower", "right_lower_limb"],
    ["left-lower", "left_lower_limb"]
];

let dom;
let page;
let fetchMock;
let pageLocation;

function svg(content) {
    return `<svg xmlns="http://www.w3.org/2000/svg">${content}</svg>`;
}

function element(id) {
    return document.getElementById(id);
}

function shape(id) {
    return element(id).querySelector("path");
}

function click(target, x = 0, y = 0) {
    target.dispatchEvent(new dom.window.MouseEvent("click", {
        bubbles: true,
        clientX: x,
        clientY: y
    }));
}

function destination() {
    return new URL(pageLocation.href, "http://localhost/");
}

async function openPage(
    age = "child",
    content = svg('<g id="pelvis"><g id="PEL_L"><path /></g></g>')
) {
    dom?.window.close();
    vi.resetModules();
    mocks.individual.ageCategory = age;

    dom = new JSDOM(`<!DOCTYPE html><html><body>
        <span id="accession-display"></span>
        <span id="site-display"></span>
        <button id="back-to-site-button"></button>
        <span id="individual-date-display"></span>
        <textarea id="notes-description"></textarea>
        <div id="skeleton-board"></div>
        <button id="expand-btn"></button>
    </body></html>`, {
        url: "http://localhost/skeletons_overview.html?accessionId=testid"
    });

    pageLocation = {
        search: dom.window.location.search,
        href: dom.window.location.href
    };

    vi.stubGlobal("window", { location: pageLocation });
    vi.stubGlobal("document", dom.window.document);
    vi.stubGlobal("getComputedStyle", dom.window.getComputedStyle.bind(dom.window));
    vi.stubGlobal("CSS", { escape: value => value });
    vi.stubGlobal("alert", vi.fn());
    vi.stubGlobal("requestAnimationFrame", callback => {
        callback();
        return 1;
    });

    dom.window.SVGElement.prototype.getBBox = function() {
        const values = (this.getAttribute("data-bbox") || "0 0 100 100")
            .split(" ").map(Number);
        return { x: values[0], y: values[1], width: values[2], height: values[3] };
    };

    dom.window.SVGElement.prototype.createSVGPoint = function() {
        return {
            x: 0,
            y: 0,
            matrixTransform() {
                return { x: this.x, y: this.y };
            }
        };
    };

    dom.window.SVGElement.prototype.getScreenCTM = function() {
        return { inverse: () => ({}) };
    };

    fetchMock = vi.fn(async () => ({
        ok: true,
        text: async () => content
    }));

    vi.stubGlobal("fetch", fetchMock);

    page = await import("../www/js/skeletons_overview.js");
    document.dispatchEvent(new dom.window.Event("DOMContentLoaded"));

    await vi.waitFor(() => {
        expect(document.querySelector("#skeleton-board svg")?.style.cursor)
            .toBe("pointer");
    });
}

beforeEach(() => {
    vi.clearAllMocks();
    mocks.rows = [];

    mocks.getAccessionById.mockImplementation(async () => ({
        ...mocks.individual
    }));

    mocks.getSiteById.mockResolvedValue({
        id: "siteid1",
        code: "SITE-1"
    });

    mocks.getZoneStatesByAccession.mockImplementation(async () => [
        ...mocks.rows
    ]);

    mocks.updateAccession.mockResolvedValue({});
});

afterEach(() => {
    dom?.window.close();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

describe("isDecorativeShape (overview)", () => {
    it("returns true for shapes with opacity < 1", async () => {
        await openPage();

        for (const opacity of ["0.5", "0.82", "0.1"]) {
            const path = document.createElementNS(
                "http://www.w3.org/2000/svg",
                "path"
            );
            path.setAttribute("opacity", opacity);

            expect(page.isDecorativeShape(path)).toBe(true);
        }
    });

    it("returns false for shapes with opacity 1", async () => {
        await openPage();

        const path = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "path"
        );
        path.setAttribute("opacity", "1");

        expect(page.isDecorativeShape(path)).toBe(false);
    });

    it("returns false for shapes with no opacity attribute", async () => {
        await openPage();

        expect(page.isDecorativeShape(shape("PEL_L"))).toBe(false);
    });
});

describe("isGhostGroup (overview)", () => {
    it("returns true when the group has opacity < 1 as an attribute", async () => {
        await openPage();

        for (const opacity of ["0.1", "0.5"]) {
            const group = document.createElementNS(
                "http://www.w3.org/2000/svg",
                "g"
            );
            group.setAttribute("opacity", opacity);

            expect(page.isGhostGroup(group)).toBe(true);
        }
    });

    it("returns true when the group has faded computed opacity", async () => {
        await openPage();
        element("PEL_L").style.opacity = "0.5";

        expect(page.isGhostGroup(element("PEL_L"))).toBe(true);
    });

    it("returns false when the group has opacity 1", async () => {
        await openPage();
        element("PEL_L").setAttribute("opacity", "1");

        expect(page.isGhostGroup(element("PEL_L"))).toBe(false);
    });

    it("returns false when the group has no opacity attribute", async () => {
        await openPage();

        expect(page.isGhostGroup(element("PEL_L"))).toBe(false);
    });
});

describe("overview loading", () => {
    it.each(OVERVIEW_FILES)("loads the correct overview file for %s", async (age, file) => {
        await openPage(age);

        expect(fetchMock).toHaveBeenCalledWith(
            `assets/skeletons/${age}/${file}`
        );
        expect(mocks.getZoneStatesByAccession).toHaveBeenCalledWith("testid");
        expect(element("accession-display").textContent).toBe("ACC1");
        expect(element("site-display").textContent).toBe("SITE-1");
    });
});

describe("saved overview colours", () => {
    it.each(PART_AGES.flatMap(age => [
        [age, "present-complete", GREEN],
        [age, "present-fragmented", ORANGE],
        [age, "absent", GREY]
    ]))(
        "restores %s %s on a part without changing its parent",
        async (age, state, colour) => {
            mocks.rows = [{ bone: "FEM_L2", state }];

            await openPage(age, svg(`
                <g id="left_lower_limb">
                    <g id="FEM_L">
                        <g id="Vector_1"><path id="own" /></g>
                        <g id="FEM_L2"><path id="part" /></g>
                    </g>
                </g>
            `));

            expect(element("part").style.fill).toBe(colour);
            expect(element("own").style.fill).toBe("");
        }
    );

    it.each(PART_AGES)("keeps different saved colours on %s parents and parts", async age => {
        mocks.rows = [
            { bone: "FEM_L", state: "present-complete" },
            { bone: "FEM_L2", state: "absent" }
        ];

        await openPage(age, svg(`
            <g id="left_lower_limb">
                <g id="FEM_L">
                    <g id="Vector_1">
                        <path id="own" />
                        <path id="decoration" opacity="0.5" />
                    </g>
                    <g id="FEM_L2"><path id="part" /></g>
                </g>
            </g>
        `));

        expect(element("own").style.fill).toBe(GREEN);
        expect(element("part").style.fill).toBe(GREY);
        expect(element("decoration").style.fill).toBe("");
        expect(
            element("FEM_L").querySelector(
                ':scope > rect[data-hit-zone]'
            ).style.fill
        ).toBe("");
    });

    it("keeps Adult colouring and parent-group rules unchanged", async () => {
        mocks.rows = [
            { bone: "FEM_L", state: "present-complete" },
            { bone: "FEM_L2", state: "absent" }
        ];

        await openPage("adult", svg(`
            <g id="left_lower_limb">
                <g id="FEM_L">
                    <path id="own" />
                    <g id="FEM_L2"><path id="part" /></g>
                </g>
            </g>
        `));

        expect(element("own").style.fill).toBe("");
        expect(element("part").style.fill).toBe(GREY);
        expect(
            element("FEM_L").querySelector(':scope > rect[data-hit-zone]')
        ).toBe(null);
    });

    it("restores saved colours on linked Child skull views", async () => {
        mocks.rows = [
            { bone: "OCC_L_lat_l", state: "present-complete" },
            { bone: "OCC_R_lat_r", state: "present-complete" }
        ];

        await openPage("child", svg(`
            <g id="cranium">
                <g id="OCC_L_lat_l"><path /></g>
                <g id="OCC_R_lat_r"><path /></g>
                <g id="PAR_R_ant"><path /></g>
            </g>
        `));

        expect(shape("OCC_L_lat_l").style.fill).toBe(GREEN);
        expect(shape("OCC_R_lat_r").style.fill).toBe(GREEN);
        expect(shape("PAR_R_ant").style.fill).toBe("");
    });
});

describe("overview hit zones", () => {
    it.each(PART_AGES)("adds separate hit zones for %s parents and parts", async age => {
        await openPage(age, svg(`
            <g id="left_lower_limb">
                <g id="FEM_L">
                    <g id="Vector_1"><path /></g>
                    <g id="FEM_L2"><path /></g>
                    <g id="FEM_L3" opacity="0.3"><path /></g>
                </g>
            </g>
        `));

        for (const id of ["FEM_L", "FEM_L2"]) {
            const rect = element(id).querySelector(
                ':scope > rect[data-hit-zone]'
            );

            expect(rect).not.toBe(null);
            expect(rect.getAttribute("pointer-events")).toBe("all");
            expect(rect.getAttribute("fill")).toBe("none");
            expect(rect.getAttribute("x")).toBe("-4");
            expect(rect.getAttribute("width")).toBe("108");
        }

        for (const id of ["left_lower_limb", "Vector_1", "FEM_L3"]) {
            expect(
                element(id).querySelector(':scope > rect[data-hit-zone]')
            ).toBe(null);
        }
    });

    it("prepares the Child RSU path for colour restoration and clicking", async () => {
        mocks.rows = [{ bone: "RSU", state: "present-complete" }];

        await openPage(
            "child",
            svg('<g id="axial_skeleton"><path id="RSU" /></g>')
        );

        expect(element("RSU").localName).toBe("g");
        expect(shape("RSU").style.fill).toBe(GREEN);
        expect(
            element("RSU").querySelector(':scope > rect[data-hit-zone]')
        ).not.toBe(null);

        click(shape("RSU"));

        expect(destination().searchParams.get("segment")).toBe("axial");
    });
});

describe("overview navigation", () => {
    it.each(AGES)(
        "opens each segment with the same individual for %s",
        async age => {
            await openPage(age, svg(
                SEGMENTS.map(([, root], index) => `
                    <g id="${root}" data-bbox="${index * 300} 0 200 200">
                        <g id="bone_${index}"><path /></g>
                    </g>
                `).join("")
            ));

            for (const [index, [segment]] of SEGMENTS.entries()) {
                click(shape(`bone_${index}`));

                expect(destination().pathname)
                    .toBe("/skeletons_selection.html");
                expect(destination().searchParams.get("accessionId"))
                    .toBe("testid");
                expect(destination().searchParams.get("segment"))
                    .toBe(segment);
            }
        }
    );

    it.each(PART_AGES)("uses the nearest segment root for a nested %s part", async age => {
        await openPage(age, svg(`
            <g id="left_lower_limb">
                <g id="FEM_L">
                    <path />
                    <g id="FEM_L2"><path /></g>
                </g>
            </g>
        `));

        click(shape("FEM_L2"));

        expect(destination().searchParams.get("segment"))
            .toBe("left-lower");
    });

    it("opens a segment when its invisible bone hit zone is clicked", async () => {
        await openPage();

        click(element("PEL_L").querySelector(
            ':scope > rect[data-hit-zone]'
        ));

        expect(destination().searchParams.get("segment")).toBe("pelvis");
    });

    it.each(PART_AGES.flatMap(age => [
        [age, "pelvis", "pelvis", 20, 20],
        [age, "axial", "axial_skeleton", 20, 20],
        [age, "cranium", "cranium", 100, 100]
    ]))(
        "uses the full %s %s box and keeps Adult box rules",
        async (age, segment, root, x, y) => {
            const content = svg(`
                <g id="${root}" data-bbox="0 0 200 200">
                    <g id="bone"><path /></g>
                </g>
            `);

            await openPage(age, content);

            click(document.querySelector("#skeleton-board svg"), x, y);

            expect(destination().searchParams.get("segment")).toBe(segment);

            await openPage("adult", content);

            click(document.querySelector("#skeleton-board svg"), x, y);

            expect(destination().pathname)
                .toBe("/skeletons_overview.html");
        }
    );

    it.each(AGES)(
        "returns to the same site for %s",
        async age => {
            await openPage(age);
            element("back-to-site-button").click();

            expect(destination().pathname).toBe("/site.html");
            expect(destination().searchParams.get("siteId")).toBe("siteid1");
        }
    );
});

describe("supplied overview assets", () => {
    it.each(OVERVIEW_FILES)(
        "loads the supplied %s overview and restores a saved pelvis state",
        async (age, file) => {
            const bone = age === "infant" ? "PEL_L1" : "PEL_L";
            mocks.rows = [{ bone, state: "present-complete" }];

            const content = readFileSync(
                new URL(
                    `../www/assets/skeletons/${age}/${file}`,
                    import.meta.url
                ),
                "utf8"
            );

            await openPage(age, content);

            for (const [, root] of SEGMENTS) {
                expect(element(root)).not.toBe(null);
            }

            expect(shape(bone).style.fill).toBe(GREEN);

            click(shape(bone));

            expect(destination().searchParams.get("segment"))
                .toBe("pelvis");
        }
    );
});


describe("updated overview groups", () => {
    it.each([
        ["infant", "infant_skeletal_system.svg", "axial", [
            ["ST_MAN", "present-complete", GREEN],
            ["ST_STE", "absent", GREY],
            ["C2_C1", "present-fragmented", ORANGE],
            ["C2_C2", "present-complete", GREEN]
        ]],
        ["adolescent", "adolescent_skeletal_system.svg", "cranium", [
            ["CRA", "present-complete", GREEN],
            ["NAS_L_ant", "present-fragmented", ORANGE],
            ["NAS_R_ant", "absent", GREY],
            ["MAX_R_inf", "present-complete", GREEN]
        ]]
    ])(
        "restores separate states on the corrected %s overview groups",
        async (age, file, segment, rows) => {
            mocks.rows = rows.map(([bone, state]) => ({ bone, state }));

            const content = readFileSync(
                new URL(
                    `../www/assets/skeletons/${age}/${file}`,
                    import.meta.url
                ),
                "utf8"
            );

            await openPage(age, content);

            for (const [id, , colour] of rows) {
                expect(element(id).localName).toBe("g");
                expect(shape(id).style.fill).toBe(colour);
                expect(
                    element(id).querySelector(':scope > rect[data-hit-zone]')
                ).not.toBe(null);

                click(shape(id));

                expect(destination().searchParams.get("segment")).toBe(segment);
            }

            if (age === "infant") {
                expect(element("C2_C")).toBe(null);
            } else {
                expect(element("NAS")).toBe(null);
            }
        }
    );
});
