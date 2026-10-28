import React, { useState, useEffect } from 'react';
import {
  Shield,
  Building2,
  Search,
  Plus,
  Edit2,
  Trash2,
  RefreshCw,
  ExternalLink,
  Bot,
  Zap,
  CheckCircle2,
  XCircle,
  X,
  ChevronLeft,
} from 'lucide-react';
import { insurerService, type InsurerEntity } from '../services/insurerService';
import { InsurerLogo } from './common/InsurerLogo';
import { InsuranceDomain, type InsuranceDomainType } from '@shared/insuranceDomain';

interface InsurerManagerProps {
  onBack?: () => void;
}

const ALL_DOMAINS: { key: InsuranceDomainType; label: string }[] = [
  { key: InsuranceDomain.PYME, label: 'PYME / Multirriesgo' },
  { key: InsuranceDomain.AUTOS, label: 'Autos / Vehículos' },
  { key: InsuranceDomain.HOGAR, label: 'Hogar / Habitación' },
  { key: InsuranceDomain.COPROPIEDADES, label: 'Copropiedades' },
  { key: InsuranceDomain.VIDA_GRUPO, label: 'Vida Grupo' },
  { key: InsuranceDomain.SALUD, label: 'Salud Colectiva' },
  { key: InsuranceDomain.CUMPLIMIENTO, label: 'Cumplimiento' },
  { key: InsuranceDomain.TRANSPORTE, label: 'Transporte' },
  { key: InsuranceDomain.EQUIPO_MAQUINARIA, label: 'Equipo y Maquinaria' },
  { key: InsuranceDomain.CASCO_EMBARCACION, label: 'Casco y Embarcación' },
];

export const InsurerManager: React.FC<InsurerManagerProps> = ({ onBack }) => {
  const [insurers, setInsurers] = useState<InsurerEntity[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDomain, setSelectedDomain] = useState<string>('all');
  const [filterRpa, setFilterRpa] = useState<boolean | null>(null);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingInsurer, setEditingInsurer] = useState<InsurerEntity | null>(null);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState<Partial<InsurerEntity>>({
    name: '',
    shortName: '',
    officialName: '',
    nit: '',
    domainUrl: '',
    logoUrl: '',
    primaryColor: '#0F172A',
    accentColor: '#0284C7',
    monogram: '',
    marketPosition: '',
    description: '',
    integrationInfo: '',
    rpaEnabled: false,
    apiEnabled: false,
    supportedDomains: [InsuranceDomain.PYME, InsuranceDomain.AUTOS],
    aliases: [],
    contactEmail: '',
    phone: '',
    isActive: true,
  });

  const loadInsurers = async () => {
    try {
      setLoading(true);
      const list = await insurerService.getInsurers(true);
      setInsurers(list);
    } catch (err) {
      console.error('Error fetching insurers:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInsurers();
  }, []);

  const handleOpenCreate = () => {
    setEditingInsurer(null);
    setFormData({
      name: '',
      shortName: '',
      officialName: '',
      nit: '',
      domainUrl: '',
      logoUrl: '',
      primaryColor: '#0F172A',
      accentColor: '#0284C7',
      monogram: '',
      marketPosition: 'Aseguradora Nacional',
      description: '',
      integrationInfo: 'Captura y cotización asistida',
      rpaEnabled: false,
      apiEnabled: false,
      supportedDomains: [InsuranceDomain.PYME, InsuranceDomain.AUTOS],
      aliases: [],
      contactEmail: '',
      phone: '',
      isActive: true,
    });
    setErrorMsg(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (ins: InsurerEntity) => {
    setEditingInsurer(ins);
    setFormData({ ...ins });
    setErrorMsg(null);
    setIsModalOpen(true);
  };

  const handleSyncOfficial = async () => {
    try {
      setSyncing(true);
      const updated = await insurerService.seedInsurers();
      setInsurers(updated);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error desconocido';
      alert(`Error al sincronizar catálogo: ${message}`);
    } finally {
      setSyncing(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name?.trim()) {
      setErrorMsg('El nombre de la aseguradora es obligatorio.');
      return;
    }

    try {
      setSaving(true);
      setErrorMsg(null);

      if (editingInsurer) {
        await insurerService.updateInsurer(editingInsurer.id || editingInsurer.code, formData);
      } else {
        await insurerService.createInsurer({
          ...formData,
          name: formData.name.trim(),
        });
      }

      await loadInsurers();
      setIsModalOpen(false);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Error al guardar la aseguradora');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`¿Está seguro de eliminar o desactivar a "${name}"?`)) return;
    try {
      await insurerService.deleteInsurer(id);
      await loadInsurers();
    } catch (err: unknown) {
      alert(`Error: ${err instanceof Error ? err.message : 'Error al eliminar'}`);
    }
  };

  const handleToggleDomain = (domainKey: InsuranceDomainType) => {
    const current = formData.supportedDomains || [];
    if (current.includes(domainKey)) {
      setFormData({ ...formData, supportedDomains: current.filter((d) => d !== domainKey) });
    } else {
      setFormData({ ...formData, supportedDomains: [...current, domainKey] });
    }
  };

  // Filtered list
  const filteredInsurers = insurers.filter((ins) => {
    const matchesSearch =
      searchTerm === '' ||
      ins.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (ins.shortName && ins.shortName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (ins.officialName && ins.officialName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (ins.nit && ins.nit.includes(searchTerm)) ||
      (ins.marketPosition && ins.marketPosition.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (ins.aliases && ins.aliases.some((a) => a.toLowerCase().includes(searchTerm.toLowerCase())));

    const matchesDomain =
      selectedDomain === 'all' ||
      (ins.supportedDomains && ins.supportedDomains.includes(selectedDomain as InsuranceDomainType));

    const matchesRpa =
      filterRpa === null ||
      (filterRpa === true && (ins.rpaEnabled || ins.apiEnabled)) ||
      (filterRpa === false && !ins.rpaEnabled && !ins.apiEnabled);

    return matchesSearch && matchesDomain && matchesRpa;
  });

  return (
    <div className="w-full max-w-7xl mx-auto px-4 py-8 space-y-8 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-3">
            {onBack && (
              <button
                onClick={onBack}
                className="p-2 rounded-xl text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                title="Volver"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            )}
            <div className="p-2.5 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                Gestión de Aseguradoras
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Catálogo unificado de aseguradoras en Colombia, identidades de marca, RPA Rocketbot y conectores API
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleSyncOfficial}
            disabled={syncing}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 font-semibold text-sm transition-all shadow-xs disabled:opacity-60"
            title="Sincroniza y actualiza los 15 líderes del mercado colombiano con sus datos oficiales SFC"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin text-blue-600' : ''}`} />
            <span>{syncing ? 'Sincronizando...' : 'Sincronizar Catálogo'}</span>
          </button>

          <button
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md hover:shadow-lg transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Nueva Aseguradora</span>
          </button>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        <div className="md:col-span-5 relative">
          <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por nombre, NIT, alias o posición de mercado..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500 text-sm"
          />
        </div>

        <div className="md:col-span-4">
          <select
            value={selectedDomain}
            onChange={(e) => setSelectedDomain(e.target.value)}
            className="w-full py-2.5 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Todos los Ramos</option>
            {ALL_DOMAINS.map((d) => (
              <option key={d.key} value={d.key}>
                {d.label}
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-3 flex items-center gap-2">
          <button
            onClick={() => setFilterRpa(filterRpa === true ? null : true)}
            className={`flex-1 py-2.5 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              filterRpa === true
                ? 'bg-purple-50 dark:bg-purple-950/60 border-purple-300 dark:border-purple-700 text-purple-700 dark:text-purple-300 shadow-xs'
                : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400'
            }`}
          >
            <Bot className="w-3.5 h-3.5" />
            <span>RPA / API</span>
          </button>

          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 px-2">
            {filteredInsurers.length} de {insurers.length}
          </span>
        </div>
      </div>

      {/* Grid of Insurers */}
      {loading ? (
        <div className="p-16 text-center text-slate-400">
          <RefreshCw className="w-8 h-8 mx-auto animate-spin mb-3 text-blue-600" />
          <p className="font-semibold text-sm">Cargando aseguradoras de Colombia...</p>
        </div>
      ) : filteredInsurers.length === 0 ? (
        <div className="p-12 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
          <Shield className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
          <p className="font-bold text-slate-700 dark:text-slate-300">No se encontraron aseguradoras</p>
          <p className="text-xs text-slate-400 mt-1">Intente cambiar los filtros o el término de búsqueda</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredInsurers.map((ins) => (
            <div
              key={ins.id || ins.code}
              className="group relative flex flex-col justify-between p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-md transition-all"
            >
              <div className="space-y-4">
                {/* Top card bar */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <InsurerLogo insurerName={ins.name} logoUrl={ins.logoUrl} size="lg" />
                    <div>
                      <h3 className="font-extrabold text-slate-900 dark:text-white group-hover:text-blue-600 transition-colors leading-tight">
                        {ins.name}
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                        NIT: {ins.nit || 'Sin registrar'}
                      </p>
                      {ins.domainUrl && (
                        <a
                          href={`https://${ins.domainUrl}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] text-blue-600 hover:underline mt-0.5"
                        >
                          <span>{ins.domainUrl}</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleOpenEdit(ins)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      title="Editar aseguradora"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(ins.id || ins.code, ins.name)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
                      title="Eliminar o desactivar"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Market position & Description */}
                {ins.marketPosition && (
                  <div className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-blue-50/70 dark:bg-blue-950/30 text-blue-800 dark:text-blue-300 border border-blue-100 dark:border-blue-900/40">
                    {ins.marketPosition}
                  </div>
                )}

                <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2 leading-relaxed">
                  {ins.description || ins.officialName}
                </p>

                {/* Automation capabilities */}
                <div className="flex items-center gap-2 pt-1 flex-wrap">
                  {ins.rpaEnabled && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                      <Bot className="w-3 h-3" />
                      Rocketbot RPA
                    </span>
                  )}
                  {ins.apiEnabled && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                      <Zap className="w-3 h-3" />
                      API Conectada
                    </span>
                  )}
                  {ins.isActive ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                      <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                      Activa
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-100 dark:bg-red-950/50 text-red-600 dark:text-red-400">
                      <XCircle className="w-3 h-3" />
                      Inactiva
                    </span>
                  )}
                </div>

                {/* Supported ramos badges */}
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] font-bold text-slate-400 mr-1 uppercase">Ramos:</span>
                  {(ins.supportedDomains || []).slice(0, 4).map((dom) => (
                    <span
                      key={dom}
                      className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 capitalize"
                    >
                      {dom.replace('_', ' ')}
                    </span>
                  ))}
                  {(ins.supportedDomains || []).length > 4 && (
                    <span className="text-[10px] font-bold text-slate-400">
                      +{ins.supportedDomains.length - 4} más
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Create / Edit */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 md:p-8 space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400">
                  <Building2 className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                    {editingInsurer ? 'Editar Aseguradora' : 'Nueva Aseguradora'}
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Configure identidad visual, datos corporativos y canales de integración
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {errorMsg && (
              <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs font-semibold">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Nombre Comercial *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name || ''}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Ej. Seguros SURA"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Razón Social Oficial (SFC)
                  </label>
                  <input
                    type="text"
                    value={formData.officialName || ''}
                    onChange={(e) => setFormData({ ...formData, officialName: e.target.value })}
                    placeholder="Ej. Seguros Generales Suramericana S.A."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    NIT / Identificación
                  </label>
                  <input
                    type="text"
                    value={formData.nit || ''}
                    onChange={(e) => setFormData({ ...formData, nit: e.target.value })}
                    placeholder="Ej. 890.903.407-9"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Dominio Web Oficial
                  </label>
                  <input
                    type="text"
                    value={formData.domainUrl || ''}
                    onChange={(e) => setFormData({ ...formData, domainUrl: e.target.value })}
                    placeholder="Ej. segurossura.com.co"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Color Primario Corporativo
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={formData.primaryColor || '#0F172A'}
                      onChange={(e) => setFormData({ ...formData, primaryColor: e.target.value })}
                      className="w-10 h-10 rounded-xl cursor-pointer border-0 bg-transparent p-0"
                    />
                    <input
                      type="text"
                      value={formData.primaryColor || '#0F172A'}
                      onChange={(e) => setFormData({ ...formData, primaryColor: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Monograma / Siglas (2-4 letras)
                  </label>
                  <input
                    type="text"
                    maxLength={4}
                    value={formData.monogram || ''}
                    onChange={(e) => setFormData({ ...formData, monogram: e.target.value.toUpperCase() })}
                    placeholder="Ej. SURA"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 uppercase font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  URL del Logotipo (PNG / SVG o Favicon)
                </label>
                <input
                  type="url"
                  value={formData.logoUrl || ''}
                  onChange={(e) => setFormData({ ...formData, logoUrl: e.target.value })}
                  placeholder="https://... o dejar vacío para insignia SVG generativa"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Posición de Mercado / Especialidad
                </label>
                <input
                  type="text"
                  value={formData.marketPosition || ''}
                  onChange={(e) => setFormData({ ...formData, marketPosition: e.target.value })}
                  placeholder="Ej. Líder en Cumplimiento y Fianzas Estatales"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Descripción Técnica & Conectores
                </label>
                <textarea
                  rows={2}
                  value={formData.description || ''}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Resumen del rol de la aseguradora y particularidades de emisión..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Toggles for RPA and API */}
              <div className="grid grid-cols-2 gap-4 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.rpaEnabled || false}
                    onChange={(e) => setFormData({ ...formData, rpaEnabled: e.target.checked })}
                    className="w-4 h-4 text-purple-600 rounded-sm focus:ring-purple-500"
                  />
                  <div>
                    <span className="block text-xs font-bold text-slate-800 dark:text-slate-200">
                      RPA Rocketbot
                    </span>
                    <span className="text-[11px] text-slate-400">Captura automática</span>
                  </div>
                </label>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.apiEnabled || false}
                    onChange={(e) => setFormData({ ...formData, apiEnabled: e.target.checked })}
                    className="w-4 h-4 text-emerald-600 rounded-sm focus:ring-emerald-500"
                  />
                  <div>
                    <span className="block text-xs font-bold text-slate-800 dark:text-slate-200">
                      API / Multicotizador
                    </span>
                    <span className="text-[11px] text-slate-400">Emisión directa</span>
                  </div>
                </label>
              </div>

              {/* Supported Ramos Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                  Ramos Soportados
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {ALL_DOMAINS.map((dom) => {
                    const isSelected = (formData.supportedDomains || []).includes(dom.key);
                    return (
                      <button
                        type="button"
                        key={dom.key}
                        onClick={() => handleToggleDomain(dom.key)}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border text-left transition-all ${
                          isSelected
                            ? 'bg-blue-600 border-blue-600 text-white'
                            : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        {dom.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Form buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 text-sm font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-6 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold shadow-md hover:shadow-lg disabled:opacity-50"
                >
                  {saving ? 'Guardando...' : editingInsurer ? 'Guardar Cambios' : 'Crear Aseguradora'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
