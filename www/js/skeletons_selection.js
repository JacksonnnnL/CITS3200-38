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

import {
    linkedSvgIds
} from './bone_counts.js';

const urlParams = new URLSearchParams(window.location.search);
const accessionId = urlParams.get('accessionId');
const segmentParam = urlParams.get('segment');

if (!accessionId) {
    alert('No individual specified!');
    window.location.href = 'index.html';
}

const SEGMENTS = [
    { id: 'cranium',     label: 'Cranium',      file: 'cranium.svg',          status: 'have' },
    { id: 'axial',       label: 'Axial',        file: 'axial_skeleton.svg',   status: 'have' },
    { id: 'pelvis',      label: 'Pelvis',       file: 'pelvis.svg',           status: 'have' },
    { id: 'right-upper', label: 'R Upper Limb', file: 'right_upper_limb.svg', status: 'have' },
    { id: 'left-upper',  label: 'L Upper Limb', file: 'left_upper_limb.svg',  status: 'have' },
    { id: 'right-lower', label: 'R Lower Limb', file: 'right_lower_limb.svg', status: 'have' },
    { id: 'left-lower',  label: 'L Lower Limb', file: 'left_lower_limb.svg',  status: 'have' }
];

let currentAccession = null;
let currentSite = null;
let selectedBone = null;
let boneStates = {};
let currentSegment = null;
let currentFolder = null;
let savedStates = [];

const HIGHLIGHT = '#007f7a';
const PRESENT_STATE = 'present-complete';

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

const container = document.getElementById('skeleton-select-container');
const detailsBox = document.getElementById('details-box');
const detailBoneName = document.getElementById('detail-bone-name');
const detailStatusText = document.getElementById('detail-status-text');
const detailStatusDot = document.getElementById('detail-status-dot');
const selectedSegmentName = document.getElementById('selected-segment-name');
const segmentTabs = document.getElementById('segment-tabs');
const detailsCloseButton = document.getElementById('details-close');
const allPresentButton = document.getElementById('all-present-button');

function paintGroup(group, state) {
    const fillColor = (state && STATE_COLORS[state])
        ? STATE_COLORS[state]
        : STATE_COLORS[UNMARKED];

    group
        .querySelectorAll('path, polygon, circle, ellipse, rect')
        .forEach(shape => {
            if (isDecorativeShape(shape)) return;
            shape.style.fill = fillColor;
        });
}

// Apply a state (or clear) to every SVG id that shares the same client
// code as boneId — e.g. all CRA views when any cranial piece is marked,
// all PAR_R views when one is marked, MND/MND_L/MND_R together.
// Updates in-memory boneStates, paints any matching groups in the
// current segment, and persists each id.
async function applyStateToLinkedBones(boneId, finalState) {
    const ids = linkedSvgIds(boneId);

    for (const id of ids) {
        boneStates[id] = finalState;

        const group = container.querySelector(`#${CSS.escape(id)}`);
        if (group) paintGroup(group, finalState);

        try {
            if (finalState === null) {
                await clearZoneState({
                    accessionId: accessionId,
                    bone: id,
                    side: '',
                    zone: id
                });
            } else {
                await setZoneState({
                    accessionId: accessionId,
                    bone: id,
                    side: '',
                    zone: id,
                    state: finalState
                });
            }
        } catch (error) {
            console.error('Failed to save bone state:', id, error);
            throw error;
        }
    }
}

function closeDetailsBox() {
    detailsBox.style.display = 'none';
    selectedBone = null;

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

async function loadSegment(segmentId) {
    const segment = SEGMENTS.find(s => s.id === segmentId);
    if (!segment || segment.status === 'missing') return;
    if (!currentFolder) return;

    allPresentButton.disabled = true;

    currentSegment = segmentId;

    document.querySelectorAll('.segment-tab').forEach(tab => {
        if (tab.id === 'all-present-button') return;
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

        allPresentButton.disabled = true;
    }
}

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
        paintGroup(group, state);

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

    allPresentButton.disabled = (boneElements.length === 0);
}

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

    // Also outline any linked views currently on screen (same client code).
    for (const id of linkedSvgIds(boneId)) {
        if (id === boneId) continue;
        const linked = container.querySelector(`#${CSS.escape(id)}`);
        if (linked) {
            linked.classList.add('selected');
            applyStroke(linked);
        }
    }

    const currentState = boneStates[boneId] || UNMARKED;
    detailBoneName.textContent = boneId;
    detailStatusText.textContent = STATE_LABELS[currentState];
    detailStatusDot.style.background = STATE_DOTS[currentState];
    detailsBox.style.display = 'block';
}

detailsCloseButton.addEventListener('click', (e) => {
    e.stopPropagation();
    closeDetailsBox();
});

document.querySelectorAll('#details-box .state-btn').forEach(btn => {
    btn.addEventListener('click', async function() {
        if (!selectedBone) {
            detailsBox.style.display = 'none';
            return;
        }

        const newState = this.dataset.state;
        const currentState = boneStates[selectedBone];
        const finalState = (currentState === newState) ? null : newState;

        try {
            await applyStateToLinkedBones(selectedBone, finalState);
        } catch (error) {
            alert('Failed to save bone state. Please try again.');
            return;
        }

        const displayState = finalState || UNMARKED;
        detailStatusText.textContent = STATE_LABELS[displayState];
        detailStatusDot.style.background = STATE_DOTS[displayState];
    });
});

allPresentButton.addEventListener('click', async () => {
    const boneElements = [];

    container.querySelectorAll('g[id]').forEach(group => {
        const id = group.id.trim();

        if (isNonBoneId(id)) return;
        if (isGhostGroup(group)) return;
        if (hasRealBoneSubgroups(group)) return;

        boneElements.push(group);
    });

    if (boneElements.length === 0) {
        alert('No bones to mark in this segment.');
        return;
    }

    allPresentButton.disabled = true;

    try {
        // Track codes already handled so linked cranial views are not
        // written once per view (once per code is enough).
        const handledCodes = new Set();

        for (const group of boneElements) {
            const boneId = group.id.trim();
            const linked = linkedSvgIds(boneId);
            const codeKey = linked.length > 1 ? linked[0] : boneId;

            if (handledCodes.has(codeKey)) {
                paintGroup(group, PRESENT_STATE);
                boneStates[boneId] = PRESENT_STATE;
                continue;
            }
            handledCodes.add(codeKey);

            await applyStateToLinkedBones(boneId, PRESENT_STATE);
        }

        if (selectedBone && boneStates[selectedBone] === PRESENT_STATE) {
            detailStatusText.textContent = STATE_LABELS[PRESENT_STATE];
            detailStatusDot.style.background = STATE_DOTS[PRESENT_STATE];
        }
    } catch (error) {
        console.error('Failed to mark all present:', error);
        alert('Failed to mark all bones present. Please try again.');
    } finally {
        allPresentButton.disabled = false;
    }
});

loadData();
