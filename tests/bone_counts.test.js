import { existsSync, readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it } from "vitest";
import { IDBFactory } from "fake-indexeddb";

import {
  AGE_CATEGORIES,
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
  // Adult non-cranial / non-mandible IDs match the client MNI codes.
  // Child rib and vertebra aliases use those same codes.
  // Cranial views map to CRA; mandible views map to MND.
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

    // Child aliases -> existing client codes
    ["RT1L", "RIB_L1"],
    ["RT1R", "RIB_R1"],
    ["C1C", "VC1"],
    ["C1N", "VC1"],
    ["C2C", "VC2"],
    ["C2N", "VC2"],
    ["NAS_L", "CRA"],
    ["NAS_R", "CRA"],
    ["OCC_L_lat_l", "CRA"],
    ["OCC_R_lat_r", "CRA"],
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
    // Non-digit-1 phalanges are visual only.
    "PPF2_R",
    // Ear ossicles are not part of the MNI set.
    "MAL_L",
    "STA_R",
    // Child unfused parts and uncounted table cells
    "FEM_L2",
    "FEM_R3",
    "PEL_L3",
    "SAC_2",
    "OCC_L2_lat_l",
    "RT2L",
    "RSU",
    "C3C",
    // Junk / defensive
    "not_a_real_bone",
    "constructor",
    "__proto__",
    undefined,
  ])("does not count %s", (svgId) => {
    expect(elementCodeForBone(svgId)).toBeNull();
  });

  it("shares codes across skull views and Child rib / vertebra representations", () => {
    const idsByCode = new Map();

    for (const [svgId, { code }] of ELEMENT_BY_SVG_ID) {
      idsByCode.set(code, [...(idsByCode.get(code) || []), svgId]);
    }

    const shared = [...idsByCode]
      .filter(([, ids]) => ids.length > 1)
      .map(([code]) => code)
      .sort();

    expect(shared).toEqual([
      "CRA", "MND", "RIB_L1", "RIB_R1", "VC1", "VC2",
    ]);
  });

  it("labels the hand digit-1 phalanges as 'thumb', not 'hallux'", () => {
    expect(ELEMENT_BY_SVG_ID.get("PPH1_R").label).toMatch(/thumb/i);
    expect(ELEMENT_BY_SVG_ID.get("DPH1_L").label).toMatch(/thumb/i);
    expect(ELEMENT_BY_SVG_ID.get("PPF1_R").label).toMatch(/hallux/i);
    expect(ELEMENT_BY_SVG_ID.get("DPF1_L").label).toMatch(/hallux/i);
  });
});

describe("linkedSvgIds", () => {
  it("links same-bone cranial views, not the whole skull", () => {
    const group = linkedSvgIds("PAR_R_post");

    expect(group.sort()).toEqual(
      ["PAR_R_ant", "PAR_R_lat_r", "PAR_R_post"].sort()
    );
    expect(group).not.toContain("TEM_L_ant");
    expect(group).not.toContain("CRA_ant");
  });

  it("links mandible parts together", () => {
    expect(linkedSvgIds("MND_L").sort()).toEqual(
      ["MND", "MND_L", "MND_R"].sort()
    );
  });

  it("links CRA lateral / anterior views together", () => {
    expect(linkedSvgIds("CRA_lat_r").sort()).toEqual(
      ["CRA_ant", "CRA_lat_l", "CRA_lat_r"].sort()
    );
  });

  it("links sphenoid views across both sides (client point 5)", () => {
    expect(linkedSvgIds("SPH_L_lat_l").sort()).toEqual(
      ["SPH_L_lat_l", "SPH_R_lat_r", "SPH_inf"].sort()
    );
    expect(linkedSvgIds("SPH_R_lat_r").sort()).toEqual(
      ["SPH_L_lat_l", "SPH_R_lat_r", "SPH_inf"].sort()
    );
  });

  it("does not cross-link left and right palatine", () => {
    expect(linkedSvgIds("PAL_L_inf")).toEqual(["PAL_L_inf"]);
    expect(linkedSvgIds("PAL_R_inf")).toEqual(["PAL_R_inf"]);
  });

  it("links the Child occipital views without changing Adult links", () => {
    for (const id of ["OCC_L_lat_l", "OCC_R_lat_r"]) {
      expect(linkedSvgIds(id, AGE_CATEGORIES.CHILD).sort()).toEqual(
        ["OCC_L_lat_l", "OCC_R_lat_r"].sort()
      );
      expect(linkedSvgIds(id, AGE_CATEGORIES.ADULT)).toEqual([id]);
    }

    expect(linkedSvgIds("OCC_lat_l", AGE_CATEGORIES.ADULT).sort()).toEqual(
      ["OCC_lat_l", "OCC_lat_r", "OCC_inf", "OCC_post"].sort()
    );
  });

  it("keeps shared skull links the same for Adult and Child", () => {
    for (const id of ["PAR_R_post", "MND_L", "CRA_ant", "SPH_inf"]) {
      expect(linkedSvgIds(id, AGE_CATEGORIES.CHILD))
        .toEqual(linkedSvgIds(id, AGE_CATEGORIES.ADULT));
    }
  });

  it("keeps numbered Child parts independent", () => {
    for (const id of ["FEM_L2", "PEL_L3", "SAC_2", "OCC_L2_lat_l"]) {
      expect(linkedSvgIds(id, AGE_CATEGORIES.CHILD)).toEqual([id]);
    }
  });

  it("returns only itself for unmapped or single bones", () => {
    expect(linkedSvgIds("FEM_R")).toEqual(["FEM_R"]);
    expect(linkedSvgIds("bone_alpha")).toEqual(["bone_alpha"]);
  });
});

const adultSvgDir = fileURLToPath(
  new URL("../www/assets/skeletons/adult/", import.meta.url)
);

const childSvgDir = fileURLToPath(
  new URL("../www/assets/skeletons/child/", import.meta.url)
);

const CHILD_ALIAS_IDS = [
  "RT1L", "RT1R", "C1C", "C1N", "C2C", "C2N",
  "NAS_L", "NAS_R", "OCC_L_lat_l", "OCC_R_lat_r",
];

function svgIdsInDirectory(directory) {
  const ids = new Set();

  for (const file of readdirSync(directory).filter((name) => name.endsWith(".svg"))) {
    const svg = readFileSync(`${directory}/${file}`, "utf8");

    // Bone ids may appear on <g>, <path>, <polygon>, etc.
    for (const match of svg.matchAll(/\sid="([^"]+)"/g)) {
      ids.add(match[1]);
    }
  }

  return ids;
}

describe.skipIf(!existsSync(adultSvgDir))("element codes vs the adult SVG assets", () => {
  it("keeps every Adult mapped ID in the Adult SVG files", () => {
    const ids = svgIdsInDirectory(adultSvgDir);

    const missing = [...ELEMENT_BY_SVG_ID.keys()]
      .filter((id) => !CHILD_ALIAS_IDS.includes(id) && !ids.has(id));

    expect(missing).toEqual([]);
  });
});

describe.skipIf(!existsSync(childSvgDir))("element codes vs the child SVG assets", () => {
  it("includes every Child alias in the supplied Child SVG files", () => {
    const ids = svgIdsInDirectory(childSvgDir);

    expect(CHILD_ALIAS_IDS.filter((id) => !ids.has(id))).toEqual([]);
  });
});

describe.skipIf(!existsSync(adultSvgDir) || !existsSync(childSvgDir))(
  "element codes vs all supported SVG assets",
  () => {
    it("finds every mapped ID in Adult or Child SVG files", () => {
      const ids = new Set([
        ...svgIdsInDirectory(adultSvgDir),
        ...svgIdsInDirectory(childSvgDir),
      ]);

      expect(
        [...ELEMENT_BY_SVG_ID.keys()].filter((id) => !ids.has(id))
      ).toEqual([]);
    });
  }
);

describe("countPresentElements", () => {
  it("counts individuals per element and splits complete from fragmented", () => {
    const { counts } = countPresentElements([
      [row("FEM_R", PRESENT_COMPLETE)],
      [row("FEM_R", PRESENT_FRAGMENTED)],
      [row("FEM_R", PRESENT_COMPLETE), row("FEM_L", PRESENT_FRAGMENTED)],
    ]);

    expect(counts["FEM_R"]).toMatchObject({
      count: 2, complete: 2, fragmented: 1,
    });
    expect(counts["FEM_L"]).toMatchObject({
      count: 0, complete: 0, fragmented: 1,
    });
  });

  it("does not count fragmented bones towards the total (client confirmed 27 Sep: fragmented means <50% present, inventory only, not MNI)", () => {
    const { counts } = countPresentElements([
      [row("FEM_R", PRESENT_FRAGMENTED)],
    ]);

    expect(counts["FEM_R"]).toMatchObject({
      count: 0, complete: 0, fragmented: 1,
    });
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

    expect(counts["CRA"]).toMatchObject({
      count: 1, complete: 1, fragmented: 0,
    });
  });

  it("counts a skull as present when only one of its bones is marked", () => {
    const { counts } = countPresentElements([
      [row("LAC_L_ant", PRESENT_COMPLETE)],
    ]);

    expect(counts["CRA"]).toMatchObject({
      count: 1, complete: 1, fragmented: 0,
    });
  });

  it("keeps the mandible and hyoid separate from the skull", () => {
    const { counts } = countPresentElements([
      [row("MND", PRESENT_COMPLETE), row("HYD", PRESENT_COMPLETE)],
    ]);

    expect(Object.keys(counts).sort()).toEqual(["HYD", "MND"]);
  });

  it("does not count the ear ossicles as part of the skull", () => {
    const { counts, ignoredBones } = countPresentElements([
      [row("MAL_L", PRESENT_COMPLETE)],
    ]);

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

    expect(counts["FEM_R"]).toMatchObject({
      count: 1, complete: 1, fragmented: 0,
    });
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

    expect(counts["FEM_R"]).toMatchObject({
      count: 1, complete: 1, fragmented: 1,
    });
  });

  it.each([
    ["RIB_L1", "RT1L", "RIB_L1"],
    ["RIB_R1", "RT1R", "RIB_R1"],
    ["VC1", "C1C", "VC1"],
    ["C1C", "C1N", "VC1"],
    ["VC2", "C2C", "VC2"],
    ["C2C", "C2N", "VC2"],
  ])(
    "counts %s and %s once per individual as %s",
    (first, second, code) => {
      const { counts } = countPresentElements([
        [row(first, PRESENT_COMPLETE), row(second, PRESENT_COMPLETE)],
        [row(second, PRESENT_COMPLETE)],
      ]);

      expect(counts[code]).toMatchObject({
        count: 2, complete: 2, fragmented: 0,
      });
    }
  );

  it("lets Present take priority over Fragmented for Child aliases in either order", () => {
    const { counts } = countPresentElements([
      [row("C1C", PRESENT_FRAGMENTED), row("C1N", PRESENT_COMPLETE)],
      [row("C1N", PRESENT_COMPLETE), row("C1C", PRESENT_FRAGMENTED)],
    ]);

    expect(counts["VC1"]).toMatchObject({
      count: 2, complete: 2, fragmented: 0,
    });
  });

  it("counts additional Child skull views as one CRA per individual", () => {
    const { counts } = countPresentElements([
      [row("NAS_L", PRESENT_COMPLETE), row("OCC_L_lat_l", PRESENT_COMPLETE)],
      [row("NAS_R", PRESENT_COMPLETE), row("OCC_R_lat_r", PRESENT_COMPLETE)],
    ]);

    expect(counts["CRA"]).toMatchObject({
      count: 2, complete: 2, fragmented: 0,
    });
  });

  it("counts one Present base femur when its numbered parts are Absent", () => {
    const stats = computeBoneStats([[
      row("FEM_L", PRESENT_COMPLETE),
      row("FEM_L2", ABSENT),
      row("FEM_L3", ABSENT),
    ]]);

    expect(stats.counts["FEM_L"]).toMatchObject({
      count: 1, complete: 1,
    });
    expect(stats.mni).toBe(1);
  });

  it("does not count Present numbered parts when the base bone is Absent", () => {
    const stats = computeBoneStats([[
      row("FEM_L", ABSENT),
      row("FEM_L2", PRESENT_COMPLETE),
      row("FEM_L3", PRESENT_COMPLETE),
      row("PEL_L3", PRESENT_COMPLETE),
      row("SAC_2", PRESENT_COMPLETE),
    ]]);

    expect(stats.counts).toEqual({});
    expect(stats.mni).toBe(0);
    expect(stats.ignoredBones).toEqual([
      "FEM_L2", "FEM_L3", "PEL_L3", "SAC_2",
    ]);
  });

  it("does not count Fragmented or Absent Child aliases towards MNI", () => {
    const stats = computeBoneStats([[
      row("RT1L", PRESENT_FRAGMENTED),
      row("C1C", ABSENT),
      row("C2N", PRESENT_FRAGMENTED),
      row("NAS_L", ABSENT),
    ]]);

    expect(stats.counts["RIB_L1"]).toMatchObject({
      count: 0, fragmented: 1,
    });
    expect(stats.counts["VC2"]).toMatchObject({
      count: 0, fragmented: 1,
    });
    expect(stats.counts["VC1"]).toBeUndefined();
    expect(stats.counts["CRA"]).toBeUndefined();
    expect(stats.mni).toBe(0);
  });

  it("counts only complete elements by default", () => {
    expect(PRESENT_STATES).toEqual([PRESENT_COMPLETE]);
  });
});

describe("summariseElementCounts", () => {
  const entry = (code, count) => ({
    code, label: code, count, complete: count, fragmented: 0,
  });

  it("uses the highest present count as the MNI", () => {
    const { mni } = summariseElementCounts({
      FEM_R: entry("FEM_R", 4),
      HUM_L: entry("HUM_L", 2),
    });

    expect(mni).toBe(4);
  });

  it("returns an MNI of 0 and no top elements when nothing is present", () => {
    expect(summariseElementCounts({})).toEqual({
      mni: 0, topElements: [],
    });
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

    expect(summariseElementCounts(counts).topElements.map((e) => e.code))
      .toEqual(["MC2_R", "MC10_R"]);
  });

  it("skips elements whose count is 0", () => {
    const { topElements } = summariseElementCounts({
      FEM_R: entry("FEM_R", 0),
    });

    expect(topElements).toEqual([]);
  });
});

describe("computeBoneStats", () => {
  it("includes individuals who have no bones recorded in the individual count", () => {
    const stats = computeBoneStats([
      [row("FEM_R", PRESENT_COMPLETE)],
      [],
    ]);

    expect(stats.individualCount).toBe(2);
    expect(stats.mni).toBe(1);
  });
});

describe("getSiteBoneStats", () => {
  async function siteWithIndividuals(code, individualCount) {
    const site = await createSite({ code });
    const individuals = [];

    for (let i = 1; i <= individualCount; i++) {
      individuals.push(await createAccession({
        siteId: site.id,
        accessionNumber: `SK${i}`,
      }));
    }

    return { site, individuals };
  }

  const mark = (individual, bone, state) =>
    setZoneState({
      accessionId: individual.id,
      bone,
      zone: bone,
      state,
    });

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
    expect(stats.topElements[0]).toMatchObject({
      code: "CRA",
      label: "Cranium",
      count: 1,
    });
  });

  it("returns an MNI of 0 for a site with individuals but nothing recorded", async () => {
    const { site } = await siteWithIndividuals("WES001", 2);
    const stats = await getSiteBoneStats(site.id);

    expect(stats).toMatchObject({
      individualCount: 2, mni: 0, topElements: [],
    });
  });

  it("returns an MNI of 0 for a site with no individuals", async () => {
    const site = await createSite({ code: "WES001" });
    const stats = await getSiteBoneStats(site.id);

    expect(stats).toMatchObject({
      individualCount: 0, mni: 0, topElements: [],
    });
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

    await clearZoneState({
      accessionId: a.id,
      bone: "FEM_R",
      zone: "FEM_R",
    });

    expect((await getSiteBoneStats(site.id)).mni).toBe(0);
  });

  it("updates when an individual is deleted", async () => {
    const { site, individuals } = await siteWithIndividuals("WES001", 3);

    for (const individual of individuals) {
      await mark(individual, "FEM_R", PRESENT_COMPLETE);
    }

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

    const added = await createAccession({
      siteId: site.id,
      accessionNumber: "SK99",
    });

    await mark(added, "FEM_R", PRESENT_COMPLETE);

    expect((await getSiteBoneStats(site.id)).mni).toBe(2);
  });

  it("only counts individuals from the requested site", async () => {
    const one = await siteWithIndividuals("WES001", 2);
    const two = await siteWithIndividuals("WES002", 1);

    for (const individual of one.individuals) {
      await mark(individual, "FEM_R", PRESENT_COMPLETE);
    }

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

  it("combines Adult and Child records using the same MNI codes", async () => {
    const site = await createSite({ code: "MIXED001" });

    const adult = await createAccession({
      siteId: site.id,
      accessionNumber: "ADULT-1",
      ageCategory: AGE_CATEGORIES.ADULT,
    });

    const child = await createAccession({
      siteId: site.id,
      accessionNumber: "CHILD-1",
      ageCategory: AGE_CATEGORIES.CHILD,
    });

    await mark(adult, "RIB_L1", PRESENT_COMPLETE);
    await mark(adult, "VC1", PRESENT_COMPLETE);
    await mark(child, "RT1L", PRESENT_COMPLETE);
    await mark(child, "C1C", PRESENT_COMPLETE);
    await mark(child, "C1N", PRESENT_COMPLETE);
    await mark(child, "OCC_L_lat_l", PRESENT_COMPLETE);
    await mark(child, "OCC_R_lat_r", PRESENT_COMPLETE);
    await mark(child, "FEM_L2", PRESENT_COMPLETE);

    const stats = await getSiteBoneStats(site.id);

    expect(stats.individualCount).toBe(2);
    expect(stats.counts["RIB_L1"].count).toBe(2);
    expect(stats.counts["VC1"].count).toBe(2);
    expect(stats.counts["CRA"].count).toBe(1);
    expect(stats.ignoredBones).toEqual(["FEM_L2"]);
    expect(stats.mni).toBe(2);

    await mark(child, "C1C", ABSENT);

    expect((await getSiteBoneStats(site.id)).counts["VC1"].count).toBe(2);

    await mark(child, "C1N", ABSENT);

    expect((await getSiteBoneStats(site.id)).counts["VC1"].count).toBe(1);
  });

  it("throws NotFoundError for an unknown site", async () => {
    await expect(getSiteBoneStats("missing-site"))
      .rejects.toBeInstanceOf(NotFoundError);
  });
});
