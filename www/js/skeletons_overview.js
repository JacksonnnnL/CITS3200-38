import {
    getAccessionById,
    getSiteById,
    updateAccession,
    getZoneStatesByAccession
} from './data.js';

import {
    isNonBoneId,
    hasRealBoneSubgroups,
    folderForAge,
    STATE_COLORS
} from './skeleton_config.js';

// ========================================
// Segment Configuration
// ========================================

// svgRootId = the top-level <g id> in skeletal_system.svg.
// Differs from `id` only because the SVG uses underscores.
const SEGMENTS = [
    { id: 'cranium',     label: 'Cranium',      svgRootId: 'cranium',          available: true },
    { id: 'axial',       label: 'Axial',        svgRootId: 'axial_skeleton',   available: true },
    { id: 'pelvis',      label: 'Pelvis',       svgRootId: 'pelvis',           available: true },
    { id: 'right-upper', label: 'R Upper Limb', svgRootId: 'right_upper_limb', available: true },
    { id: 'left-upper',  label: 'L Upper Limb', svgRootId: 'left_upper_limb',  available: true },
    { id: 'right-lower', label: 'R Lower Limb', svgRootId: 'right_lower_limb', available: true },
    { id: 'left-lower',  label: 'L Lower Limb', svgRootId: 'left_lower_limb',  available: true }
];

const SVG_ROOT_TO_SEGMENT = Object.fromEntries(
    SEGMENTS.map(s => [s.svgRootId, s.id])
);

// ========================================
// Bbox Split & Shrink Rules
// ========================================

// Cranium's bbox spans both lateral views with a big empty
// middle, so it overlaps the upper limbs at the shoulders.
// Split it into 2 sub-boxes with a gap in the middle.
// axial and pelvis are shrunk so they don't steal limb taps.
const SEGMENT_BBOX_RULES = {
    'cranium': { split: 2, shrink: 0,  splitGap: 0.30 },
    'axial':   { split: 1, shrink: 60, splitGap: 0 },
    'pelvis':  { split: 1, shrink: 40, splitGap: 0 }
};

// Padding around each bone for its invisible hit rect.
const BONE_HIT_PADDING = 4;

let segmentBoxes = [];

// ========================================
// Shape Helpers
// ========================================

export function isDecorativeShape(shape) {
    const attr = shape.getAttribute('opacity');
    if (attr !== null && parseFloat(attr) < 1) return true;
    return false;
}

export function isGhostGroup(group) {
    const attr = group.getAttribute('opacity');
    if (attr !== null && parseFloat(attr) < 1) return true;
    if (parseFloat(getComputedStyle(group).opacity) < 1) return true;
    return false;
}

// ========================================
// Selected Individual
// ========================================

const params = new URLSearchParams(window.location.search);
const accessionId = params.get('accessionId');

if (!accessionId) {
    alert('No individual specified!');
    window.location.href = 'index.html';
}

let currentAccession = null;
let currentSite = null;
let ageCategory = null;
let boneStates = {};

// ========================================
// Load Data
// ========================================

async function loadData() {
    try {
        currentAccession = await getAccessionById(accessionId);

        if (!currentAccession) {
            alert('Individual not found!');
            window.location.href = 'index.html';
            return;
        }

        ageCategory = currentAccession.ageCategory || 'adult';

        const savedStates = await getZoneStatesByAccession(accessionId);
        savedStates.forEach(s => {
            if (s.bone) boneStates[s.bone] = s.state;
        });

        document.getElementById('accession-display').textContent =
            currentAccession.accessionNumber || accessionId;

        if (currentAccession.siteId) {
            currentSite = await getSiteById(currentAccession.siteId);
            document.getElementById('site-display').textContent =
                currentSite ? currentSite.code : '---';

            const backButton = document.getElementById('back-to-site-button');
            if (backButton) {
                backButton.addEventListener('click', () => {
                    window.location.href =
                        `site.html?siteId=${encodeURIComponent(currentAccession.siteId)}`;
                });
            }
        }

        renderDate();

        if (currentAccession.notes) {
            document.getElementById('notes-description').value = currentAccession.notes;
        }

        const folder = folderForAge(ageCategory);

        if (folder) {
            loadSkeletonBoard(folder);
        } else {
            showComingSoonMessage(ageCategory);
        }
    } catch (error) {
        // Silent fail — the page shows whatever state it's in.
    }
}

// ========================================
// Date Rendering
// ========================================

function renderDate() {
    const dateDisplay = document.getElementById('individual-date-display');

    if (currentAccession.date) {
        const dateObj = new Date(currentAccession.date);

        if (!isNaN(dateObj.getTime())) {
            const year = dateObj.getFullYear();
            const month = String(dateObj.getMonth() + 1).padStart(2, '0');
            const day = String(dateObj.getDate()).padStart(2, '0');
            dateDisplay.textContent = `${day}/${month}/${year}`;
        } else {
            dateDisplay.textContent = currentAccession.date;
        }
    } else {
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        dateDisplay.textContent = `${day}/${month}/${year}`;
    }
}

// ========================================
// Coming Soon (non-adult)
// ========================================

function showComingSoonMessage(age) {
    const board = document.getElementById('skeleton-board');
    const ageDisplay = age
        ? age.charAt(0).toUpperCase() + age.slice(1)
        : 'Child';

    board.innerHTML = `
        <div class="skeleton-placeholder" style="padding: 40px 20px;">
            <h3 style="margin: 8px 0; color: var(--text);">
                ${ageDisplay} Skeleton Coming Soon
            </h3>
            <p style="margin: 4px 0; color: var(--text-muted); font-size: 14px;">
                The ${ageDisplay} skeletal model is currently in development.
            </p>
            <p style="margin: 4px 0; color: var(--text-light); font-size: 13px;">
                Please check back in a future update.
            </p>
            <div style="margin-top: 16px; padding: 12px 20px; background: #f0f4f4; border-radius: 8px; display: inline-block;">
                <span style="font-size: 13px; color: var(--text-muted);">
                    Estimated availability: Future release
                </span>
            </div>
        </div>
    `;
}

// ========================================
// Navigation
// ========================================

function goToSegment(segId) {
    window.location.href =
        `skeletons_selection.html?accessionId=${encodeURIComponent(accessionId)}&segment=${encodeURIComponent(segId)}`;
}

// ========================================
// Load Skeleton Board
// ========================================

async function loadSkeletonBoard(folder) {
    const board = document.getElementById('skeleton-board');
    board.innerHTML = '';

    try {
        const response = await fetch(`assets/skeletons/${folder}/skeletal_system.svg`);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        const svgText = await response.text();
        board.innerHTML = svgText;

        applyBoneColors(board);
        injectBoneHitZones(board);
        cacheSegmentBoxes(board);
        attachSegmentClickHandler(board);

        // Start centred so the user doesn't land on the top-left corner.
        scrollBoardToCentre(board);
    } catch (error) {
        board.innerHTML = `
            <div class="skeleton-placeholder">
                <span class="icon">🦴</span>
                Could not load skeleton.<br>
                <span style="font-size:14px;color:var(--text-light);">
                    Make sure skeletal_system.svg is in assets/skeletons/${folder}/
                </span>
            </div>
        `;
    }
}

// ========================================
// Inject Bone Hit Zones
// ========================================

// Inserts an invisible padded <rect> as the first child of every
// real bone group. pointer-events:all makes it catch taps that
// land a few px off the bone itself.
function injectBoneHitZones(board) {
    const svgRoot = board.querySelector('svg');
    if (!svgRoot) return;

    const SVG_NS = 'http://www.w3.org/2000/svg';

    svgRoot.querySelectorAll('g[id]').forEach(group => {
        const id = group.id.trim();

        if (!id) return;
        if (isNonBoneId(id)) return;
        if (isGhostGroup(group)) return;
        if (hasRealBoneSubgroups(group)) return;

        if (group.querySelector(':scope > rect[data-hit-zone]')) return;

        let bbox;
        try {
            bbox = group.getBBox();
        } catch (e) {
            return;
        }

        if (!bbox || bbox.width === 0 || bbox.height === 0) return;

        const pad = BONE_HIT_PADDING;

        const rect = document.createElementNS(SVG_NS, 'rect');
        rect.setAttribute('x', bbox.x - pad);
        rect.setAttribute('y', bbox.y - pad);
        rect.setAttribute('width',  bbox.width  + pad * 2);
        rect.setAttribute('height', bbox.height + pad * 2);
        rect.setAttribute('fill', 'none');
        rect.setAttribute('stroke', 'none');
        rect.setAttribute('pointer-events', 'all');
        rect.setAttribute('data-hit-zone', '1');

        group.insertBefore(rect, group.firstChild);
    });
}

// ========================================
// Cache Segment Bboxes
// ========================================

function cacheSegmentBoxes(board) {
    segmentBoxes = [];

    const svgRoot = board.querySelector('svg');
    if (!svgRoot) return;

    for (const seg of SEGMENTS) {
        const group = svgRoot.querySelector(`#${CSS.escape(seg.svgRootId)}`);
        if (!group) continue;

        const bbox = group.getBBox();
        const rule = SEGMENT_BBOX_RULES[seg.id] || { split: 1, shrink: 0, splitGap: 0 };

        const s = rule.shrink || 0;
        const x = bbox.x + s;
        const y = bbox.y + s;
        const w = Math.max(0, bbox.width  - 2 * s);
        const h = Math.max(0, bbox.height - 2 * s);

        if (rule.split <= 1) {
            segmentBoxes.push({ id: seg.id, x, y, w, h });
        } else {
            const gapFrac = rule.splitGap || 0;
            const usable = w * (1 - gapFrac);
            const subW = usable / rule.split;
            const gapW = w - usable;
            for (let i = 0; i < rule.split; i++) {
                segmentBoxes.push({
                    id: seg.id,
                    x: x + i * (subW + gapW),
                    y,
                    w: subW,
                    h
                });
            }
        }
    }
}

// ========================================
// Screen to SVG Coordinates
// ========================================

function screenToSvg(svgRoot, clientX, clientY) {
    const pt = svgRoot.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;

    const ctm = svgRoot.getScreenCTM();
    if (!ctm) return null;

    return pt.matrixTransform(ctm.inverse());
}

// ========================================
// Segment Click Handler
// ========================================

// Step 1: bones (and hit rects) win — walk up the DOM to the
//         nearest segment root.
// Step 2: fallback — pick the segment bbox containing the tap,
//         choosing the closest centre when several overlap.
function attachSegmentClickHandler(board) {
    const svgRoot = board.querySelector('svg');
    if (!svgRoot) return;

    svgRoot.style.cursor = 'pointer';

    svgRoot.addEventListener('click', (event) => {
        let node = event.target;
        while (node && node !== svgRoot) {
            if (node.tagName === 'g' && node.id) {
                const segId = SVG_ROOT_TO_SEGMENT[node.id.trim()];
                if (segId) {
                    event.stopPropagation();
                    goToSegment(segId);
                    return;
                }
            }
            node = node.parentNode;
        }

        if (segmentBoxes.length === 0) return;

        const svgPt = screenToSvg(svgRoot, event.clientX, event.clientY);
        if (!svgPt) return;

        const candidates = segmentBoxes.filter(box => {
            return svgPt.x >= box.x &&
                   svgPt.x <= box.x + box.w &&
                   svgPt.y >= box.y &&
                   svgPt.y <= box.y + box.h;
        });

        if (candidates.length === 0) return;

        let best = null;
        let bestDist = Infinity;
        for (const box of candidates) {
            const cx = box.x + box.w / 2;
            const cy = box.y + box.h / 2;
            const dx = svgPt.x - cx;
            const dy = svgPt.y - cy;
            const d = dx * dx + dy * dy;
            if (d < bestDist) {
                bestDist = d;
                best = box;
            }
        }

        if (best) {
            event.stopPropagation();
            goToSegment(best.id);
        }
    });
}

// ========================================
// Centre Board On Load
// ========================================

function scrollBoardToCentre(board) {
    requestAnimationFrame(() => {
        const contentW = board.scrollWidth;
        const contentH = board.scrollHeight;
        const viewW    = board.clientWidth;
        const viewH    = board.clientHeight;

        if (contentW <= viewW && contentH <= viewH) return;

        board.scrollLeft = Math.max(0, (contentW - viewW) / 2);
        board.scrollTop  = Math.max(0, (contentH - viewH) / 2);
    });
}

// ========================================
// Apply Bone State Colours
// ========================================

function applyBoneColors(scope) {
    scope.querySelectorAll('g[id]').forEach(group => {
        const elementId = group.id.trim();

        if (!elementId) return;
        if (isNonBoneId(elementId)) return;
        if (hasRealBoneSubgroups(group)) return;

        const state = boneStates[elementId];
        if (!state || !STATE_COLORS[state]) return;

        group
            .querySelectorAll('path, polygon, circle, ellipse, rect')
            .forEach(shape => {
                if (shape.hasAttribute('data-hit-zone')) return;
                if (isDecorativeShape(shape)) return;
                shape.style.fill = STATE_COLORS[state];
            });
    });
}

// ========================================
// Expand Button
// ========================================

// Inert placeholder — navigation is now via segment taps.
document.getElementById('expand-btn')?.addEventListener('click', () => {});

// ========================================
// Notes Auto-Save
// ========================================

const notesInput = document.getElementById('notes-description');

notesInput.addEventListener('change', async function() {
    try {
        await updateAccession(accessionId, { notes: this.value.trim() });
    } catch (error) {
        // Silent fail — the field keeps its value either way.
    }
});

// ========================================
// Start
// ========================================

document.addEventListener('DOMContentLoaded', loadData);