import {
    PRESERVATION_STATES,
    AGE_CATEGORIES
} from './data.js';

// ========================================
// Container / Bone ID Helpers
// ========================================

// These IDs identify segment roots, skull views and SVG containers.
// Both skeleton pages skip them when finding selectable bones.
// Add new container IDs here so both pages use the same rules.
export const CONTAINER_IDS = new Set([
    // Segment and overview roots
    'pelvis',
    'cranium',
    'axial_skeleton',
    'right_upper_limb',
    'left_upper_limb',
    'right_lower_limb',
    'left_lower_limb',
    'skeletal_system',
    'child_skeletal_system',
    'infant_skeletal_system',
    'adolescent_skeletal_system',

    // Cranium sub-view roots
    'skull_anterior',
    'skull_right_lateral',
    'skull_left_lateral',
    'skull_posterior',
    'skull_inferior',
    'skull_top',

    // Auditory ossicle containers
    'auditory_ossicles_left',
    'auditory_ossicles_right'
]);

// Return true for empty IDs, known containers and SVG editor wrappers.
// These elements should not be treated as selectable bones.
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

// Check whether a group contains other bone groups.
// Internal SVG editor wrappers do not count as separate bones.
export function hasRealBoneSubgroups(group) {
    const children = group.querySelectorAll('g[id]');
    for (const child of children) {
        const cid = child.id.trim();
        if (!isNonBoneId(cid)) return true;
    }
    return false;
}

// ========================================
// Preservation State Colours and Labels
// ========================================

// Use the preservation state values defined in data.js.
// UNMARKED is used for display when a bone has no saved state.
export const UNMARKED = 'unmarked';

export const STATE_COLORS = {
    [PRESERVATION_STATES.PRESENT_COMPLETE]:   '#2e7d32',  // green
    [PRESERVATION_STATES.PRESENT_FRAGMENTED]: '#ed6c02',  // orange
    [PRESERVATION_STATES.ABSENT]:             '#9e9e9e',  // grey
    [UNMARKED]:                               'transparent'  // transparent
};

export const STATE_LABELS = {
    [PRESERVATION_STATES.PRESENT_COMPLETE]:   'Present',
    [PRESERVATION_STATES.PRESENT_FRAGMENTED]: 'Fragmented',
    [PRESERVATION_STATES.ABSENT]:             'Absent',
    [UNMARKED]:                                'Unmarked'
};

// Keep status-dot colours separate from SVG fill colours.
// Unmarked bones use a white status dot.
export const STATE_DOTS = {
    [PRESERVATION_STATES.PRESENT_COMPLETE]:   '#2e7d32',
    [PRESERVATION_STATES.PRESENT_FRAGMENTED]: '#ed6c02',
    [PRESERVATION_STATES.ABSENT]:             '#9e9e9e',
    [UNMARKED]:                                '#ffffff'
};

// ========================================
// Age Category Asset Folders
// ========================================

// Asset folders are available for all four age categories.
export const AGE_FOLDER_MAP = {
    [AGE_CATEGORIES.ADULT]: 'adult',
    [AGE_CATEGORIES.CHILD]: 'child',
    [AGE_CATEGORIES.ADOLESCENT]: 'adolescent',
    [AGE_CATEGORIES.INFANT]: 'infant',
};

// Return the asset folder for the selected age category.
// Return null when no folder is configured so the page can show a placeholder.
export function folderForAge(age) {
    try {
        const normalized = (age || '').toLowerCase();
        return AGE_FOLDER_MAP[normalized] || null;
    } catch (error) {
        console.error('Failed to resolve folder for age:', age, error);
        return null;
    }
}

// ========================================
// Age Category Overview Files
// ========================================

// Use the overview filename supplied for each supported age category.
// Child, Infant and Adolescent use age-specific overview filenames.
// Adult uses skeletal_system.svg.
export function overviewFileForAge(age) {
    const folder = folderForAge(age);
    if (folder === 'child') return 'child_skeletal_system.svg';
    if (folder === 'infant') return 'infant_skeletal_system.svg';
    if (folder === 'adolescent') return 'adolescent_skeletal_system.svg';
    return 'skeletal_system.svg';
}

// ========================================
// Selectable Bone Shapes / Groups
// ========================================

// Find the shapes belonging to a bone group.
// Child, Infant and Adolescent parts keep their own shapes and colours.
// Exclude shapes owned by nested bone groups for these ages.
// Adult continues to use all descendant shapes.
export function boneShapesForGroup(group, age) {
    const shapes = Array.from(group.querySelectorAll(
        'path, polygon, circle, ellipse, rect'
    ));
    const folder = folderForAge(age);
    if (folder !== 'child' && folder !== 'infant' && folder !== 'adolescent') {
        return shapes;
    }

    return shapes.filter(shape => {
        let owner = shape.parentElement;
        while (owner && owner !== group) {
            if (owner.localName === 'g' && !isNonBoneId(owner.id.trim())) {
                return false;
            }
            owner = owner.parentElement;
        }
        return owner === group;
    });
}

// Check whether a group can be selected as a bone.
// Child, Infant and Adolescent parent groups can be selected
// when they have their own visible shapes. Adult skips groups containing other bones.
export function isSelectableBoneGroup(group, age) {
    if (isNonBoneId(group.id.trim())) return false;
    const folder = folderForAge(age);
    if (folder === 'child' || folder === 'infant' || folder === 'adolescent') {
        return boneShapesForGroup(group, age).some(shape =>
            !shape.hasAttribute('data-hit-zone') &&
            !(shape.hasAttribute('opacity') &&
              parseFloat(shape.getAttribute('opacity')) < 1)
        );
    }
    return !hasRealBoneSubgroups(group);
}

// ========================================
// Child SVG Preparation
// ========================================

// Wrap the Child RSU rib-table path in a group when the SVG loads.
// This lets the cell use the same selection logic as other bone groups.
export function prepareSkeletonSvg(scope, age) {
    if (folderForAge(age) !== 'child') return;

    const cell = scope.querySelector('path[id="RSU"]');
    if (!cell) return;

    const group = cell.ownerDocument.createElementNS(
        'http://www.w3.org/2000/svg', 'g'
    );
    group.id = cell.id;
    cell.removeAttribute('id');
    cell.parentNode.insertBefore(group, cell);
    group.appendChild(cell);
}
