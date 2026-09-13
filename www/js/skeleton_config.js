// ============================================
// SKELETON CONFIG - skeleton_config.js
// ============================================
//
// Shared configuration and helpers used by both:
//   - skeletons_overview.js
//   - skeletons_selection.js
//
// Both pages must agree on what counts as a "bone" group inside
// the SVG files. Keeping this logic in one place prevents the two
// pages from drifting apart (which caused errors before).
//
// If you ever add a new segment root (e.g. a new cranium view),
// add its id to CONTAINER_IDS here — both pages pick it up
// automatically.
//
// This file also owns the shared preservation-state tokens and
// the age -> asset-folder mapping, so neither page re-declares
// them. State strings come from data.js so there is a single
// source of truth across the whole app.
// ============================================

import {
    PRESERVATION_STATES,
    AGE_CATEGORIES
} from './data.js';

// ============================================
// 1. Container / bone id helpers
// ============================================

// IDs that belong to container "views" or wrappers, not bones:
//   - Segment roots (pelvis, cranium, ...)
//   - Cranium sub-views (skull_anterior, skull_right_lateral, ...)
//
// Anything whose id is in this set is skipped when walking the SVG.
export const CONTAINER_IDS = new Set([
    // Segment roots
    'pelvis',
    'cranium',
    'axial_skeleton',
    'right_upper_limb',
    'left_upper_limb',
    'right_lower_limb',
    'left_lower_limb',

    // Cranium sub-views
    'skull_anterior',
    'skull_right_lateral',
    'skull_left_lateral',
    'skull_posterior',
    'skull_inferior'
]);

// True if the given id is NOT a real bone:
//   - empty
//   - a container / view root (see CONTAINER_IDS)
//   - an internal Inkscape/Illustrator wrapper ("Vector_1", "Group 16")
//   - a clip / defs / mask element
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

// True if `group` contains OTHER real bone sub-groups (i.e. it is a
// wrapper around bones, not a bone itself). A bone that contains only
// internal wrappers (Vector_* / Group N) is still treated as a bone.
export function hasRealBoneSubgroups(group) {
    const children = group.querySelectorAll('g[id]');
    for (const child of children) {
        const cid = child.id.trim();
        if (!isNonBoneId(cid)) return true;
    }
    return false;
}

// ============================================
// 2. Preservation state tokens
// ============================================
//
// Keyed on the strings exported from data.js, so if a state name
// ever changes there, both skeleton pages pick it up automatically.
//
// `UNMARKED` is a UI-only pseudo-state (not persisted) — it is what
// a bone shows when no state has been recorded for it.

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

// Same values as STATE_COLORS today, kept as its own export so the
// two uses (SVG fill vs. small status dot) can diverge later without
// touching call sites.
export const STATE_DOTS = {
    [PRESERVATION_STATES.PRESENT_COMPLETE]:   '#2e7d32',
    [PRESERVATION_STATES.PRESENT_FRAGMENTED]: '#ed6c02',
    [PRESERVATION_STATES.ABSENT]:             '#d32f2f',
    [UNMARKED]:                                '#e0e0e0'
};

// ============================================
// 3. Age -> asset folder mapping
// ============================================
//
// Only 'adult' has assets today. When a new folder is added under
// assets/skeletons/ (e.g. child/), uncomment the matching line
// below — both skeleton pages pick it up automatically.

export const AGE_FOLDER_MAP = {
    [AGE_CATEGORIES.ADULT]: 'adult',
    // [AGE_CATEGORIES.CHILD]:      'child',
    // [AGE_CATEGORIES.ADOLESCENT]: 'adolescent',
    // [AGE_CATEGORIES.INFANT]:     'infant',
};

// Returns the folder name for an age category, or null if that age
// has no assets yet (caller shows the "coming soon" placeholder).
export function folderForAge(age) {
    const normalized = (age || '').toLowerCase();
    return AGE_FOLDER_MAP[normalized] || null;
}