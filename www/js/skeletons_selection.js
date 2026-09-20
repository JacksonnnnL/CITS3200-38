import {
    getAccessionById,
    getSiteById,
    setZoneState,
    getZoneStatesByAccession,
    clearZoneState
} from './data.js';

import {
    isNonBoneId,
    hasRealBoneSubgroups,
    folderForAge,
    STATE_COLORS,
    STATE_LABELS,
    STATE_DOTS,
    UNMARKED
} from './skeleton_config.js';

// ========================================
// URL Params
// ========================================

const urlParams = new URLSearchParams(window.location.search);
const accessionId = urlParams.get('accessionId');
const segmentParam = urlParams.get('segment');

if (!accessionId) {
    alert('No individual specified!');
    window.location.href = 'index.html';
}

// ========================================
// Segment Configuration
// ========================================

// `file` is just the file name. The folder is decided at runtime
// by folderForAge() based on the individual's age category.
const SEGMENTS = [
    { id: 'cranium',     label: 'Cranium',      file: 'cranium.svg',          status: 'have' },
    { id: 'axial',       label: 'Axial',        file: 'axial_skeleton.svg',   status: 'have' },
    { id: 'pelvis',      label: 'Pelvis',       file: 'pelvis.svg',           status: 'have' },
    { id: 'right-upper', label: 'R Upper Limb', file: 'right_upper_limb.svg', status: 'have' },
    { id: 'left-upper',  label: 'L Upper Limb', file: 'left_upper_limb.svg',  status: 'have' },
    { id: 'right-lower', label: 'R Lower Limb', file: 'right_lower_limb.svg', status: 'have' },
    { id: 'left-lower',  label: 'L Lower Limb', file: 'left_lower_limb.svg',  status: 'have' }
];

// ========================================
// State
// ========================================

let currentAccession = null;
let currentSite = null;
let selectedBone = null;
let boneStates = {};
let currentSegment = null;
let currentFolder = null;
let savedStates = [];

const HIGHLIGHT = '#007f7a';

// ========================================
// Shape Helpers
// ========================================

export function isGhostGroup(group) {
    const attr = group.getAttribute('opacity');
    if (attr !== null && parseFloat(attr) < 1) return true;
    if (parseFloat(getComputedStyle(group).opacity) < 1) return true;
    return false;
}

export function isDecorativeShape(shape) {
    const attr = shape.getAttribute('opacity');
    if (attr !== null && parseFloat(attr) < 1) return true;
    return false;
}

// ========================================
// DOM References
// ========================================

const container = document.getElementById('skeleton-select-container');
const detailsBox = document.getElementById('details-box');
const detailBoneName = document.getElementById('detail-bone-name');
const detailStatusText = document.getElementById('detail-status-text');
const detailStatusDot = document.getElementById('detail-status-dot');
const selectedZoneLabel = document.getElementById('selected-zone-label');
const selectedSegmentName = document.getElementById('selected-segment-name');
const segmentTabs = document.getElementById('segment-tabs');
const detailsCloseButton = document.getElementById('details-close');

// ========================================
// Close Details Box
// ========================================

function closeDetailsBox() {
    detailsBox.style.display = 'none';
    selectedBone = null;
    selectedZoneLabel.textContent = 'None';

    container.querySelectorAll('g[id]').forEach(el => {
        el.classList.remove('selected');
        el.querySelectorAll('path, polygon, circle, ellipse, rect')
            .forEach(shape => {
                if (isDecorativeShape(shape)) return;
                shape.style.stroke = '';
                shape.style.strokeWidth = '';
            });
    });
}

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

        document.getElementById('accession-display').textContent =
            currentAccession.accessionNumber || accessionId;

        if (currentAccession.siteId) {
            currentSite = await getSiteById(currentAccession.siteId);
            document.getElementById('site-display').textContent =
                currentSite ? currentSite.code : '---';
        }

        document.getElementById('back-to-overview-button')
            .addEventListener('click', () => {
                window.location.href =
                    `skeletons_overview.html?accessionId=${encodeURIComponent(accessionId)}`;
            });

        currentFolder = folderForAge(currentAccession.ageCategory);

        if (!currentFolder) {
            container.innerHTML = `
                <div style="text-align:center;color:var(--text-muted);padding:40px;">
                    <span style="font-size:48px;display:block;margin-bottom:8px;">🦴</span>
                    This age category is not yet available.<br>
                    <span style="font-size:14px;">Please check back in a future update.</span>
                </div>
            `;
            return;
        }

        savedStates = await getZoneStatesByAccession(accessionId);
        savedStates.forEach(s => {
            boneStates[s.bone] = s.state;
        });

        renderSegmentTabs();

        let initialSegment = SEGMENTS.find(s => s.id === segmentParam && s.status === 'have');
        if (!initialSegment) {
            initialSegment = SEGMENTS.find(s => s.status === 'have');
        }
        if (initialSegment) {
            loadSegment(initialSegment.id);
        }
    } catch (error) {
        console.error('Failed to load data:', error);
    }
}

// ========================================
// Render Segment Tabs
// ========================================

function renderSegmentTabs() {
    segmentTabs.innerHTML = '';

    SEGMENTS.forEach(seg => {
        const btn = document.createElement('button');
        btn.className = 'segment-tab';

        if (seg.status === 'missing') {
            btn.classList.add('missing');
            btn.title = 'Coming soon';
        }

        btn.textContent = seg.label + (seg.status === 'missing' ? ' ⏳' : '');
        btn.dataset.segment = seg.id;

        btn.addEventListener('click', () => {
            if (seg.status === 'missing') {
                alert(`"${seg.label}" is not yet available. Coming soon!`);
                return;
            }
            loadSegment(seg.id);
        });

        segmentTabs.appendChild(btn);
    });
}

// ========================================
// Load Segment SVG
// ========================================

async function loadSegment(segmentId) {
    const segment = SEGMENTS.find(s => s.id === segmentId);
    if (!segment || segment.status === 'missing') return;
    if (!currentFolder) return;

    currentSegment = segmentId;

    document.querySelectorAll('.segment-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.segment === segmentId);
    });

    selectedSegmentName.textContent = `Selected: ${segment.label}`;

    closeDetailsBox();

    try {
        const response = await fetch(`assets/skeletons/${currentFolder}/${segment.file}`);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        const svgText = await response.text();

        container.innerHTML = svgText;

        // Tag the container with the current segment id so CSS can
        // target specific segments (e.g. the cranium's scroller).
        container.dataset.segment = segmentId;

        applyColorsAndMakeClickable();
    } catch (error) {
        console.error('Failed to load segment:', segment.label, error);

        container.innerHTML = `
            <div style="text-align:center;color:var(--text-muted);padding:40px;">
                <span style="font-size:48px;display:block;margin-bottom:8px;">🦴</span>
                Failed to load ${segment.label}<br>
                <span style="font-size:14px;">${error.message}</span>
            </div>
        `;
    }
}

// ========================================
// Apply Colors & Make Bones Clickable
// ========================================

// Key on <g id> groups, not path ids — path ids inside the SVGs
// are non-unique ("Vector", "Vector_2", ...), group ids are unique.
function applyColorsAndMakeClickable() {
    const allGroups = container.querySelectorAll('g[id]');
    const boneElements = [];

    allGroups.forEach(group => {
        const id = group.id.trim();

        if (isNonBoneId(id)) return;
        if (isGhostGroup(group)) return;
        if (hasRealBoneSubgroups(group)) return;

        boneElements.push(group);
    });

    boneElements.forEach(group => {
        const boneId = group.id.trim();

        const allShapes = group.querySelectorAll(
            'path, polygon, circle, ellipse, rect'
        );

        const shapes = Array.from(allShapes).filter(
            shape => !isDecorativeShape(shape)
        );

        group.style.cursor = 'pointer';
        allShapes.forEach(shape => {
            shape.style.cursor = 'pointer';
        });

        const state = boneStates[boneId];
        const fillColor = (state && STATE_COLORS[state])
            ? STATE_COLORS[state]
            : STATE_COLORS[UNMARKED];
        shapes.forEach(shape => {
            shape.style.fill = fillColor;
        });

        group.addEventListener('click', function(e) {
            e.stopPropagation();
            handleBoneClick(this);
        });

        allShapes.forEach(shape => {
            shape.addEventListener('mouseenter', function(e) {
                e.stopPropagation();
                shapes.forEach(s => {
                    s.style.stroke = HIGHLIGHT;
                    s.style.strokeWidth = '2';
                });
            });

            shape.addEventListener('mouseleave', function(e) {
                e.stopPropagation();
                if (!group.classList.contains('selected')) {
                    shapes.forEach(s => {
                        s.style.stroke = '';
                        s.style.strokeWidth = '';
                    });
                }
            });
        });
    });
}

// ========================================
// Handle Bone Click
// ========================================

function handleBoneClick(element) {
    const boneId = element.id.trim();

    function clearStroke(group) {
        group
            .querySelectorAll('path, polygon, circle, ellipse, rect')
            .forEach(shape => {
                if (isDecorativeShape(shape)) return;
                shape.style.stroke = '';
                shape.style.strokeWidth = '';
            });
    }

    function applyStroke(group) {
        group
            .querySelectorAll('path, polygon, circle, ellipse, rect')
            .forEach(shape => {
                if (isDecorativeShape(shape)) return;
                shape.style.stroke = HIGHLIGHT;
                shape.style.strokeWidth = '3';
            });
    }

    if (selectedBone === boneId && detailsBox.style.display === 'block') {
        closeDetailsBox();
        return;
    }

    container.querySelectorAll('g[id]').forEach(el => {
        el.classList.remove('selected');
        clearStroke(el);
    });

    selectedBone = boneId;
    element.classList.add('selected');
    applyStroke(element);

    const currentState = boneStates[boneId] || UNMARKED;
    detailBoneName.textContent = boneId;
    detailStatusText.textContent = STATE_LABELS[currentState];
    detailStatusDot.style.background = STATE_DOTS[currentState];
    detailsBox.style.display = 'block';
    selectedZoneLabel.textContent = boneId;
}

// ========================================
// Close Button
// ========================================

detailsCloseButton.addEventListener('click', (e) => {
    e.stopPropagation();
    closeDetailsBox();
});

// ========================================
// State Buttons (Present, Fragmented, Absent)
// ========================================

document.querySelectorAll('#details-box .state-btn').forEach(btn => {
    btn.addEventListener('click', async function() {
        if (!selectedBone) {
            detailsBox.style.display = 'none';
            return;
        }

        const newState = this.dataset.state;

        const bone = container.querySelector(`#${CSS.escape(selectedBone)}`);
        if (!bone) {
            console.error('Bone element not found:', selectedBone);
            return;
        }

        const currentState = boneStates[selectedBone];

        // Toggle off if the same state is tapped again.
        let finalState = (currentState === newState) ? null : newState;

        const fillColor = STATE_COLORS[finalState || UNMARKED];
        bone
            .querySelectorAll('path, polygon, circle, ellipse, rect')
            .forEach(shape => {
                if (isDecorativeShape(shape)) return;
                shape.style.fill = fillColor;
            });
        boneStates[selectedBone] = finalState;

        const displayState = finalState || UNMARKED;
        detailStatusText.textContent = STATE_LABELS[displayState];
        detailStatusDot.style.background = STATE_DOTS[displayState];

        try {
            if (finalState === null) {
                await clearZoneState({
                    accessionId: accessionId,
                    bone: selectedBone,
                    side: '',
                    zone: selectedBone
                });
            } else {
                // TODO (future): when zonation lands, `zone` must come
                // from the clicked SVG element and `boneStates` must be
                // keyed by bone+side+zone.
                await setZoneState({
                    accessionId: accessionId,
                    bone: selectedBone,
                    side: '',
                    zone: selectedBone,
                    state: finalState
                });
            }
        } catch (error) {
            console.error('Failed to save bone state:', selectedBone, error);
            alert('Failed to save bone state. Please try again.');
        }
    });
});

// ========================================
// Start
// ========================================

document.addEventListener('DOMContentLoaded', function() {
    loadData();
});