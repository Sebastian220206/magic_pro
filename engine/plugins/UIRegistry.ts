import type { PluginManifest, PluginUIContract } from './manifest';
import type React from 'react';

export type PluginUIComponent = React.ComponentType<PluginUIContract>;

interface UIRegistration {
  component?: PluginUIComponent;
  iframeUrl?: string;
  width?: number;
  height?: number;
}

const uiMap = new Map<string, UIRegistration>();

export function registerPluginUI(
  pluginId: string,
  ui: PluginUIComponent,
  options?: { width?: number; height?: number }
): void {
  uiMap.set(pluginId, { component: ui, ...options });
}

export function registerPluginIframeUI(
  pluginId: string,
  iframeUrl: string,
  options?: { width?: number; height?: number }
): void {
  uiMap.set(pluginId, { iframeUrl, ...options });
}

export function getPluginUI(pluginId: string): UIRegistration | undefined {
  return uiMap.get(pluginId);
}

export function unregisterPluginUI(pluginId: string): void {
  uiMap.delete(pluginId);
}

export function createDefaultUIContract(
  trackId: string,
  pluginId: string,
  manifest: PluginManifest,
  params: Record<string, number>,
  onParamChange: (paramId: string, value: number) => void
): PluginUIContract {
  return { trackId, pluginId, manifest, params, onParamChange };
}
