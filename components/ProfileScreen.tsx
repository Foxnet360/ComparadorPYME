import React, { useState, useEffect } from 'react';
import {
  User,
  Mail,
  Building,
  Phone,
  Briefcase,
  Save,
  Loader2,
  X,
  ShieldCheck,
  Award,
  MapPin,
  Image as ImageIcon,
  Upload,
  FileText,
  RotateCcw,
} from 'lucide-react';
import { storageService } from '../services/storageService';
import { organizationService } from '../services/organizationService';
import { UserProfile } from '../types';
import {
  CommercialPolicies,
  DEFAULT_COMMERCIAL_POLICIES,
  getEffectiveCommercialPolicies,
} from '../src/data/commercialPolicies';

interface ProfileScreenProps {
  currentUser: UserProfile;
  onUpdateProfile: (user: UserProfile) => void;
  onClose: () => void;
}

const ProfileScreen: React.FC<ProfileScreenProps> = ({ currentUser, onUpdateProfile, onClose }) => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    intermediaryName: '',
    registrationNumber: '',
    phone: '',
    field: '',
    address: '',
    city: '',
    bio: '',
    avatarUrl: '',
    logoUrl: '',
  });

  const [isLoading, setIsLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [activeTab, setActiveTab] = useState<'profile' | 'policies'>('profile');
  const [policies, setPolicies] = useState<CommercialPolicies>(() =>
    getEffectiveCommercialPolicies(currentUser?.commercialPolicies)
  );

  useEffect(() => {
    if (currentUser) {
      setFormData({
        name: currentUser.name || '',
        email: currentUser.email || '',
        intermediaryName: currentUser.intermediaryName || '',
        registrationNumber:
          currentUser.registrationNumber || currentUser.agentDetails?.registrationNumber || '',
        phone: currentUser.agentDetails?.phone || '',
        field: currentUser.agentDetails?.field || '',
        address: currentUser.address || currentUser.agentDetails?.address || '',
        city: currentUser.city || currentUser.agentDetails?.city || '',
        bio: currentUser.agentDetails?.bio || '',
        avatarUrl: currentUser.avatarUrl || '',
        logoUrl: currentUser.logoUrl || currentUser.agentDetails?.logoUrl || '',
      });

      if (currentUser.commercialPolicies) {
        setPolicies(getEffectiveCommercialPolicies(currentUser.commercialPolicies));
      }
    }

    let isMounted = true;
    if (currentUser?.allyId && currentUser.allyId.length === 36) {
      organizationService
        .getCommercialPolicies(currentUser.allyId)
        .then((loaded) => {
          if (isMounted && loaded) {
            setPolicies(loaded);
          }
        })
        .catch((err) => console.warn('Could not load org policies', err));
    }

    return () => {
      isMounted = false;
    };
  }, [currentUser]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handlePolicyChange = (
    field: keyof CommercialPolicies,
    value: string | number
  ) => {
    setPolicies((prev) => ({ ...prev, [field]: value }));
  };

  const handleResetPolicies = () => {
    setPolicies({ ...DEFAULT_COMMERCIAL_POLICIES });
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        setErrorMsg('El logo no debe superar los 2MB');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData((prev) => ({ ...prev, logoUrl: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const updatedUser: UserProfile = {
        ...currentUser,
        name: formData.name,
        intermediaryName: formData.intermediaryName,
        registrationNumber: formData.registrationNumber,
        address: formData.address,
        city: formData.city,
        logoUrl: formData.logoUrl,
        commercialPolicies: policies,
        avatarUrl:
          formData.avatarUrl ||
          `https://ui-avatars.com/api/?name=${encodeURIComponent(formData.name)}&background=4f46e5&color=fff`,
        agentDetails: {
          phone: formData.phone,
          field: formData.field,
          bio: formData.bio,
          registrationNumber: formData.registrationNumber,
          address: formData.address,
          city: formData.city,
          logoUrl: formData.logoUrl,
        },
      };

      await storageService.updateProfile(updatedUser);

      // Also persist to organization settings if allyId is a valid UUID
      if (currentUser?.allyId && currentUser.allyId.length === 36) {
        try {
          await organizationService.updateCommercialPolicies(currentUser.allyId, policies);
        } catch (orgErr) {
          console.warn('Could not sync policies to organization record', orgErr);
        }
      }

      onUpdateProfile(updatedUser);
      setSuccessMsg('Perfil y políticas comerciales actualizados correctamente.');

      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (_err: unknown) {
      setErrorMsg('Error al actualizar perfil.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto"
      aria-labelledby="modal-title"
      role="dialog"
      aria-modal="true"
    >
      <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        {/* Background Overlay */}
        <div
          className="fixed inset-0 bg-slate-500 bg-opacity-75 transition-opacity"
          onClick={onClose}
          aria-hidden="true"
        ></div>

        <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">
          &#8203;
        </span>

        <div className="inline-block align-bottom bg-white rounded-xl text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full">
          {/* Header */}
          <div className="bg-indigo-600 px-4 py-4 sm:px-6 flex justify-between items-center">
            <h3 className="text-lg leading-6 font-medium text-white flex items-center">
              <User className="mr-2 h-5 w-5" /> Perfil de Aliado / Intermediario
            </h3>
            <button
              onClick={onClose}
              className="text-indigo-100 hover:text-white transition-colors"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          {/* Navigation Tabs */}
          <div className="flex border-b border-slate-200 bg-slate-50 px-4 sm:px-6 pt-3 gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('profile')}
              className={`py-2 px-3 text-xs font-bold rounded-t-lg transition-colors flex items-center gap-1.5 border-t border-l border-r ${
                activeTab === 'profile'
                  ? 'bg-white text-indigo-700 border-slate-200 -mb-px shadow-xs'
                  : 'bg-transparent text-slate-500 border-transparent hover:text-slate-800'
              }`}
            >
              <User className="h-4 w-4" />
              <span>Datos de Correduría</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('policies')}
              className={`py-2 px-3 text-xs font-bold rounded-t-lg transition-colors flex items-center gap-1.5 border-t border-l border-r ${
                activeTab === 'policies'
                  ? 'bg-white text-indigo-700 border-slate-200 -mb-px shadow-xs'
                  : 'bg-transparent text-slate-500 border-transparent hover:text-slate-800'
              }`}
            >
              <FileText className="h-4 w-4" />
              <span>Políticas Comerciales (Exportaciones)</span>
            </button>
          </div>

          <form onSubmit={handleUpdate}>
            <div className="px-4 py-5 sm:p-6 space-y-6 max-h-[75vh] overflow-y-auto">
              {activeTab === 'profile' ? (
                <>
                  {/* Role & Hierarchy Badge Banner */}
                  <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3.5 flex items-center justify-between shadow-xs">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-indigo-600 text-white rounded-lg">
                        <ShieldCheck className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-indigo-900 uppercase tracking-wider">
                          Rol de Sistema Asignado
                        </div>
                        <div className="text-sm font-extrabold text-indigo-700">
                          {currentUser?.role === 'super_admin'
                            ? 'SUPER ADMINISTRADOR PLATAFORMA'
                            : currentUser?.role === 'ally_admin'
                              ? 'ADMINISTRADOR DE ALIADO (DIRECTOR TÉCNICO)'
                              : 'TÉCNICO ANALISTA DE SEGURIDAD'}
                        </div>
                      </div>
                    </div>
                    <span className="px-3 py-1 bg-indigo-600 text-white rounded-full text-xs font-bold uppercase tracking-wider">
                      {currentUser?.allyName || formData.intermediaryName || 'Aliado CSA'}
                    </span>
                  </div>

              {/* Asesor & Logo Section */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 bg-slate-50 p-4 rounded-xl border border-slate-200">
                {/* Asesor Info */}
                <div className="flex items-center space-x-4">
                  <img
                    className="h-16 w-16 rounded-full bg-slate-200 border border-slate-300 flex-shrink-0"
                    src={formData.avatarUrl || currentUser.avatarUrl}
                    alt="Avatar"
                  />
                  <div className="flex-1 min-w-0">
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Asesor Responsable
                    </label>
                    <input
                      name="name"
                      type="text"
                      value={formData.name}
                      onChange={handleChange}
                      placeholder="Nombre del corredor"
                      className="block w-full border border-slate-300 rounded-md shadow-sm p-2 text-sm focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>
                </div>

                {/* Intermediary Logo Picker */}
                <div className="flex items-center space-x-4">
                  <div className="h-16 w-24 bg-white border border-slate-300 rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0 p-1">
                    {formData.logoUrl ? (
                      <img
                        src={formData.logoUrl}
                        alt="Logo Aliado"
                        className="max-h-full max-w-full object-contain"
                      />
                    ) : (
                      <ImageIcon className="w-8 h-8 text-slate-300" />
                    )}
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Logo del Aliado (PDF/Excel)
                    </label>
                    <label className="cursor-pointer inline-flex items-center px-3 py-1.5 border border-slate-300 rounded-md text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 transition-colors">
                      <Upload className="w-3.5 h-3.5 mr-1.5 text-indigo-600" />
                      Subir Logo
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleLogoUpload}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>
              </div>

              {/* Form Grid */}
              <div className="grid grid-cols-1 gap-y-5 gap-x-4 sm:grid-cols-2">
                {/* Intermediary Name */}
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-slate-700">
                    Compañía / Agencia de Seguros (Aliado)
                  </label>
                  <div className="mt-1 relative rounded-md shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Building className="h-4 w-4 text-slate-400" />
                    </div>
                    <input
                      name="intermediaryName"
                      type="text"
                      value={formData.intermediaryName}
                      onChange={handleChange}
                      placeholder="Ej. Correval Seguros Ltda."
                      className="pl-9 block w-full border border-slate-300 rounded-md shadow-sm p-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    />
                  </div>
                </div>

                {/* Registration Number */}
                <div>
                  <label className="block text-sm font-medium text-slate-700">
                    Nº Matrícula / Registro
                  </label>
                  <div className="mt-1 relative rounded-md shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Award className="h-4 w-4 text-slate-400" />
                    </div>
                    <input
                      name="registrationNumber"
                      type="text"
                      value={formData.registrationNumber}
                      onChange={handleChange}
                      placeholder="Ej. Superfinanciera Reg. 9042"
                      className="pl-9 block w-full border border-slate-300 rounded-md shadow-sm p-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    />
                  </div>
                </div>

                {/* Phone */}
                <div>
                  <label className="block text-sm font-medium text-slate-700">
                    Teléfono de Contacto
                  </label>
                  <div className="mt-1 relative rounded-md shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Phone className="h-4 w-4 text-slate-400" />
                    </div>
                    <input
                      name="phone"
                      type="tel"
                      value={formData.phone}
                      onChange={handleChange}
                      placeholder="+57 (601) 234-5678"
                      className="pl-9 block w-full border border-slate-300 rounded-md shadow-sm p-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    />
                  </div>
                </div>

                {/* Address */}
                <div>
                  <label className="block text-sm font-medium text-slate-700">
                    Dirección Comercial
                  </label>
                  <div className="mt-1 relative rounded-md shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <MapPin className="h-4 w-4 text-slate-400" />
                    </div>
                    <input
                      name="address"
                      type="text"
                      value={formData.address}
                      onChange={handleChange}
                      placeholder="Calle 100 # 19-61 Off 502"
                      className="pl-9 block w-full border border-slate-300 rounded-md shadow-sm p-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    />
                  </div>
                </div>

                {/* City */}
                <div>
                  <label className="block text-sm font-medium text-slate-700">
                    Ciudad / Ubicación
                  </label>
                  <div className="mt-1 relative rounded-md shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <MapPin className="h-4 w-4 text-slate-400" />
                    </div>
                    <input
                      name="city"
                      type="text"
                      value={formData.city}
                      onChange={handleChange}
                      placeholder="Bogotá D.C."
                      className="pl-9 block w-full border border-slate-300 rounded-md shadow-sm p-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    />
                  </div>
                </div>

                {/* Specialty Field */}
                <div>
                  <label className="block text-sm font-medium text-slate-700">
                    Ramo / Especialidad
                  </label>
                  <div className="mt-1 relative rounded-md shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Briefcase className="h-4 w-4 text-slate-400" />
                    </div>
                    <input
                      name="field"
                      type="text"
                      value={formData.field}
                      onChange={handleChange}
                      placeholder="Ej. Copropiedades, Cumplimiento, Pyme"
                      className="pl-9 block w-full border border-slate-300 rounded-md shadow-sm p-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    />
                  </div>
                </div>

                {/* Email (Read Only) */}
                <div>
                  <label className="block text-sm font-medium text-slate-700">
                    Correo Electrónico (Solo Lectura)
                  </label>
                  <div className="mt-1 relative rounded-md shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Mail className="h-4 w-4 text-slate-400" />
                    </div>
                    <input
                      name="email"
                      type="email"
                      value={formData.email}
                      disabled
                      className="pl-9 block w-full bg-slate-50 border border-slate-300 rounded-md shadow-sm p-2 text-slate-500 sm:text-sm cursor-not-allowed"
                    />
                  </div>
                </div>
              </div>
                </>
              ) : (
                <div className="space-y-5">
                  <div className="bg-indigo-50/70 border border-indigo-200 rounded-xl p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <div>
                      <h4 className="text-sm font-bold text-indigo-900 flex items-center gap-1.5">
                        <FileText className="h-4 w-4 text-indigo-600" />
                        Políticas Comerciales de la Correduría
                      </h4>
                      <p className="text-xs text-indigo-700 mt-1 max-w-xl">
                        Estas condiciones se inyectan automáticamente en la portada y páginas de respaldo de los reportes PDF y libros Excel exportados para sus clientes.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleResetPolicies}
                      className="px-3 py-1.5 bg-white border border-indigo-200 text-indigo-700 hover:bg-indigo-50 rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-2xs whitespace-nowrap transition-colors"
                      title="Restablecer términos sugeridos estándar en Colombia"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      <span>Restablecer Estándar</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                        Plazo de Validez de la Oferta (Días Calendario)
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="90"
                        value={policies.offerValidityDays}
                        onChange={(e) =>
                          handlePolicyChange('offerValidityDays', parseInt(e.target.value) || 15)
                        }
                        className="w-full sm:w-48 block border border-slate-300 rounded-md shadow-xs p-2 text-sm focus:ring-indigo-500 focus:border-indigo-500 font-semibold text-slate-800"
                      />
                      <span className="text-[11px] text-slate-500 mt-0.5 block">
                        Días de vigencia garantizada para las cotizaciones presentadas al cliente.
                      </span>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                        Condiciones de Recaudo y Financiación
                      </label>
                      <textarea
                        rows={2}
                        value={policies.paymentConditions}
                        onChange={(e) => handlePolicyChange('paymentConditions', e.target.value)}
                        placeholder="Ej. Pago de contado con descuento o cuotas mensuales..."
                        className="w-full block border border-slate-300 rounded-md shadow-xs p-2.5 text-xs text-slate-800 focus:ring-indigo-500 focus:border-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                        Requisitos de Inspección y Suscripción Previa
                      </label>
                      <textarea
                        rows={2}
                        value={policies.inspectionRequirements}
                        onChange={(e) => handlePolicyChange('inspectionRequirements', e.target.value)}
                        placeholder="Ej. Inspección obligatoria para bienes > 500 SMMLV..."
                        className="w-full block border border-slate-300 rounded-md shadow-xs p-2.5 text-xs text-slate-800 focus:ring-indigo-500 focus:border-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                        Requisitos Obligatorios para Expedición
                      </label>
                      <textarea
                        rows={2}
                        value={policies.issuanceRequirements}
                        onChange={(e) => handlePolicyChange('issuanceRequirements', e.target.value)}
                        placeholder="Ej. Orden de expedición firmada, SARLAFT vigente y RUT..."
                        className="w-full block border border-slate-300 rounded-md shadow-xs p-2.5 text-xs text-slate-800 focus:ring-indigo-500 focus:border-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                        Procedimiento de Atención y Notificación de Siniestros (Art. 1075 C.Co.)
                      </label>
                      <textarea
                        rows={2}
                        value={policies.claimsPolicy}
                        onChange={(e) => handlePolicyChange('claimsPolicy', e.target.value)}
                        placeholder="Ej. Aviso dentro de los 3 días hábiles siguientes..."
                        className="w-full block border border-slate-300 rounded-md shadow-xs p-2.5 text-xs text-slate-800 focus:ring-indigo-500 focus:border-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                        Alcance del Asesor / Intermediación
                      </label>
                      <textarea
                        rows={2}
                        value={policies.intermediationScope}
                        onChange={(e) => handlePolicyChange('intermediationScope', e.target.value)}
                        placeholder="Ej. Asesoría técnica integral e imparcial..."
                        className="w-full block border border-slate-300 rounded-md shadow-xs p-2.5 text-xs text-slate-800 focus:ring-indigo-500 focus:border-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                        Notas Especiales / Observaciones Particulares (Opcional)
                      </label>
                      <textarea
                        rows={2}
                        value={policies.customNotes || ''}
                        onChange={(e) => handlePolicyChange('customNotes', e.target.value)}
                        placeholder="Ej. Sujeto a no siniestralidad previa..."
                        className="w-full block border border-slate-300 rounded-md shadow-xs p-2.5 text-xs text-slate-800 focus:ring-indigo-500 focus:border-indigo-500"
                      />
                    </div>
                  </div>
                </div>
              )}

              {successMsg && (
                <div className="rounded-md bg-green-50 p-4">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <ShieldCheck className="h-5 w-5 text-green-400" />
                    </div>
                    <div className="ml-3">
                      <p className="text-sm font-medium text-green-800">{successMsg}</p>
                    </div>
                  </div>
                </div>
              )}

              {errorMsg && (
                <div className="rounded-md bg-red-50 p-4">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <X className="h-5 w-5 text-red-400" />
                    </div>
                    <div className="ml-3">
                      <p className="text-sm font-medium text-red-800">{errorMsg}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-slate-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-base font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-70 font-semibold"
              >
                {isLoading ? (
                  <Loader2 className="animate-spin h-5 w-5" />
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" /> Guardar Perfil del Aliado
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="mt-3 w-full inline-flex justify-center rounded-md border border-slate-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ProfileScreen;
