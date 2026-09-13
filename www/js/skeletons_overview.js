// ============================================
// SKELETON OVERVIEW - skeletons_overview.js
// Shows combined SVG segments based on age category
// Adult → shows SVGs with bone state colors
// Non-adult → shows "Coming soon" message
//
// Each segment card is TAPPABLE and jumps straight
// into skeletons_selection.html for that segment.
// The bottom Expand button still resumes from the
// last-viewed segment (localStorage) as before.
// ============================================

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
    STATE_COLORS,
    UNMARKED
} from './skeleton_config.js';

console.log('Skeleton Overview loaded!');

// ============================================
// 1. Segment configuration
// ============================================

const SEGMENTS = [
    // Row 1: Cranium alone
    { id: 'cranium', label: 'Cranium', file: 'cranium.svg', available: true, row: 1 },

    // Row 2: Upper limbs, Pelvis, Axial
    { id: 'right-upper', label: 'R Upper Limb', file: 'right_upper_limb.svg', available: true, row: 2 },
    { id: 'pelvis', label: 'Pelvis', file: 'pelvis.svg', available: true, row: 2 },
    { id: 'axial', label: 'Axial', file: 'axial_skeleton.svg', available: true, row: 2 },
    { id: 'left-upper', label: 'L Upper Limb', file: 'left_upper_limb.svg', available: true, row: 2 },

    // Row 3: Lower limbs
    { id: 'right-lower', label: 'R Lower Limb', file: 'right_lower_limb.svg', available: true, row: 3 },
    { id: 'left-lower', label: 'L Lower Limb', file: 'left_lower_limb.svg', available: true, row: 3 }
];

// ============================================
// 1a. Shape helpers
// ============================================
//
// Some SVG bones contain "decorative" overlay paths (e.g.
// <path id="Vector_1" opacity="0.82"/>) that visually frame the bone
// but are not the bone itself. Colouring them makes the highlight
// look like a big rectangle around the bone. We skip anything with
// explicit opacity < 1 when applying fill / stroke.

function isDecorativeShape(shape) {
    const attr = shape.getAttribute('opacity');
    if (attr !== null && parseFloat(attr) < 1) return true;
    return false;
}

// ============================================
// 2. Get data
// ============================================

const urlParams = new URLSearchParams(window.location.search);
const accessionId = urlParams.get('accessionId');

if (!accessionId) {
    alert('No individual specified!');
    window.location.href = 'index.html';
}

let currentAccession = null;
let currentSite = null;
let ageCategory = null;
let boneStates = {};  // Store bone states by bone ID

// ============================================
// 3. Load data
// ============================================

async function loadData() {
    try {
        currentAccession = await getAccessionById(accessionId);
        if (!currentAccession) {
            alert('Individual not found!');
            window.location.href = 'index.html';
            return;
        }

        // Store age category for later use
        ageCategory = currentAccession.ageCategory || 'adult';
        console.log('Age Category:', ageCategory);

        // ====== Load bone states ======
        const savedStates = await getZoneStatesByAccession(accessionId);
        console.log(`Loaded ${savedStates.length} saved bone states`);

        // TODO (future): When zonation is introduced, key by
        // bone+side+zone instead of just bone.
        // Build boneStates map: boneId -> state
        savedStates.forEach(s => {
            if (s.bone) {
                boneStates[s.bone] = s.state;
            }
        });
        console.log('Bone states map:', boneStates);

        // Display Accession Number
        document.getElementById('accession-display').textContent = currentAccession.accessionNumber || accessionId;

        // Display Site
        if (currentAccession.siteId) {
            currentSite = await getSiteById(currentAccession.siteId);
            document.getElementById('site-display').textContent = currentSite ? currentSite.code : '---';

            // Back button → back to the site page
            const backButton = document.getElementById('back-to-site-button');
            if (backButton) {
                backButton.addEventListener('click', () => {
                    window.location.href =
                        `site.html?siteId=${encodeURIComponent(currentAccession.siteId)}`;
                });
            }
        }

        // Display individual's date
        const dateDisplay = document.getElementById('individual-date-display');
        if (currentAccession.date) {
            const dateObj = new Date(currentAccession.date);
            if (!isNaN(dateObj.getTime())) {
                const year = dateObj.getFullYear();
                const month = String(dateObj.getMonth() + 1).padStart(2, '0');
                const day = String(dateObj.getDate()).padStart(2, '0');
                dateDisplay.textContent = year + '/' + month + '/' + day;
            } else {
                dateDisplay.textContent = currentAccession.date;
            }
        } else {
            const today = new Date();
            const year = today.getFullYear();
            const month = String(today.getMonth() + 1).padStart(2, '0');
            const day = String(today.getDate()).padStart(2, '0');
            dateDisplay.textContent = year + '/' + month + '/' + day;
        }

        // Load notes
        if (currentAccession.notes) {
            document.getElementById('notes-description').value = currentAccession.notes;
        }

        // ====== Check age → Folder ======
        const folder = folderForAge(ageCategory);

        if (folder) {
            console.log(`${folder} skeleton - loading SVGs with bone states`);
            loadSkeletonBoard(folder);
        } else {
            console.log(`${ageCategory} - showing coming soon message`);
            showComingSoonMessage(ageCategory);
        }

    } catch (error) {
        console.error('Failed to load data:', error);
    }
}

// ============================================
// 4. Show coming soon message for non-adult group
// ============================================

function showComingSoonMessage(age) {
    const board = document.getElementById('skeleton-board');
    const ageDisplay = age ? age.charAt(0).toUpperCase() + age.slice(1) : 'Child';

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

// ============================================
// 5. Load skeleton board with bone states
// ============================================
//
// Each segment card is TAPPABLE. Tapping it:
//   1. Saves the segment to localStorage (so the Expand button
//      resumes there next time — same key skeletons_selection.js uses)
//   2. Navigates to skeletons_selection.html with ?segment=<id>

function goToSegment(segId) {
    try {
        localStorage.setItem(
            `osteomap:lastSegment:${accessionId}`,
            segId
        );
        console.log('Saved last segment:', segId);
    } catch (e) {
        console.warn('Could not save last segment:', e);
    }

    window.location.href =
        `skeletons_selection.html?accessionId=${encodeURIComponent(accessionId)}&segment=${encodeURIComponent(segId)}`;
}

async function loadSkeletonBoard(folder) {
    const board = document.getElementById('skeleton-board');

    // Clear loading message
    board.innerHTML = '';

    // Build row groups dynamically
    const rowsMap = new Map();
    SEGMENTS.forEach(seg => {
        if (!seg.available) return;
        if (!rowsMap.has(seg.row)) {
            rowsMap.set(seg.row, []);
        }
        rowsMap.get(seg.row).push(seg);
    });

    const rowNumbers = Array.from(rowsMap.keys()).sort((a, b) => a - b);

    let loadedCount = 0;

    // Helper to create a row
    async function createRow(segments) {
        const row = document.createElement('div');
        row.className = 'skeleton-row';

        for (const seg of segments) {
            try {
                const response = await fetch(`assets/skeletons/${folder}/${seg.file}`);
                if (!response.ok) {
                    console.warn(`Failed to load ${seg.file} from ${folder}/`);
                    continue;
                }
                const svgText = await response.text();

                // Create card for each SVG
                const card = document.createElement('div');
                card.className = 'skeleton-segment';
                card.dataset.segment = seg.id;

                // Insert the SVG (SVG itself is pointer-events: none
                // via CSS — the CARD is the tap target)
                card.innerHTML = svgText;

                // ====== Apply bone states colours ======
                applyBoneColors(card);

                // Add label below
                const label = document.createElement('div');
                label.className = 'segment-label';
                label.textContent = seg.label;
                card.appendChild(label);

                // ====== Make the whole card tappable ======
                card.addEventListener('click', () => {
                    goToSegment(seg.id);
                });

                row.appendChild(card);
                loadedCount++;

            } catch (error) {
                console.warn(`Could not load ${seg.file}:`, error);
            }
        }

        return row;
    }

    // Render every row in order
    for (const rowNumber of rowNumbers) {
        const row = await createRow(rowsMap.get(rowNumber));
        if (row.children.length > 0) {
            board.appendChild(row);
        }
    }

    // Show message if nothing loaded
    if (loadedCount === 0) {
        board.innerHTML = `
            <div class="skeleton-placeholder">
                <span class="icon">🦴</span>
                No skeleton segments found.<br>
                <span style="font-size:14px;color:var(--text-light);">
                    Make sure SVG files are in assets/skeletons/${folder}/
                </span>
            </div>
        `;
    } else {
        console.log(`Loaded ${loadedCount} skeleton segments from ${folder}/ folder`);
    }
}

// ============================================
// 6. Apply bone state colours to svg
// ============================================
//
// SVG files use non-unique path ids ("Vector", "Vector_2", ...)
// inside unique bone groups (<g id="femur_left">). We must key on
// the group id, otherwise states collide across bones.
//
// isNonBoneId() and hasRealBoneSubgroups() are imported from
// skeleton_config.js — they are shared with skeletons_selection.js.

function applyBoneColors(card) {
    const groups = card.querySelectorAll('g[id]');
    let coloredCount = 0;

    groups.forEach(group => {
        const elementId = group.id.trim();

        if (!elementId) return;
        if (isNonBoneId(elementId)) return;

        // Skip wrapper groups that contain other real bone groups.
        // Internal wrappers like Vector_* / Group N do not count.
        if (hasRealBoneSubgroups(group)) return;

        const state = boneStates[elementId];
        if (!state || !STATE_COLORS[state]) return;

        // Colour every real shape inside this group.
        // Skip decorative overlay paths (opacity < 1).
        group
            .querySelectorAll('path, polygon, circle, ellipse, rect')
            .forEach(shape => {
                if (isDecorativeShape(shape)) return;
                shape.style.fill = STATE_COLORS[state];
            });

        coloredCount++;
    });

    if (coloredCount > 0) {
        console.log(`Applied colors to ${coloredCount} bones in overview`);
    } else {
        console.log(`No bone states to apply in overview`);
    }
}

// ============================================
// 7. Expand button
// ============================================
//
// Still resumes from the last-viewed segment (which may have been
// set either by this page's card taps, or by skeletons_selection.js).
// Falls back to the first available segment.

document.getElementById('expand-btn').addEventListener('click', () => {
    // Check if age has assets
    const folder = folderForAge(ageCategory);

    if (!folder) {
        alert(`The ${ageCategory || 'Child'} skeletal model is not yet available. Please check back in a future update.`);
        return;
    }

    const availableSegments = SEGMENTS.filter(s => s.available);
    if (availableSegments.length === 0) {
        alert('No segments available yet!');
        return;
    }

    // Read the last segment this individual was viewing.
    const storageKey = `osteomap:lastSegment:${accessionId}`;
    let targetId = null;

    try {
        const stored = localStorage.getItem(storageKey);
        if (stored && availableSegments.some(s => s.id === stored)) {
            targetId = stored;
            console.log('Resuming at:', targetId);
        }
    } catch (e) {
        console.warn('Could not read last segment:', e);
    }

    if (!targetId) {
        targetId = availableSegments[0].id;
        console.log('No memory, starting at:', targetId);
    }

    goToSegment(targetId);
});

// ============================================
// 8. Auto save notes on change
// ============================================

const notesInput = document.getElementById('notes-description');

notesInput.addEventListener('change', async function() {
    try {
        await updateAccession(accessionId, { notes: this.value.trim() });
        console.log('Notes auto-saved');
    } catch (error) {
        console.error('Failed to auto-save notes:', error);
    }
});

// ============================================
// 9. Start
// ============================================

document.addEventListener('DOMContentLoaded', loadData);