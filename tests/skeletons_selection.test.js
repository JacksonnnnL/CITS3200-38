import { describe, expect, it, beforeAll } from "vitest";
import { JSDOM } from "jsdom";


// ============================================
// Mock DOM before importing the module
// ============================================
//
// skeletons_selection.js reads window.location and grabs several
// DOM elements at import time. We set up a jsdom document with
// those ids (and a URL with an accessionId so the top-level
// redirect check doesn't fire) before importing.

let isDecorativeShape;
let isGhostGroup;

beforeAll(async () => {

    const dom = new JSDOM(
        `<!DOCTYPE html><html><body>
            <span id="accession-display"></span>
            <span id="site-display"></span>
            <button id="back-to-overview-button"></button>
            <div id="segment-tabs"></div>
            <div id="selected-segment-name"></div>
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
    global.indexedDB = undefined; // not touched during tests

    const mod = await import("../www/js/skeletons_selection.js");
    isDecorativeShape = mod.isDecorativeShape;
    isGhostGroup = mod.isGhostGroup;
});


// ============================================
// isDecorativeShape
// ============================================

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


// ============================================
// isGhostGroup
// ============================================

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