import { useCallback, useRef } from 'react';

interface UseGridKeyboardNavigationProps {
  rowCount: number;
  colCount: number;
  onCellFocus?: (row: number, col: number) => void;
  onCellActivate?: (row: number, col: number) => void;
}

/**
 * Hook para navegación por teclado en grids ARIA
 * Implementa navegación con flechas, Enter para activar, Escape para salir
 */
export function useGridKeyboardNavigation({
  rowCount,
  colCount,
  onCellFocus,
  onCellActivate,
}: UseGridKeyboardNavigationProps) {
  const focusedCellRef = useRef<{ row: number; col: number } | null>(null);
  const gridRef = useRef<HTMLElement | null>(null);

  const focusCell = useCallback((row: number, col: number) => {
    if (row < 0 || row >= rowCount || col < 0 || col >= colCount) return;
    
    focusedCellRef.current = { row, col };
    
    // Encontrar y enfocar el elemento DOM
    const grid = gridRef.current;
    if (grid) {
      const cells = grid.querySelectorAll('[role="gridcell"]');
      const index = row * colCount + col;
      if (cells[index]) {
        (cells[index] as HTMLElement).focus();
        onCellFocus?.(row, col);
      }
    }
  }, [rowCount, colCount, onCellFocus]);

  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    const current = focusedCellRef.current;
    if (!current) return;

    const { row, col } = current;

    switch (event.key) {
      case 'ArrowRight':
        event.preventDefault();
        focusCell(row, Math.min(col + 1, colCount - 1));
        break;
      case 'ArrowLeft':
        event.preventDefault();
        focusCell(row, Math.max(col - 1, 0));
        break;
      case 'ArrowDown':
        event.preventDefault();
        focusCell(Math.min(row + 1, rowCount - 1), col);
        break;
      case 'ArrowUp':
        event.preventDefault();
        focusCell(Math.max(row - 1, 0), col);
        break;
      case 'Enter':
        event.preventDefault();
        onCellActivate?.(row, col);
        break;
      case 'Escape':
        event.preventDefault();
        // Salir del grid
        if (gridRef.current) {
          gridRef.current.blur();
        }
        focusedCellRef.current = null;
        break;
      case 'Home':
        event.preventDefault();
        if (event.ctrlKey) {
          focusCell(0, 0);
        } else {
          focusCell(row, 0);
        }
        break;
      case 'End':
        event.preventDefault();
        if (event.ctrlKey) {
          focusCell(rowCount - 1, colCount - 1);
        } else {
          focusCell(row, colCount - 1);
        }
        break;
    }
  }, [rowCount, colCount, focusCell, onCellActivate]);

  const setGridRef = useCallback((element: HTMLElement | null) => {
    gridRef.current = element;
  }, []);

  return {
    gridRef: setGridRef,
    handleKeyDown,
    focusCell,
    focusedCell: focusedCellRef.current,
  };
}
