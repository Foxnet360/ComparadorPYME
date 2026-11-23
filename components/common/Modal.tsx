import React, { useEffect, useId } from 'react';
import { X } from 'lucide-react';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  children: React.ReactNode;
  maxWidthClass?: string;
  zIndexClass?: string;
  closeOnBackdrop?: boolean;
  showCloseButton?: boolean;
  containerClassName?: string;
}

/**
 * Accessible base dialog with Escape-key closing, ARIA dialog semantics,
 * optional backdrop dismiss, and responsive sizing.
 */
export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  maxWidthClass = 'max-w-lg',
  zIndexClass = 'z-50',
  closeOnBackdrop = true,
  showCloseButton = false,
  containerClassName = '',
}) => {
  const titleId = useId();

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className={`fixed inset-0 ${zIndexClass} overflow-y-auto bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4`}
      onClick={(e) => {
        if (closeOnBackdrop && e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        className={`bg-white rounded-2xl ${maxWidthClass} w-full shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-150 ${containerClassName}`}
      >
        {(title || showCloseButton) && (
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between gap-3">
            {title ? (
              <h2 id={titleId} className="text-base font-bold text-slate-900">
                {title}
              </h2>
            ) : (
              <span />
            )}
            {showCloseButton && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Cerrar diálogo"
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition-colors"
              >
                <X size={18} />
              </button>
            )}
          </div>
        )}
        {children}
      </div>
    </div>
  );
};

export default Modal;
