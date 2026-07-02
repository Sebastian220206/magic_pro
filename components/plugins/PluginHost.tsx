'use client';

import React, { useCallback, useMemo } from 'react';
import type { PluginManifest, PluginUIContract } from '@/engine/plugins/manifest';
import { getPluginUI } from '@/engine/plugins/UIRegistry';
import { PluginIFrameView } from './PluginIFrameView';
import { AutoGenPluginUI } from './AutoGenPluginUI';

interface PluginHostProps {
  trackId: string;
  pluginId: string;
  manifest: PluginManifest;
  params: Record<string, number>;
  onParamChange: (paramId: string, value: number) => void;
  onPresetLoad?: (presetId: string) => void;
}

export function PluginHost({
  trackId,
  pluginId,
  manifest,
  params,
  onParamChange,
  onPresetLoad,
}: PluginHostProps) {
  const contract: PluginUIContract = useMemo(
    () => ({ trackId, pluginId, manifest, params, onParamChange, onPresetLoad }),
    [trackId, pluginId, manifest, params, onParamChange, onPresetLoad]
  );

  const uiRegistration = getPluginUI(manifest.id);

  const handleParamChange = useCallback(
    (paramId: string, value: number) => {
      onParamChange(paramId, value);
    },
    [onParamChange]
  );

  if (uiRegistration?.iframeUrl) {
    return (
      <PluginIFrameView
        url={uiRegistration.iframeUrl}
        contract={contract}
        width={uiRegistration.width}
        height={uiRegistration.height}
      />
    );
  }

  if (uiRegistration?.component) {
    const UIComponent = uiRegistration.component;
    return (
      <UIComponent
        trackId={trackId}
        pluginId={pluginId}
        manifest={manifest}
        params={params}
        onParamChange={handleParamChange}
        onPresetLoad={onPresetLoad}
      />
    );
  }

  return (
    <AutoGenPluginUI
      trackId={trackId}
      pluginId={pluginId}
      manifest={manifest}
      params={params}
      onParamChange={handleParamChange}
    />
  );
}
