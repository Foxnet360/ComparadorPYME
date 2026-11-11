import React from 'react';
import {
  ShieldCheck,
  Building2,
  Phone,
  Mail,
  Globe,
  FileText,
  Lock,
  Scale,
  Shield,
  ExternalLink,
  AlertCircle,
} from 'lucide-react';
import type { UserProfile } from '../../types';

export type LegalTabType = 'terms' | 'privacy' | 'security' | 'disclaimer';

interface AppFooterProps {
  currentUser?: UserProfile | null;
  onOpenLegalModal: (tab: LegalTabType) => void;
}

export const AppFooter: React.FC<AppFooterProps> = ({
  currentUser,
  onOpenLegalModal,
}) => {
  const brokerName =
    currentUser?.intermediaryName ||
    currentUser?.agencyName ||
    'Corredores de Seguros Asociados S.A.';
  const advisorName = currentUser?.name || 'Asesor Técnico de Seguros';
  const brokerPhone =
    currentUser?.agentDetails?.phone || currentUser?.phone || '+57 (601) 345-6789';
  const brokerEmail = currentUser?.email || 'soporte@comparadorcsa.com';
  const brokerRegistration =
    currentUser?.registrationNumber ||
    currentUser?.agentDetails?.registrationNumber ||
    'Inscripción Vigente SFC';
  const brokerWebsite = 'https://correseguros.co/';

  return (
    <footer className="bg-slate-900 text-slate-300 border-t border-slate-800 mt-auto text-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pb-8 border-b border-slate-800">
          {/* Columna 1: Identidad del Intermediario */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-indigo-600 text-white">
                <Building2 className="w-4 h-4" />
              </div>
              <span className="font-bold text-white text-sm tracking-tight">
                {brokerName}
              </span>
            </div>

            <p className="text-slate-400 text-xs leading-relaxed">
              Intermediación técnica y auditoría de pólizas de seguros. Asesoría consultiva,
              acompañamiento en colocación y radicación de siniestros.
            </p>

            <div className="space-y-1.5 pt-1 text-slate-300">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                <span>
                  Registro / Licencia: <strong className="text-white font-medium">{brokerRegistration}</strong>
                </span>
              </div>
              {currentUser?.name && (
                <div className="flex items-center gap-2">
                  <span className="text-slate-400">Asesor:</span>
                  <span className="text-white font-medium">{advisorName}</span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <a
                  href={`tel:${brokerPhone.replace(/[^0-9+]/g, '')}`}
                  className="hover:text-indigo-400 transition-colors"
                >
                  {brokerPhone}
                </a>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <a
                  href={`mailto:${brokerEmail}`}
                  className="hover:text-indigo-400 transition-colors"
                >
                  {brokerEmail}
                </a>
              </div>
              <div className="flex items-center gap-2">
                <Globe className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                <a
                  href={brokerWebsite}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-indigo-400 hover:text-indigo-300 font-medium inline-flex items-center gap-1 transition-colors"
                >
                  <span>correseguros.co</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          </div>

          {/* Columna 2: Marco Legal y Privacidad (Accesos Directos Interactivos) */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-emerald-600/20 text-emerald-400 border border-emerald-500/30">
                <Scale className="w-4 h-4" />
              </div>
              <span className="font-bold text-white text-sm tracking-tight">
                Marco Legal y Privacidad
              </span>
            </div>

            <p className="text-slate-400 text-xs leading-relaxed">
              Cumplimiento estricto del ordenamiento jurídico colombiano y protección de datos
              personales (Habeas Data).
            </p>

            <ul className="space-y-2 pt-1">
              <li>
                <button
                  type="button"
                  onClick={() => onOpenLegalModal('terms')}
                  className="flex items-center gap-2 text-slate-300 hover:text-white transition-colors cursor-pointer group text-left"
                >
                  <FileText className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-400 transition-colors" />
                  <span className="group-hover:underline">Términos y Condiciones del Servicio</span>
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onOpenLegalModal('privacy')}
                  className="flex items-center gap-2 text-slate-300 hover:text-white transition-colors cursor-pointer group text-left"
                >
                  <Lock className="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-400 transition-colors" />
                  <span className="group-hover:underline">
                    Política de Privacidad y Habeas Data (Ley 1581 de 2012)
                  </span>
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onOpenLegalModal('security')}
                  className="flex items-center gap-2 text-slate-300 hover:text-white transition-colors cursor-pointer group text-left"
                >
                  <Shield className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-400 transition-colors" />
                  <span className="group-hover:underline">
                    Seguridad de la Información y Arquitectura Zero-Trust
                  </span>
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onOpenLegalModal('disclaimer')}
                  className="flex items-center gap-2 text-slate-300 hover:text-white transition-colors cursor-pointer group text-left"
                >
                  <AlertCircle className="w-3.5 h-3.5 text-slate-400 group-hover:text-amber-400 transition-colors" />
                  <span className="group-hover:underline">
                    Descargo de Responsabilidad y Naturaleza Consultiva
                  </span>
                </button>
              </li>
            </ul>
          </div>

          {/* Columna 3: Procedimientos, Siniestros y Supervisión */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-amber-600/20 text-amber-400 border border-amber-500/30">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <span className="font-bold text-white text-sm tracking-tight">
                Supervisión y Procedimientos
              </span>
            </div>

            <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-3 space-y-2 text-slate-300">
              <div className="flex items-start gap-2">
                <span className="text-amber-400 font-bold shrink-0">⚖️</span>
                <p className="text-[11px] leading-relaxed">
                  <strong className="text-white">Aviso Perentorio de Siniestros:</strong> Conforme al
                  Artículo 1075 del Código de Comercio, el asegurado o beneficiario debe dar noticia
                  del siniestro al asegurador dentro de los <strong className="text-amber-300">3 días hábiles</strong> siguientes
                  a la fecha en que lo haya conocido.
                </p>
              </div>
              <div className="flex items-start gap-2 pt-1 border-t border-slate-700/40">
                <span className="text-indigo-400 font-bold shrink-0">🏛️</span>
                <p className="text-[11px] leading-relaxed">
                  <strong className="text-white">Vigilancia Estatal:</strong> Actividad de intermediación
                  sujeta al Estatuto Orgánico del Sistema Financiero (Decreto 663 de 1993) e inspección
                  de la <strong className="text-slate-100">Superintendencia Financiera de Colombia</strong>.
                </p>
              </div>
            </div>

            <p className="text-[11px] text-slate-400 leading-normal">
              Las cotizaciones y dictámenes generados son herramientas de apoyo analítico y no
              sustituyen las condiciones particulares de las pólizas expedidas por las aseguradoras.
            </p>
          </div>
        </div>

        {/* Fila Inferior / Copyright & Créditos */}
        <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-slate-400 text-xs">
          <p>
            © {new Date().getFullYear()} <strong className="text-slate-300">Corredores de Seguros Asociados S.A.</strong> Todos los derechos reservados.
          </p>
          <div className="flex items-center gap-4 text-[11px]">
            <a
              href={brokerWebsite}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-indigo-400 transition-colors"
            >
              Portal Corporativo CSA
            </a>
            <span className="text-slate-700">·</span>
            <span>Plataforma Comparador CSA v1.0</span>
            <span className="text-slate-700">·</span>
            <span className="text-slate-400">Colombia</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
