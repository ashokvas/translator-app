'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';

export function UnicornBackground() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [stageTransform, setStageTransform] = useState<string>('translate(-50%, -50%) scale(1)');

  useEffect(() => {
    const STAGE_WIDTH = 1920;
    const STAGE_HEIGHT = 1080;
    const X_OFFSET_PCT = 8; // tweak this to shift the scene right

    const updateStageTransform = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;

      // Scale-to-cover so the 1920x1080 stage fills the hero background.
      const scale = Math.max(rect.width / STAGE_WIDTH, rect.height / STAGE_HEIGHT);
      const offsetX = (rect.width * X_OFFSET_PCT) / 100;

      // Center stage, then shift right, then scale.
      setStageTransform(`translate(-50%, -50%) translateX(${offsetX}px) scale(${scale})`);
    };

    updateStageTransform();

    const resizeObserver = new ResizeObserver(() => updateStageTransform());
    if (containerRef.current) resizeObserver.observe(containerRef.current);
    window.addEventListener('resize', updateStageTransform);

    // Load Unicorn Studio script once, then init.
    const ensureUnicornStudio = () => {
      if (window.UnicornStudio?.isInitialized) return;

      if (!window.UnicornStudio) window.UnicornStudio = { isInitialized: false };

      const existing = document.querySelector<HTMLScriptElement>(
        'script[src*="unicornStudio.umd.js"]'
      );

      const init = () => {
        const us = window.UnicornStudio ?? (window.UnicornStudio = { isInitialized: false });
        if (!us.isInitialized) {
          us.init?.();
          us.isInitialized = true;
        }
      };

      if (existing) {
        // Script tag already present; just init.
        init();
        return;
      }

      const script = document.createElement('script');
      script.src =
        'https://cdn.jsdelivr.net/gh/hiunicornstudio/unicornstudio.js@v2.0.1/dist/unicornStudio.umd.js';
      script.onload = init;
      (document.head || document.body).appendChild(script);
    };

    ensureUnicornStudio();

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateStageTransform);
    };
  }, []);

  const stageStyle = useMemo<CSSProperties>(() => {
    return {
      position: 'absolute',
      left: '50%',
      top: '50%',
      width: 1920,
      height: 1080,
      transform: stageTransform,
      transformOrigin: 'center',
      willChange: 'transform',
    };
  }, [stageTransform]);

  return (
    <div ref={containerRef} className="relative h-full w-full overflow-hidden pointer-events-none">
      <div style={stageStyle}>
        <div data-us-project="aCzfKbVycG4WMSZEeHGv" style={{ width: 1920, height: 1080 }} />
      </div>
    </div>
  );
}

// Add TypeScript declaration for UnicornStudio
declare global {
  interface Window {
    UnicornStudio?: {
      isInitialized: boolean;
      init?: () => void;
    };
  }
}
