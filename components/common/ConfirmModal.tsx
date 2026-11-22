import React from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { Modal } from './Modal';

export interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'primary';
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Reusable non-blocking confirmation dialog replacing native window.confirm().
 */
export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  variant = 'danger',
  onConfirm,
  onCancel,
}) => {
  const confirmBtnClass =
    variant === 'danger'
      ? 'bg-red-600 hover:bg-red-700 text-white focus:ring-red-500'
      : 'bg-indigo-600 hover:bg-indigo-700 text-white focus:ring-indigo-500';

  return (
    <Modal isOpen={isOpen} onClose={onCancel} maxWidthClass="max-w-md" zIndexClass="z-[70]">
      <div className="p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div
              className={`p-2 rounded-xl shrink-0 ${
                variant === 'danger' ? 'bg-red-50 text-red-600' : 'bg-indigo-50 text-indigo-600'
              }`}
            >
              <AlertTriangle size={20} />
            </div>
            <div>
              <h3 id="confirm-modal-title" className="text-base font-bold text-slate-900">
                {title}
              </h3>
              <p className="mt-1.5 text-sm text-slate-600 leading-relaxed">{message}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition-colors"
            aria-label="Cerrar"
          >
            <X size={18} />
          </button>
        </div>

        <div className="mt-6 flex justify-end gap-2.5">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`px-4 py-2 text-sm font-semibold rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 ${confirmBtnClass}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
};
