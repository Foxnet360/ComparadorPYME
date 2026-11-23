import React from 'react';

interface MissingReportFallbackProps {
  onBackToDashboard: () => void;
  onNewAudit: () => void;
}

export const MissingReportFallback: React.FC<MissingReportFallbackProps> = ({
  onBackToDashboard,
  onNewAudit,
}) => (
  <div className="max-w-lg mx-auto my-16 bg-white border border-slate-200 rounded-2xl p-8 text-center shadow-sm">
    <h2 className="text-lg font-bold text-slate-900 mb-2">
      No hay un informe cargado en esta sesión
    </h2>
    <p className="text-sm text-slate-600 mb-6">
      Selecciona un análisis desde el dashboard o inicia una nueva auditoría para generar un
      informe comparativo.
    </p>
    <div className="flex flex-wrap justify-center gap-3">
      <button
        type="button"
        onClick={onBackToDashboard}
        className="px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800"
      >
        Ir al Dashboard
      </button>
      <button
        type="button"
        onClick={onNewAudit}
        className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 text-sm font-medium hover:bg-slate-50"
      >
        Nueva Auditoría
      </button>
    </div>
  </div>
);
