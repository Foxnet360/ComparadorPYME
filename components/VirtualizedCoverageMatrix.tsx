import React, { useRef, memo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { MatrixRow, MatrixCell, QuoteAnalysis } from '../types';
import { DeductibleBadge } from './DeductibleBadge';

interface VirtualizedMatrixProps {
  rows: MatrixRow[];
  quotes: QuoteAnalysis[];
  onCellClick?: (rowId: string, colIdx: number) => void;
  onCellDoubleClick?: (rowId: string, colIdx: number) => void;
}

const CoverageCell = memo(
  ({
    cell,
    rowLabel,
    _colIdx,
    onClick,
    onDoubleClick,
  }: {
    cell: MatrixCell;
    rowLabel: string;
    _colIdx: number;
    onClick?: () => void;
    onDoubleClick?: () => void;
  }) => {
    const isWinner = cell.isWinner;
    const excluded = cell.isExcluded;

    return (
      <div
        className={`px-6 py-3.5 text-sm text-center relative border-r border-slate-50 ${
          isWinner ? 'bg-amber-50/60 font-semibold text-amber-900' : ''
        } ${excluded ? 'text-red-500 italic bg-slate-50/20' : 'text-slate-800'}`}
        onClick={onClick}
        onDoubleClick={onDoubleClick}
      >
        {excluded ? (
          <span className="text-red-400 font-medium">No incluida</span>
        ) : (
          <span className={isWinner ? 'text-amber-950 font-bold' : 'text-slate-800 font-medium'}>
            {rowLabel === 'Deducible' && cell.value !== 'No aplica' ? (
              <DeductibleBadge deductible={cell.value} />
            ) : (
              cell.value
            )}
          </span>
        )}
      </div>
    );
  }
);

CoverageCell.displayName = 'CoverageCell';

export const VirtualizedCoverageMatrix: React.FC<VirtualizedMatrixProps> = ({
  rows,
  quotes: _quotes,
  onCellClick,
  onCellDoubleClick,
}) => {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 60,
    overscan: 5,
  });

  const virtualRows = virtualizer.getVirtualItems();

  return (
    <div
      ref={parentRef}
      className="overflow-auto"
      style={{ height: '600px' }}
      role="grid"
      aria-label="Matriz de coberturas virtualizada"
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualRows.map((virtualRow) => {
          const row = rows[virtualRow.index]!;
          const isHeader = row.type === 'header';
          const isSpacer = row.type === 'spacer';

          if (isSpacer) {
            return (
              <div
                key={row.id}
                role="row"
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
                className="bg-white h-4"
              >
                <div role="gridcell" className="py-2"></div>
              </div>
            );
          }

          if (isHeader) {
            return (
              <div
                key={row.id}
                role="row"
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
                className="bg-[#E6F0FA]/40 font-bold"
              >
                <div
                  role="gridcell"
                  className="px-6 py-3 text-xs md:text-sm text-blue-800 uppercase tracking-wide w-full"
                >
                  {row.label}
                </div>
              </div>
            );
          }

          return (
            <div
              key={row.id}
              role="row"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`,
              }}
              className="hover:bg-slate-50/70 transition-colors group flex"
            >
              {/* Concept Label */}
              <div
                role="gridcell"
                className="px-6 py-3.5 text-xs md:text-sm font-semibold text-slate-700 bg-[#F8FAFC] border-r border-slate-100 min-w-[220px] md:min-w-[280px]"
              >
                {row.label}
              </div>

              {/* Insurer Cells */}
              {row.cells.map((cell, colIdx) => (
                <CoverageCell
                  key={colIdx}
                  cell={cell}
                  rowLabel={row.label}
                  _colIdx={colIdx}
                  onClick={() => onCellClick?.(row.id, colIdx)}
                  onDoubleClick={() => onCellDoubleClick?.(row.id, colIdx)}
                />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default VirtualizedCoverageMatrix;
