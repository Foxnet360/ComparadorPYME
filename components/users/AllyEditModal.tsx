import React, { useState, useEffect } from 'react';
import { Building2, X, FileText, RotateCcw, Image as ImageIcon, Upload } from 'lucide-react';
import { Ally } from '../../types';
import { organizationService } from '../../services/organizationService';
import {
  CommercialPolicies,
  DEFAULT_COMMERCIAL_POLICIES,
  getEffectiveCommercialPolicies,
} from '../../src/data/commercialPolicies';

export interface AllyEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  ally: Ally | null;
  onUpdate: (
    allyId: string,
    updates: {
      name: string;
      nit?: string;
      contactPhone?: string;
      contactEmail?: string;
      status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
      logoUrl?: string;
    },
    commercialPolicies?: CommercialPolicies
  ) => Promise<void>;
}

export const AllyEditModal: React.FC<AllyEditModalProps> = ({
  isOpen,
  onClose,
  ally,
  onUpdate,
}) => {
  const [name, setName] = useState('');
  const [nit, setNit] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [logoError, setLogoError] = useState<string | null>(null);
  const [status, setStatus] = useState<'ACTIVE' | 'INACTIVE' | 'SUSPENDED'>('ACTIVE');
  const [showPoliciesSection, setShowPoliciesSection] = useState(false);
  const [commercialPolicies, setCommercialPolicies] = useState<CommercialPolicies>(
    DEFAULT_COMMERCIAL_POLICIES
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (ally) {
      setName(ally.name);
      setNit(ally.nit || '');
      setPhone(ally.phone || '');
      setEmail(ally.contact_email || '');
      setLogoUrl(
        ally.logoUrl ||
        (ally.settings as Record<string, any> | undefined)?.logo_url ||
        (ally.settings as Record<string, any> | undefined)?.logoUrl ||
        ''
      );
      setLogoError(null);
      setStatus(ally.status || 'ACTIVE');
      setCommercialPolicies(
        getEffectiveCommercialPolicies(
          ally.commercialPolicies || (ally.settings as Record<string, any> | undefined)?.commercial_policies
        )
      );
      setShowPoliciesSection(false);

      organizationService
        .getCommercialPolicies(ally.id)
        .then((policies) => {
          if (policies) setCommercialPolicies(policies);
        })
        .catch((err) => console.warn('Could not load ally policies', err));
    }
  }, [ally]);

  if (!isOpen || !ally) return null;

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLogoError(null);
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg'];
    if (!validTypes.includes(file.type)) {
      setLogoError('Formato inválido. Debe ser una imagen PNG o JPG/JPEG.');
      return;
    }

    const maxSize = 2 * 1024 * 1024; // 2MB
    if (file.size > maxSize) {
      setLogoError('El archivo supera los 2 MB. Reduzca la resolución o peso de la imagen.');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        setLogoUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onUpdate(
        ally.id,
        {
          name,
          nit: nit || undefined,
          contactPhone: phone || undefined,
          contactEmail: email || undefined,
          status,
          logoUrl: logoUrl || undefined,
        },
        commercialPolicies
      );
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center border-b pb-3">
          <h3 className="font-bold text-slate-900 flex items-center gap-2">
            <Building2 className="text-indigo-600" size={18} />
            <span>Editar Intermediario</span>
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
              Nombre de la Correduría / Intermediario
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border border-slate-300 rounded-xl p-2.5 text-xs outline-none focus:ring-2 focus:ring-indigo-500 font-semibold"
            />
          </div>

          {/* Logo del Intermediario para PDF y Excel */}
          <div className="border border-slate-200 rounded-xl p-3.5 bg-slate-50/70 space-y-3">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Logo del Intermediario (PDF y Excel)
              </label>
              <span className="text-[11px] font-medium text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-md">
                Membrete Oficial
              </span>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-4">
              <div className="h-20 w-36 bg-white border border-slate-300 rounded-xl flex items-center justify-center overflow-hidden shrink-0 p-1.5 shadow-xs">
                {logoUrl ? (
                  <img
                    src={logoUrl}
                    alt="Logo Intermediario"
                    className="max-h-full max-w-full object-contain"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center text-slate-400">
                    <ImageIcon className="w-8 h-8 text-slate-300" />
                    <span className="text-[10px] mt-1">Sin logo</span>
                  </div>
                )}
              </div>

              <div className="flex-1 space-y-2 text-left w-full">
                <div className="flex flex-wrap items-center gap-2">
                  <label className="cursor-pointer inline-flex items-center px-3 py-1.5 border border-indigo-300 rounded-lg text-xs font-bold text-indigo-700 bg-indigo-50/80 hover:bg-indigo-100 transition-colors shadow-xs">
                    <Upload className="w-3.5 h-3.5 mr-1.5 text-indigo-600" />
                    <span>{logoUrl ? 'Cambiar Logo' : 'Cargar Logo'}</span>
                    <input
                      type="file"
                      accept="image/png, image/jpeg, image/jpg"
                      onChange={handleLogoUpload}
                      className="hidden"
                    />
                  </label>

                  {logoUrl && (
                    <button
                      type="button"
                      onClick={() => setLogoUrl('')}
                      className="inline-flex items-center px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-medium text-slate-600 bg-white hover:bg-slate-100 hover:text-rose-600 transition-colors"
                    >
                      <span>Quitar</span>
                    </button>
                  )}
                </div>

                <div className="text-[11px] text-slate-500 leading-relaxed bg-white border border-slate-200/80 rounded-lg p-2">
                  <p className="font-semibold text-slate-700 mb-0.5">Especificaciones requeridas para PDF y Excel:</p>
                  <ul className="list-disc pl-4 space-y-0.5 text-[10.5px]">
                    <li><strong>Formatos:</strong> PNG o JPG/JPEG (fondo transparente o blanco recomendado).</li>
                    <li><strong>Proporción sugerida:</strong> Rectangular horizontal 3:1 o 4:1 (aprox. 400 × 120 px) para membrete de encabezado.</li>
                    <li><strong>Peso máximo:</strong> 2 MB (recomendado &lt; 500 KB para no ralentizar la exportación).</li>
                  </ul>
                </div>

                {logoError && (
                  <p className="text-xs text-rose-600 font-semibold">{logoError}</p>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">NIT</label>
              <input
                type="text"
                value={nit}
                onChange={(e) => setNit(e.target.value)}
                className="w-full border border-slate-300 rounded-xl p-2.5 text-xs outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Teléfono / Celular
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full border border-slate-300 rounded-xl p-2.5 text-xs outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
              Correo Electrónico
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-slate-300 rounded-xl p-2.5 text-xs outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
              Estado de la Correduría
            </label>
            <select
              value={status}
              onChange={(e) =>
                setStatus(e.target.value as 'ACTIVE' | 'INACTIVE' | 'SUSPENDED')
              }
              className="w-full border border-slate-300 rounded-xl p-2.5 text-xs outline-none focus:ring-2 focus:ring-indigo-500 font-semibold"
            >
              <option value="ACTIVE">Vigente / Activa</option>
              <option value="INACTIVE">Inactiva</option>
              <option value="SUSPENDED">Suspendida</option>
            </select>
          </div>

          {/* Políticas Comerciales Accordion */}
          <div className="border border-indigo-100 rounded-xl bg-indigo-50/50 overflow-hidden">
            <button
              type="button"
              onClick={() => setShowPoliciesSection(!showPoliciesSection)}
              className="w-full p-3 flex justify-between items-center text-xs font-bold text-indigo-900 hover:bg-indigo-50 transition-colors"
            >
              <span className="flex items-center gap-1.5">
                <FileText size={15} className="text-indigo-600" />
                <span>Políticas Comerciales de Oferta ({commercialPolicies.offerValidityDays} días)</span>
              </span>
              <span className="text-[11px] text-indigo-600 underline">
                {showPoliciesSection ? 'Ocultar' : 'Configurar'}
              </span>
            </button>

            {showPoliciesSection && (
              <div className="p-3.5 border-t border-indigo-100 bg-white space-y-3 animate-in fade-in">
                <div className="flex justify-between items-center">
                  <span className="text-[11px] text-slate-500">
                    Inyectadas en exportaciones PDF y Excel.
                  </span>
                  <button
                    type="button"
                    onClick={() => setCommercialPolicies({ ...DEFAULT_COMMERCIAL_POLICIES })}
                    className="text-[11px] text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1"
                  >
                    <RotateCcw size={12} />
                    <span>Restablecer Estándar</span>
                  </button>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-0.5">
                    Validez de la Oferta (días)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="90"
                    value={commercialPolicies.offerValidityDays}
                    onChange={(e) =>
                      setCommercialPolicies((p) => ({
                        ...p,
                        offerValidityDays: parseInt(e.target.value) || 15,
                      }))
                    }
                    className="w-32 border border-slate-300 rounded-lg p-1.5 text-xs font-bold"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-0.5">
                    Condiciones de Pago
                  </label>
                  <textarea
                    rows={2}
                    value={commercialPolicies.paymentConditions}
                    onChange={(e) =>
                      setCommercialPolicies((p) => ({ ...p, paymentConditions: e.target.value }))
                    }
                    className="w-full border border-slate-300 rounded-lg p-2 text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-0.5">
                    Requisitos de Inspección
                  </label>
                  <textarea
                    rows={2}
                    value={commercialPolicies.inspectionRequirements}
                    onChange={(e) =>
                      setCommercialPolicies((p) => ({
                        ...p,
                        inspectionRequirements: e.target.value,
                      }))
                    }
                    className="w-full border border-slate-300 rounded-lg p-2 text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-0.5">
                    Requisitos de Emisión
                  </label>
                  <textarea
                    rows={2}
                    value={commercialPolicies.issuanceRequirements}
                    onChange={(e) =>
                      setCommercialPolicies((p) => ({
                        ...p,
                        issuanceRequirements: e.target.value,
                      }))
                    }
                    className="w-full border border-slate-300 rounded-lg p-2 text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-0.5">
                    Atención de Siniestros (Art. 1075 C.Co.)
                  </label>
                  <textarea
                    rows={2}
                    value={commercialPolicies.claimsPolicy}
                    onChange={(e) =>
                      setCommercialPolicies((p) => ({ ...p, claimsPolicy: e.target.value }))
                    }
                    className="w-full border border-slate-300 rounded-lg p-2 text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-0.5">
                    Alcance de Intermediación
                  </label>
                  <textarea
                    rows={2}
                    value={commercialPolicies.intermediationScope}
                    onChange={(e) =>
                      setCommercialPolicies((p) => ({
                        ...p,
                        intermediationScope: e.target.value,
                      }))
                    }
                    className="w-full border border-slate-300 rounded-lg p-2 text-xs"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="pt-3 flex justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 disabled:opacity-50"
            >
              {isSubmitting ? 'Guardando...' : 'Actualizar Correduría'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
