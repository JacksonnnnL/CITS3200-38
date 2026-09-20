import { describe, expect, it, beforeAll, vi } from "vitest";
import { JSDOM } from "jsdom";
import { IDBFactory } from "fake-indexeddb";

const { setZoneStateSpy } = vi.hoisted(() => ({
    setZoneStateSpy: vi.fn(async () => ({}))
}));

vi.mock("../www/js/data.js", async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...actual,
        setZoneState: setZoneStateSpy,
        clearZoneState: vi.fn(async () => {})
    };
});

let isDecorativeShape;
let isGhostGroup;
let allPresentButton;
let container;

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
    global.CSS = { escape: (s) => s };
    globalThis.indexedDB = new IDBFactory();

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

    const GREEN = "#2e7d32";

    function setSegmentSvg(boneIds) {
        const groups = boneIds.map(id => `
            <g id="${id}">
                <path d="M0 0 L10 0 L10 10 Z" />
            </g>
        `).join("");

        container.innerHTML =
            `<svg xmlns="http://www.w3.org/2000/svg">${groups}</svg>`;
    }

    it("starts disabled before any segment loads", () => {
        expect(allPresentButton.hasAttribute("disabled")).toBe(true);
    });

    it("turns every bone in the segment green", async () => {
        setSegmentSvg(["bone_alpha", "bone_beta", "bone_gamma"]);
        allPresentButton.disabled = false;
        setZoneStateSpy.mockClear();

        allPresentButton.click();
        await new Promise((r) => setTimeout(r, 0));

        const alpha = container.querySelector("#bone_alpha path");
        const beta  = container.querySelector("#bone_beta path");
        const gamma = container.querySelector("#bone_gamma path");

        expect(alpha.style.fill).toBe(GREEN);
        expect(beta.style.fill).toBe(GREEN);
        expect(gamma.style.fill).toBe(GREEN);
    });

    it("skips ghost groups (opacity < 1)", async () => {
        container.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg">
                <g id="bone_visible"><path d="M0 0 L1 0 L1 1 Z" /></g>
                <g id="bone_ghost" opacity="0.3"><path d="M0 0 L1 0 L1 1 Z" /></g>
            </svg>
        `;
        allPresentButton.disabled = false;

        allPresentButton.click();
        await new Promise((r) => setTimeout(r, 0));

        const visible = container.querySelector("#bone_visible path");
        const ghost   = container.querySelector("#bone_ghost path");

        expect(visible.style.fill).toBe(GREEN);
        expect(ghost.style.fill).not.toBe(GREEN);
    });

    it("re-enables itself after a successful run", async () => {
        setSegmentSvg(["bone_alpha"]);
        allPresentButton.disabled = false;

        allPresentButton.click();
        await new Promise((r) => setTimeout(r, 0));

        expect(allPresentButton.hasAttribute("disabled")).toBe(false);
    });

});
