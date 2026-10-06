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
  linkedSvgIds,
  summariseElementCounts,
} from "../www/js/bone_counts.js";

const { PRESENT_COMPLETE, PRESENT_FRAGMENTED, ABSENT } = PRESERVATION_STATES;

const row = (bone, state) => ({ bone, side: "", zone: bone, state });

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
  __resetConnectionForTests();
});

describe("element codes", () => {
  // For every non-cranial, non-mandible element the SVG id IS the
  // client MNI code. Cranial views map many-to-one onto CRA; the
  // mandible views map onto MND.
  it.each([
    // Sided bones (SVG id === client code)
    ["FEM_R", "FEM_R"],
    ["FEM_L", "FEM_L"],
    ["CLA_R", "CLA_R"],
    ["CLA_L", "CLA_L"],
    ["SCA_R", "SCA_R"],
    ["HUM_R", "HUM_R"],
    ["HUM_L", "HUM_L"],
    ["RAD_R", "RAD_R"],
    ["ULN_L", "ULN_L"],
    ["PAT_R", "PAT_R"],
    ["TIB_L", "TIB_L"],
    ["FIB_R", "FIB_R"],
    ["SC_R", "SC_R"],
    ["LU_L", "LU_L"],
    ["TQ_R", "TQ_R"],
    ["PI_L", "PI_L"],
    ["TZ_R", "TZ_R"],
    ["TR_L", "TR_L"],
    ["CA_R", "CA_R"],
    ["HA_L", "HA_L"],
    ["CAL_R", "CAL_R"],
    ["TAL_L", "TAL_L"],
    ["CUB_R", "CUB_R"],
    ["NAV_L", "NAV_L"],
    ["PEL_R", "PEL_R"],
    ["PEL_L", "PEL_L"],
    ["RIB_R1", "RIB_R1"],
    ["RIB_L1", "RIB_L1"],
    ["MC1_R", "MC1_R"],
    ["MC3_R", "MC3_R"],
    ["MC5_L", "MC5_L"],
    ["MT1_R", "MT1_R"],
    ["MT5_L", "MT5_L"],
    ["CUN_L1", "CUN_L1"],
    ["CUN_R3", "CUN_R3"],
    ["PPF1_R", "PPF1_R"],
    ["DPF1_L", "DPF1_L"],
    ["PPH1_R", "PPH1_R"],
    ["DPH1_L", "DPH1_L"],

    // Axial (SVG id === client code)
    ["STN", "STN"],
    ["SAC", "SAC"],
    ["HYD", "HYD"],
    ["VC1", "VC1"],
    ["VC2", "VC2"],

    // Cranial views -> CRA
    ["CRA_ant", "CRA"],
    ["OCC_post", "CRA"],
    ["PAR_L_post", "CRA"],
    ["PAR_R_ant", "CRA"],
    ["TEM_L_inf", "CRA"],
    ["TEM_R_lat_r", "CRA"],
    ["NAS_L_ant", "CRA"],
    ["MAX_R_inf", "CRA"],
    ["ZYG_L_lat_l", "CRA"],
    ["LAC_R_ant", "CRA"],
    ["SPH_inf", "CRA"],
    ["PAL_L_inf", "CRA"],
    ["VOM_ant", "CRA"],
    ["INCO_L", "CRA"],

    // Mandible views -> MND
    ["MND", "MND"],
    ["MND_L", "MND"],
    ["MND_R", "MND"],
  ])("maps %s to the client code %s", (svgId, code) => {
    expect(elementCodeForBone(svgId)).toBe(code);
  });

  it.each([
    // Ribs beyond the first are recorded visually only.
    "RIB_R2",
    "RIB_L12",
    // Only C1 and C2 go into MNI; other vertebrae are visual only.
    "VC3",
    "VT1",
    "VL5",
    "COC",
    // Non-hallux phalanges are visual only.
    "PPF2_R",
    // Ear ossicles are not part of the MNI set.
    "MAL_L",
    "STA_R",
    // Junk / defensive
    "not_a_real_bone",
    "constructor",
    "__proto__",
    undefined,
  ])("does not count %s", (svgId) => {
    expect(elementCodeForBone(svgId)).toBeNull();
  });

  it("CRA and MND are the only codes shared by several SVG ids", () => {
    const idsByCode = new Map();
    for (const [svgId, { code }] of ELEMENT_BY_SVG_ID) {
      idsByCode.set(code, [...(idsByCode.get(code) || []), svgId]);
    }

    const shared = [...idsByCode]
      .filter(([, ids]) => ids.length > 1)
      .map(([code]) => code)
      .sort();
    expect(shared).toEqual(["CRA", "MND"]);
  });
});

describe("linkedSvgIds", () => {
  it("links same-bone cranial views, not the whole skull", () => {
    const group = linkedSvgIds("PAR_R_post");
    expect(group.sort()).toEqual(["PAR_R_ant", "PAR_R_lat_r", "PAR_R_post"].sort());
    expect(group).not.toContain("TEM_L_ant");
    expect(group).not.toContain("CRA_ant");
  });

  it("links mandible parts together", () => {
    expect(linkedSvgIds("MND_L").sort()).toEqual(["MND", "MND_L", "MND_R"].sort());
  });

  it("links CRA lateral / anterior views together", () => {
    expect(linkedSvgIds("CRA_lat_r").sort()).toEqual(
      ["CRA_ant", "CRA_lat_l", "CRA_lat_r"].sort()
    );
  });

  it("returns only itself for unmapped or single bones", () => {
    expect(linkedSvgIds("FEM_R")).toEqual(["FEM_R"]);
    expect(linkedSvgIds("bone_alpha")).toEqual(["bone_alpha"]);
  });
});

const adultSvgDir = fileURLToPath(
  new URL("../www/assets/skeletons/adult/", import.meta.url)
);

describe.skipIf(!existsSync(adultSvgDir))("element codes vs the adult SVG assets", () => {
  it("every mapped SVG id exists in the adult SVG files", () => {
    const ids = new Set();

    for (const file of readdirSync(adultSvgDir).filter((name) => name.endsWith(".svg"))) {
      const svg = readFileSync(`${adultSvgDir}/${file}`, "utf8");
      // Bone ids may appear on <g>, <path>, <polygon>, etc.
      for (const match of svg.matchAll(/\sid="([^"]+)"/g)) ids.add(match[1]);
    }

    const missing = [...ELEMENT_BY_SVG_ID.keys()].filter((id) => !ids.has(id));
    expect(missing).toEqual([]);
  });
});

describe("countPresentElements", () => {
  it("counts individuals per element and splits complete from fragmented", () => {
    const { counts } = countPresentElements([
      [row("FEM_R", PRESENT_COMPLETE)],
      [row("FEM_R", PRESENT_FRAGMENTED)],
      [row("FEM_R", PRESENT_COMPLETE), row("FEM_L", PRESENT_FRAGMENTED)],
    ]);

    expect(counts["FEM_R"]).toMatchObject({ count: 2, complete: 2, fragmented: 1 });
    expect(counts["FEM_L"]).toMatchObject({ count: 0, complete: 0, fragmented: 1 });
  });

  it("does not count fragmented bones towards the total (client confirmed 27 Sep: fragmented means <50% present, inventory only, not MNI)", () => {
    const { counts } = countPresentElements([[row("FEM_R", PRESENT_FRAGMENTED)]]);
    expect(counts["FEM_R"]).toMatchObject({ count: 0, complete: 0, fragmented: 1 });
  });

  it("does not count absent bones", () => {
    const { counts } = countPresentElements([[row("FEM_R", ABSENT)]]);
    expect(counts["FEM_R"]).toBeUndefined();
  });

  it("treats the skull as one element however many of its bones are marked", () => {
    const { counts } = countPresentElements([
      [
        row("CRA_ant", PRESENT_COMPLETE),
        row("OCC_post", PRESENT_FRAGMENTED),
        row("PAR_R_post", PRESENT_COMPLETE),
      ],
    ]);

    expect(counts["CRA"]).toMatchObject({ count: 1, complete: 1, fragmented: 0 });
  });

  it("counts a skull as present when only one of its bones is marked", () => {
    const { counts } = countPresentElements([[row("LAC_L_ant", PRESENT_COMPLETE)]]);
    expect(counts["CRA"]).toMatchObject({ count: 1, complete: 1, fragmented: 0 });
  });

  it("keeps the mandible and hyoid separate from the skull", () => {
    const { counts } = countPresentElements([
      [row("MND", PRESENT_COMPLETE), row("HYD", PRESENT_COMPLETE)],
    ]);

    expect(Object.keys(counts).sort()).toEqual(["HYD", "MND"]);
  });

  it("does not count the ear ossicles as part of the skull", () => {
    const { counts, ignoredBones } = countPresentElements([[row("MAL_L", PRESENT_COMPLETE)]]);

    expect(counts).toEqual({});
    expect(ignoredBones).toEqual(["MAL_L"]);
  });

  it("counts an individual once per element even with several rows for it", () => {
    const { counts } = countPresentElements([
      [
        { bone: "FEM_R", side: "", zone: "shaft", state: PRESENT_FRAGMENTED },
        { bone: "FEM_R", side: "", zone: "head", state: PRESENT_COMPLETE },
      ],
    ]);

    expect(counts["FEM_R"]).toMatchObject({ count: 1, complete: 1, fragmented: 0 });
  });

  it("reports bones that are not part of the counts, sorted and de-duplicated", () => {
    const { counts, ignoredBones } = countPresentElements([
      [row("RIB_R2", PRESENT_COMPLETE), row("COC", PRESENT_COMPLETE)],
      [row("RIB_R2", PRESENT_COMPLETE)],
    ]);

    expect(counts).toEqual({});
    expect(ignoredBones).toEqual(["COC", "RIB_R2"]);
  });

  it("can be restricted to complete elements only", () => {
    const { counts } = countPresentElements(
      [[row("FEM_R", PRESENT_COMPLETE)], [row("FEM_R", PRESENT_FRAGMENTED)]],
      { presentStates: [PRESENT_COMPLETE] }
    );

    expect(counts["FEM_R"]).toMatchObject({ count: 1, complete: 1, fragmented: 1 });
  });

  it("counts only complete elements by default", () => {
    expect(PRESENT_STATES).toEqual([PRESENT_COMPLETE]);
  });
});

describe("summariseElementCounts", () => {
  const entry = (code, count) => ({ code, label: code, count, complete: count, fragmented: 0 });

  it("uses the highest present count as the MNI", () => {
    const { mni } = summariseElementCounts({
      FEM_R: entry("FEM_R", 4),
      HUM_L: entry("HUM_L", 2),
    });

    expect(mni).toBe(4);
  });

  it("returns an MNI of 0 and no top elements when nothing is present", () => {
    expect(summariseElementCounts({})).toEqual({ mni: 0, topElements: [] });
  });

  it("ranks by count then code, and limits to the top 5", () => {
    const counts = {};
    for (const [code, count] of [
      ["TIB_R", 2],
      ["FEM_R", 5],
      ["FEM_L", 2],
      ["HUM_R", 3],
      ["ULN_R", 2],
      ["RAD_R", 1],
      ["SAC", 4],
    ]) {
      counts[code] = entry(code, count);
    }

    const { topElements } = summariseElementCounts(counts);

    expect(topElements.map((element) => element.code)).toEqual([
      "FEM_R",
      "SAC",
      "HUM_R",
      "FEM_L",
      "TIB_R",
    ]);
  });

  it("sorts codes with numbers naturally when counts tie", () => {
    const counts = {
      MC10_R: entry("MC10_R", 1),
      MC2_R: entry("MC2_R", 1),
    };

    expect(summariseElementCounts(counts).topElements.map((e) => e.code)).toEqual([
      "MC2_R",
      "MC10_R",
    ]);
  });

  it("skips elements whose count is 0", () => {
    const { topElements } = summariseElementCounts({ FEM_R: entry("FEM_R", 0) });
    expect(topElements).toEqual([]);
  });
});

describe("computeBoneStats", () => {
  it("includes individuals who have no bones recorded in the individual count", () => {
    const stats = computeBoneStats([[row("FEM_R", PRESENT_COMPLETE)], []]);
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

    await mark(a, "FEM_R", PRESENT_COMPLETE);
    await mark(a, "HUM_R", PRESENT_FRAGMENTED);
    await mark(a, "FEM_L", ABSENT);
    await mark(b, "FEM_R", PRESENT_FRAGMENTED);
    await mark(c, "FEM_R", PRESENT_COMPLETE);
    await mark(c, "TIB_L", PRESENT_COMPLETE);

    const stats = await getSiteBoneStats(site.id);

    expect(stats.individualCount).toBe(3);
    expect(stats.mni).toBe(2);
    expect(stats.topElements.map((e) => [e.code, e.count])).toEqual([
      ["FEM_R", 2],
      ["TIB_L", 1],
    ]);
    expect(stats.counts["FEM_L"]).toBeUndefined();
  });

  it("counts the skull once per individual and can drive the MNI", async () => {
    const { site, individuals } = await siteWithIndividuals("WES001", 3);
    const [a, b, c] = individuals;

    await mark(a, "CRA_ant", PRESENT_COMPLETE);
    await mark(a, "OCC_lat_r", PRESENT_COMPLETE);
    await mark(b, "PAR_L_ant", PRESENT_FRAGMENTED);
    await mark(c, "FEM_R", PRESENT_COMPLETE);

    const stats = await getSiteBoneStats(site.id);

    expect(stats.mni).toBe(1);
    expect(stats.topElements[0]).toMatchObject({ code: "CRA", label: "Cranium", count: 1 });
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

    await mark(a, "FEM_R", PRESENT_COMPLETE);
    await mark(b, "FEM_R", PRESENT_COMPLETE);
    expect((await getSiteBoneStats(site.id)).mni).toBe(2);

    await mark(b, "FEM_R", ABSENT);
    expect((await getSiteBoneStats(site.id)).mni).toBe(1);

    await mark(b, "FEM_R", PRESENT_FRAGMENTED);
    expect((await getSiteBoneStats(site.id)).mni).toBe(1);
  });

  it("updates when a bone state is cleared", async () => {
    const { site, individuals } = await siteWithIndividuals("WES001", 1);
    const [a] = individuals;

    await mark(a, "FEM_R", PRESENT_COMPLETE);
    expect((await getSiteBoneStats(site.id)).mni).toBe(1);

    await clearZoneState({ accessionId: a.id, bone: "FEM_R", zone: "FEM_R" });
    expect((await getSiteBoneStats(site.id)).mni).toBe(0);
  });

  it("updates when an individual is deleted", async () => {
    const { site, individuals } = await siteWithIndividuals("WES001", 3);

    for (const individual of individuals) await mark(individual, "FEM_R", PRESENT_COMPLETE);
    expect((await getSiteBoneStats(site.id)).mni).toBe(3);

    await deleteAccession(individuals[0].id);

    const stats = await getSiteBoneStats(site.id);
    expect(stats.mni).toBe(2);
    expect(stats.individualCount).toBe(2);
  });

  it("updates when an individual is added", async () => {
    const { site, individuals } = await siteWithIndividuals("WES001", 1);
    await mark(individuals[0], "FEM_R", PRESENT_COMPLETE);
    expect((await getSiteBoneStats(site.id)).mni).toBe(1);

    const added = await createAccession({ siteId: site.id, accessionNumber: "SK99" });
    await mark(added, "FEM_R", PRESENT_COMPLETE);

    expect((await getSiteBoneStats(site.id)).mni).toBe(2);
  });

  it("only counts individuals from the requested site", async () => {
    const one = await siteWithIndividuals("WES001", 2);
    const two = await siteWithIndividuals("WES002", 1);

    for (const individual of one.individuals) await mark(individual, "FEM_R", PRESENT_COMPLETE);
    await mark(two.individuals[0], "FEM_R", PRESENT_COMPLETE);

    expect((await getSiteBoneStats(one.site.id)).mni).toBe(2);
    expect((await getSiteBoneStats(two.site.id)).mni).toBe(1);
  });

  it("ignores bones that are not counted, without failing", async () => {
    const { site, individuals } = await siteWithIndividuals("WES001", 1);
    await mark(individuals[0], "RIB_R7", PRESENT_COMPLETE);
    await mark(individuals[0], "VT4", PRESENT_COMPLETE);

    const stats = await getSiteBoneStats(site.id);

    expect(stats.mni).toBe(0);
    expect(stats.topElements).toEqual([]);
    expect(stats.ignoredBones).toEqual(["RIB_R7", "VT4"]);
  });

  it("throws NotFoundError for an unknown site", async () => {
    await expect(getSiteBoneStats("missing-site")).rejects.toBeInstanceOf(NotFoundError);
  });
});
