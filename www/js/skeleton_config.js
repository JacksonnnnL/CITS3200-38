import {
    PRESERVATION_STATES,
    AGE_CATEGORIES
} from './data.js';

// ========================================
// Container / Bone ID Helpers
// ========================================

// IDs that belong to container "views" or wrappers, not bones:
//   - Segment roots (pelvis, cranium, ...)
//   - Cranium sub-views (skull_anterior, skull_right_lateral, ...)
// Anything in this set is skipped when walking the SVG.
// Add any new segment root here — both skeleton pages pick it up.
export const CONTAINER_IDS = new Set([
    'pelvis',
    'cranium',
    'axial_skeleton',
    'right_upper_limb',
    'left_upper_limb',
    'right_lower_limb',
    'left_lower_limb',

    'skull_anterior',
    'skull_right_lateral',
    'skull_left_lateral',
    'skull_posterior',
    'skull_inferior'
]);

// True if the id is NOT a real bone: empty, a container / view
// root, an Inkscape/Illustrator wrapper ("Vector_1", "Group 16"),
// or a clip / defs / mask element.
export function isNonBoneId(id) {
    if (!id) return true;
    if (CONTAINER_IDS.has(id)) return true;
    if (id.startsWith('clip')) return true;
    if (id.startsWith('defs')) return true;
    if (id.startsWith('mask')) return true;
    if (id.startsWith('Vector')) return true;
    if (id.startsWith('Group ')) return true;
    return false;
}

// True if `group` contains OTHER real bone sub-groups (i.e. it is
// a wrapper around bones, not a bone itself). A bone containing
// only internal wrappers (Vector_* / Group N) is still a bone.
export function hasRealBoneSubgroups(group) {
    const children = group.querySelectorAll('g[id]');
    for (const child of children) {
        const cid = child.id.trim();
        if (!isNonBoneId(cid)) return true;
    }
    return false;
}

// ========================================
// Preservation State Tokens
// ========================================

// Keyed on the strings from data.js so a rename there flows
// through automatically. UNMARKED is a UI-only pseudo-state
// (not persisted) — what a bone shows with no recorded state.
export const UNMARKED = 'unmarked';

export const STATE_COLORS = {
    [PRESERVATION_STATES.PRESENT_COMPLETE]:   '#2e7d32',  // green
    [PRESERVATION_STATES.PRESENT_FRAGMENTED]: '#ed6c02',  // orange
    [PRESERVATION_STATES.ABSENT]:             '#d32f2f',  // red
    [UNMARKED]:                                '#e0e0e0'  // light grey
};

export const STATE_LABELS = {
    [PRESERVATION_STATES.PRESENT_COMPLETE]:   'Present ✅',
    [PRESERVATION_STATES.PRESENT_FRAGMENTED]: 'Fragmented ◐',
    [PRESERVATION_STATES.ABSENT]:             'Absent ✗',
    [UNMARKED]:                                'Unmarked'
};

// Same values as STATE_COLORS today; separate export so the two
// uses (SVG fill vs. status dot) can diverge later without
// touching call sites.
export const STATE_DOTS = {
    [PRESERVATION_STATES.PRESENT_COMPLETE]:   '#2e7d32',
    [PRESERVATION_STATES.PRESENT_FRAGMENTED]: '#ed6c02',
    [PRESERVATION_STATES.ABSENT]:             '#d32f2f',
    [UNMARKED]:                                '#e0e0e0'
};

// ========================================
// Age -> Asset Folder Mapping
// ========================================

// Only 'adult' has assets today. Uncomment a line below when a
// new folder is added under assets/skeletons/.
export const AGE_FOLDER_MAP = {
    [AGE_CATEGORIES.ADULT]: 'adult',
    // [AGE_CATEGORIES.CHILD]:      'child',
    // [AGE_CATEGORIES.ADOLESCENT]: 'adolescent',
    // [AGE_CATEGORIES.INFANT]:     'infant',
};

// Returns the folder for an age category, or null if that age has
// no assets yet (caller shows the "coming soon" placeholder).
export function folderForAge(age) {
    const normalized = (age || '').toLowerCase();
    return AGE_FOLDER_MAP[normalized] || null;
}