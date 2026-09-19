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
// The bone-marking pages save the SVG element id as `bone` (for example
// "femur_right"). The client identifies elements by short codes (for
// example "FEM-R", taken from the client's labelled adult diagram,
// ADULT-1.jpg), so ELEMENT_BY_SVG_ID translates between the two. Only
// elements listed there are counted, which matches the client's rule
// that just the first rib and first two vertebrae go into bone counts
// while the remaining ribs/vertebrae are recorded visually only.
// ========================================

import {
  PRESERVATION_STATES,
  NotFoundError,
  getSiteById,
  getAccessionsBySite,
  getZoneStatesByAccession,
} from "./data.js";

// States that count as "Present". The client asked for the highest
// repeating element "marked as present" and the wording is ambiguous
// about whether a fragmented element counts. An identifiable fragment
// still evidences an individual, so both count by default. To count
// only complete elements, pass { presentStates: [PRESENT_COMPLETE] }
// or change this constant.
export const PRESENT_STATES = Object.freeze([
  PRESERVATION_STATES.PRESENT_COMPLETE,
  PRESERVATION_STATES.PRESENT_FRAGMENTED,
]);

export const TOP_ELEMENT_LIMIT = 5;

// ========================================
// Client element codes
// ========================================

const SIDES = [
  { word: "right", letter: "R", label: "Right" },
  { word: "left", letter: "L", label: "Left" },
];

const SIDED_BONES = [
  ["clavicle", "CLA"],
  ["scapula", "SCA"],
  ["humerus", "HUM"],
  ["radius", "RAD"],
  ["ulna", "ULN"],
  ["scaphoid", "SC"],
  ["lunate", "LU"],
  ["triquetrum", "TQ"],
  ["pisiform", "PI"],
  ["trapezium", "TZ"],
  ["trapezoid", "TR"],
  ["capitate", "CA"],
  ["hamate", "HA"],
  ["femur", "FEM"],
  ["patella", "PAT"],
  ["tibia", "TIB"],
  ["fibula", "FIB"],
  ["calcaneus", "CAL"],
  ["talus", "TAL"],
  ["cuboid", "CUB"],
  ["navicular", "NAV"],
];

// Cuneiforms are numbered medial -> lateral on the client's diagram
// (CUN-R1 sits next to the big toe, CUN-R3 on the outer side).
const CUNEIFORMS = [
  ["medial", 1],
  ["intermediate", 2],
  ["lateral", 3],
];

function buildElementTable() {
  const table = new Map();
  const add = (svgId, code, label) => table.set(svgId, Object.freeze({ code, label }));

  add("sternum", "STN", "Sternum");
  add("sacrum", "SAC", "Sacrum");
  add("mandible", "MND", "Mandible");
  add("hyoid", "HYD", "Hyoid");
  add("cervical_1", "VC1", "Atlas (C1)");
  add("cervical_2", "VC2", "Axis (C2)");

  for (const side of SIDES) {
    for (const [bone, code] of SIDED_BONES) {
      add(`${bone}_${side.word}`, `${code}-${side.letter}`, `${side.label} ${bone}`);
    }

    add(`os_coxae_${side.word}`, `PEL-${side.letter}`, `${side.label} os coxae (pelvis)`);
    add(`${side.word}_rib_1`, `RIB-${side.letter}1`, `${side.label} first rib`);

    for (let n = 1; n <= 5; n++) {
      add(`metacarpal_${n}_${side.word}`, `MC${n}-${side.letter}`, `${side.label} metacarpal ${n}`);
      add(`metatarsal_${n}_${side.word}`, `MT${n}-${side.letter}`, `${side.label} metatarsal ${n}`);
    }

    for (const [position, n] of CUNEIFORMS) {
      add(
        `${position}_cuneiform_${side.word}`,
        `CUN-${side.letter}${n}`,
        `${side.label} ${position} cuneiform`
      );
    }

    // The client labels only the big toe's phalanges individually; the
    // other phalanges are tallied in the diagram's "PH." box instead.
    add(`foot_proximal_phalanx_1_${side.word}`, `PP1-${side.letter}`, `${side.label} hallux proximal phalanx`);
    add(`foot_distal_phalanx_1_${side.word}`, `DP1-${side.letter}`, `${side.label} hallux distal phalanx`);
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

  const countsComplete = presentStates.includes(PRESERVATION_STATES.PRESENT_COMPLETE);
  const countsFragmented = presentStates.includes(PRESERVATION_STATES.PRESENT_FRAGMENTED);

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

      if ((status === "complete" && countsComplete) || (status === "fragmented" && countsFragmented)) {
        entry.count += 1;
      }
    }
  }

  return { counts, ignoredBones: [...ignored].sort() };
}

const labelByCode = new Map([...ELEMENT_BY_SVG_ID.values()].map((e) => [e.code, e.label]));

function labelForCode(code) {
  return labelByCode.get(code) || code;
}

// Highest present count becomes the site's MNI; the top elements are
// ranked by count (ties broken by code so the order is stable).
export function summariseElementCounts(counts, { topN = TOP_ELEMENT_LIMIT } = {}) {
  const ranked = Object.values(counts)
    .filter((entry) => entry.count > 0)
    .sort((a, b) => b.count - a.count || a.code.localeCompare(b.code, "en", { numeric: true }));

  return {
    mni: ranked.length > 0 ? ranked[0].count : 0,
    topElements: ranked.slice(0, topN),
  };
}

// Pure calculation over already-loaded zone states.
export function computeBoneStats(zoneStatesPerIndividual, options = {}) {
  const { counts, ignoredBones } = countPresentElements(zoneStatesPerIndividual, options);

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
    accessions.map((accession) => getZoneStatesByAccession(accession.id))
  );

  return { siteId, ...computeBoneStats(zoneStatesPerIndividual, options) };
}
