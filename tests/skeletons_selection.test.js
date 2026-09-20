import { describe, expect, it, beforeAll, vi } from "vitest";
import { JSDOM } from "jsdom";

let isDecorativeShape;
let isGhostGroup;
let allPresentButton;
let container;
let setZoneStateSpy;

beforeAll(async () => {

    const dom = new JSDOM(
        `<!DOCTYPE html><html><body>
            <span id="accession-display"></span>
            <span id="site-display"></span>
            <button id="back-to-overview-button"></button>
            <div id="segment-tabs"></div>
            <div class="selected-row">
                <div id="selected-segment-name"></div>
                <button id="all-present-button" class="segment-tab" disabled></button>
            </div>
            <div id="skeleton-select-container"></div>
            <div id="selected-info">
                <span id="selected-zone-label"></span>
            </div>
            <div id="details-box">
                <button id="details-close"></button>
                <div id="detail-bone-name"></div>
                <span id="detail-status-text"></span>
                <span id="detail-status-dot"></span>
                <button class="state-btn" data-state="present-complete"></button>
                <button class="state-btn" data-state="present-fragmented"></button>
                <button class="state-btn" data-state="absent"></button>
            </div>
        </body></html>`,
        { url: "http://localhost/skeletons_selection.html?accessionId=test-id&segment=cranium" }
    );

    global.window = dom.window;
    global.document = dom.window.document;
    global.getComputedStyle = dom.window.getComputedStyle;
    global.alert = () => {};
    global.fetch = async () => ({ ok: false, status: 404 });
    global.indexedDB = undefined;
    global.CSS = { escape: (s) => s };

    setZoneStateSpy = vi.fn(async () => ({}));

    vi.mock("../www/js/data.js", () => ({
        getAccessionById: vi.fn(async () => null),
        getSiteById: vi.fn(async () => null),
        setZoneState: setZoneStateSpy,
        getZoneStatesByAccession: vi.fn(async () => []),
        clearZoneState: vi.fn(async () => {})
    }));

    vi.mock("../www/js/skeleton_config.js", async (orig) => {
        const actual = await orig();
        return {
            ...actual,
            folderForAge: () => null
        };
    });

    const mod = await import("../www/js/skeletons_selection.js");
    isDecorativeShape = mod.isDecorativeShape;
    isGhostGroup = mod.isGhostGroup;

    allPresentButton = document.getElementById("all-present-button");
    container = document.getElementById("skeleton-select-container");
});

describe("isDecorativeShape (selection)", () => {

    it("returns true for shapes with opacity < 1", () => {
        const dom = new JSDOM(`<svg xmlns="http://www.w3.org/2000/svg">
            <path id="p1" opacity="0.5" />
            <path id="p2" opacity="0.82" />
            <path id="p3" opacity="0.1" />
        </svg>`);
        const doc = dom.window.document;

        expect(isDecorativeShape(doc.getElementById("p1"))).toBe(true);
        expect(isDecorativeShape(doc.getElementById("p2"))).toBe(true);
        expect(isDecorativeShape(doc.getElementById("p3"))).toBe(true);
    });

    it("returns false for shapes with opacity 1", () => {
        const dom = new JSDOM(`<svg xmlns="http://www.w3.org/2000/svg">
            <path id="p1" opacity="1" />
        </svg>`);
        const doc = dom.window.document;

        expect(isDecorativeShape(doc.getElementById("p1"))).toBe(false);
    });

    it("returns false for shapes with no opacity attribute", () => {
        const dom = new JSDOM(`<svg xmlns="http://www.w3.org/2000/svg">
            <path id="p1" />
        </svg>`);
        const doc = dom.window.document;

        expect(isDecorativeShape(doc.getElementById("p1"))).toBe(false);
    });

});

describe("isGhostGroup (selection)", () => {

    it("returns true when the group has opacity < 1 as an attribute", () => {
        const dom = new JSDOM(`<svg xmlns="http://www.w3.org/2000/svg">
            <g id="g1" opacity="0.1"></g>
            <g id="g2" opacity="0.5"></g>
        </svg>`);
        const doc = dom.window.document;

        expect(isGhostGroup(doc.getElementById("g1"))).toBe(true);
        expect(isGhostGroup(doc.getElementById("g2"))).toBe(true);
    });

    it("returns false when the group has opacity 1", () => {
        const dom = new JSDOM(`<svg xmlns="http://www.w3.org/2000/svg">
            <g id="g1" opacity="1"></g>
        </svg>`);
        const doc = dom.window.document;

        expect(isGhostGroup(doc.getElementById("g1"))).toBe(false);
    });

    it("returns false when the group has no opacity attribute", () => {
        const dom = new JSDOM(`<svg xmlns="http://www.w3.org/2000/svg">
            <g id="g1"></g>
        </svg>`);
        const doc = dom.window.document;

        expect(isGhostGroup(doc.getElementById("g1"))).toBe(false);
    });

});

describe("All Present button", () => {

    function buildSegmentSvg(boneIds) {
        const groups = boneIds.map(id => `
            <g id="${id}">
                <path d="M0 0 L10 0 L10 10 Z" />
            </g>
        `).join("");

        return `<svg xmlns="http://www.w3.org/2000/svg">${groups}</svg>`;
    }

    function setSegmentSvg(boneIds) {
        container.innerHTML = buildSegmentSvg(boneIds);
    }

    it("starts disabled before any segment loads", () => {
        expect(allPresentButton.hasAttribute("disabled")).toBe(true);
    });

    it("is a no-op if there are no bones in the container", async () => {
        container.innerHTML = "";
        setZoneStateSpy.mockClear();

        allPresentButton.click();

        await Promise.resolve();

        expect(setZoneStateSpy).not.toHaveBeenCalled();
    });

    it("marks every bone in the segment Present and persists each", async () => {
        setSegmentSvg([
            "bone_alpha",
            "bone_beta",
            "bone_gamma"
        ]);

        setZoneStateSpy.mockClear();

        allPresentButton.click();

        await new Promise((r) => setTimeout(r, 0));

        expect(setZoneStateSpy).toHaveBeenCalledTimes(3);

        const calledBones = setZoneStateSpy.mock.calls.map((c) => c[0].bone);
        expect(calledBones).toEqual(
            expect.arrayContaining(["bone_alpha", "bone_beta", "bone_gamma"])
        );

        setZoneStateSpy.mock.calls.forEach((call) => {
            expect(call[0].state).toBe("present-complete");
            expect(call[0].accessionId).toBe("test-id");
        });
    });

    it("paints each bone green (STATE_COLORS present-complete)", async () => {
        setSegmentSvg(["bone_alpha", "bone_beta"]);
        setZoneStateSpy.mockClear();

        allPresentButton.click();
        await new Promise((r) => setTimeout(r, 0));

        const alpha = container.querySelector("#bone_alpha path");
        const beta = container.querySelector("#bone_beta path");

        expect(alpha.style.fill).toBe("rgb(46, 125, 50)");
        expect(beta.style.fill).toBe("rgb(46, 125, 50)");
    });

    it("skips ghost groups (opacity < 1)", async () => {
        container.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg">
                <g id="bone_visible"><path d="M0 0 L1 0 L1 1 Z" /></g>
                <g id="bone_ghost" opacity="0.3"><path d="M0 0 L1 0 L1 1 Z" /></g>
            </svg>
        `;

        setZoneStateSpy.mockClear();

        allPresentButton.click();
        await new Promise((r) => setTimeout(r, 0));

        const calledBones = setZoneStateSpy.mock.calls.map((c) => c[0].bone);
        expect(calledBones).toContain("bone_visible");
        expect(calledBones).not.toContain("bone_ghost");
    });

    it("re-enables itself after a successful run", async () => {
        setSegmentSvg(["bone_alpha"]);
        setZoneStateSpy.mockClear();

        allPresentButton.click();
        await new Promise((r) => setTimeout(r, 0));

        expect(allPresentButton.hasAttribute("disabled")).toBe(false);
    });

});
