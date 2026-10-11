import {
    PRESERVATION_STATES,
    getZoneStatesByAccession
} from './data.js';

import {
    ELEMENT_BY_SVG_ID
} from './bone_counts.js';

import {
    STATE_COLORS
} from './skeleton_config.js';

import {
    isNativeApp,
    saveNativeBlob
} from './nativeFileSaver.js';

// ========================================
// CSV State Codes
// ========================================

// Proposed research coding:
// 0 = Absent
// 2 = Fragmented
// 1 = Present / Complete

export const STATE_CODES = {
    [PRESERVATION_STATES.ABSENT]: 0,
    [PRESERVATION_STATES.PRESENT_FRAGMENTED]: 2,
    [PRESERVATION_STATES.PRESENT_COMPLETE]: 1
};


// ========================================
// Convert one preservation state to number
// ========================================

export function stateToCode(state) {
    return STATE_CODES[state] ?? '';
}


// ========================================
// Build CSV Rows
// ========================================

// ELEMENT_BY_SVG_ID contains the client MNI mapping.
// Bones recorded for inventory purposes but excluded from MNI
// may therefore have blank element_code / element_label fields.
// A future export-data refactor could introduce canonical bone
// metadata without changing the MNI calculation.

export function buildExportRows(zoneStates) {

    return zoneStates.map(zoneState => {

        const boneInfo =
            ELEMENT_BY_SVG_ID.get(zoneState.bone);

        return {
            bone_id:
                zoneState.bone,

            element_code:
                boneInfo?.code || '',

            element_label:
                boneInfo?.label || '',

            state_code:
                stateToCode(zoneState.state)
        };
    });
}


// ========================================
// Escape CSV Values
// ========================================

export function escapeCsvValue(value) {

    if (value === null || value === undefined) {
        return '';
    }

    const text = String(value);

    if (
        text.includes(',') ||
        text.includes('"') ||
        text.includes('\n')
    ) {
        return `"${text.replaceAll('"', '""')}"`;
    }

    return text;
}


// ========================================
// Convert Rows to CSV
// ========================================

export function rowsToCsv(rows) {

    const headers = [
        'bone_id',
        'element_code',
        'element_label',
        'state_code'
    ];

    const lines = [
        headers.join(',')
    ];

    for (const row of rows) {

        const line = headers
            .map(header =>
                escapeCsvValue(row[header])
            )
            .join(',');

        lines.push(line);
    }

    return lines.join('\n');
}

// ========================================
// Build CSV for Individual
// ========================================

export async function createIndividualCsv(accessionId) {

    const zoneStates =
        await getZoneStatesByAccession(accessionId);

    const rows =
        buildExportRows(zoneStates);

    return rowsToCsv(rows);
}


// ========================================
// Create CSV Blob
// ========================================

export async function createIndividualCsvBlob(accessionId) {

    const csv =
        await createIndividualCsv(accessionId);

    return new Blob(
        [csv],
        {
            type: 'text/csv;charset=utf-8;'
        }
    );
}


// ========================================
// Download CSV File
// ========================================

export async function downloadIndividualCsv(
    accessionId,
    fileName = 'osteomap-export.csv'
) {

    const blob =
        await createIndividualCsvBlob(accessionId);

    await downloadBlob(blob, fileName);
}

// ========================================
// Draw Preservation Legend on JPEG
// ========================================

function drawPreservationLegend(ctx, canvas, margin, legendHeight) {

    const legendItems = [
        {
            label: 'Present',
            color: STATE_COLORS[PRESERVATION_STATES.PRESENT_COMPLETE]
        },
        {
            label: 'Fragmented',
            color: STATE_COLORS[PRESERVATION_STATES.PRESENT_FRAGMENTED]
        },
        {
            label: 'Absent',
            color: STATE_COLORS[PRESERVATION_STATES.ABSENT]
        },
        {
            label: 'Unmarked',
            color: '#ffffff'
        }
    ];

    // Position the legend below the skeleton
    const legendTop =
        canvas.height - margin - legendHeight;

    // Horizontal divider
    ctx.strokeStyle = '#cccccc';
    ctx.lineWidth = 3;

    ctx.beginPath();
    ctx.moveTo(margin, legendTop + 20);
    ctx.lineTo(canvas.width - margin, legendTop + 20);
    ctx.stroke();

    // Legend heading
    ctx.fillStyle = '#222222';
    ctx.font = 'bold 54px Arial';

    ctx.fillText(
        'Preservation State Legend',
        margin,
        legendTop + 100
    );

    // Arrange four legend items horizontally
    const availableWidth = canvas.width - margin * 2;
    const itemWidth = availableWidth / legendItems.length;

    const squareSize = 55;
    const itemY = legendTop + 160;

    legendItems.forEach((item, index) => {

        const x = margin + index * itemWidth;

        // Draw colour square
        ctx.fillStyle = item.color;
        ctx.fillRect(x, itemY, squareSize, squareSize);

        // Outline for visibility
        ctx.strokeStyle = '#333333';
        ctx.lineWidth = 2;
        ctx.strokeRect(x, itemY, squareSize, squareSize);

        // Draw label
        ctx.fillStyle = '#222222';
        ctx.font = '38px Arial';

        ctx.fillText(
            item.label,
            x + squareSize + 18,
            itemY + 42
        );
    });
}


// ========================================
// Download Skeleton JPEG Blob
// ========================================

export async function createSkeletonJpegBlob(svgElement) {

    if (!svgElement) {
        throw new Error('No SVG element provided for JPEG export.');
    }

    const serializer = new XMLSerializer();
    const svgString = serializer.serializeToString(svgElement);

    const svgBlob = new Blob(
        [svgString],
        { type: 'image/svg+xml;charset=utf-8' }
    );

    const svgUrl = URL.createObjectURL(svgBlob);

    const image = new Image();

    const imageLoaded = new Promise((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(
            new Error('Failed to load SVG into image.')
        );
    });

    image.src = svgUrl;
    await imageLoaded;

    // A4 portrait at 300 DPI
    const canvas = document.createElement('canvas');
    canvas.width = 2480;
    canvas.height = 3508;

    const ctx = canvas.getContext('2d');

    if (!ctx) {
        URL.revokeObjectURL(svgUrl);
        throw new Error('Failed to get canvas context.');
    }

    // White background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // ========================================
    // Canvas Layout
    // ========================================

    // Outer margins
    const margin = 180;

    // Reserve space for preservation legend
    const legendHeight = 360;

    // Available space for skeleton
    const maxWidth =
        canvas.width - margin * 2;

    const maxHeight =
        canvas.height - margin * 2 - legendHeight;

    // Maintain SVG aspect ratio
    const scale = Math.min(
        maxWidth / image.width,
        maxHeight / image.height
    );

    const drawWidth = image.width * scale;
    const drawHeight = image.height * scale;

    // Centre skeleton within its allocated area
    const x =
        (canvas.width - drawWidth) / 2;

    const y =
        margin + (maxHeight - drawHeight) / 2;

    // Draw skeleton
    ctx.drawImage(
        image,
        x,
        y,
        drawWidth,
        drawHeight
    );

    // ========================================
    // Draw Preservation Legend
    // ========================================

    drawPreservationLegend(
        ctx,
        canvas,
        margin,
        legendHeight
    );


    URL.revokeObjectURL(svgUrl);

    const jpegBlob = await new Promise((resolve, reject) => {
        canvas.toBlob(
            blob => {
                if (blob) {
                    resolve(blob);
                } else {
                    reject(
                        new Error('Failed to create JPEG blob.')
                    );
                }
            },
            'image/jpeg',
            0.95
        );
    });

    return jpegBlob;
}

// ========================================
// Download Skeleton JPEG
// ========================================

export async function downloadSkeletonJpeg(
    svgElement,
    fileName = 'osteomap-skeleton.jpg'
) {

    const blob =
        await createSkeletonJpegBlob(svgElement);

    await downloadBlob(blob, fileName);
}

// ========================================
// Download Blob
// ========================================

async function downloadBlob(blob, fileName) {
    if (isNativeApp()) {
        // Native saving is required for Capacitor's Android WebView.
        // Do not silently fall back to a browser download if the plugin fails.
        await saveNativeBlob(blob, fileName);
        return;
    }

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    try {
        link.click();
    } finally {
        link.remove();
        // Allow the browser time to take ownership of the Blob URL.
        setTimeout(() => URL.revokeObjectURL(url), 30000);
    }
}

// ========================================
// Export two separate files, without ZIP
// ========================================

export async function saveCsvAndJpeg(csvBlob, jpegBlob, baseFileName) {
    const csvName = `${baseFileName}_data.csv`;
    const jpegName = `${baseFileName}_skeleton.jpg`;

    await downloadBlob(csvBlob, csvName);
    try {
        await downloadBlob(jpegBlob, jpegName);
    } catch (error) {
        throw new Error(`CSV was saved, but JPEG export failed: ${error.message}`);
    }
}

export async function downloadIndividualFiles(
    accessionId,
    svgElement,
    baseFileName = 'osteomap-export'
) {
    // Generate both files before saving either one, so a rendering error
    // cannot leave behind only the CSV.
    const csvBlob = await createIndividualCsvBlob(accessionId);
    const jpegBlob = await createSkeletonJpegBlob(svgElement);
    await saveCsvAndJpeg(csvBlob, jpegBlob, baseFileName);
}
