"use client"
import React from 'react';
import {
    SURROUND_CHANNEL_LABELS, hasChannel, type SurroundChannel,
} from '@/lib/surroundLayout';

/**
 * The surround channel grid shared by all three I/O Assignments panels.
 *
 * All three drew their own copy of the same grid, each slightly different and
 * each missing rows the reference has — the top-surround pair was absent from
 * two of them and L./R. center from a third. One grid, three cell renderers.
 *
 * The layout is the reference's: a five-wide front row, then the mid and
 * surround rows sitting under its outer and centre columns, then the height
 * channels in a two-wide block below.
 */

/** Row 1 spans all five columns; rows 2 and 3 use columns 1, 3 and 5. */
const FRONT_ROW: SurroundChannel[] = ['left', 'lc', 'center', 'rc', 'right'];
const MID_ROW: SurroundChannel[] = ['lm', 'lfe', 'rm'];
const SURROUND_ROW: SurroundChannel[] = ['ls', 'surround', 'rs'];
const HEIGHT_PAIRS: [SurroundChannel, SurroundChannel][] = [
    ['lt', 'rt'],
    ['ltm', 'rtm'],
    ['lts', 'rts'],
];

export interface SurroundGridProps {
    format: string;
    /**
     * Renders one channel's control. Told whether the format carries the
     * channel, and which way the cell reads, so the control matches its label.
     */
    renderCell: (
        channel: SurroundChannel,
        enabled: boolean,
        align: 'left' | 'center' | 'right',
    ) => React.ReactNode;
}

function Cell({
    channel, format, renderCell, align,
}: SurroundGridProps & { channel: SurroundChannel; align: 'left' | 'center' | 'right' }) {
    const enabled = hasChannel(format, channel);
    return (
        <div
            className={`space-y-1 ${align === 'center' ? 'text-center' : align === 'right' ? 'text-right' : 'text-left'}`}
            data-channel={channel}
            data-enabled={enabled}
        >
            <label className={`block text-[10px] font-bold uppercase ${enabled ? 'text-studio-text-dim' : 'text-studio-text-dim/40'}`}>
                {SURROUND_CHANNEL_LABELS[channel]}:
            </label>
            {renderCell(channel, enabled, align)}
        </div>
    );
}

export function SurroundGrid({ format, renderCell }: SurroundGridProps) {
    const cell = (channel: SurroundChannel, align: 'left' | 'center' | 'right', column?: number) => (
        <div key={channel} style={column ? { gridColumn: column } : undefined}>
            <Cell channel={channel} format={format} renderCell={renderCell} align={align} />
        </div>
    );

    // Outer columns read outward-aligned, as in the reference, so the grid
    // mirrors the room it describes.
    const alignFor = (index: number): 'left' | 'center' | 'right' =>
        index === 0 ? 'left' : index === 4 ? 'right' : 'center';

    return (
        <div className="bg-black/20 rounded-xl p-6 border border-white/5">
            <div className="grid grid-cols-5 gap-x-4 gap-y-5">
                {FRONT_ROW.map((channel, i) => cell(channel, alignFor(i)))}
                {MID_ROW.map((channel, i) => cell(channel, alignFor(i * 2), i * 2 + 1))}
                {SURROUND_ROW.map((channel, i) => cell(channel, alignFor(i * 2), i * 2 + 1))}
            </div>

            <div className="grid grid-cols-2 gap-x-10 gap-y-4 mt-8 px-8">
                {HEIGHT_PAIRS.map(([leftChannel, rightChannel]) => (
                    <React.Fragment key={leftChannel}>
                        <Cell channel={leftChannel} format={format} renderCell={renderCell} align="left" />
                        <Cell channel={rightChannel} format={format} renderCell={renderCell} align="left" />
                    </React.Fragment>
                ))}
            </div>
        </div>
    );
}

/** Shared look for a grid cell's control, enabled or not. */
export function gridControlClass(enabled: boolean, align: 'left' | 'center' | 'right'): string {
    const alignment = align === 'center' ? 'text-center' : align === 'right' ? 'text-right' : '';
    return [
        'w-full h-6 bg-studio-panel border rounded px-2 text-[11px] outline-none shadow-inner transition-colors',
        enabled
            ? 'border-studio-line-strong text-accent-cyan hover:border-accent-cyan/60 cursor-pointer'
            : 'border-white/5 text-studio-text-dim/40 cursor-default',
        alignment,
    ].join(' ');
}
