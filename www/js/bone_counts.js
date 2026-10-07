// ========================================
// Site-level Bone Counts and MNI
// ========================================
//
// Counts how many individuals in a site have each skeletal element
// recorded as Present, derives the Minimum Number of Individuals (MNI)
// from the most frequently present element, and ranks the top elements.
//
// Everything here is DERIVED from the stored zone states each time it
// is asked for — nothing is cached or stored — so counts are always in
// step with the database when a bone state, or a whole individual,
// changes or is deleted.
//
// The bone-marking pages save the SVG element id as `bone`. For
// Adult non-cranial, non-mandible elements, the SVG id IS the client's
// MNI code (e.g. FEM_R, RIB_R1, STN, VC1, MC3_R, PPH1_R). Child
// rib / vertebra table IDs are mapped to those same codes. Cranial
// views all map to CRA; mandible views (MND, MND_L, MND_R) map to MND.
// Only elements listed in ELEMENT_BY_SVG_ID are counted, which
// matches the client's rule that just the first rib and first two
// vertebrae go into bone counts while the remaining ribs/vertebrae are
// recorded visually only. Numbered unfused parts (FEM_L2, SAC_2,
// etc.) remain visual inventory records and are excluded from MNI.
// ========================================

import {
  PRESERVATION_STATES,
  AGE_CATEGORIES,
  NotFoundError,
  getSiteById,
  getAccessionsBySite,
  getZoneStatesByAccession,
} from "./data.js";

// States that count towards the MNI. Confirmed with the client
// (Ambika, 27 Sep): Fragmented means less than 50% of the element is
// present, so it is recorded for inventory purposes only and excluded
// from MNI — only Present (Complete, >=50% present) counts. Kept as a
// list rather than a single value in case that ever needs to change
// again; pass a different { presentStates: [...] } to override per call.
export const PRESENT_STATES = Object.freeze([
  PRESERVATION_STATES.PRESENT_COMPLETE,
]);

export const TOP_ELEMENT_LIMIT = 5;

// ========================================
// Client element codes (MNI) — also the SVG ids
// ========================================

const SIDES = [
  { letter: "R", label: "Right" },
  { letter: "L", label: "Left" },
];

// [code, name] — SVG id and client MNI code are both
// `${code}_${letter}` (e.g. FEM_R, CLA_L).
const SIDED_BONES = [
  ["CLA", "clavicle"],
  ["SCA", "scapula"],
  ["HUM", "humerus"],
  ["RAD", "radius"],
  ["ULN", "ulna"],
  ["SC", "scaphoid"],
  ["LU", "lunate"],
  ["TQ", "triquetrum"],
  ["PI", "pisiform"],
  ["TZ", "trapezium"],
  ["TR", "trapezoid"],
  ["CA", "capitate"],
  ["HA", "hamate"],
  ["FEM", "femur"],
  ["PAT", "patella"],
  ["TIB", "tibia"],
  ["FIB", "fibula"],
  ["CAL", "calcaneus"],
  ["TAL", "talus"],
  ["CUB", "cuboid"],
  ["NAV", "navicular"],
];

// Skull counts as ONE MNI element (CRA). Every cranial view id maps
// here for counting only. UI linking of same-bone views is separate
// (see LINKED_VIEW_GROUPS / linkedSvgIds below).
const CRANIAL_SVG_IDS = [
  "CRA_ant", "CRA_lat_l", "CRA_lat_r",
  "PAR_L_ant", "PAR_L_lat_l", "PAR_L_post",
  "PAR_R_ant", "PAR_R_lat_r", "PAR_R_post",
  "TEM_L_ant", "TEM_L_inf", "TEM_L_lat_l", "TEM_L_post",
  "TEM_R_ant", "TEM_R_inf", "TEM_R_lat_r", "TEM_R_post",
  "OCC_inf", "OCC_lat_l", "OCC_lat_r", "OCC_post",
  "SPH_L_lat_l", "SPH_R_lat_r", "SPH_inf",
  "MAX_L_ant", "MAX_L_inf", "MAX_L_lat_l",
  "MAX_R_ant", "MAX_R_inf", "MAX_R_lat_r",
  "ZYG_L_ant", "ZYG_L_inf", "ZYG_L_lat_l",
  "ZYG_R_ant", "ZYG_R_inf", "ZYG_R_lat_r",
  "NAS_L_ant", "NAS_L_lat_l",
  "NAS_R_ant", "NAS_R_lat_r",
  "LAC_L_ant", "LAC_L_lat_l",
  "LAC_R_ant", "LAC_R_lat_r",
  "PAL_L_inf", "PAL_R_inf",
  "VOM_ant", "VOM_inf",
  "INCO_L", "INCO_R",

  // Child cranial aliases; numbered unfused parts are not counted.
  "NAS_L", "NAS_R", "OCC_L_lat_l", "OCC_R_lat_r",
];

const MANDIBLE_SVG_IDS = ["MND", "MND_L", "MND_R"];

function buildElementTable() {
  const table = new Map();
  const add = (svgId, code, label) =>
    table.set(svgId, Object.freeze({ code, label }));

  // --- Axial (single, non-sided) ---
  add("STN", "STN", "Sternum");
  add("SAC", "SAC", "Sacrum");
  add("HYD", "HYD", "Hyoid");

  // --- Cranium + mandible ---
  for (const svgId of CRANIAL_SVG_IDS) {
    add(svgId, "CRA", "Cranium");
  }
  for (const svgId of MANDIBLE_SVG_IDS) {
    add(svgId, "MND", "Mandible");
  }

  // --- Vertebrae (only C1 and C2 count; rest are visual only) ---
  add("VC1", "VC1", "Atlas (C1)");
  add("VC2", "VC2", "Axis (C2)");

  // Child table cells map to the same first-rib / C1 / C2 elements.
  // Different representations count at most once per individual.
  add("RT1L", "RIB_L1", "Left first rib");
  add("RT1R", "RIB_R1", "Right first rib");

  for (const id of ["C1C", "C1N"]) {
    add(id, "VC1", "Atlas (C1)");
  }
  for (const id of ["C2C", "C2N"]) {
    add(id, "VC2", "Axis (C2)");
  }

  // --- Sided bones ---
  for (const side of SIDES) {
    for (const [code, name] of SIDED_BONES) {
      add(
        `${code}_${side.letter}`,
        `${code}_${side.letter}`,
        `${side.label} ${name}`
      );
    }

    // Pelvis (os coxae)
    add(
      `PEL_${side.letter}`,
      `PEL_${side.letter}`,
      `${side.label} os coxae (pelvis)`
    );

    // First rib only
    add(
      `RIB_${side.letter}1`,
      `RIB_${side.letter}1`,
      `${side.label} first rib`
    );

    // Metacarpals 1–5
    for (let n = 1; n <= 5; n++) {
      add(
        `MC${n}_${side.letter}`,
        `MC${n}_${side.letter}`,
        `${side.label} metacarpal ${n}`
      );
    }

    // Metatarsals 1–5
    for (let n = 1; n <= 5; n++) {
      add(
        `MT${n}_${side.letter}`,
        `MT${n}_${side.letter}`,
        `${side.label} metatarsal ${n}`
      );
    }

    // Cuneiforms: 1 medial -> 3 lateral (CUN_R1 next to the big toe).
    for (let n = 1; n <= 3; n++) {
      const position =
        n === 1 ? "medial" : n === 2 ? "intermediate" : "lateral";

      add(
        `CUN_${side.letter}${n}`,
        `CUN_${side.letter}${n}`,
        `${side.label} ${position} cuneiform`
      );
    }

    // Digit 1 phalanges only — thumb (hand, PPH/DPH) and hallux (foot, PPF/DPF).
    // Both are on the client's MNI list; other digits are visual only.
    add(
      `PPH1_${side.letter}`,
      `PPH1_${side.letter}`,
      `${side.label} thumb proximal phalanx`
    );
    add(
      `DPH1_${side.letter}`,
      `DPH1_${side.letter}`,
      `${side.label} thumb distal phalanx`
    );
    add(
      `PPF1_${side.letter}`,
      `PPF1_${side.letter}`,
      `${side.label} hallux proximal phalanx`
    );
    add(
      `DPF1_${side.letter}`,
      `DPF1_${side.letter}`,
      `${side.label} hallux distal phalanx`
    );
  }

  return table;
}

// SVG element id (as saved in `bone`) -> { code, label }
export const ELEMENT_BY_SVG_ID = buildElementTable();

// Returns the client's element code for a stored bone id, or null when
// that bone is not part of the counts.
export function elementCodeForBone(bone) {
  const element = ELEMENT_BY_SVG_ID.get(bone);
  return element ? element.code : null;
}

// ========================================
// Same-bone view linking (selection UI)
// ========================================
//
// Cranium bones appear in multiple views. Marking one view of a bone
// should update only that bone's other views — not the whole skull.
// Groups come from the client sheet (point 5). MNI still treats the
// whole skull as one CRA via ELEMENT_BY_SVG_ID above.

const LINKED_VIEW_GROUPS = [
  ["CRA_lat_l", "CRA_lat_r", "CRA_ant"],
  ["PAR_L_lat_l", "PAR_L_post", "PAR_L_ant"],
  ["PAR_R_lat_r", "PAR_R_post", "PAR_R_ant"],
  ["TEM_L_lat_l", "TEM_L_ant", "TEM_L_inf", "TEM_L_post"],
  ["TEM_R_lat_r", "TEM_R_ant", "TEM_R_inf", "TEM_R_post"],
  ["NAS_L_lat_l", "NAS_L_ant"],
  ["NAS_R_lat_r", "NAS_R_ant"],
  ["MAX_L_lat_l", "MAX_L_inf", "MAX_L_ant"],
  ["MAX_R_lat_r", "MAX_R_inf", "MAX_R_ant"],
  ["ZYG_L_lat_l", "ZYG_L_ant", "ZYG_L_inf"],
  ["ZYG_R_lat_r", "ZYG_R_ant", "ZYG_R_inf"],
  ["LAC_L_lat_l", "LAC_L_ant"],
  ["LAC_R_lat_r", "LAC_R_ant"],
  ["OCC_lat_l", "OCC_lat_r", "OCC_inf", "OCC_post"],
  ["SPH_L_lat_l", "SPH_R_lat_r", "SPH_inf"],
  // ["PAL_L_inf", "PAL_R_inf"],
  ["VOM_ant", "VOM_inf"],
  ["MND", "MND_L", "MND_R"],
];

const LINKED_BY_ID = (() => {
  const map = new Map();

  for (const group of LINKED_VIEW_GROUPS) {
    const frozen = Object.freeze([...group]);
    for (const id of group) map.set(id, frozen);
  }

  return map;
})();

// Child uses the same links except for its additional occipital IDs.
// This separate map leaves all Adult linking behaviour unchanged.
const CHILD_LINKED_BY_ID = (() => {
  const map = new Map(LINKED_BY_ID);

  // These views use different occipital IDs in Child. Keep Adult intact.
  const occipital = Object.freeze([
    "OCC_L_lat_l",
    "OCC_R_lat_r",
  ]);

  for (const id of occipital) map.set(id, occipital);

  return map;
})();

// SVG ids that should receive the same state as `boneId` in the
// selection UI. Same-bone multi-view groups only; unmapped ids
// (including numbered unfused parts) return just themselves.
export function linkedSvgIds(
  boneId,
  ageCategory = AGE_CATEGORIES.ADULT
) {
  const map = ageCategory === AGE_CATEGORIES.CHILD
    ? CHILD_LINKED_BY_ID
    : LINKED_BY_ID;

  const group = map.get(boneId);
  return group ? [...group] : [boneId];
}

// ========================================
// Counting
// ========================================

// zoneStatesPerIndividual: an array with one entry per individual, each
// entry being that individual's array of zone-state rows.
//
// An individual counts at most once per element, even if several stored
// bone ids were ever mapped to the same code. If one representation is
// Complete and another Fragmented, Complete wins.
//
// Returns:
//   counts        { [code]: { code, label, count, complete, fragmented } }
//                 `complete` / `fragmented` are how many individuals have
//                 the element in that state; `count` is the number that
//                 qualify under `presentStates`.
//   ignoredBones  recorded bone ids that are not part of the counts
export function countPresentElements(
  zoneStatesPerIndividual,
  { presentStates = PRESENT_STATES } = {}
) {
  const counts = {};
  const ignored = new Set();

  const countsComplete = presentStates.includes(
    PRESERVATION_STATES.PRESENT_COMPLETE
  );
  const countsFragmented = presentStates.includes(
    PRESERVATION_STATES.PRESENT_FRAGMENTED
  );

  for (const zoneStates of zoneStatesPerIndividual) {
    const statusByCode = new Map();

    for (const zoneState of zoneStates) {
      const element = ELEMENT_BY_SVG_ID.get(zoneState.bone);

      if (!element) {
        ignored.add(zoneState.bone);
        continue;
      }

      if (zoneState.state === PRESERVATION_STATES.PRESENT_COMPLETE) {
        statusByCode.set(element.code, "complete");
      } else if (
        zoneState.state === PRESERVATION_STATES.PRESENT_FRAGMENTED &&
        statusByCode.get(element.code) !== "complete"
      ) {
        statusByCode.set(element.code, "fragmented");
      }
    }

    for (const [code, status] of statusByCode) {
      const entry =
        counts[code] ||
        (counts[code] = {
          code,
          label: labelForCode(code),
          count: 0,
          complete: 0,
          fragmented: 0,
        });

      entry[status] += 1;

      if (
        (status === "complete" && countsComplete) ||
        (status === "fragmented" && countsFragmented)
      ) {
        entry.count += 1;
      }
    }
  }

  return { counts, ignoredBones: [...ignored].sort() };
}

const labelByCode = new Map(
  [...ELEMENT_BY_SVG_ID.values()].map((e) => [e.code, e.label])
);

function labelForCode(code) {
  return labelByCode.get(code) || code;
}

// Highest present count becomes the site's MNI; the top elements are
// ranked by count (ties broken by code so the order is stable).
export function summariseElementCounts(
  counts,
  { topN = TOP_ELEMENT_LIMIT } = {}
) {
  const ranked = Object.values(counts)
    .filter((entry) => entry.count > 0)
    .sort(
      (a, b) =>
        b.count - a.count ||
        a.code.localeCompare(b.code, "en", { numeric: true })
    );

  return {
    mni: ranked.length > 0 ? ranked[0].count : 0,
    topElements: ranked.slice(0, topN),
  };
}

// Pure calculation over already-loaded zone states.
export function computeBoneStats(zoneStatesPerIndividual, options = {}) {
  const { counts, ignoredBones } = countPresentElements(
    zoneStatesPerIndividual,
    options
  );

  return {
    individualCount: zoneStatesPerIndividual.length,
    counts,
    ignoredBones,
    ...summariseElementCounts(counts, options),
  };
}

// Loads a site's individuals and their zone states, then computes stats.
export async function getSiteBoneStats(siteId, options = {}) {
  const site = await getSiteById(siteId);
  if (!site) throw new NotFoundError(`Site "${siteId}" does not exist`);

  const accessions = await getAccessionsBySite(siteId);
  const zoneStatesPerIndividual = await Promise.all(
    accessions.map((accession) =>
      getZoneStatesByAccession(accession.id)
    )
  );

  return { siteId, ...computeBoneStats(zoneStatesPerIndividual, options) };
}
