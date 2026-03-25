import React, { useCallback } from 'react';
import { Upload, FileText, X, BookOpen, FileCheck, User } from 'lucide-react';

interface FileUploaderProps {
  files: File[];
  onFilesSelected: (files: File[]) => void;
  onRemoveFile: (index: number) => void;
  disabled?: boolean;
  title?: string;
  description?: string;
  variant?: 'primary' | 'secondary';
  icon?: React.ReactNode;
}

const FileUploader: React.FC<FileUploaderProps> = ({ 
  files, 
  onFilesSelected, 
  onRemoveFile, 
  disabled,
  title = "Sube tus archivos",
  description = "Arrastra y suelta documentos aquí",
  variant = 'primary',
  icon,
}) => {
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (disabled) return;
    const droppedFiles = Array.from(e.dataTransfer.files) as File[];
    const validFiles = droppedFiles.filter(f => f.type.startsWith('image/') || f.type === 'application/pdf');
    if (validFiles.length > 0) {
      onFilesSelected(validFiles);
    }
  }, [onFilesSelected, disabled]);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && !disabled) {
      const selectedFiles = Array.from(e.target.files);
      onFilesSelected(selectedFiles);
    }
  };

  const isPrimary = variant === 'primary';
  const borderColor = isPrimary ? 'border-indigo-300 hover:border-indigo-500' : 'border-slate-300 hover:border-slate-400';
  const bgColor = isPrimary ? 'hover:bg-indigo-50' : 'hover:bg-slate-50';
  const iconColor = isPrimary ? 'text-indigo-600' : 'text-slate-600';
  const iconBg = isPrimary ? 'bg-indigo-100' : 'bg-slate-100';

  return (
    <div className="w-full h-full flex flex-col">
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors flex-grow flex flex-col items-center justify-center ${
          disabled ? 'opacity-50 cursor-not-allowed border-slate-200' : `${borderColor} ${bgColor} cursor-pointer`
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
        <label htmlFor={`file-upload-${title}`} className="cursor-pointer flex flex-col items-center w-full">
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
            <div key={idx} className="flex items-center justify-between p-2 bg-white border border-slate-200 rounded-lg shadow-sm">
              <div className="flex items-center space-x-2 overflow-hidden">
                <div className={`${isPrimary ? 'text-orange-600 bg-orange-50' : 'text-blue-600 bg-blue-50'} p-1.5 rounded`}>
                  {isPrimary ? <FileText size={16} /> : <BookOpen size={16} />}
                </div>
                <span className="text-xs font-medium text-slate-700 truncate max-w-[150px]">{file.name}</span>
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