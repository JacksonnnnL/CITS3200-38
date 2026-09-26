import { existsSync, readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it } from "vitest";
import { IDBFactory } from "fake-indexeddb";

import {
  NotFoundError,
  PRESERVATION_STATES,
  __resetConnectionForTests,
  clearZoneState,
  createAccession,
  createSite,
  deleteAccession,
  setZoneState,
} from "../www/js/data.js";

import {
  ELEMENT_BY_SVG_ID,
  PRESENT_STATES,
  computeBoneStats,
  countPresentElements,
  elementCodeForBone,
  getSiteBoneStats,
  summariseElementCounts,
} from "../www/js/bone_counts.js";

const { PRESENT_COMPLETE, PRESENT_FRAGMENTED, ABSENT } = PRESERVATION_STATES;

// Same shape the bone-marking page saves: bone === zone === the SVG id.
const row = (bone, state) => ({ bone, side: "", zone: bone, state });

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
  __resetConnectionForTests();
});

describe("element codes", () => {
  it.each([
    ["femur_right", "FEM-R"],
    ["femur_left", "FEM-L"],
    ["right_rib_1", "RIB-R1"],
    ["left_rib_1", "RIB-L1"],
    ["cervical_1", "VC1"],
    ["cervical_2", "VC2"],
    ["sternum", "STN"],
    ["sacrum", "SAC"],
    ["mandible", "MND"],
    ["hyoid", "HYD"],
    ["frontal", "CRA"],
    ["occipital_3", "CRA"],
    ["parietal_left_2", "CRA"],
    ["inferior_nasal_concha_1", "CRA"],
    ["os_coxae_left", "PEL-L"],
    ["triquetrum_left", "TQ-L"],
    ["metacarpal_3_right", "MC3-R"],
    ["metatarsal_5_left", "MT5-L"],
    ["medial_cuneiform_left", "CUN-L1"],
    ["lateral_cuneiform_right", "CUN-R3"],
    ["foot_proximal_phalanx_1_right", "PP1-R"],
    ["foot_distal_phalanx_1_left", "DP1-L"],
  ])("maps %s to the client code %s", (svgId, code) => {
    expect(elementCodeForBone(svgId)).toBe(code);
  });

  it.each([
    // the client only counts the first rib and first two vertebrae
    "right_rib_2",
    "left_rib_12",
    "cervical_3",
    "thoracic_1",
    "lumbar_5",
    // no client code
    "coccyx",
    "foot_proximal_phalanx_2_right",
    "malleus_left",
    "stapes_right",
    "not_a_real_bone",
    // must not resolve through Object.prototype
    "constructor",
    "__proto__",
    undefined,
  ])("does not count %s", (svgId) => {
    expect(elementCodeForBone(svgId)).toBeNull();
  });

  it("only the cranium shares one client code between several SVG ids", () => {
    const idsByCode = new Map();
    for (const [svgId, { code }] of ELEMENT_BY_SVG_ID) {
      idsByCode.set(code, [...(idsByCode.get(code) || []), svgId]);
    }

    const shared = [...idsByCode].filter(([, ids]) => ids.length > 1).map(([code]) => code);
    expect(shared).toEqual(["CRA"]);
  });
});

// Guards against the SVG assets being renamed underneath the mapping. The
// assets live on a separate branch, so this switches on by itself once
// they are present.
const adultSvgDir = fileURLToPath(new URL("../www/assets/skeletons/adult/", import.meta.url));

describe.skipIf(!existsSync(adultSvgDir))("element codes vs the adult SVG assets", () => {
  it("every mapped SVG id exists in the adult SVG files", () => {
    const ids = new Set();

    for (const file of readdirSync(adultSvgDir).filter((name) => name.endsWith(".svg"))) {
      const svg = readFileSync(`${adultSvgDir}/${file}`, "utf8");
      for (const match of svg.matchAll(/<g[^>]*\sid="([^"]+)"/g)) ids.add(match[1]);
    }

    const missing = [...ELEMENT_BY_SVG_ID.keys()].filter((id) => !ids.has(id));
    expect(missing).toEqual([]);
  });
});

describe("countPresentElements", () => {
  it("counts individuals per element and splits complete from fragmented", () => {
    const { counts } = countPresentElements([
      [row("femur_right", PRESENT_COMPLETE)],
      [row("femur_right", PRESENT_FRAGMENTED)],
      [row("femur_right", PRESENT_COMPLETE), row("femur_left", PRESENT_FRAGMENTED)],
    ]);

    expect(counts["FEM-R"]).toMatchObject({ count: 3, complete: 2, fragmented: 1 });
    expect(counts["FEM-L"]).toMatchObject({ count: 1, complete: 0, fragmented: 1 });
  });

  it("does not count absent bones", () => {
    const { counts } = countPresentElements([[row("femur_right", ABSENT)]]);
    expect(counts["FEM-R"]).toBeUndefined();
  });

  it("treats the skull as one element however many of its bones are marked", () => {
    const { counts } = countPresentElements([
      [
        row("frontal", PRESENT_COMPLETE),
        row("occipital_3", PRESENT_FRAGMENTED),
        row("parietal_right", PRESENT_COMPLETE),
      ],
    ]);

    expect(counts["CRA"]).toMatchObject({ count: 1, complete: 1, fragmented: 0 });
  });

  it("counts a skull as present when only one of its bones is marked", () => {
    const { counts } = countPresentElements([[row("lacrimal_left", PRESENT_FRAGMENTED)]]);
    expect(counts["CRA"]).toMatchObject({ count: 1, complete: 0, fragmented: 1 });
  });

  it("keeps the mandible and hyoid separate from the skull", () => {
    const { counts } = countPresentElements([[row("mandible", PRESENT_COMPLETE), row("hyoid", PRESENT_COMPLETE)]]);

    expect(Object.keys(counts).sort()).toEqual(["HYD", "MND"]);
  });

  it("does not count the ear ossicles as part of the skull", () => {
    const { counts, ignoredBones } = countPresentElements([[row("malleus_left", PRESENT_COMPLETE)]]);

    expect(counts).toEqual({});
    expect(ignoredBones).toEqual(["malleus_left"]);
  });

  it("counts an individual once per element even with several rows for it", () => {
    const { counts } = countPresentElements([
      [
        { bone: "femur_right", side: "", zone: "shaft", state: PRESENT_FRAGMENTED },
        { bone: "femur_right", side: "", zone: "head", state: PRESENT_COMPLETE },
      ],
    ]);

    expect(counts["FEM-R"]).toMatchObject({ count: 1, complete: 1, fragmented: 0 });
  });

  it("reports bones that are not part of the counts, sorted and de-duplicated", () => {
    const { counts, ignoredBones } = countPresentElements([
      [row("right_rib_2", PRESENT_COMPLETE), row("coccyx", PRESENT_COMPLETE)],
      [row("right_rib_2", PRESENT_COMPLETE)],
    ]);

    expect(counts).toEqual({});
    expect(ignoredBones).toEqual(["coccyx", "right_rib_2"]);
  });

  it("can be restricted to complete elements only", () => {
    const { counts } = countPresentElements(
      [[row("femur_right", PRESENT_COMPLETE)], [row("femur_right", PRESENT_FRAGMENTED)]],
      { presentStates: [PRESENT_COMPLETE] }
    );

    expect(counts["FEM-R"]).toMatchObject({ count: 1, complete: 1, fragmented: 1 });
  });

  it("counts both present states by default", () => {
    expect(PRESENT_STATES).toEqual([PRESENT_COMPLETE, PRESENT_FRAGMENTED]);
  });
});

describe("summariseElementCounts", () => {
  const entry = (code, count) => ({ code, label: code, count, complete: count, fragmented: 0 });

  it("uses the highest present count as the MNI", () => {
    const { mni } = summariseElementCounts({
      "FEM-R": entry("FEM-R", 4),
      "HUM-L": entry("HUM-L", 2),
    });

    expect(mni).toBe(4);
  });

  it("returns an MNI of 0 and no top elements when nothing is present", () => {
    expect(summariseElementCounts({})).toEqual({ mni: 0, topElements: [] });
  });

  it("ranks by count then code, and limits to the top 5", () => {
    const counts = {};
    for (const [code, count] of [
      ["TIB-R", 2],
      ["FEM-R", 5],
      ["FEM-L", 2],
      ["HUM-R", 3],
      ["ULN-R", 2],
      ["RAD-R", 1],
      ["SAC", 4],
    ]) {
      counts[code] = entry(code, count);
    }

    const { topElements } = summariseElementCounts(counts);

    expect(topElements.map((element) => element.code)).toEqual([
      "FEM-R",
      "SAC",
      "HUM-R",
      "FEM-L",
      "TIB-R",
    ]);
  });

  it("sorts codes with numbers naturally when counts tie", () => {
    const counts = {
      "MC10-R": entry("MC10-R", 1),
      "MC2-R": entry("MC2-R", 1),
    };

    expect(summariseElementCounts(counts).topElements.map((e) => e.code)).toEqual(["MC2-R", "MC10-R"]);
  });

  it("skips elements whose count is 0", () => {
    const { topElements } = summariseElementCounts({ "FEM-R": entry("FEM-R", 0) });
    expect(topElements).toEqual([]);
  });
});

describe("computeBoneStats", () => {
  it("includes individuals who have no bones recorded in the individual count", () => {
    const stats = computeBoneStats([[row("femur_right", PRESENT_COMPLETE)], []]);
    expect(stats.individualCount).toBe(2);
    expect(stats.mni).toBe(1);
  });
});

describe("getSiteBoneStats", () => {
  async function siteWithIndividuals(code, individualCount) {
    const site = await createSite({ code });
    const individuals = [];

    for (let i = 1; i <= individualCount; i++) {
      individuals.push(await createAccession({ siteId: site.id, accessionNumber: `SK${i}` }));
    }

    return { site, individuals };
  }

  const mark = (individual, bone, state) =>
    setZoneState({ accessionId: individual.id, bone, zone: bone, state });

  it("counts present elements across all individuals in the site", async () => {
    const { site, individuals } = await siteWithIndividuals("WES001", 3);
    const [a, b, c] = individuals;

    await mark(a, "femur_right", PRESENT_COMPLETE);
    await mark(a, "humerus_right", PRESENT_FRAGMENTED);
    await mark(a, "femur_left", ABSENT);
    await mark(b, "femur_right", PRESENT_FRAGMENTED);
    await mark(c, "femur_right", PRESENT_COMPLETE);
    await mark(c, "tibia_left", PRESENT_COMPLETE);

    const stats = await getSiteBoneStats(site.id);

    expect(stats.individualCount).toBe(3);
    expect(stats.mni).toBe(3);
    expect(stats.topElements.map((e) => [e.code, e.count])).toEqual([
      ["FEM-R", 3],
      ["HUM-R", 1],
      ["TIB-L", 1],
    ]);
    expect(stats.counts["FEM-L"]).toBeUndefined();
  });

  it("counts the skull once per individual and can drive the MNI", async () => {
    const { site, individuals } = await siteWithIndividuals("WES001", 3);
    const [a, b, c] = individuals;

    await mark(a, "frontal", PRESENT_COMPLETE);
    await mark(a, "occipital_2", PRESENT_COMPLETE);
    await mark(b, "parietal_1", PRESENT_FRAGMENTED);
    await mark(c, "femur_right", PRESENT_COMPLETE);

    const stats = await getSiteBoneStats(site.id);

    expect(stats.mni).toBe(2);
    expect(stats.topElements[0]).toMatchObject({ code: "CRA", label: "Cranium", count: 2 });
  });

  it("returns an MNI of 0 for a site with individuals but nothing recorded", async () => {
    const { site } = await siteWithIndividuals("WES001", 2);
    const stats = await getSiteBoneStats(site.id);

    expect(stats).toMatchObject({ individualCount: 2, mni: 0, topElements: [] });
  });

  it("returns an MNI of 0 for a site with no individuals", async () => {
    const site = await createSite({ code: "WES001" });
    const stats = await getSiteBoneStats(site.id);

    expect(stats).toMatchObject({ individualCount: 0, mni: 0, topElements: [] });
  });

  it("updates when a bone state changes", async () => {
    const { site, individuals } = await siteWithIndividuals("WES001", 2);
    const [a, b] = individuals;

    await mark(a, "femur_right", PRESENT_COMPLETE);
    await mark(b, "femur_right", PRESENT_COMPLETE);
    expect((await getSiteBoneStats(site.id)).mni).toBe(2);

    await mark(b, "femur_right", ABSENT);
    expect((await getSiteBoneStats(site.id)).mni).toBe(1);

    await mark(b, "femur_right", PRESENT_FRAGMENTED);
    expect((await getSiteBoneStats(site.id)).mni).toBe(2);
  });

  it("updates when a bone state is cleared", async () => {
    const { site, individuals } = await siteWithIndividuals("WES001", 1);
    const [a] = individuals;

    await mark(a, "femur_right", PRESENT_COMPLETE);
    expect((await getSiteBoneStats(site.id)).mni).toBe(1);

    await clearZoneState({ accessionId: a.id, bone: "femur_right", zone: "femur_right" });
    expect((await getSiteBoneStats(site.id)).mni).toBe(0);
  });

  it("updates when an individual is deleted", async () => {
    const { site, individuals } = await siteWithIndividuals("WES001", 3);

    for (const individual of individuals) await mark(individual, "femur_right", PRESENT_COMPLETE);
    expect((await getSiteBoneStats(site.id)).mni).toBe(3);

    await deleteAccession(individuals[0].id);

    const stats = await getSiteBoneStats(site.id);
    expect(stats.mni).toBe(2);
    expect(stats.individualCount).toBe(2);
  });

  it("updates when an individual is added", async () => {
    const { site, individuals } = await siteWithIndividuals("WES001", 1);
    await mark(individuals[0], "femur_right", PRESENT_COMPLETE);
    expect((await getSiteBoneStats(site.id)).mni).toBe(1);

    const added = await createAccession({ siteId: site.id, accessionNumber: "SK99" });
    await mark(added, "femur_right", PRESENT_COMPLETE);

    expect((await getSiteBoneStats(site.id)).mni).toBe(2);
  });

  it("only counts individuals from the requested site", async () => {
    const one = await siteWithIndividuals("WES001", 2);
    const two = await siteWithIndividuals("WES002", 1);

    for (const individual of one.individuals) await mark(individual, "femur_right", PRESENT_COMPLETE);
    await mark(two.individuals[0], "femur_right", PRESENT_COMPLETE);

    expect((await getSiteBoneStats(one.site.id)).mni).toBe(2);
    expect((await getSiteBoneStats(two.site.id)).mni).toBe(1);
  });

  it("ignores bones that are not counted, without failing", async () => {
    const { site, individuals } = await siteWithIndividuals("WES001", 1);
    await mark(individuals[0], "right_rib_7", PRESENT_COMPLETE);
    await mark(individuals[0], "thoracic_4", PRESENT_COMPLETE);

    const stats = await getSiteBoneStats(site.id);

    expect(stats.mni).toBe(0);
    expect(stats.ignoredBones).toEqual(["right_rib_7", "thoracic_4"]);
  });

  it("can count complete elements only", async () => {
    const { site, individuals } = await siteWithIndividuals("WES001", 2);
    await mark(individuals[0], "femur_right", PRESENT_COMPLETE);
    await mark(individuals[1], "femur_right", PRESENT_FRAGMENTED);

    const stats = await getSiteBoneStats(site.id, { presentStates: [PRESENT_COMPLETE] });

    expect(stats.mni).toBe(1);
  });

  it("throws NotFoundError for a site that does not exist", async () => {
    await expect(getSiteBoneStats("does-not-exist")).rejects.toBeInstanceOf(NotFoundError);
  });
});
