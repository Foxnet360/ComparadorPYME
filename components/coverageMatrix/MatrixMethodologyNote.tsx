import React from 'react';
import { Info } from 'lucide-react';

export interface MatrixMethodologyNoteProps {
  viewMode: 'client' | 'technical';
}

export const MatrixMethodologyNote: React.FC<MatrixMethodologyNoteProps> = ({ viewMode }) => {
  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-inner">
      <div className="flex items-start gap-3">
        <Info className="text-blue-600 mt-0.5 flex-shrink-0" size={16} />
        <div className="text-xs text-slate-600 leading-relaxed">
          {viewMode === 'client' ? (
            <>
              <span className="font-semibold text-slate-800">Nota:</span> La correspondencia en esta
              matriz horizontal ha sido alineada por nuestro motor de análisis. El contenido
              coincide de manera exacta con el reporte de cotizaciones.
            </>
          ) : (
            <>
              <span className="font-semibold text-slate-800">Nota técnica:</span> La correspondencia
              en esta matriz horizontal ha sido alineada determinísticamente por nuestro
              transformador. El contenido coincide de manera exacta y paritaria con el reporte Excel
              monocromático de 3 pestañas.
            </>
          )}
        </div>
      </div>

      {viewMode === 'technical' && (
        <div className="flex items-center gap-2 text-[11px] text-slate-500 bg-white px-3 py-1.5 rounded-lg border border-slate-200 whitespace-nowrap self-start md:self-auto">
          <span>
            💡 <strong>Tip:</strong> Doble clic en cualquier celda para contrastar con el PDF
            original o añadir notas
          </span>
        </div>
      )}
    </div>
  );
};
