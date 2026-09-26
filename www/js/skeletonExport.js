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