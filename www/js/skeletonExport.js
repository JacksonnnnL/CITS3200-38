import {
    PRESERVATION_STATES,
    getZoneStatesByAccession
} from './data.js';

import {
    ELEMENT_BY_SVG_ID
} from './bone_counts.js';


// ========================================
// CSV State Codes
// ========================================

// Proposed research coding:
// 0 = Absent
// 1 = Fragmented
// 2 = Present / Complete

export const STATE_CODES = {
    [PRESERVATION_STATES.ABSENT]: 0,
    [PRESERVATION_STATES.PRESENT_FRAGMENTED]: 1,
    [PRESERVATION_STATES.PRESENT_COMPLETE]: 2
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

export function buildExportRows(zoneStates) {

    return zoneStates.map(zoneState => {

        const boneInfo =
            ELEMENT_BY_SVG_ID.get(zoneState.bone);

        return {
            bone_id: zoneState.bone,

            element_code:
                boneInfo?.code || '',

            element_label:
                boneInfo?.label || '',

            side:
                zoneState.side || '',

            zone:
                zoneState.zone || '',

            state_code:
                stateToCode(zoneState.state),

            state:
                zoneState.state
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
        'side',
        'zone',
        'state_code',
        'state'
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

    downloadBlob(blob, fileName);
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

    // Margins
    const margin = 180;
    const maxWidth = canvas.width - margin * 2;
    const maxHeight = canvas.height - margin * 2;

    // Keep aspect ratio
    const scale = Math.min(
        maxWidth / image.width,
        maxHeight / image.height
    );

    const drawWidth = image.width * scale;
    const drawHeight = image.height * scale;

    const x = (canvas.width - drawWidth) / 2;
    const y = (canvas.height - drawHeight) / 2;

    ctx.drawImage(
        image,
        x,
        y,
        drawWidth,
        drawHeight
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

    downloadBlob(blob, fileName);
}

// ========================================
// Download Blob
// ========================================

function downloadBlob(blob, fileName) {

    const url =
        URL.createObjectURL(blob);

    const link =
        document.createElement('a');

    link.href = url;
    link.download = fileName;

    document.body.appendChild(link);

    link.click();

    document.body.removeChild(link);

    URL.revokeObjectURL(url);
}

// ========================================
// Download CSV + JPEG as ZIP
// ========================================

export async function downloadIndividualZip(
    accessionId,
    svgElement,
    baseFileName = 'osteomap-export'
) {

    // Create the ZIP container
    const zip = new JSZip();


    // Create both export files as Blobs
    const csvBlob =
        await createIndividualCsvBlob(accessionId);

    const jpegBlob =
        await createSkeletonJpegBlob(svgElement);


    // Add the files to the ZIP
    zip.file(
        `${baseFileName}_data.csv`,
        csvBlob
    );

    zip.file(
        `${baseFileName}_skeleton.jpg`,
        jpegBlob
    );


    // Generate the completed ZIP as a Blob
    const zipBlob =
        await zip.generateAsync({
            type: 'blob'
        });


    // Download one ZIP file
    downloadBlob(
        zipBlob,
        `${baseFileName}.zip`
    );
}