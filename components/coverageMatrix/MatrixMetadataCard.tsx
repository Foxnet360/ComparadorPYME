import React from 'react';
import { Calendar } from 'lucide-react';
import { QuoteMetadata } from '../../types';
import { InsurerLogo } from '../common/InsurerLogo';

export interface MatrixMetadataCardProps {
  metadata?: QuoteMetadata[];
}

export const MatrixMetadataCard: React.FC<MatrixMetadataCardProps> = ({ metadata }) => {
  if (!metadata || metadata.length === 0) return null;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
      <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
        <Calendar className="text-blue-600" size={20} />
        <h3 className="font-bold text-slate-800 text-lg">Información del Riesgo & Metadatos</h3>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {metadata.map((meta, idx) => (
          <div
            key={idx}
            className="bg-slate-50 rounded-xl p-4 border border-slate-100 flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-3 border-b border-slate-200 pb-2">
                <div className="flex items-center gap-2">
                  <InsurerLogo insurerName={meta.insurer} size="xs" />
                  <span className="font-extrabold text-blue-800 text-sm">{meta.insurer}</span>
                </div>
                <span className="text-[10px] bg-blue-100 text-blue-700 font-bold px-2 py-0.5 rounded-full">
                  Extracción V2
                </span>
              </div>
              <div className="space-y-2 text-xs text-slate-600">
                {meta.cliente && (
                  <div className="flex justify-between">
                    <span className="font-medium text-slate-500">Cliente:</span>
                    <span className="font-semibold text-slate-800 text-right">{meta.cliente}</span>
                  </div>
                )}
                {meta.tipoSeguro && (
                  <div className="flex justify-between">
                    <span className="font-medium text-slate-500">Tipo de Seguro:</span>
                    <span className="font-semibold text-slate-800 text-right">
                      {meta.tipoSeguro}
                    </span>
                  </div>
                )}
                {meta.ubicacionRiesgo && (
                  <div className="flex justify-between">
                    <span className="font-medium text-slate-500">Ubicación del Riesgo:</span>
                    <span
                      className="font-semibold text-slate-800 text-right max-w-[150px] truncate"
                      title={meta.ubicacionRiesgo}
                    >
                      {meta.ubicacionRiesgo}
                    </span>
                  </div>
                )}
                {meta.anoConstruccion && (
                  <div className="flex justify-between">
                    <span className="font-medium text-slate-500">Año de Construcción:</span>
                    <span className="font-semibold text-slate-800 text-right">
                      {meta.anoConstruccion}
                    </span>
                  </div>
                )}
                {meta.pisos && (
                  <div className="flex justify-between">
                    <span className="font-medium text-slate-500">Pisos:</span>
                    <span className="font-semibold text-slate-800 text-right">{meta.pisos}</span>
                  </div>
                )}
                {meta.aliado && (
                  <div className="flex justify-between">
                    <span className="font-medium text-slate-500">Aliado:</span>
                    <span className="font-semibold text-slate-800 text-right">{meta.aliado}</span>
                  </div>
                )}
                {meta.actividadOcupacion && (
                  <div className="flex justify-between">
                    <span className="font-medium text-slate-500">Actividad/Ocupación:</span>
                    <span
                      className="font-semibold text-slate-800 text-right max-w-[150px] truncate"
                      title={meta.actividadOcupacion}
                    >
                      {meta.actividadOcupacion}
                    </span>
                  </div>
                )}
                {meta.documento && (
                  <div className="flex justify-between">
                    <span className="font-medium text-slate-500">Documento:</span>
                    <span className="font-semibold text-slate-800 text-right">
                      {meta.documento}
                    </span>
                  </div>
                )}
                {meta.vigencia && (
                  <div className="flex justify-between">
                    <span className="font-medium text-slate-500">Vigencia:</span>
                    <span className="font-semibold text-slate-800 text-right">{meta.vigencia}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
