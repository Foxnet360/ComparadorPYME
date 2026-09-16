import React, { useEffect, useRef, useState } from 'react';

interface DeferredChartProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Mounts chart children only once the wrapper has measurable, non-zero
 * dimensions.
 *
 * ResponsiveContainer logs "The width(-1) and height(-1) of chart should be
 * greater than 0" whenever its parent renders with no box (dashboard tabs
 * mounting while hidden, first paint before layout). Deferring the mount
 * silences that warning and skips a wasted render pass; the ResizeObserver
 * mounts the chart as soon as the container becomes visible and sized.
 */
const DeferredChart: React.FC<DeferredChartProps> = ({ children, className }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || ready) return;

    const measure = () => {
      const { width, height } = el.getBoundingClientRect();
      if (width > 0 && height > 0) {
        setReady(true);
      }
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [ready]);

  return (
    <div
      ref={ref}
      className={className}
      style={{ width: '100%', height: '100%', minHeight: '200px', minWidth: '100px' }}
    >
      {ready ? children : null}
    </div>
  );
};

export default DeferredChart;
