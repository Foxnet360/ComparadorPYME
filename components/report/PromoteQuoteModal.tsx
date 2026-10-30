import React, { useState, useEffect } from 'react';
import {
  X,
  ShieldCheck,
  Building2,
  Calendar,
  FileCheck,
  Loader2,
  AlertCircle,
  PlusCircle,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import {
  listClients,
  createClient,
  promoteQuoteToPolicy,
  type PortfolioClient,
  type PortfolioPolicy,
} from '../../services/portfolioService';
import { formatCOP } from '../../utils/formatCurrency';
import type { QuoteAnalysis } from '../../types';

interface PromoteQuoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  analysisId?: string;
  quoteIndex: number;
  quote: QuoteAnalysis;
  domain?: string;
  initialClientName?: string;
  onOpenPortfolio?: () => void;
  onSuccess?: (policy: PortfolioPolicy) => void;
}

export const PromoteQuoteModal: React.FC<PromoteQuoteModalProps> = ({
  isOpen,
  onClose,
  analysisId,
  quoteIndex,
  quote,
  domain = 'pyme',
  initialClientName,
  onOpenPortfolio,
  onSuccess,
}) => {
  const [clients, setClients] = useState<PortfolioClient[]>([]);
  const [loadingClients, setLoadingClients] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [isCreatingNewClient, setIsCreatingNewClient] = useState(false);

  // New client form fields
  const [newClientName, setNewClientName] = useState(initialClientName || '');
  const [newClientNit, setNewClientNit] = useState('');
  const [newClientEmail, setNewClientEmail] = useState('');
  const [newClientPhone, setNewClientPhone] = useState('');

  // Policy confirmation fields
  const [policyNumber, setPolicyNumber] = useState('');
  const todayStr = new Date().toISOString().split('T')[0]!;
  const nextYear = new Date();
  nextYear.setFullYear(nextYear.getFullYear() + 1);
  const nextYearStr = nextYear.toISOString().split('T')[0]!;

  const [startDate, setStartDate] = useState(todayStr);
  const [endDate, setEndDate] = useState(nextYearStr);

  // Ramo specific insured fields
  const [plate, setPlate] = useState('');
  const [model, setModel] = useState('');
  const [commercialValue, setCommercialValue] = useState<number | ''>('');
  const [sumaAsegurada, setSumaAsegurada] = useState<number | ''>('');
  const [headcount, setHeadcount] = useState<number | ''>('');
  const [carenciasDate, setCarenciasDate] = useState(todayStr);
  const [address, setAddress] = useState('');
  const [contract, setContract] = useState('');
  const [assetId, setAssetId] = useState('');

  // Submission & state
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [createdPolicy, setCreatedPolicy] = useState<PortfolioPolicy | null>(null);

  useEffect(() => {
    if (isOpen) {
      setErrorMessage(null);
      setCreatedPolicy(null);
      fetchClients();
    }
  }, [isOpen]);

  const fetchClients = async () => {
    setLoadingClients(true);
    try {
      const data = await listClients();
      setClients(data);
      if (data.length > 0) {
        // Try matching with initialClientName
        if (initialClientName) {
          const matched = data.find(
            (c) => c.name.toLowerCase().trim() === initialClientName.toLowerCase().trim()
          );
          if (matched) {
            setSelectedClientId(matched.id);
          } else {
            setSelectedClientId(data[0]!.id);
          }
        } else {
          setSelectedClientId(data[0]!.id);
        }
      } else {
        setIsCreatingNewClient(true);
      }
    } catch {
      // Backend client list could fail if not authenticated with real token in test/demo mode
      setIsCreatingNewClient(true);
    } finally {
      setLoadingClients(false);
    }
  };

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!policyNumber.trim()) {
      setErrorMessage('Por favor ingresá el número de póliza.');
      return;
    }

    if (!startDate || !endDate) {
      setErrorMessage('Por favor seleccioná las fechas de vigencia.');
      return;
    }

    setSubmitting(true);

    try {
      let finalClientId = selectedClientId;

      // Create new client if toggled
      if (isCreatingNewClient) {
        if (!newClientName.trim()) {
          setErrorMessage('Por favor ingresá el nombre del cliente.');
          setSubmitting(false);
          return;
        }
        const createdClient = await createClient({
          name: newClientName.trim(),
          tax_id: newClientNit.trim() || undefined,
          contact: {
            email: newClientEmail.trim() || undefined,
            phone: newClientPhone.trim() || undefined,
          },
        });
        finalClientId = createdClient.id;
      }

      if (!finalClientId) {
        setErrorMessage('Debes seleccionar o crear un cliente válido.');
        setSubmitting(false);
        return;
      }

      // Build per-ramo insured requirement
      const insured: Record<string, unknown> = {};
      const normDomain = domain.toLowerCase();

      if (normDomain === 'autos') {
        insured.plate = plate.trim() || 'SIN-PLACA';
        insured.model = model.trim() || '2025';
        insured.value = Number(commercialValue) || 50000000;
      } else if (normDomain === 'pyme' || normDomain === 'copropiedades') {
        insured.suma_asegurada = Number(sumaAsegurada) || quote.priceAnnual * 100 || 100000000;
      } else if (normDomain === 'salud' || normDomain === 'vida_grupo') {
        insured.headcount = Number(headcount) || 10;
        insured.carencias_date = carenciasDate || startDate;
      } else if (normDomain === 'hogar') {
        insured.address = address.trim() || 'Dirección Principal';
      } else if (normDomain === 'cumplimiento') {
        insured.contract = contract.trim() || 'CTR-2026-001';
      } else {
        insured.asset_id = assetId.trim() || 'ACTIVO-01';
      }

      const effectiveAnalysisId = analysisId || quote.id || crypto.randomUUID();

      const policy = await promoteQuoteToPolicy({
        analysis_id: effectiveAnalysisId,
        quote_index: quoteIndex >= 0 ? quoteIndex : 0,
        confirmations: {
          client_id: finalClientId,
          policy_number: policyNumber.trim(),
          start_date: startDate,
          end_date: endDate,
          insured,
        },
      });

      setCreatedPolicy(policy);
      if (onSuccess) {
        onSuccess(policy);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al promocionar la cotización a póliza';
      setErrorMessage(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="promote-modal-title"
    >
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-indigo-900 to-indigo-800 text-white">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-white/10 backdrop-blur text-emerald-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 id="promote-modal-title" className="text-base font-bold">
                Promocionar Cotización a Póliza Activa
              </h2>
              <p className="text-xs text-indigo-200">
                Registra la emisión oficial en el módulo de Portafolio y Renovaciones de Cartera
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-indigo-200 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            aria-label="Cerrar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Quote Card Snapshot */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-700">
                  {domain.toUpperCase()}
                </span>
                <span className="text-sm font-bold text-slate-800">{quote.insurerName}</span>
              </div>
              <p className="text-xs text-slate-500 mt-1">{quote.policyName || 'Póliza Empresarial'}</p>
            </div>
            <div className="text-left sm:text-right">
              <span className="text-xs text-slate-400 block font-medium">Prima Anual</span>
              <span className="text-lg font-black text-indigo-600">
                {formatCOP(quote.priceAnnual)}
              </span>
            </div>
          </div>

          {/* Success Screen */}
          {createdPolicy ? (
            <div className="space-y-6 py-4 text-center animate-in zoom-in-95 duration-200">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
                <Sparkles className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-900">
                  ¡Póliza Promocionada con Éxito!
                </h3>
                <p className="text-sm text-slate-600 mt-1">
                  La póliza <strong className="text-slate-900">{createdPolicy.policy_number}</strong> ha sido registrada en el sistema de gestión de cartera.
                </p>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs text-left space-y-2 max-w-md mx-auto">
                <div className="flex justify-between">
                  <span className="text-slate-500">Aseguradora:</span>
                  <span className="font-semibold text-slate-800">{createdPolicy.insurer}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Ramo:</span>
                  <span className="font-semibold text-slate-800">{createdPolicy.ramo}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Vencimiento:</span>
                  <span className="font-semibold text-slate-800">{createdPolicy.end_date}</span>
                </div>
              </div>

              <div className="flex items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 border border-slate-300 hover:bg-slate-100 rounded-xl text-sm font-semibold text-slate-700 transition-colors"
                >
                  Seguir en Reporte
                </button>
                {onOpenPortfolio && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenPortfolio();
                    }}
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold shadow-md hover:shadow-lg transition-all flex items-center gap-2"
                  >
                    <span>Ir al Portafolio</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              {errorMessage && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-rose-700 text-xs animate-in fade-in duration-200">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Client Selection Section */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Cliente / Asegurado</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsCreatingNewClient(!isCreatingNewClient)}
                    className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <PlusCircle className="w-3 h-3" />
                    <span>{isCreatingNewClient ? 'Seleccionar existente' : 'Nuevo cliente'}</span>
                  </button>
                </div>

                {isCreatingNewClient ? (
                  <div className="p-3 bg-indigo-50/50 border border-indigo-100 rounded-xl space-y-3">
                    <div>
                      <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                        Nombre o Razón Social *
                      </label>
                      <input
                        type="text"
                        required
                        value={newClientName}
                        onChange={(e) => setNewClientName(e.target.value)}
                        placeholder="Ej: Conjunto Residencial Los Sauces"
                        className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <div>
                        <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                          NIT / Doc
                        </label>
                        <input
                          type="text"
                          value={newClientNit}
                          onChange={(e) => setNewClientNit(e.target.value)}
                          placeholder="900.123.456-7"
                          className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                          Email
                        </label>
                        <input
                          type="email"
                          value={newClientEmail}
                          onChange={(e) => setNewClientEmail(e.target.value)}
                          placeholder="admin@edificio.com"
                          className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                          Teléfono
                        </label>
                        <input
                          type="tel"
                          value={newClientPhone}
                          onChange={(e) => setNewClientPhone(e.target.value)}
                          placeholder="310 123 4567"
                          className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div>
                    {loadingClients ? (
                      <div className="text-xs text-slate-400 py-2 flex items-center gap-2">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Cargando clientes...
                      </div>
                    ) : (
                      <select
                        value={selectedClientId}
                        onChange={(e) => setSelectedClientId(e.target.value)}
                        className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                      >
                        {clients.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name} {c.tax_id ? `(${c.tax_id})` : ''}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                )}
              </div>

              {/* Policy Number and Dates */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-1">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5 mb-1">
                    <FileCheck className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Número de Póliza *</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={policyNumber}
                    onChange={(e) => setPolicyNumber(e.target.value)}
                    placeholder="POL-2026-987"
                    className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5 mb-1">
                    <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Fecha Inicio *</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5 mb-1">
                    <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Fecha Vencimiento *</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Per-Ramo Specific Requirements */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <span className="text-xs font-bold text-slate-700 block">
                  Información Técnica del Riesgo Asegurado ({domain.toUpperCase()})
                </span>

                {domain.toLowerCase() === 'autos' && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                        Placa *
                      </label>
                      <input
                        type="text"
                        required
                        value={plate}
                        onChange={(e) => setPlate(e.target.value.toUpperCase())}
                        placeholder="ABC-123"
                        className="w-full text-xs px-3 py-1.5 bg-white border border-slate-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                        Modelo / Año *
                      </label>
                      <input
                        type="text"
                        required
                        value={model}
                        onChange={(e) => setModel(e.target.value)}
                        placeholder="2025"
                        className="w-full text-xs px-3 py-1.5 bg-white border border-slate-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                        Valor Comercial (COP) *
                      </label>
                      <input
                        type="number"
                        required
                        value={commercialValue}
                        onChange={(e) => setCommercialValue(Number(e.target.value) || '')}
                        placeholder="75000000"
                        className="w-full text-xs px-3 py-1.5 bg-white border border-slate-300 rounded-lg"
                      />
                    </div>
                  </div>
                )}

                {(domain.toLowerCase() === 'pyme' || domain.toLowerCase() === 'copropiedades') && (
                  <div>
                    <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                      Suma Asegurada Total (COP) *
                    </label>
                    <input
                      type="number"
                      required
                      value={sumaAsegurada}
                      onChange={(e) => setSumaAsegurada(Number(e.target.value) || '')}
                      placeholder="Ej: 500000000"
                      className="w-full text-xs px-3 py-1.5 bg-white border border-slate-300 rounded-lg"
                    />
                  </div>
                )}

                {(domain.toLowerCase() === 'salud' || domain.toLowerCase() === 'vida_grupo') && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                        Número de Asegurados (Vidas) *
                      </label>
                      <input
                        type="number"
                        required
                        value={headcount}
                        onChange={(e) => setHeadcount(Number(e.target.value) || '')}
                        placeholder="15"
                        className="w-full text-xs px-3 py-1.5 bg-white border border-slate-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                        Fecha Fin Carencias
                      </label>
                      <input
                        type="date"
                        value={carenciasDate}
                        onChange={(e) => setCarenciasDate(e.target.value)}
                        className="w-full text-xs px-3 py-1.5 bg-white border border-slate-300 rounded-lg"
                      />
                    </div>
                  </div>
                )}

                {domain.toLowerCase() === 'hogar' && (
                  <div>
                    <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                      Dirección del Inmueble Asegurado *
                    </label>
                    <input
                      type="text"
                      required
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="Calle 100 # 15-20, Bogotá"
                      className="w-full text-xs px-3 py-1.5 bg-white border border-slate-300 rounded-lg"
                    />
                  </div>
                )}

                {domain.toLowerCase() === 'cumplimiento' && (
                  <div>
                    <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                      Número o Código de Contrato *
                    </label>
                    <input
                      type="text"
                      required
                      value={contract}
                      onChange={(e) => setContract(e.target.value)}
                      placeholder="CTR-MINTRANSPORTE-2026-09"
                      className="w-full text-xs px-3 py-1.5 bg-white border border-slate-300 rounded-lg"
                    />
                  </div>
                )}

                {!['autos', 'pyme', 'copropiedades', 'salud', 'vida_grupo', 'hogar', 'cumplimiento'].includes(
                  domain.toLowerCase()
                ) && (
                  <div>
                    <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                      Identificador de Activo / Embarcación / Maquinaria *
                    </label>
                    <input
                      type="text"
                      required
                      value={assetId}
                      onChange={(e) => setAssetId(e.target.value)}
                      placeholder="MATRICULA-12345"
                      className="w-full text-xs px-3 py-1.5 bg-white border border-slate-300 rounded-lg"
                    />
                  </div>
                )}
              </div>

              {/* Action buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-2 cursor-pointer"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Emitiendo...</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4" />
                      <span>Emitir y Guardar en Portafolio</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default PromoteQuoteModal;