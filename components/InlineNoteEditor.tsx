import React, { useState, useRef, useEffect } from 'react';
import { X, Save, Pin } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface InlineNoteEditorProps {
  cellId: string;
  initialContent?: string;
  onSave: (cellId: string, content: string) => void;
  onCancel: () => void;
}

export const InlineNoteEditor: React.FC<InlineNoteEditorProps> = ({
  cellId,
  initialContent = '',
  onSave,
  onCancel,
}) => {
  const [content, setContent] = useState(initialContent);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
    }
  }, []);

  const handleSave = () => {
    if (content.trim()) {
      onSave(cellId, content.trim());
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    }
  };

  return (
    <div className="absolute inset-0 bg-white z-50 flex flex-col shadow-lg border border-slate-200 rounded-lg">
      <div className="flex items-center justify-between px-3 py-2 border-b bg-slate-50">
        <div className="flex items-center gap-2">
          <Pin size={14} className="text-slate-400" />
          <span className="text-xs font-medium text-slate-600">Nota consultiva</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleSave}
            className="p-1.5 text-green-600 hover:bg-green-50 rounded transition-colors"
            title="Guardar (Ctrl+Enter)"
          >
            <Save size={14} />
          </button>
          <button
            onClick={onCancel}
            className="p-1.5 text-slate-400 hover:bg-slate-100 rounded transition-colors"
            title="Cancelar (Esc)"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      <textarea
        ref={textareaRef}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Agregue su insight o recomendación..."
        className="flex-1 p-3 text-sm resize-none outline-none"
        maxLength={2000}
      />

      {content && (
        <div className="px-3 py-2 border-t bg-slate-50">
          <p className="text-xs text-slate-400 mb-1">Vista previa:</p>
          {/* SEC-3: react-markdown escapes raw HTML by default (no rehype-raw)
              and sanitizes dangerous link protocols — no HTML injection sink. */}
          <div className="text-xs text-slate-600 prose prose-sm max-w-none">
            <ReactMarkdown>{content}</ReactMarkdown>
          </div>
        </div>
      )}

      <div className="px-3 py-1.5 border-t bg-slate-50 flex justify-between items-center">
        <span className="text-[10px] text-slate-400">{content.length}/2000 caracteres</span>
        <span className="text-[10px] text-slate-400">Markdown soportado</span>
      </div>
    </div>
  );
};

export default InlineNoteEditor;
