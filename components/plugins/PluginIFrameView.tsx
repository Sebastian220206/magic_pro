'use client';

import React, { useRef, useEffect } from 'react';
import type { PluginUIContract } from '@/engine/plugins/manifest';

interface PluginIFrameViewProps {
  url: string;
  contract: PluginUIContract;
  width?: number;
  height?: number;
}

export function PluginIFrameView({ url, contract, width, height }: PluginIFrameViewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) return;
      if (event.data?.type === 'param_change') {
        contract.onParamChange(event.data.paramId, event.data.value);
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [contract]);

  useEffect(() => {
    iframeRef.current?.contentWindow?.postMessage(
      { type: 'init', contract },
      '*'
    );
  }, [contract]);

  useEffect(() => {
    iframeRef.current?.contentWindow?.postMessage(
      { type: 'params_update', params: contract.params },
      '*'
    );
  }, [contract.params]);

  return (
    <iframe
      ref={iframeRef}
      src={url}
      style={{
        width: width || 400,
        height: height || 300,
        border: 'none',
        background: 'transparent',
      }}
      title={`Plugin: ${contract.manifest.name}`}
      sandbox="allow-scripts allow-same-origin"
    />
  );
}
