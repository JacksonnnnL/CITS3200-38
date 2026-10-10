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
    rows: new Map(),
    getAccessionById: vi.fn(),
    getSiteById: vi.fn(),
    getZoneStatesByAccession: vi.fn(),
    setZoneState: vi.fn(),
    clearZoneState: vi.fn()
}));

vi.mock("../www/js/data.js", async (importOriginal) => ({
    ...await importOriginal(),
    getAccessionById: mocks.getAccessionById,
    getSiteById: mocks.getSiteById,
    getZoneStatesByAccession: mocks.getZoneStatesByAccession,
    setZoneState: mocks.setZoneState,
    clearZoneState: mocks.clearZoneState
}));

const AGES = ["adult", "child", "infant", "adolescent"];
const PART_AGES = ["child", "infant", "adolescent"];

const GREEN = "#2e7d32";
const ORANGE = "#ed6c02";
const GREY = "#9e9e9e";
const HIGHLIGHT = "#007f7a";

const SEGMENTS = [
    ["cranium", "cranium.svg"],
    ["axial", "axial_skeleton.svg"],
    ["pelvis", "pelvis.svg"],
    ["right-upper", "right_upper_limb.svg"],
    ["left-upper", "left_upper_limb.svg"],
    ["right-lower", "right_lower_limb.svg"],
    ["left-lower", "left_lower_limb.svg"]
];

let dom;
let page;
let fetchMock;
let svgText;
let pageLocation;

function svg(content) {
    return `<svg xmlns="http://www.w3.org/2000/svg">${content}</svg>`;
}

function bones(ids) {
    return svg(ids.map(id => `
        <g id="${id}">
            <path d="M0 0 L10 0 L10 10 Z" />
        </g>
    `).join(""));
}

function element(id) {
    return document.getElementById(id);
}

function shape(id) {
    return element(id).querySelector("path");
}

function chooseState(state) {
    document.querySelector(`[data-state="${state}"]`).click();
}

async function markAll() {
    element("all-present-button").click();

    await vi.waitFor(() => {
        expect(element("all-present-button").disabled).toBe(false);
    });
}

function touch(type, points, target = element("skeleton-select-container")) {
    const event = new dom.window.Event(type, {
        bubbles: true,
        cancelable: true
    });
    Object.defineProperty(event, "touches", {
        value: points.map(([identifier, clientX, clientY]) => ({
            identifier,
            clientX,
            clientY
        }))
    });
    target.dispatchEvent(event);
    return event;
}

function pinch(multiplier) {
    touch("touchstart", [[1, 150, 150], [2, 250, 150]]);
    touch("touchmove", [
        [1, 200 - 50 * multiplier, 150],
        [2, 200 + 50 * multiplier, 150]
    ]);
    touch("touchend", []);
}

function drawing() {
    return document.querySelector("#skeleton-select-container svg");
}

async function openPage(
    age = "child",
    segment = "cranium",
    content = bones(["FEM_L"])
) {
    dom?.window.close();
    vi.resetModules();

    mocks.individual.ageCategory = age;
    svgText = content;

    dom = new JSDOM(
        `<!DOCTYPE html><html><body>
            <span id="accession-display"></span>
            <span id="site-display"></span>
            <button id="back-to-overview-button"></button>
            <div id="segment-tabs"></div>
            <div id="selected-segment-name"></div>
            <button id="all-present-button" class="segment-tab" disabled></button>
            <div id="skeleton-select-container"></div>
            <div id="details-box" style="display:none">
                <button id="details-close"></button>
                <div id="detail-bone-name"></div>
                <span id="detail-status-text"></span>
                <span id="detail-status-dot"></span>
                <button class="state-btn" data-state="present-complete"></button>
                <button class="state-btn" data-state="present-fragmented"></button>
                <button class="state-btn" data-state="absent"></button>
            </div>
        </body></html>`,
        {
            url: `http://localhost/skeletons_selection.html?accessionId=testid&segment=${segment}`
        }
    );

    pageLocation = {
        search: dom.window.location.search,
        href: dom.window.location.href
    };

    vi.stubGlobal("window", {
        location: pageLocation,
        MouseEvent: dom.window.MouseEvent
    });

    vi.stubGlobal("document", dom.window.document);
    vi.stubGlobal(
        "getComputedStyle",
        dom.window.getComputedStyle.bind(dom.window)
    );
    vi.stubGlobal("CSS", { escape: value => value });
    vi.stubGlobal("alert", vi.fn());

    const viewer = element("skeleton-select-container");
    Object.defineProperties(viewer, {
        clientWidth: { configurable: true, value: 400 },
        clientHeight: { configurable: true, value: 300 }
    });
    viewer.getBoundingClientRect = () => ({
        x: 0, y: 0, left: 0, top: 0,
        right: 400, bottom: 300, width: 400, height: 300
    });

    for (const [property, dimension, viewport] of [
        ["scrollLeft", "width", 400],
        ["scrollTop", "height", 300]
    ]) {
        let offset = 0;
        Object.defineProperty(viewer, property, {
            configurable: true,
            get: () => offset,
            set: value => {
                const stage = viewer.querySelector(".skeleton-zoom-stage");
                const maximum = Math.max(0,
                    (parseFloat(stage?.style[dimension]) || viewport) - viewport
                );
                offset = Math.max(0, Math.min(maximum, value));
            }
        });
    }

    fetchMock = vi.fn(async () => ({
        ok: true,
        text: async () => svgText
    }));

    vi.stubGlobal("fetch", fetchMock);

    page = await import("../www/js/skeletons_selection.js");

    await vi.waitFor(() => {
        expect(element("all-present-button").disabled).toBe(false);
    });
}

beforeEach(() => {
    vi.clearAllMocks();
    mocks.rows.clear();

    mocks.getAccessionById.mockImplementation(async () => ({
        ...mocks.individual
    }));

    mocks.getSiteById.mockResolvedValue({
        id: "siteid1",
        code: "SITE-1"
    });

    mocks.getZoneStatesByAccession.mockImplementation(async () => [
        ...mocks.rows.values()
    ]);

    mocks.setZoneState.mockImplementation(async row => {
        mocks.rows.set(row.bone, { ...row });
        return row;
    });

    mocks.clearZoneState.mockImplementation(async row => {
        mocks.rows.delete(row.bone);
    });
});

afterEach(() => {
    dom?.window.close();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

describe("selection shape helpers", () => {
    it("recognises decorative shapes and faded groups", async () => {
        await openPage();

        const doc = new JSDOM(svg(`
            <g id="ghost" opacity="0.3"><path opacity="0.5" /></g>
            <g id="styled" style="opacity:0.4"><path opacity="1" /></g>
            <g id="visible"><path /></g>
        `)).window.document;

        expect(page.isGhostGroup(doc.getElementById("ghost"))).toBe(true);
        expect(page.isGhostGroup(doc.getElementById("styled"))).toBe(true);
        expect(page.isGhostGroup(doc.getElementById("visible"))).toBe(false);

        expect(page.isDecorativeShape(doc.querySelector("#ghost path"))).toBe(true);
        expect(page.isDecorativeShape(doc.querySelector("#styled path"))).toBe(false);
        expect(page.isDecorativeShape(doc.querySelector("#visible path"))).toBe(false);
    });
});

describe("segment loading", () => {
    it.each(AGES)(
        "loads all seven %s segment files",
        async age => {
            await openPage(age);

            expect(element("accession-display").textContent).toBe("ACC1");
            expect(element("site-display").textContent).toBe("SITE-1");
            expect(document.querySelectorAll("#segment-tabs button")).toHaveLength(7);

            for (const [id, file] of SEGMENTS) {
                document.querySelector(`[data-segment="${id}"]`).click();

                await vi.waitFor(() => {
                    expect(element("skeleton-select-container").dataset.segment)
                        .toBe(id);
                });

                expect(fetchMock).toHaveBeenLastCalledWith(
                    `assets/skeletons/${age}/${file}`
                );

                expect(
                    document.querySelector(
                        `#segment-tabs [data-segment="${id}"]`
                    ).classList
                ).toContain("active");
            }
        }
    );
});

describe("selection navigation", () => {
    it.each(AGES)(
        "opens the requested segment for %s",
        async age => {
            await openPage(age, "pelvis");

            expect(fetchMock).toHaveBeenLastCalledWith(
                `assets/skeletons/${age}/pelvis.svg`
            );
            expect(element("skeleton-select-container").dataset.segment)
                .toBe("pelvis");
            expect(element("selected-segment-name").textContent)
                .toBe("Selected: Pelvis");
            expect(element("skeleton-select-container").dataset.age).toBe(age);
            expect(
                document.querySelector(
                    '#segment-tabs [data-segment="pelvis"]'
                ).classList
            ).toContain("active");
        }
    );

    it("opens the first available segment when the requested segment is unknown", async () => {
        await openPage("child", "unknown");

        expect(fetchMock).toHaveBeenLastCalledWith(
            "assets/skeletons/child/cranium.svg"
        );
        expect(element("skeleton-select-container").dataset.segment)
            .toBe("cranium");
    });

    it.each(AGES)(
        "keeps the same individual when returning to overview for %s",
        async age => {
            await openPage(age);
            element("back-to-overview-button").click();

            const destination = new URL(
                pageLocation.href,
                "http://localhost/"
            );

            expect(destination.pathname).toBe("/skeletons_overview.html");
            expect(destination.searchParams.get("accessionId"))
                .toBe("testid");
        }
    );

    it.each(PART_AGES)("closes %s bone details when switching segments and restores the state on return", async age => {
        const originalSvg = bones(["FEM_L"]);

        await openPage(age, "left-lower", originalSvg);

        element("FEM_L").dispatchEvent(
            new window.MouseEvent("click", { bubbles: true })
        );

        chooseState("present-fragmented");

        await vi.waitFor(() => {
            expect(element("detail-status-text").textContent)
                .toBe("Fragmented");
        });

        fetchMock.mockImplementation(async path => ({
            ok: true,
            text: async () => path.endsWith("pelvis.svg")
                ? bones(["PEL_L"])
                : originalSvg
        }));

        document.querySelector(
            '#segment-tabs [data-segment="pelvis"]'
        ).click();

        await vi.waitFor(() => {
            expect(element("skeleton-select-container").dataset.segment)
                .toBe("pelvis");
        });

        expect(element("details-box").style.display).toBe("none");
        expect(element("FEM_L")).toBe(null);
        expect(element("PEL_L")).not.toBe(null);

        document.querySelector(
            '#segment-tabs [data-segment="left-lower"]'
        ).click();

        await vi.waitFor(() => {
            expect(element("skeleton-select-container").dataset.segment)
                .toBe("left-lower");
        });

        expect(shape("FEM_L").style.fill).toBe(ORANGE);
        expect(
            document.querySelector(
                '#segment-tabs [data-segment="pelvis"]'
            ).classList
        ).not.toContain("active");
    });
});

describe.each(PART_AGES)("%s bone selection", age => {
    const nested = svg(`
        <g id="left_lower_limb">
            <g id="FEM_L">
                <g id="Vector_1"><path id="parent-shape" /></g>
                <g id="FEM_L2"><path id="part-shape" /></g>
            </g>
        </g>
    `);

    it.each([
        ["present-complete", GREEN, "Present"],
        ["present-fragmented", ORANGE, "Fragmented"],
        ["absent", GREY, "Absent"]
    ])(
        "saves %s for a part without changing its parent",
        async (state, colour, label) => {
            await openPage(age, "left-lower", nested);

            shape("FEM_L2").dispatchEvent(
                new window.MouseEvent("click", { bubbles: true })
            );

            expect(element("detail-bone-name").textContent).toBe("FEM_L2");

            chooseState(state);

            await vi.waitFor(() => {
                expect(mocks.setZoneState).toHaveBeenCalledWith({
                    accessionId: "testid",
                    bone: "FEM_L2",
                    side: "",
                    zone: "FEM_L2",
                    state
                });
            });

            expect(element("part-shape").style.fill).toBe(colour);
            expect(element("parent-shape").style.fill).toBe("transparent");

            await vi.waitFor(() => {
                expect(element("detail-status-text").textContent)
                    .toBe(label);
            });
        }
    );

    it("changes and hovers the parent without changing the nested part", async () => {
        await openPage(age, "left-lower", nested);

        element("parent-shape").dispatchEvent(
            new window.MouseEvent("mouseenter")
        );

        expect(element("parent-shape").style.stroke).toBe(HIGHLIGHT);
        expect(element("part-shape").style.stroke).toBe("");

        element("parent-shape").dispatchEvent(
            new window.MouseEvent("mouseleave")
        );

        expect(element("parent-shape").style.stroke).toBe("");

        element("parent-shape").dispatchEvent(
            new window.MouseEvent("click", { bubbles: true })
        );

        chooseState("present-complete");

        await vi.waitFor(() => {
            expect(mocks.rows.has("FEM_L")).toBe(true);
        });

        expect(element("parent-shape").style.fill).toBe(GREEN);
        expect(element("part-shape").style.fill).toBe("transparent");
    });

    it("clears the state when the same button is chosen again", async () => {
        await openPage(age);

        element("FEM_L").dispatchEvent(
            new window.MouseEvent("click", { bubbles: true })
        );

        chooseState("present-complete");

        await vi.waitFor(() => {
            expect(mocks.rows.has("FEM_L")).toBe(true);
        });

        chooseState("present-complete");

        await vi.waitFor(() => {
            expect(mocks.clearZoneState).toHaveBeenCalledWith({
                accessionId: "testid",
                bone: "FEM_L",
                side: "",
                zone: "FEM_L"
            });
        });

        expect(shape("FEM_L").style.fill).toBe("transparent");

        await vi.waitFor(() => {
            expect(element("detail-status-text").textContent)
                .toBe("Unmarked");
        });

        expect(mocks.rows.has("FEM_L")).toBe(false);
    });

    it("restores independent states after reopening the page", async () => {
        await openPage(age, "left-lower", nested);

        element("FEM_L2").dispatchEvent(
            new window.MouseEvent("click", { bubbles: true })
        );

        chooseState("absent");

        await vi.waitFor(() => {
            expect(mocks.rows.has("FEM_L2")).toBe(true);
        });

        await openPage(age, "left-lower", nested);

        expect(element("part-shape").style.fill).toBe(GREY);
        expect(element("parent-shape").style.fill).toBe("transparent");
    });

    it("restores different saved states for the parent and part", async () => {
        mocks.rows.set("FEM_L", {
            bone: "FEM_L",
            state: "present-complete"
        });
        mocks.rows.set("FEM_L2", {
            bone: "FEM_L2",
            state: "absent"
        });

        await openPage(age, "left-lower", nested);

        expect(element("parent-shape").style.fill).toBe(GREEN);
        expect(element("part-shape").style.fill).toBe(GREY);
    });

});

describe("Child SVG preparation", () => {
    it("wraps the Child RSU path and lets it be selected and saved", async () => {
        await openPage(
            "child",
            "axial",
            svg('<g id="axial_skeleton"><path id="RSU" /></g>')
        );

        expect(element("RSU").localName).toBe("g");

        shape("RSU").dispatchEvent(
            new window.MouseEvent("click", { bubbles: true })
        );

        chooseState("present-complete");

        await vi.waitFor(() => {
            expect(mocks.rows.has("RSU")).toBe(true);
        });

        expect(shape("RSU").style.fill).toBe(GREEN);
    });
});

describe("linked views and All Present", () => {
    it("highlights, saves and clears Child occipital views together", async () => {
        await openPage(
            "child",
            "cranium",
            bones(["OCC_L_lat_l", "OCC_R_lat_r", "PAR_R_ant"])
        );

        element("OCC_L_lat_l").dispatchEvent(
            new window.MouseEvent("click", { bubbles: true })
        );

        expect(shape("OCC_R_lat_r").style.stroke).toBe(HIGHLIGHT);
        expect(shape("PAR_R_ant").style.stroke).toBe("");

        chooseState("absent");

        await vi.waitFor(() => {
            expect(mocks.setZoneState).toHaveBeenCalledTimes(2);
        });

        expect(shape("OCC_R_lat_r").style.fill).toBe(GREY);
        expect(shape("PAR_R_ant").style.fill).toBe("transparent");

        chooseState("absent");

        await vi.waitFor(() => {
            expect(mocks.clearZoneState).toHaveBeenCalledTimes(2);
        });

        expect(shape("OCC_L_lat_l").style.fill).toBe("transparent");
        expect(shape("OCC_R_lat_r").style.fill).toBe("transparent");
    });

    it.each(["adult", "child", "adolescent"])(
        "marks shared linked groups once per ID for %s",
        async age => {
            const ids = [
                "PAR_R_post",
                "PAR_R_lat_r",
                "PAR_R_ant",
                "MND",
                "MND_L",
                "MND_R",
                "CRA_lat_l",
                "CRA_lat_r",
                age === "adolescent" ? "CRA" : "CRA_ant"
            ];

            await openPage(age, "cranium", bones(ids));
            await markAll();

            expect(mocks.setZoneState).toHaveBeenCalledTimes(ids.length);

            for (const id of ids) {
                expect(shape(id).style.fill).toBe(GREEN);
                expect(
                    mocks.setZoneState.mock.calls.filter(
                        ([row]) => row.bone === id
                    )
                ).toHaveLength(1);
            }
        }
    );

    it("keeps Child-specific occipital IDs independent for Adult", async () => {
        await openPage(
            "adult",
            "cranium",
            bones(["OCC_L_lat_l", "OCC_R_lat_r"])
        );

        element("OCC_L_lat_l").dispatchEvent(
            new window.MouseEvent("click", { bubbles: true })
        );

        chooseState("present-complete");

        await vi.waitFor(() => {
            expect(mocks.setZoneState).toHaveBeenCalledTimes(1);
        });

        expect(shape("OCC_R_lat_r").style.fill).toBe("transparent");
    });

    it.each(PART_AGES)("marks %s parents and parts separately and skips faded or decorative shapes", async age => {
        await openPage(
            age,
            "left-lower",
            svg(`
                <g id="left_lower_limb">
                    <g id="FEM_L">
                        <path id="own" />
                        <path id="decoration" opacity="0.5" />
                        <g id="FEM_L2"><path /></g>
                    </g>
                    <g id="FEM_L3" opacity="0.3"><path /></g>
                    <g id="FEM_R"><path opacity="0.4" /></g>
                </g>
            `)
        );

        await markAll();

        expect(
            mocks.setZoneState.mock.calls.map(([row]) => row.bone)
        ).toEqual(["FEM_L", "FEM_L2"]);

        expect(element("own").style.fill).toBe(GREEN);
        expect(shape("FEM_L2").style.fill).toBe(GREEN);
        expect(shape("FEM_L3").style.fill).toBe("");
        expect(element("decoration").style.fill).toBe("");
    });

    it("updates the selected bone status after All Present", async () => {
        await openPage();

        element("FEM_L").dispatchEvent(
            new window.MouseEvent("click", { bubbles: true })
        );

        await markAll();

        expect(element("detail-status-text").textContent)
            .toBe("Present");
    });

    it("marks the Child occipital pair once per linked ID", async () => {
        await openPage(
            "child",
            "cranium",
            bones(["OCC_L_lat_l", "OCC_R_lat_r"])
        );

        await markAll();

        expect(
            mocks.setZoneState.mock.calls.map(([row]) => row.bone)
        ).toEqual(["OCC_L_lat_l", "OCC_R_lat_r"]);

        expect(shape("OCC_L_lat_l").style.fill).toBe(GREEN);
        expect(shape("OCC_R_lat_r").style.fill).toBe(GREEN);
    });

    it("skips an Adult parent containing other bones", async () => {
        await openPage(
            "adult",
            "left-lower",
            svg(`
                <g id="FEM_L">
                    <path id="own" />
                    <g id="FEM_L2"><path /></g>
                </g>
            `)
        );

        await markAll();

        expect(
            mocks.setZoneState.mock.calls.map(([row]) => row.bone)
        ).toEqual(["FEM_L2"]);

        expect(element("own").style.fill).toBe("");
    });
});

describe("supplied segments", () => {
    it.each(AGES.flatMap(age => SEGMENTS.map(([id, file]) => [age, id, file])))(
        "loads %s %s and saves selectable bones from the supplied SVG",
        async (age, id, file) => {
            const content = readFileSync(
                new URL(
                    `../www/assets/skeletons/${age}/${file}`,
                    import.meta.url
                ),
                "utf8"
            );

            await openPage(age, id, content);

            const fittedWidth = parseFloat(drawing().style.width);
            const fittedHeight = parseFloat(drawing().style.height);
            expect(element("reset-zoom-button").disabled).toBe(false);
            expect(fittedWidth).toBeGreaterThan(0);
            expect(fittedHeight).toBeGreaterThan(0);
            expect(Number(fittedWidth.toFixed(1))).toBeLessThanOrEqual(400);
            expect(Number(fittedHeight.toFixed(1))).toBeLessThanOrEqual(300);

            pinch(2);
            expect(parseFloat(drawing().style.width)).toBeCloseTo(fittedWidth * 2);
            expect(parseFloat(drawing().style.height)).toBeCloseTo(fittedHeight * 2);
            expect(mocks.setZoneState).not.toHaveBeenCalled();

            element("reset-zoom-button").click();
            expect(parseFloat(drawing().style.width)).toBeCloseTo(fittedWidth);
            expect(parseFloat(drawing().style.height)).toBeCloseTo(fittedHeight);

            await markAll();

            expect(mocks.setZoneState.mock.calls.length).toBeGreaterThan(0);
            expect(
                mocks.setZoneState.mock.calls.every(
                    ([row]) => row.state === "present-complete"
                )
            ).toBe(true);

            const savedIds = mocks.setZoneState.mock.calls.map(([row]) => row.bone);
            expect(new Set(savedIds).size).toBe(savedIds.length);

            if (age === "adolescent" && id === "cranium") {
                for (const bone of savedIds) {
                    expect(element(bone)).not.toBe(null);
                }
                for (const bone of ["CRA", "NAS_L_ant", "NAS_R_ant", "MAX_R_inf"]) {
                    expect(savedIds).toContain(bone);
                    expect(shape(bone).style.fill).toBe(GREEN);
                }
                expect(savedIds).not.toContain("NAS");
                expect(savedIds).not.toContain("CRA_ant");
            }

            if (age === "infant" && id === "axial") {
                for (const bone of ["ST_MAN", "ST_STE", "C2_C1", "C2_C2"]) {
                    expect(savedIds).toContain(bone);
                    expect(shape(bone).style.fill).toBe(GREEN);
                }
                expect(savedIds).not.toContain("C2_C");
            }
        }
    );
});

describe("Infant and Adolescent linked views", () => {
    it.each([
        ["infant", ["TEM_L_ENDO", "TEM_L_EXO"], "TEM_R_ENDO"],
        ["infant", ["TEM_R_ENDO", "TEM_R_EXO"], "TEM_L_ENDO"],
        ["adolescent", ["CRA_lat_l", "CRA_lat_r", "CRA"], "PAR_L_ant"],
        ["adolescent", ["NAS_L_lat_l", "NAS_L_ant"], "NAS_R_ant"],
        ["adolescent", ["NAS_R_lat_r", "NAS_R_ant"], "NAS_L_ant"],
        ["adolescent", ["MAX_R_lat_r", "MAX_R_inf", "MAX_R_ant"], "MAX_L_ant"]
    ])(
        "highlights, saves, restores and clears %s views %j together",
        async (age, ids, other) => {
            const content = bones([...ids, other]);
            await openPage(age, "cranium", content);

            element(ids[0]).dispatchEvent(
                new window.MouseEvent("click", { bubbles: true })
            );

            for (const id of ids) {
                expect(shape(id).style.stroke).toBe(HIGHLIGHT);
            }
            expect(shape(other).style.stroke).toBe("");

            chooseState("present-fragmented");

            await vi.waitFor(() => {
                expect(element("detail-status-text").textContent)
                    .toBe("Fragmented");
            });

            expect(mocks.setZoneState).toHaveBeenCalledTimes(ids.length);
            for (const id of ids) {
                expect(mocks.rows.get(id).state).toBe("present-fragmented");
                expect(shape(id).style.fill).toBe(ORANGE);
            }
            expect(mocks.rows.has(other)).toBe(false);

            await openPage(age, "cranium", content);

            for (const id of ids) {
                expect(shape(id).style.fill).toBe(ORANGE);
            }

            element(ids[0]).dispatchEvent(
                new window.MouseEvent("click", { bubbles: true })
            );
            chooseState("present-fragmented");

            await vi.waitFor(() => {
                expect(element("detail-status-text").textContent).toBe("Unmarked");
            });

            expect(mocks.clearZoneState).toHaveBeenCalledTimes(ids.length);
            for (const id of ids) {
                expect(mocks.rows.has(id)).toBe(false);
                expect(shape(id).style.fill).toBe("transparent");
            }
            expect(shape(other).style.fill).toBe("transparent");
        }
    );

    it.each(["MAN_L", "MAN_R"])(
        "keeps Infant mandible part %s independent",
        async id => {
            await openPage("infant", "cranium", bones(["MAN_L", "MAN_R"]));

            element(id).dispatchEvent(
                new window.MouseEvent("click", { bubbles: true })
            );
            chooseState("present-complete");

            await vi.waitFor(() => {
                expect(element("detail-status-text").textContent).toBe("Present");
            });

            expect(mocks.setZoneState).toHaveBeenCalledTimes(1);
            const other = id === "MAN_L" ? "MAN_R" : "MAN_L";
            expect(shape(other).style.fill).toBe("transparent");
        }
    );
});

describe("updated Infant axial groups", () => {
    it.each([
        ["ST_MAN", "present-complete", GREEN],
        ["ST_STE", "absent", GREY],
        ["C2_C1", "present-fragmented", ORANGE],
        ["C2_C2", "present-complete", GREEN]
    ])(
        "selects, saves and restores %s independently",
        async (id, state, colour) => {
            const content = readFileSync(
                new URL(
                    "../www/assets/skeletons/infant/axial_skeleton.svg",
                    import.meta.url
                ),
                "utf8"
            );

            await openPage("infant", "axial", content);

            expect(element(id).localName).toBe("g");
            shape(id).dispatchEvent(
                new window.MouseEvent("click", { bubbles: true })
            );
            expect(element("detail-bone-name").textContent).toBe(id);
            chooseState(state);

            await vi.waitFor(() => {
                expect(mocks.rows.get(id)?.state).toBe(state);
            });

            expect(mocks.setZoneState).toHaveBeenCalledTimes(1);
            expect(shape(id).style.fill).toBe(colour);

            for (const other of ["ST_MAN", "ST_STE", "C2_C1", "C2_C2"]) {
                if (other !== id) {
                    expect(shape(other).style.fill).toBe("transparent");
                }
            }

            await openPage("infant", "axial", content);
            expect(shape(id).style.fill).toBe(colour);
        }
    );
});

describe("selection zoom", () => {
    it.each(AGES)("pinches within the zoom limits and resets without changing %s bone states", async age => {
        mocks.rows.set("FEM_L", {
            bone: "FEM_L",
            state: "present-complete"
        });
        await openPage(age, "left-lower");

        const viewer = element("skeleton-select-container");
        const reset = element("reset-zoom-button");
        expect(element("all-present-button").nextElementSibling).toBe(reset);
        expect(reset.className).toBe("segment-tab");
        expect(reset.textContent).toBe("Reset Zoom");
        expect(drawing().style.width).toBe("300px");
        expect(drawing().style.height).toBe("300px");

        pinch(2);
        expect(drawing().style.width).toBe("600px");
        expect(drawing().style.height).toBe("600px");
        expect(viewer.scrollLeft).toBeCloseTo(100);
        expect(viewer.scrollTop).toBeCloseTo(150);  

        reset.click();
        pinch(10);
        expect(drawing().style.width).toBe("1800px");
        expect(drawing().style.height).toBe("1800px");

        pinch(0.01);
        expect(drawing().style.width).toBe("300px");
        expect(drawing().style.height).toBe("300px");

        pinch(3);
        reset.click();
        expect(drawing().style.width).toBe("300px");
        expect(drawing().style.height).toBe("300px");
        expect(viewer.scrollLeft).toBe(0);
        expect(viewer.scrollTop).toBe(0);
        expect(shape("FEM_L").style.fill).toBe(GREEN);
        expect(mocks.rows.get("FEM_L").state).toBe("present-complete");
        expect(mocks.setZoneState).not.toHaveBeenCalled();
        expect(mocks.clearZoneState).not.toHaveBeenCalled();
    });

    it("moves with one finger, ignores gesture clicks and still allows bone tapping", async () => {
        await openPage();
        const viewer = element("skeleton-select-container");

        pinch(2);
        shape("FEM_L").dispatchEvent(
            new window.MouseEvent("click", { bubbles: true })
        );
        expect(element("details-box").style.display).toBe("none");

        const left = viewer.scrollLeft;
        const top = viewer.scrollTop;
        touch("touchstart", [[1, 200, 150]], shape("FEM_L"));
        const move = touch("touchmove", [[1, 170, 110]], shape("FEM_L"));
        touch("touchend", [], shape("FEM_L"));

        expect(move.defaultPrevented).toBe(true);
        expect(viewer.scrollLeft).toBeCloseTo(left + 30);
        expect(viewer.scrollTop).toBeCloseTo(top + 40);
        expect(drawing().style.width).toBe("600px");

        shape("FEM_L").dispatchEvent(
            new window.MouseEvent("click", { bubbles: true })
        );
        expect(element("details-box").style.display).toBe("none");
        expect(mocks.setZoneState).not.toHaveBeenCalled();
        expect(mocks.clearZoneState).not.toHaveBeenCalled();

        touch("touchstart", [[1, 200, 150]], shape("FEM_L"));
        const end = touch("touchend", [], shape("FEM_L"));
        expect(end.defaultPrevented).toBe(false);
        shape("FEM_L").dispatchEvent(
            new window.MouseEvent("click", { bubbles: true })
        );
        expect(element("details-box").style.display).toBe("block");
        expect(element("detail-bone-name").textContent).toBe("FEM_L");

        chooseState("present-fragmented");
        await vi.waitFor(() => {
            expect(mocks.rows.get("FEM_L")?.state).toBe("present-fragmented");
        });
        expect(shape("FEM_L").style.fill).toBe(ORANGE);
    });

    it("fits the new segment and resets zoom and position when switching", async () => {
        await openPage();
        pinch(3);
        expect(drawing().style.width).toBe("900px");

        fetchMock.mockImplementation(async () => ({
            ok: true,
            text: async () => '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 200"><g id="PEL_L"><path /></g></svg>'
        }));
        document.querySelector('#segment-tabs [data-segment="pelvis"]').click();
        expect(element("reset-zoom-button").disabled).toBe(true);

        await vi.waitFor(() => {
            expect(element("skeleton-select-container").dataset.segment).toBe("pelvis");
            expect(element("reset-zoom-button").disabled).toBe(false);
        });

        expect(drawing().style.width).toBe("400px");
        expect(drawing().style.height).toBe("200px");
        expect(element("skeleton-select-container").scrollLeft).toBe(0);
        expect(element("skeleton-select-container").scrollTop).toBe(0);
        expect(element("reset-zoom-button").classList).not.toContain("active");
        expect(mocks.setZoneState).not.toHaveBeenCalled();
        expect(mocks.clearZoneState).not.toHaveBeenCalled();
    });
});
