import React, { memo } from 'react';
import { Pin, Trophy, Eye, AlertCircle, AlertTriangle, Loader2, ChevronDown } from 'lucide-react';
import { MatrixCell, MatrixRow, QuoteAnalysis } from '../../types';
import { DeductibleBadge } from '../DeductibleBadge';
import { InlineNoteEditor } from '../InlineNoteEditor';
import { formatPercentage } from '../../utils/formatCurrency';
import {
  formatMatrixValue,
  getConfidenceBadgeColor,
  getConfidenceText,
  isLowConfidence,
} from './matrixFormatters';
import { DiscrepancyDropdown } from './DiscrepancyDropdown';
import { ExtractionAuditPopover } from './ExtractionAuditPopover';

// CoverageCell memoizado para optimizar re-renders
export const CoverageCell = memo(
  ({
    cell,
    rowLabel,
    isWinner,
    excluded,
    lowConfidence,
    needsReview,
    isSaving,
    onOpenPdf: _onOpenPdf,
    onOpenCorrection: _onOpenCorrection,
    onDoubleClick,
    hasNote,
  }: {
    cell: MatrixCell;
    rowLabel: string;
    isWinner: boolean;
    excluded: boolean;
    lowConfidence: boolean;
    needsReview: boolean;
    isSaving: boolean;
    onOpenPdf?: () => void;
    onOpenCorrection?: () => void;
    onDoubleClick?: () => void;
    hasNote?: boolean;
  }) => {
    return (
      <div
        className={`relative ${
          isWinner ? 'bg-amber-50/60 font-semibold text-amber-900 border border-amber-200/50' : ''
        } ${excluded ? 'text-red-500 italic bg-slate-50/20' : 'text-slate-800'} ${
          lowConfidence ? 'bg-yellow-50/40 border-2 border-yellow-400/60 shadow-sm' : ''
        } ${needsReview ? 'ring-2 ring-red-300/50 ring-inset' : ''} ${
          isSaving ? 'opacity-70' : ''
        }`}
        onDoubleClick={onDoubleClick}
      >
        {/* Note indicator */}
        {hasNote && (
          <span className="absolute top-1 right-1 text-blue-500" title="Tiene nota consultiva">
            <Pin size={12} />
          </span>
        )}

        {/* Winner trophy */}
        {isWinner && !lowConfidence && (
          <span className="absolute top-1 left-1 text-amber-500" title="Condición favorable">
            <Trophy size={12} />
          </span>
        )}

        <div className="flex flex-col items-center justify-center gap-1.5">
          {excluded ? (
            <span className="text-red-400 font-medium">No incluida</span>
          ) : (
            <span
              className={`${isWinner ? 'text-amber-950 font-bold' : 'text-slate-800 font-medium'}`}
            >
              {rowLabel === 'Deducible' && cell.value !== 'No aplica' ? (
                <DeductibleBadge deductible={cell.value} />
              ) : (
                formatMatrixValue(cell.value)
              )}
            </span>
          )}
        </div>
      </div>
    );
  }
);

CoverageCell.displayName = 'CoverageCell';

export interface MatrixDataCellProps {
  cell: MatrixCell;
  row: MatrixRow;
  colIdx: number;
  quote?: QuoteAnalysis;
  viewMode: 'client' | 'technical';
  isPinned: boolean;
  isHiddenByPinning: boolean;
  isSaving: boolean;
  cellNote?: { content?: string } | null;
  isEditingNote: boolean;
  isHovered: boolean;
  isDropdownOpen: boolean;
  dropdownRef: React.RefObject<HTMLDivElement | null>;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onDoubleClick: () => void;
  onSaveNote: (content: string) => void;
  onCancelNote: () => void;
  onOpenPdfEvidence?: (cell: MatrixCell, quote: QuoteAnalysis) => void;
  onToggleDropdown: () => void;
  onResolveDiscrepancy: (selectedCategory: string) => void;
}

export const MatrixDataCell: React.FC<MatrixDataCellProps> = ({
  cell,
  row,
  colIdx,
  quote,
  viewMode,
  isPinned: _isPinned,
  isHiddenByPinning,
  isSaving,
  cellNote,
  isEditingNote,
  isHovered,
  isDropdownOpen,
  dropdownRef,
  onMouseEnter,
  onMouseLeave,
  onDoubleClick,
  onSaveNote,
  onCancelNote,
  onOpenPdfEvidence,
  onToggleDropdown,
  onResolveDiscrepancy,
}) => {
  if (isHiddenByPinning) return null;

  const cellId = `${row.id}-${colIdx}`;
  const isWinner = cell.isWinner;
  const excluded = cell.isExcluded;
  const hasDetails =
    cell.confidence !== undefined ||
    cell.pageNumber !== undefined ||
    cell.notes;
  const lowConfidence = isLowConfidence(cell.confidence);
  const needsReview = cell.needsHumanReview;

  if (isEditingNote) {
    return (
      <td
        role="gridcell"
        tabIndex={0}
        className="relative p-0"
        style={{ height: '150px' }}
      >
        <InlineNoteEditor
          cellId={cellId}
          initialContent={cellNote?.content || ''}
          onSave={(_id, content) => onSaveNote(content)}
          onCancel={onCancelNote}
        />
      </td>
    );
  }

  const cellClass = `px-6 py-3.5 text-sm align-middle text-center relative border-r border-slate-50 transition-all cursor-pointer group/cell ${
    isWinner
      ? 'bg-amber-50/60 font-semibold text-amber-900 border border-amber-200/50'
      : ''
  } ${
    excluded
      ? 'text-slate-400 italic bg-slate-100/60 line-through decoration-slate-400'
      : 'text-slate-800'
  } ${
    lowConfidence
      ? 'bg-yellow-50/40 border-2 border-yellow-400/60 shadow-sm'
      : ''
  } ${needsReview ? 'ring-2 ring-red-300/50 ring-inset' : ''} ${
    isSaving ? 'opacity-70' : ''
  } hover:ring-1 hover:ring-blue-400 hover:ring-inset`;

  return (
    <td
      role="gridcell"
      tabIndex={0}
      className={cellClass}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onDoubleClick={onDoubleClick}
    >
      {/* Note indicator */}
      {cellNote && (
        <span
          className="absolute top-1 right-2 text-blue-500 hover:scale-110 transition-transform cursor-help"
          title={`Nota: ${cellNote.content?.substring(0, 50) || ''}...`}
        >
          <Pin size={12} />
        </span>
      )}

      {/* Hover Audit Affordance Hint (Double Click Prompt) */}
      {!cellNote && (
        <span
          className="absolute top-1 right-1.5 text-slate-300 group-hover/cell:text-blue-500 opacity-0 group-hover/cell:opacity-100 transition-all text-[10px] pointer-events-none"
          title="Doble clic para ver en PDF o agregar nota"
        >
          🔍
        </span>
      )}

      {/* Confidence indicator */}
      {viewMode === 'technical' && cell.confidence !== undefined && (
        <span
          className={`absolute top-1 left-1 w-2.5 h-2.5 rounded-full border ${getConfidenceBadgeColor(cell.confidence)} cursor-help`}
          title={`Confianza: ${formatPercentage(cell.confidence, 0)} (${getConfidenceText(cell.confidence)})`}
        />
      )}

      {/* Winner trophy */}
      {isWinner && (viewMode === 'technical' ? !lowConfidence : true) && (
        <span
          className="absolute top-1 right-2 text-amber-500 hover:scale-110 transition-transform cursor-help"
          title="Condición / Valor favorable"
        >
          🏆
        </span>
      )}

      {/* Low Confidence / Needs Review Alert */}
      {viewMode === 'technical' && (lowConfidence || needsReview) && (
        <span
          className="absolute top-1 right-2 text-yellow-600 hover:scale-110 transition-transform cursor-help z-10"
          title={
            needsReview
              ? 'Requiere validación humana - Doble agente en discrepancia'
              : 'Confianza baja en mapeo ontológico'
          }
        >
          <AlertCircle size={14} />
        </span>
      )}

      {/* Cell Value Rendering */}
      <div className="flex flex-col items-center justify-center gap-1.5">
        {excluded ? (
          <span className="text-slate-400 font-medium">No incluida</span>
        ) : (
          <span
            className={`${isWinner ? 'text-amber-950 font-bold' : 'text-slate-800 font-medium'}`}
          >
            {row.label === 'Deducible' && cell.value !== 'No aplica' ? (
              <DeductibleBadge deductible={cell.value} />
            ) : (
              formatMatrixValue(cell.value)
            )}
          </span>
        )}

        {/* Technical Details Popover Trigger (Only in Technical ViewMode) */}
        {viewMode === 'technical' && hasDetails && (
          <div className="flex items-center gap-1 mt-1 text-[10px] text-slate-400">
            {(cell.calculatedPage !== undefined ||
              cell.pageNumber !== undefined) && quote && (
              <button
                type="button"
                onClick={() => onOpenPdfEvidence?.(cell, quote)}
                className="bg-blue-50 text-blue-600 hover:bg-blue-100 px-1.5 py-0.5 rounded border border-blue-200 flex items-center gap-0.5 transition-colors cursor-pointer"
                title="Ver evidencia en PDF"
              >
                <Eye size={10} />
                Pág. {cell.calculatedPage || cell.pageNumber}
              </button>
            )}
            {cell.confidence !== undefined && (
              <span
                className={`px-1.5 py-0.5 rounded border ${getConfidenceBadgeColor(cell.confidence)}`}
              >
                {getConfidenceText(cell.confidence)}
              </span>
            )}
            {needsReview && (
              <span className="bg-red-50 text-red-600 px-1.5 py-0.5 rounded border border-red-200 flex items-center gap-0.5">
                <AlertTriangle size={10} />
                Revisar
              </span>
            )}
          </div>
        )}
      </div>

      {/* Inline Discrepancy Resolution Dropdown */}
      {viewMode === 'technical' &&
        needsReview &&
        isDropdownOpen && (
          <DiscrepancyDropdown
            dropdownRef={dropdownRef}
            onSelect={onResolveDiscrepancy}
            onClose={onToggleDropdown}
          />
        )}

      {/* Trigger button for dropdown */}
      {viewMode === 'technical' && needsReview && (
        <button
          type="button"
          onClick={onToggleDropdown}
          disabled={isSaving}
          className="absolute bottom-1 right-1 text-[10px] text-yellow-700 bg-yellow-100 hover:bg-yellow-200 disabled:opacity-50 px-1.5 py-0.5 rounded border border-yellow-300 transition-colors flex items-center gap-0.5 z-10 cursor-pointer"
        >
          {isSaving ? (
            <Loader2 size={10} className="animate-spin" />
          ) : (
            <ChevronDown size={10} />
          )}
          {isSaving ? 'Guardando...' : 'Corregir'}
        </button>
      )}

      {/* Premium Technical Hover Card Popover */}
      {viewMode === 'technical' && isHovered && hasDetails && (
        <ExtractionAuditPopover cell={cell} needsReview={Boolean(needsReview)} />
      )}
    </td>
  );
};
