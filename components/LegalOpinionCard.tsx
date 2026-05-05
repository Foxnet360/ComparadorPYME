import React from 'react';
import { BookOpen, Scale, Lightbulb, Quote } from 'lucide-react';

interface LegalOpinionCardProps {
  coverageName: string;
  riskScenario: string;
  clauseInterpretation: string;
  recommendation: string;
  citations: Array<{
    text: string;
    section: string;
    pageNumber: number;
  }>;
  confidence: number;
}

export const LegalOpinionCard: React.FC<LegalOpinionCardProps> = ({
  coverageName,
  riskScenario,
  clauseInterpretation,
  recommendation,
  citations,
  confidence
}) => {
  return (
    <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
      <div className="bg-indigo-50 px-4 py-3 border-b border-indigo-100">
        <div className="flex items-center gap-2">
          <Scale className="text-indigo-600" size={18} />
          <h3 className="font-bold text-indigo-900">Opinión Legal: {coverageName}</h3>
        </div>
        <div className="mt-1 flex items-center gap-2">
          <div className="flex-1 h-1.5 bg-white rounded-full">
            <div
              className="h-full bg-indigo-500 rounded-full"
              style={{ width: `${confidence}%` }}
            />
          </div>
          <span className="text-xs text-indigo-600 font-medium">{confidence}% confianza</span>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Risk Scenario */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Lightbulb className="text-amber-500" size={16} />
            <h4 className="text-sm font-medium text-slate-700">Escenario de Riesgo</h4>
          </div>
          <p className="text-sm text-slate-600 pl-6">{riskScenario}</p>
        </div>

        {/* Clause Interpretation */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <BookOpen className="text-indigo-500" size={16} />
            <h4 className="text-sm font-medium text-slate-700">Interpretación del Clausulado</h4>
          </div>
          <p className="text-sm text-slate-600 pl-6">{clauseInterpretation}</p>
        </div>

        {/* Recommendation */}
        <div className="bg-green-50 rounded-lg p-3 border border-green-200">
          <h4 className="text-sm font-medium text-green-800 mb-1">Recomendación</h4>
          <p className="text-sm text-green-700">{recommendation}</p>
        </div>

        {/* Citations */}
        {citations.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Quote className="text-slate-400" size={16} />
              <h4 className="text-sm font-medium text-slate-700">Citas del Clausulado</h4>
            </div>
            <div className="space-y-2">
              {citations.map((citation, idx) => (
                <blockquote
                  key={idx}
                  className="text-sm text-slate-600 border-l-2 border-indigo-300 pl-3 italic"
                >
                  "{citation.text}"
                  <cite className="block text-xs text-slate-400 mt-1 not-italic">
                    {citation.section}, Pág. {citation.pageNumber}
                  </cite>
                </blockquote>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LegalOpinionCard;
