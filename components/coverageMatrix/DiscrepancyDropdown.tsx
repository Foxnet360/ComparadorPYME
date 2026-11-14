import React from 'react';
import { AlertTriangle, Check } from 'lucide-react';
import { PLANTILLA_ITEMS } from '../../constants';

interface DiscrepancyDropdownProps {
  dropdownRef: React.RefObject<HTMLDivElement | null>;
  onSelect: (category: string) => void;
  onClose: () => void;
}

export const DiscrepancyDropdown: React.FC<DiscrepancyDropdownProps> = ({
  dropdownRef,
  onSelect,
  onClose,
}) => {
  return (
    <div
      ref={dropdownRef}
      className="absolute left-1/2 -translate-x-1/2 top-full mt-2 w-80 bg-white rounded-xl shadow-2xl z-50 border border-slate-200 overflow-hidden"
    >
      <div className="bg-amber-50 px-4 py-2.5 border-b border-amber-200 flex items-center gap-2">
        <AlertTriangle size={14} className="text-amber-600" />
        <span className="text-xs font-bold text-amber-800">Resolver Discrepancia Ontológica</span>
      </div>
      <div className="p-3 max-h-64 overflow-y-auto">
        <p className="text-[11px] text-slate-500 mb-2">
          Seleccione la categoría canónica correcta:
        </p>
        {PLANTILLA_ITEMS.map((item, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => onSelect(item)}
            className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 rounded-lg transition-colors flex items-center justify-between group cursor-pointer"
          >
            <span>{item}</span>
            <Check
              size={12}
              className="text-green-600 opacity-0 group-hover:opacity-100 transition-opacity"
            />
          </button>
        ))}
      </div>
      <div className="px-3 py-2 bg-slate-50 border-t border-slate-100">
        <button
          type="button"
          onClick={onClose}
          className="w-full text-center text-[11px] text-slate-500 hover:text-slate-700 py-1 cursor-pointer"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
};
