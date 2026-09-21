import { describe, expect, it, beforeAll } from "vitest";
import { JSDOM } from "jsdom";

let isDecorativeShape;
let isGhostGroup;

beforeAll(async () => {

    const dom = new JSDOM(
        `<!DOCTYPE html><html><body>
            <span id="accession-display"></span>
            <span id="site-display"></span>
            <button id="back-to-site-button"></button>
            <span id="individual-date-display"></span>
            <textarea id="notes-description"></textarea>
            <div id="skeleton-board"></div>
            <button id="expand-btn"></button>
        </body></html>`,
        { url: "http://localhost/skeletons_overview.html?accessionId=test-id" }
    );

    global.window = dom.window;
    global.document = dom.window.document;
    global.getComputedStyle = dom.window.getComputedStyle;
    global.alert = () => {};
    global.fetch = async () => ({ ok: false, status: 404 });
    global.indexedDB = undefined;

    const mod = await import("../www/js/skeletons_overview.js");
    isDecorativeShape = mod.isDecorativeShape;
    isGhostGroup = mod.isGhostGroup;
});

describe("isDecorativeShape (overview)", () => {

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

describe("isGhostGroup (overview)", () => {

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