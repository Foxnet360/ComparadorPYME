import React, { useState, useEffect, useCallback } from 'react';
import { Upload, FileText, X, BookOpen } from 'lucide-react';
import DomainSelector, { InsuranceDomain } from './DomainSelector';

interface FileUploaderProps {
  files: File[];
  onFilesSelected: (files: File[]) => void;
  onRemoveFile: (index: number) => void;
  disabled?: boolean;
  title?: string;
  description?: string;
  variant?: 'primary' | 'secondary';
  icon?: React.ReactNode;
  domain?: InsuranceDomain;
  onDomainChange?: (domain: InsuranceDomain) => void;
  showDomainSelector?: boolean;
  onFocusClientSelection?: () => void;
}

interface DomainSuggestion {
  domain: InsuranceDomain;
  label: string;
  matchedKeyword: string;
}

const DOMAIN_KEYWORD_RULES: Array<{
  domain: InsuranceDomain;
  label: string;
  keywords: string[];
}> = [
  {
    domain: 'autos',
    label: 'Seguro de Autos',
    keywords: ['auto', 'automovil', 'vehicul', 'placa', 'chasis', 'flota', 'fasecolda', 'liviano', 'pesado'],
  },
  {
    domain: 'copropiedades',
    label: 'Copropiedades',
    keywords: ['copropiedad', 'ley 675', 'conjunto', 'edificio', 'areas comunes', 'zonas comunes', 'ph '],
  },
  {
    domain: 'salud',
    label: 'Salud / Medicina Prepagada',
    keywords: ['salud', 'prepagada', 'medicina', 'res 244', 'hospitaliz', 'ambulatori'],
  },
  {
    domain: 'vida_grupo',
    label: 'Vida Grupo / Colectivo',
    keywords: ['vida grupo', 'vida colectiv', 'invalidez', 'sobrevivencia', 'amparos adicionales'],
  },
  {
    domain: 'cumplimiento',
    label: 'Cumplimiento y Fianzas',
    keywords: ['cumplimiento', 'seriedad', 'anticipo', 'estatal', 'ley 80', 'fianza', 'garantia unica'],
  },
  {
    domain: 'transporte',
    label: 'Transporte de Mercancías',
    keywords: ['transporte', 'mercancia', 'carga', 'flete', 'despacho', 'incoterm'],
  },
  {
    domain: 'hogar',
    label: 'Seguro de Hogar',
    keywords: ['hogar', 'habitacion', 'vivienda', 'enseres', 'casa'],
  },
  {
    domain: 'equipo_maquinaria',
    label: 'Maquinaria y Equipo',
    keywords: ['maquinaria', 'equipo amarillo', 'rotura', 'contratista', 'c.co 1083'],
  },
  {
    domain: 'casco_embarcacion',
    label: 'Casco Embarcación',
    keywords: ['embarcacion', 'casco', 'maritimo', 'fluvial', 'dimar', 'institute time'],
  },
];

const detectSuggestedDomain = (
  fileList: File[],
  currentDomain: InsuranceDomain
): DomainSuggestion | null => {
  for (const file of fileList) {
    const nameLower = file.name.toLowerCase();
    for (const rule of DOMAIN_KEYWORD_RULES) {
      if (rule.domain === currentDomain) continue;
      for (const kw of rule.keywords) {
        if (nameLower.includes(kw)) {
          return {
            domain: rule.domain,
            label: rule.label,
            matchedKeyword: kw,
          };
        }
      }
    }
  }
  return null;
};

const FileUploader: React.FC<FileUploaderProps> = ({
  files,
  onFilesSelected,
  onRemoveFile,
  disabled,
  title = 'Sube tus archivos',
  description = 'Arrastra y suelta documentos aquí',
  variant = 'primary',
  icon,
  domain: propDomain,
  onDomainChange,
  showDomainSelector,
  onFocusClientSelection: _onFocusClientSelection,
}) => {
  const [domain, setDomain] = useState<InsuranceDomain>(propDomain || 'pyme');
  const [suggestion, setSuggestion] = useState<DomainSuggestion | null>(null);

  useEffect(() => {
    if (propDomain !== undefined) {
      setDomain(propDomain);
    }
  }, [propDomain]);

  const handleDomainChange = (newDomain: InsuranceDomain) => {
    setDomain(newDomain);
    setSuggestion(null);
    if (onDomainChange) {
      onDomainChange(newDomain);
    }
  };

  const handleFilesAdded = useCallback(
    (newFiles: File[]) => {
      onFilesSelected(newFiles);
      const detected = detectSuggestedDomain(newFiles, domain);
      if (detected) {
        setSuggestion(detected);
      }
    },
    [domain, onFilesSelected]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (disabled) return;
      const droppedFiles = Array.from(e.dataTransfer.files) as File[];
      const validFiles = droppedFiles.filter(
        (f) => f.type.startsWith('image/') || f.type === 'application/pdf'
      );
      if (validFiles.length > 0) {
        handleFilesAdded(validFiles);
      }
    },
    [handleFilesAdded, disabled]
  );

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && !disabled) {
      const selectedFiles = Array.from(e.target.files);
      handleFilesAdded(selectedFiles);
    }
  };

  const isPrimary = variant === 'primary';
  const borderColor = isPrimary
    ? 'border-indigo-300 hover:border-indigo-500'
    : 'border-slate-300 hover:border-slate-400';
  const bgColor = isPrimary ? 'hover:bg-indigo-50' : 'hover:bg-slate-50';
  const iconColor = isPrimary ? 'text-indigo-600' : 'text-slate-600';
  const iconBg = isPrimary ? 'bg-indigo-100' : 'bg-slate-100';

  const shouldDisplayDomainSelector = showDomainSelector ?? false;

  return (
    <div className="w-full h-full flex flex-col space-y-4">
      {shouldDisplayDomainSelector && (
        <DomainSelector selectedDomain={domain} onChange={handleDomainChange} disabled={disabled} />
      )}

      {/* Smart Domain Sniffing Alert Banner (UX Hallazgo 4) */}
      {suggestion && (
        <div className="bg-amber-50 border border-amber-300 rounded-xl p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2 duration-300 shadow-sm">
          <div className="flex items-start gap-2.5">
            <span className="text-lg">💡</span>
            <div className="text-xs">
              <span className="font-bold text-amber-900 block">
                ¿Estas cotizaciones corresponden al ramo "{suggestion.label}"?
              </span>
              <span className="text-amber-800">
                Detectamos el patrón <em>"{suggestion.matchedKeyword}"</em> en los archivos. Podés cambiar el ramo ahora para aplicar la taxonomía especializada.
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
            <button
              type="button"
              onClick={() => handleDomainChange(suggestion.domain)}
              className="text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white px-3 py-1.5 rounded-lg transition-colors shadow-xs cursor-pointer"
            >
              Cambiar a {suggestion.label}
            </button>
            <button
              type="button"
              onClick={() => setSuggestion(null)}
              className="text-xs text-amber-700 hover:text-amber-900 px-2 py-1.5 rounded-lg hover:bg-amber-100 transition-colors cursor-pointer"
            >
              Ignorar
            </button>
          </div>
        </div>
      )}

      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors flex-grow flex flex-col items-center justify-center ${
          disabled
            ? 'opacity-50 cursor-not-allowed border-slate-200'
            : `${borderColor} ${bgColor} cursor-pointer`
        }`}
      >
        <input
          type="file"
          multiple
          accept="image/*,application/pdf"
          onChange={handleFileInput}
          className="hidden"
          id={`file-upload-${title}`}
          disabled={disabled}
        />
        <label
          htmlFor={`file-upload-${title}`}
          className="cursor-pointer flex flex-col items-center w-full"
        >
          <div className={`${iconBg} p-3 rounded-full mb-3`}>
            {icon || <Upload className={`w-6 h-6 ${iconColor}`} />}
          </div>
          <h3 className="text-base font-semibold text-slate-700">{title}</h3>
          <p className="text-slate-500 mt-1 text-xs">{description}</p>
        </label>
      </div>

      {files.length > 0 && (
        <div className="mt-4 space-y-2 max-h-[150px] overflow-y-auto pr-1 scrollbar-thin">
          {files.map((file, idx) => (
            <div
              key={`${file.name}-${idx}`}
              className="flex items-center justify-between p-2 bg-white border border-slate-200 rounded-lg shadow-sm"
            >
              <div className="flex items-center space-x-2 overflow-hidden">
                <div
                  className={`${isPrimary ? 'text-orange-600 bg-orange-50' : 'text-blue-600 bg-blue-50'} p-1.5 rounded`}
                >
                  {isPrimary ? <FileText size={16} /> : <BookOpen size={16} />}
                </div>
                <span className="text-xs font-medium text-slate-700 truncate max-w-[150px]">
                  {file.name}
                </span>
              </div>
              {!disabled && (
                <button
                  onClick={() => onRemoveFile(idx)}
                  className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-red-500 transition-colors"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default FileUploader;
