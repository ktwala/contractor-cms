import React from 'react';

const shimmer: React.CSSProperties = {
  background: 'linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%)',
  backgroundSize: '200% 100%',
  animation: 'shimmer 1.5s infinite',
  borderRadius: 8,
};

export function SkeletonLine({ width = '100%', height = 16 }: { width?: string | number; height?: number }) {
  return <div style={{ ...shimmer, width, height, marginBottom: 8 }} />;
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div>
      <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
        {Array.from({ length: 7 }).map((_, i) => (
          <SkeletonLine key={i} width={i === 0 ? 80 : 100} height={14} />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} style={{ display: 'flex', gap: 16, marginBottom: 10 }}>
          {Array.from({ length: 7 }).map((_, i) => (
            <SkeletonLine key={i} width={i === 0 ? 80 : 100} height={12} />
          ))}
        </div>
      ))}
      <style>{`@keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }`}</style>
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid #e2e8f0',
        borderRadius: 12,
        padding: 20,
      }}
    >
      <SkeletonLine width="60%" height={18} />
      <SkeletonLine width="40%" height={14} />
      <SkeletonLine width="80%" height={14} />
      <style>{`@keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }`}</style>
    </div>
  );
}
