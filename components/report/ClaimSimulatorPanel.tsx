import React, { useState, useMemo } from 'react';
import { Calculator, CheckCircle2, TrendingDown } from 'lucide-react';
import type { QuoteAnalysis, CoverageItem } from '../../types';

interface ClaimSimulatorPanelProps {
  quotes: QuoteAnalysis[];
}

const SMMLV_CURRENT = 1423500; // SMMLV 2025 COP canonical reference

const PRESET_AMOUNTS = [
  { label: '$10M COP', value: 10_000_000 },
  { label: '$50M COP', value: 50_000_000 },
  { label: '$100M COP', value: 100_000_000 },
  { label: '$250M COP', value: 250_000_000 },
];

export const ClaimSimulatorPanel: React.FC<ClaimSimulatorPanelProps> = ({ quotes }) => {
  const [claimAmount, setClaimAmount] = useState<number>(50_000_000);

  // Extract amparo básico / main deductible per quote
  const simulationResults = useMemo(() => {
    return quotes.map((q) => {
      // Find relevant coverage: prefer "Incendio" / "Amparo Básico" / "Daño Material" or quote.deductibles
      const coverageItem = q.coverages?.find((c: CoverageItem) => {
        const n = (c.name || '').toLowerCase();
        return (
          n.includes('básico') ||
          n.includes('incendio') ||
          n.includes('daño material') ||
          n.includes('edificio')
        );
      });

      const rawText =
        coverageItem?.deductibleStructure?.rawText ||
        coverageItem?.deductible ||
        q.deductibles ||
        '10% valor pérdida, mín. 5 SMMLV';

      const norm = coverageItem?.deductibleStructure?.normalized;

      let percentage = norm?.percentage ?? 0;
      let minCOP = norm?.minAmount ?? 0;
      let maxCOP = norm?.maxAmount ?? 0;

      // Heuristic fallback if not pre-normalized
      if (!norm) {
        const lower = rawText.toLowerCase();
        const isExempt =
          lower.includes('sin deducible') || lower.includes('exento') || lower === '0%';
        if (!isExempt) {
          const pctMatch = lower.match(/(\d+(?:[.,]\d+)?)\s*%/);
          if (pctMatch && pctMatch[1]) percentage = parseFloat(pctMatch[1].replace(',', '.'));

          const minMatch = lower.match(/(?:m[íi]n(?:imo)?\.?\s*(?:de)?)\s*(\d+(?:[.,]\d+)?)\s*(smmlv|uvt|\$)?/i);
          if (minMatch && minMatch[1]) {
            const val = parseFloat(minMatch[1].replace(/\./g, '').replace(',', '.'));
            const unit = (minMatch[2] || '').toLowerCase();
            minCOP = unit === 'smmlv' || (!unit && val <= 50) ? val * SMMLV_CURRENT : val;
          }

          const maxMatch = lower.match(/(?:m[áa]x(?:imo)?\.?|tope)\s*(?:de)?\s*(\d+(?:[.,]\d+)?)\s*(smmlv|uvt|\$)?/i);
          if (maxMatch && maxMatch[1]) {
            const val = parseFloat(maxMatch[1].replace(/\./g, '').replace(',', '.'));
            const unit = (maxMatch[2] || '').toLowerCase();
            maxCOP = unit === 'smmlv' || (!unit && val <= 200) ? val * SMMLV_CURRENT : val;
          }
        }
      }

      // Calculation
      let calculated = 0;
      if (percentage > 0) {
        calculated = claimAmount * (percentage / 100);
      }
      if (minCOP > 0 && calculated < minCOP) calculated = minCOP;
      if (maxCOP > 0 && calculated > maxCOP) calculated = maxCOP;

      const payableDeductible = Math.round(Math.min(calculated, claimAmount));
      const netIndemnification = Math.round(Math.max(0, claimAmount - payableDeductible));
      const effectivePercentage =
        claimAmount > 0 ? Number(((payableDeductible / claimAmount) * 100).toFixed(1)) : 0;

      return {
        insurerName: q.insurerName,
        rawText,
        payableDeductible,
        netIndemnification,
        effectivePercentage,
      };
    });
  }, [quotes, claimAmount]);

  // Find lowest deductible (best option)
  const sorted = [...simulationResults].sort(
    (a, b) => a.payableDeductible - b.payableDeductible
  );
  const bestInsurer = sorted[0]?.insurerName;
  const worstDeductible = sorted[sorted.length - 1]?.payableDeductible || 0;
  const bestDeductible = sorted[0]?.payableDeductible || 0;
  const savings = Math.max(0, worstDeductible - bestDeductible);

  const formatCOP = (val: number) => `$${Math.round(val).toLocaleString('es-CO')} COP`;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
              <Calculator size={20} />
            </div>
            <h3 className="text-lg font-bold text-slate-900">
              Simulador Interactivo de Siniestro (Deducibles)
            </h3>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Calculá en tiempo real el desembolso que asumiría el cliente ante una pérdida hipotética en Amparo Básico.
          </p>
        </div>

        {savings > 0 && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 flex items-center gap-2 text-emerald-800 text-xs font-semibold">
            <TrendingDown size={16} className="text-emerald-600" />
            <span>Ahorro máximo: {formatCOP(savings)} con {bestInsurer}</span>
          </div>
        )}
      </div>

      {/* Controls: Presets and Slider */}
      <div className="space-y-4 bg-slate-50 p-4 rounded-xl border border-slate-200/80">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <label htmlFor="claim-slider" className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
            Monto de Pérdida / Reclamo Simulado:
          </label>
          <div className="text-xl font-black text-indigo-700 font-mono">
            {formatCOP(claimAmount)}
          </div>
        </div>

        <input
          id="claim-slider"
          type="range"
          min={5_000_000}
          max={500_000_000}
          step={5_000_000}
          value={claimAmount}
          onChange={(e) => setClaimAmount(Number(e.target.value))}
          className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
        />

        <div className="flex flex-wrap gap-2 pt-1">
          {PRESET_AMOUNTS.map((p) => (
            <button
              key={p.value}
              onClick={() => setClaimAmount(p.value)}
              className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-all ${
                claimAmount === p.value
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Comparative Cards / Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {simulationResults.map((res) => {
          const isWinner = res.insurerName === bestInsurer;
          return (
            <div
              key={res.insurerName}
              className={`p-4 rounded-xl border transition-all ${
                isWinner
                  ? 'bg-gradient-to-b from-emerald-50/50 to-white border-emerald-300 ring-2 ring-emerald-500/20 shadow-sm'
                  : 'bg-white border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="flex justify-between items-start mb-3">
                <span className="font-bold text-slate-900 text-sm truncate max-w-[180px]">
                  {res.insurerName}
                </span>
                {isWinner ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                    <CheckCircle2 size={12} /> Menor Deducible
                  </span>
                ) : (
                  <span className="text-[11px] text-slate-500 font-mono">
                    {res.effectivePercentage}% pérdida
                  </span>
                )}
              </div>

              {/* Progress representation */}
              <div className="space-y-1 mb-4">
                <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden flex">
                  <div
                    style={{ width: `${Math.min(100, res.effectivePercentage)}%` }}
                    className={`h-full ${isWinner ? 'bg-emerald-500' : 'bg-amber-500'}`}
                  />
                  <div
                    style={{ width: `${Math.max(0, 100 - res.effectivePercentage)}%` }}
                    className="h-full bg-indigo-500"
                  />
                </div>
                <div className="flex justify-between text-[10px] text-slate-400">
                  <span>Asume Cliente ({res.effectivePercentage}%)</span>
                  <span>Indemniza Aseguradora</span>
                </div>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between items-center py-1 border-b border-slate-100">
                  <span className="text-slate-600">Deducible a pagar:</span>
                  <span className={`font-bold font-mono ${isWinner ? 'text-emerald-700' : 'text-slate-900'}`}>
                    {formatCOP(res.payableDeductible)}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-slate-100">
                  <span className="text-slate-600">Indemnización neta:</span>
                  <span className="font-bold font-mono text-indigo-700">
                    {formatCOP(res.netIndemnification)}
                  </span>
                </div>
                <div className="pt-1">
                  <p className="text-[11px] text-slate-500 line-clamp-2 italic" title={res.rawText}>
                    Regla: {res.rawText}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ClaimSimulatorPanel;
