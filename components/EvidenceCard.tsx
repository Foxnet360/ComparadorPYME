import React, { useState } from 'react';
import { BookOpen, ChevronDown, ChevronUp, FileText, AlertCircle, BadgeCheck } from 'lucide-react';
import { Evidence } from '../types';

interface EvidenceCardProps {
  evidence: Evidence[];
  analysisType: 'rag_enriched' | 'quote_based';
}

export const EvidenceCard: React.FC<EvidenceCardProps> = ({ evidence, analysisType }) => {
  const [expanded, setExpanded] = useState(false);
  
  if (analysisType === 'quote_based' || evidence.length === 0) {
    return (
      <div className="mt-3 pt-3 border-t border-slate-200/60">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <FileText size={14} />
          <span>Análisis basado en datos de cotización</span>
        </div>
      </div>
    );
  }
  
  return (
    <div className="mt-3 pt-3 border-t border-slate-200/60">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 text-xs font-medium text-indigo-600 hover:text-indigo-800 transition-colors"
      >
        {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        <BadgeCheck size={14} />
        <span>{evidence.length} evidencia{evidence.length > 1 ? 's' : ''} de clausulado</span>
      </button>
      
      {expanded && (
        <div className="mt-3 space-y-3">
          {evidence.map((item, idx) => (
            <div key={idx} className="bg-slate-50 rounded-lg p-3 border border-slate-200 text-sm">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <BookOpen size={14} className="text-indigo-600" />
                  <span className="font-medium text-slate-700">{item.insurerName}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500">Pág. {item.pageNumber}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    item.similarityScore >= 0.8 ? 'bg-green-100 text-green-700' :
                    item.similarityScore >= 0.6 ? 'bg-yellow-100 text-yellow-700' :
                    'bg-slate-100 text-slate-600'
                  }`}>
                    {Math.round(item.similarityScore * 100)}% match
                  </span>
                </div>
              </div>
              <blockquote className="text-slate-600 italic border-l-2 border-indigo-300 pl-3">
                "{item.content}"
              </blockquote>
              <div className="mt-2 text-xs text-slate-400">
                Sección: {item.sectionType}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default EvidenceCard;
