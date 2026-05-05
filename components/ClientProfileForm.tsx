import React, { useState } from 'react';
import { Building2, Users, MapPin, Briefcase, DollarSign, Save } from 'lucide-react';

export interface ClientProfileFormData {
  industryType: string;
  locationCity: string;
  locationZone: string;
  hasSingleSupplier: boolean;
  employeeCount: number;
  buildingType: string;
  primaryActivity: string;
  annualRevenue?: number;
}

interface ClientProfileFormProps {
  initialData?: Partial<ClientProfileFormData>;
  onSave: (data: ClientProfileFormData) => void;
}

export const ClientProfileForm: React.FC<ClientProfileFormProps> = ({
  initialData,
  onSave
}) => {
  const [formData, setFormData] = useState<ClientProfileFormData>({
    industryType: initialData?.industryType || '',
    locationCity: initialData?.locationCity || '',
    locationZone: initialData?.locationZone || '',
    hasSingleSupplier: initialData?.hasSingleSupplier || false,
    employeeCount: initialData?.employeeCount || 0,
    buildingType: initialData?.buildingType || '',
    primaryActivity: initialData?.primaryActivity || '',
    annualRevenue: initialData?.annualRevenue
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Industry Type */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            <Briefcase className="inline mr-1" size={14} />
            Tipo de Industria
          </label>
          <select
            value={formData.industryType}
            onChange={(e) => setFormData({ ...formData, industryType: e.target.value })}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">Seleccionar...</option>
            <option value="manufactura">Manufactura</option>
            <option value="comercio">Comercio</option>
            <option value="servicios">Servicios</option>
            <option value="construccion">Construcción</option>
            <option value="transporte">Transporte</option>
            <option value="otro">Otro</option>
          </select>
        </div>

        {/* Location Zone */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            <MapPin className="inline mr-1" size={14} />
            Zona Geográfica
          </label>
          <select
            value={formData.locationZone}
            onChange={(e) => setFormData({ ...formData, locationZone: e.target.value })}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">Seleccionar...</option>
            <option value="costera">Costera</option>
            <option value="montana">Montaña</option>
            <option value="urbana">Urbana</option>
            <option value="industrial">Industrial</option>
            <option value="rural">Rural</option>
          </select>
        </div>

        {/* Location City */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Ciudad
          </label>
          <input
            type="text"
            value={formData.locationCity}
            onChange={(e) => setFormData({ ...formData, locationCity: e.target.value })}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            placeholder="Ej: Bogotá, Cartagena"
          />
        </div>

        {/* Employee Count */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            <Users className="inline mr-1" size={14} />
            Número de Empleados
          </label>
          <input
            type="number"
            value={formData.employeeCount}
            onChange={(e) => setFormData({ ...formData, employeeCount: parseInt(e.target.value) || 0 })}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>

        {/* Building Type */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            <Building2 className="inline mr-1" size={14} />
            Tipo de Inmueble
          </label>
          <select
            value={formData.buildingType}
            onChange={(e) => setFormData({ ...formData, buildingType: e.target.value })}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">Seleccionar...</option>
            <option value="propio">Propio</option>
            <option value="arrendado">Arrendado</option>
            <option value="mixto">Mixto</option>
          </select>
        </div>

        {/* Primary Activity */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Actividad Principal
          </label>
          <input
            type="text"
            value={formData.primaryActivity}
            onChange={(e) => setFormData({ ...formData, primaryActivity: e.target.value })}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            placeholder="Ej: Fabricación de alimentos"
          />
        </div>

        {/* Annual Revenue */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            <DollarSign className="inline mr-1" size={14} />
            Ingresos Anuales (COP)
          </label>
          <input
            type="number"
            value={formData.annualRevenue || ''}
            onChange={(e) => setFormData({ ...formData, annualRevenue: parseInt(e.target.value) || undefined })}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            placeholder="Ej: 1000000000"
          />
        </div>

        {/* Single Supplier */}
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="singleSupplier"
            checked={formData.hasSingleSupplier}
            onChange={(e) => setFormData({ ...formData, hasSingleSupplier: e.target.checked })}
            className="rounded border-slate-300"
          />
          <label htmlFor="singleSupplier" className="text-sm text-slate-700">
            Depende de un único proveedor clave
          </label>
        </div>
      </div>

      <button
        type="submit"
        className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
      >
        <Save size={16} />
        Guardar Perfil
      </button>
    </form>
  );
};

export default ClientProfileForm;
