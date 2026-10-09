import {
    getAccessionById,
    getSiteById,
    setZoneState,
    getZoneStatesByAccession,
    clearZoneState
} from './data.js';

import {
    isNonBoneId,
    isSelectableBoneGroup,
    boneShapesForGroup,
    prepareSkeletonSvg,
    folderForAge,
    STATE_COLORS,
    STATE_LABELS,
    STATE_DOTS,
    UNMARKED
} from './skeleton_config.js';

import {
    linkedSvgIds
} from './bone_counts.js';

// ========================================
// Selected Individual
// ========================================

// Read the individual and initial segment from the page URL.
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

// Map the seven segments to their SVG filenames.
// The selected age category determines which asset folder is used.
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
// Page State
// ========================================

// Keep the loaded individual, current segment and bone states in memory.
let currentAccession = null;
let currentSite = null;
let selectedBone = null;
let boneStates = {};
let currentSegment = null;
let currentFolder = null;
let savedStates = [];

const HIGHLIGHT = '#007f7a';
const PRESENT_STATE = 'present-complete';

// ========================================
// Shape Helpers
// ========================================

// Skip faded groups based on their opacity attribute or computed style.
export function isGhostGroup(group) {
    const attr = group.getAttribute('opacity');
    if (attr !== null && parseFloat(attr) < 1) return true;
    if (parseFloat(getComputedStyle(group).opacity) < 1) return true;
    return false;
}

// Treat shapes with an opacity attribute below 1 as decorative.
export function isDecorativeShape(shape) {
    const attr = shape.getAttribute('opacity');
    if (attr !== null && parseFloat(attr) < 1) return true;
    return false;
}

// ========================================
// Page Elements
// ========================================

// Store references to the skeleton area, bone details and segment controls.
const container = document.getElementById('skeleton-select-container');
const detailsBox = document.getElementById('details-box');
const detailBoneName = document.getElementById('detail-bone-name');
const detailStatusText = document.getElementById('detail-status-text');
const detailStatusDot = document.getElementById('detail-status-dot');
const selectedSegmentName = document.getElementById('selected-segment-name');
const segmentTabs = document.getElementById('segment-tabs');
const detailsCloseButton = document.getElementById('details-close');
const allPresentButton = document.getElementById('all-present-button');

// ========================================
// Zoom Controls
// ========================================

// Add Reset Zoom beside All Present using the same button style.
const resetZoomButton = document.createElement('button');
resetZoomButton.id = 'reset-zoom-button';
resetZoomButton.className = 'segment-tab';
resetZoomButton.type = 'button';
resetZoomButton.textContent = 'Reset Zoom';
resetZoomButton.disabled = true;
allPresentButton.insertAdjacentElement('afterend', resetZoomButton);

const MIN_ZOOM = 1;
const MAX_ZOOM = 6;
const DRAG_THRESHOLD = 8;

let zoomSvg = null;
let zoomStage = null;
let zoomLevel = MIN_ZOOM;
let fittedWidth = 0;
let fittedHeight = 0;
let viewerWidth = 0;
let viewerHeight = 0;
let touchGesture = null;
let suppressClickUntil = 0;
let segmentLoadId = 0;

// Size every segment from its SVG proportions and the available viewer space.
function fitSegment() {
    if (!zoomSvg) return;

    const style = getComputedStyle(container);
    viewerWidth = Math.max(1, container.clientWidth
        - (parseFloat(style.paddingLeft) || 0)
        - (parseFloat(style.paddingRight) || 0));
    viewerHeight = Math.max(1, container.clientHeight
        - (parseFloat(style.paddingTop) || 0)
        - (parseFloat(style.paddingBottom) || 0));

    const viewBox = (zoomSvg.getAttribute('viewBox') || '')
        .trim().split(/[\s,]+/).map(Number);
    const svgWidth = viewBox.length === 4 && viewBox[2] > 0
        ? viewBox[2] : parseFloat(zoomSvg.getAttribute('width')) || 1;
    const svgHeight = viewBox.length === 4 && viewBox[3] > 0
        ? viewBox[3] : parseFloat(zoomSvg.getAttribute('height')) || 1;
    const scale = Math.min(viewerWidth / svgWidth, viewerHeight / svgHeight);

    if (viewBox.length !== 4) {
        zoomSvg.setAttribute('viewBox', `0 0 ${svgWidth} ${svgHeight}`);
    }

    fittedWidth = svgWidth * scale;
    fittedHeight = svgHeight * scale;
    resetZoom();
}

// Resize the drawing and keep the chosen point under the same finger position.
function setZoom(level, anchor = null) {
    if (!zoomSvg || !zoomStage) return;

    const nextZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, level));
    const width = fittedWidth * nextZoom;
    const height = fittedHeight * nextZoom;
    const left = Math.max(0, (viewerWidth - width) / 2);
    const top = Math.max(0, (viewerHeight - height) / 2);

    zoomStage.style.width = `${Math.max(viewerWidth, width)}px`;
    zoomStage.style.height = `${Math.max(viewerHeight, height)}px`;
    zoomSvg.style.width = `${width}px`;
    zoomSvg.style.height = `${height}px`;
    zoomSvg.style.left = `${left}px`;
    zoomSvg.style.top = `${top}px`;
    zoomLevel = nextZoom;

    if (anchor) {
        container.scrollLeft = left + anchor.x * width - anchor.screenX;
        container.scrollTop = top + anchor.y * height - anchor.screenY;
    }
}

// Return to the fitted view without changing any bone states.
function resetZoom() {
    touchGesture = null;
    setZoom(MIN_ZOOM);
    container.scrollLeft = 0;
    container.scrollTop = 0;
}

// Prepare a shared drawing area after each SVG loads.
function prepareSegmentZoom() {
    zoomSvg = container.querySelector('svg');
    if (!zoomSvg) return;

    zoomStage = document.createElement('div');
    zoomStage.className = 'skeleton-zoom-stage';
    zoomSvg.parentNode.insertBefore(zoomStage, zoomSvg);
    zoomStage.appendChild(zoomSvg);
    zoomSvg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    fitSegment();
    resetZoomButton.disabled = false;
}

// Get finger positions relative to the viewer's inner drawing area.
function touchPoint(touch) {
    const rect = container.getBoundingClientRect();
    const style = getComputedStyle(container);
    return {
        x: touch.clientX - rect.left - container.clientLeft
            - (parseFloat(style.paddingLeft) || 0),
        y: touch.clientY - rect.top - container.clientTop
            - (parseFloat(style.paddingTop) || 0)
    };
}

// Start a pinch using the point between the first two fingers.
function startPinch(touches) {
    const first = touchPoint(touches[0]);
    const second = touchPoint(touches[1]);
    const screenX = (first.x + second.x) / 2;
    const screenY = (first.y + second.y) / 2;
    const left = parseFloat(zoomSvg.style.left) || 0;
    const top = parseFloat(zoomSvg.style.top) || 0;

    touchGesture = {
        type: 'pinch',
        ids: [touches[0].identifier, touches[1].identifier],
        distance: Math.max(1, Math.hypot(first.x - second.x, first.y - second.y)),
        zoom: zoomLevel,
        x: (container.scrollLeft + screenX - left) / (fittedWidth * zoomLevel),
        y: (container.scrollTop + screenY - top) / (fittedHeight * zoomLevel),
        moved: true
    };
    suppressClickUntil = Date.now() + 400;
}

// One finger moves the drawing; two fingers change its zoom.
container.addEventListener('touchstart', event => {
    if (!zoomSvg) return;
    if (event.touches.length >= 2) {
        startPinch(event.touches);
    } else if (event.touches.length === 1) {
        const touch = event.touches[0];
        touchGesture = {
            type: 'pan',
            id: touch.identifier,
            x: touch.clientX,
            y: touch.clientY,
            left: container.scrollLeft,
            top: container.scrollTop,
            moved: false
        };
        suppressClickUntil = 0;
    }
}, { passive: true });

container.addEventListener('touchmove', event => {
    if (!zoomSvg || !touchGesture) return;
    if (event.cancelable) event.preventDefault();

    if (touchGesture.type === 'pinch') {
        const touches = Array.from(event.touches);
        const firstTouch = touches.find(t => t.identifier === touchGesture.ids[0]);
        const secondTouch = touches.find(t => t.identifier === touchGesture.ids[1]);
        if (!firstTouch || !secondTouch) return;

        const first = touchPoint(firstTouch);
        const second = touchPoint(secondTouch);
        const distance = Math.hypot(first.x - second.x, first.y - second.y);
        setZoom(touchGesture.zoom * distance / touchGesture.distance, {
            x: touchGesture.x,
            y: touchGesture.y,
            screenX: (first.x + second.x) / 2,
            screenY: (first.y + second.y) / 2
        });
    } else {
        const touch = Array.from(event.touches)
            .find(t => t.identifier === touchGesture.id);
        if (!touch) return;

        const dx = touch.clientX - touchGesture.x;
        const dy = touch.clientY - touchGesture.y;
        if (Math.hypot(dx, dy) >= DRAG_THRESHOLD) touchGesture.moved = true;
        if (touchGesture.moved) {
            container.scrollLeft = touchGesture.left - dx;
            container.scrollTop = touchGesture.top - dy;
        }
    }

    if (touchGesture.moved) suppressClickUntil = Date.now() + 400;
}, { passive: false });

// Ignore the click generated after a drag or pinch, while keeping normal taps.
function finishTouch(event) {
    if (touchGesture?.moved) {
        suppressClickUntil = Date.now() + 400;
        if (event.cancelable) event.preventDefault();
    }
    if (event.touches.length === 0) touchGesture = null;
}

container.addEventListener('touchend', finishTouch, { passive: false });
container.addEventListener('touchcancel', () => {
    suppressClickUntil = Date.now() + 400;
    touchGesture = null;
});

container.addEventListener('click', event => {
    if (touchGesture?.moved || Date.now() < suppressClickUntil) {
        event.preventDefault();
        event.stopImmediatePropagation();
    }
}, true);

// Support mouse-wheel movement and Ctrl + wheel zoom on desktop.
container.addEventListener('wheel', event => {
    if (!zoomSvg) return;

    if (event.ctrlKey) {
        event.preventDefault();
        const point = touchPoint(event);
        const left = parseFloat(zoomSvg.style.left) || 0;
        const top = parseFloat(zoomSvg.style.top) || 0;
        setZoom(zoomLevel * Math.exp(-event.deltaY * 0.01), {
            x: (container.scrollLeft + point.x - left) / (fittedWidth * zoomLevel),
            y: (container.scrollTop + point.y - top) / (fittedHeight * zoomLevel),
            screenX: point.x,
            screenY: point.y
        });
    } else if (zoomLevel > MIN_ZOOM) {
        const unit = event.deltaMode === 1 ? 16
            : event.deltaMode === 2 ? viewerHeight : 1;
        const dx = event.shiftKey && !event.deltaX ? event.deltaY : event.deltaX;
        const dy = event.shiftKey && !event.deltaX ? 0 : event.deltaY;
        const left = container.scrollLeft;
        const top = container.scrollTop;
        container.scrollLeft += dx * unit;
        container.scrollTop += dy * unit;
        if (container.scrollLeft !== left || container.scrollTop !== top) {
            event.preventDefault();
        }
    }
}, { passive: false });

resetZoomButton.addEventListener('click', resetZoom);

// Fit the segment again when the viewer changes size or the phone rotates.
if (typeof ResizeObserver !== 'undefined') {
    const observer = new ResizeObserver(() => {
        if (!zoomSvg) return;
        const style = getComputedStyle(container);
        const width = container.clientWidth
            - (parseFloat(style.paddingLeft) || 0)
            - (parseFloat(style.paddingRight) || 0);
        const height = container.clientHeight
            - (parseFloat(style.paddingTop) || 0)
            - (parseFloat(style.paddingBottom) || 0);
        if (Math.abs(width - viewerWidth) > 1 || Math.abs(height - viewerHeight) > 1) {
            fitSegment();
        }
    });
    observer.observe(container);
}

// ========================================
// Apply Bone State Colours
// ========================================

// Apply the saved state colour, or the unmarked colour when no state is set.
// Child, Infant and Adolescent parts keep separate colours; decorative shapes are skipped.
function paintGroup(group, state) {
    const fillColor = (state && STATE_COLORS[state])
        ? STATE_COLORS[state]
        : STATE_COLORS[UNMARKED];

    boneShapesForGroup(group, currentAccession?.ageCategory)
        .forEach(shape => {
            if (isDecorativeShape(shape)) return;
            shape.style.fill = fillColor;
        });
}

// ========================================
// Save Linked Bone States
// ========================================

// Apply or clear the state for every linked view of the same bone.
// Update the colours on screen and save each linked ID.
// Child, Infant and Adolescent unfused parts remain independent from their parent bone.
async function applyStateToLinkedBones(boneId, finalState) {
    const ids = linkedSvgIds(boneId, currentAccession?.ageCategory);

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

// ========================================
// Close Bone Details
// ========================================

// Hide the details popup and remove the current selection outlines.
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

// ========================================
// Load Data
// ========================================

// Load the individual, site details and saved bone states.
// Open the requested segment or the first available segment.
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

        let initialSegment = SEGMENTS.find(
            s => s.id === segmentParam && s.status === 'have'
        );
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

// Create a tab for each segment and show which segments are unavailable.
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
// Load Segment
// ========================================

// Load the segment SVG from the selected age folder.
// Restore its colours and prepare bone selection after loading.
async function loadSegment(segmentId) {
    const segment = SEGMENTS.find(s => s.id === segmentId);
    if (!segment || segment.status === 'missing') return;
    if (!currentFolder) return;

    allPresentButton.disabled = true;
    resetZoomButton.disabled = true;
    zoomSvg = null;
    zoomStage = null;
    touchGesture = null;
    const loadId = ++segmentLoadId;

    currentSegment = segmentId;

    segmentTabs.querySelectorAll('.segment-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.segment === segmentId);
    });

    selectedSegmentName.textContent = `Selected: ${segment.label}`;

    closeDetailsBox();

    try {
        const response = await fetch(
            `assets/skeletons/${currentFolder}/${segment.file}`
        );
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        const svgText = await response.text();
        if (loadId !== segmentLoadId) return;

        container.innerHTML = svgText;
        prepareSkeletonSvg(container, currentAccession?.ageCategory);

        container.dataset.segment = segmentId;
        container.dataset.age = currentFolder;

        prepareSegmentZoom();
        applyColorsAndMakeClickable();
    } catch (error) {
        if (loadId !== segmentLoadId) return;
        zoomSvg = null;
        zoomStage = null;
        resetZoomButton.disabled = true;
        console.error('Failed to load segment:', segment.label, error);

        container.innerHTML = `
            <div style="text-align:center;color:var(--text-muted);padding:40px;">
                Failed to load ${segment.label}<br>
                <span style="font-size:14px;">${error.message}</span>
            </div>
        `;

        allPresentButton.disabled = true;
    }
}

// ========================================
// Prepare Bone Selection
// ========================================

// Find selectable bones, restore their colours and add click and hover handlers.
function applyColorsAndMakeClickable() {
    const allGroups = container.querySelectorAll('g[id]');
    const boneElements = [];

    allGroups.forEach(group => {
        const id = group.id.trim();

        if (isNonBoneId(id)) return;
        if (isGhostGroup(group)) return;
        if (!isSelectableBoneGroup(group, currentAccession?.ageCategory)) return;

        boneElements.push(group);
    });

    boneElements.forEach(group => {
        const boneId = group.id.trim();

        // Use each bone's own shapes so nested parts keep separate colours and highlights.
        const allShapes = boneShapesForGroup(
            group,
            currentAccession?.ageCategory
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

// ========================================
// Handle Bone Click
// ========================================

// Select the bone, outline its linked views and show its current state.
// Clicking the same selected bone again closes the details popup.
function handleBoneClick(element) {
    const boneId = element.id.trim();

    // Remove the outline from the bone's non-decorative shapes.
    function clearStroke(group) {
        boneShapesForGroup(group, currentAccession?.ageCategory)
            .forEach(shape => {
                if (isDecorativeShape(shape)) return;
                shape.style.stroke = '';
                shape.style.strokeWidth = '';
            });
    }

    // Outline the bone's non-decorative shapes to show selection.
    function applyStroke(group) {
        boneShapesForGroup(group, currentAccession?.ageCategory)
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

    // Outline the same bone's linked views that are visible in this segment.
    for (const id of linkedSvgIds(boneId, currentAccession?.ageCategory)) {
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

// ========================================
// Close Button
// ========================================

// Close the popup without passing the click to the skeleton.
detailsCloseButton.addEventListener('click', (e) => {
    e.stopPropagation();
    closeDetailsBox();
});

// ========================================
// Preservation State Buttons
// ========================================

// Save the chosen state for the selected bone and its linked views.
// Choosing the current state again clears it back to Unmarked.
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

// ========================================
// Mark All Present
// ========================================

// Mark every selectable bone in the current segment as Present.
// Apply the same state to linked views and update the open details popup.
allPresentButton.addEventListener('click', async () => {
    const boneElements = [];

    container.querySelectorAll('g[id]').forEach(group => {
        const id = group.id.trim();

        if (isNonBoneId(id)) return;
        if (isGhostGroup(group)) return;
        if (!isSelectableBoneGroup(group, currentAccession?.ageCategory)) return;

        boneElements.push(group);
    });

    if (boneElements.length === 0) {
        alert('No bones to mark in this segment.');
        return;
    }

    allPresentButton.disabled = true;

    try {
        // Process each linked group once to avoid repeating the same saves.
        const handledCodes = new Set();

        for (const group of boneElements) {
            const boneId = group.id.trim();
            const linked = linkedSvgIds(
                boneId,
                currentAccession?.ageCategory
            );
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

// ========================================
// Start
// ========================================

// Load the individual and initial segment.
loadData();
