'use client';

import React from 'react';
import type { PluginUIContract } from '@/engine/plugins/manifest';

type AutoGenProps = Pick<PluginUIContract, 'manifest' | 'params' | 'onParamChange'> & {
  trackId: string;
  pluginId: string;
};

export function AutoGenPluginUI({ manifest, params, onParamChange }: AutoGenProps) {
  return (
    <div className="bg-[#1a1a1a] rounded-lg border border-gray-800 p-6 text-white select-none" style={{ width: 400 }}>
      <div className="flex items-center gap-3 mb-6 border-b border-gray-800 pb-3">
        <div className="w-2 h-2 rounded-full bg-emerald-500" />
        <h2 className="text-sm font-bold uppercase tracking-widest text-gray-300">
          {manifest.name}
        </h2>
        <span className="text-[10px] text-gray-600 ml-auto">{manifest.version}</span>
      </div>

      {manifest.parameters.length === 0 && (
        <div className="text-gray-500 text-xs text-center py-8">
          No parameters defined
        </div>
      )}

      <div className="space-y-4">
        {manifest.parameters.map((param) => {
          const value = params[param.id] ?? param.defaultValue;

          const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
            const val = e.target.type === 'checkbox'
              ? (e.target as HTMLInputElement).checked ? 1 : 0
              : parseFloat(e.target.value);
            onParamChange(param.id, val);
          };

          return (
            <div key={param.id}>
              <div className="flex justify-between items-center mb-1">
                <label className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">
                  {param.name}
                </label>
                <span className="text-[11px] font-mono text-amber-500">
                  {formatValue(value, param)}
                </span>
              </div>

              {param.type === 'boolean' && (
                <input
                  type="checkbox"
                  checked={value === 1}
                  onChange={handleChange}
                  className="accent-emerald-500 cursor-pointer"
                />
              )}

              {param.type === 'enum' && param.enumValues && (
                <select
                  value={value}
                  onChange={handleChange}
                  className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-xs text-white cursor-pointer"
                >
                  {param.enumValues.map((label, i) => (
                    <option key={i} value={i}>{label}</option>
                  ))}
                </select>
              )}

              {(param.type === 'float' || param.type === 'int') && (
                <input
                  type="range"
                  min={param.minValue ?? 0}
                  max={param.maxValue ?? 100}
                  step={param.step ?? (param.type === 'int' ? 1 : 0.1)}
                  value={value}
                  onChange={handleChange}
                  className="w-full accent-amber-500 bg-gray-900 appearance-none h-1.5 rounded cursor-pointer"
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function formatValue(value: number, param: { type: string; unit?: string; enumValues?: string[] }): string {
  if (param.type === 'boolean') return value === 1 ? 'ON' : 'OFF';
  if (param.type === 'enum' && param.enumValues) {
    return param.enumValues[value] ?? String(value);
  }
  const formatted = param.type === 'int' ? value.toFixed(0) : value.toFixed(1);
  return param.unit ? `${formatted} ${param.unit}` : formatted;
}
