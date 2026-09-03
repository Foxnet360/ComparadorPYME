import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Zap,
  FileText,
  CheckCircle,
  BarChart3,
  ArrowRight,
  Star,
  Menu,
  X,
  Lock,
  TrendingUp,
  AlertTriangle,
  Mail,
  Phone,
  MapPin,
  Globe,
  MessageCircle,
  Building2,
  Car,
  Building,
  Users,
  Stethoscope,
  Scale,
  Truck,
  BookOpen,
  Sparkles,
  FileCheck,
  Award,
  Briefcase,
} from 'lucide-react';

interface LandingPageProps {
  onLoginClick: () => void;
  onRegisterClick: () => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ onLoginClick, onRegisterClick }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [activeDomainTab, setActiveDomainTab] = useState<string>('copropiedades');

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
      setMobileMenuOpen(false);
    }
  };

  const domainsInfo = [
    {
      id: 'copropiedades',
      title: 'Copropiedades',
      norm: 'Ley 675 de Propiedad Horizontal',
      icon: Building,
      desc: 'Auditoría de pólizas de copropiedad (edificios y conjuntos) verificando amparos obligatorios de bienes comunes, reconstrucción y RCE.',
      highlights: [
        'Verificación amparo bienes comunes',
        'Cálculo de valores asegurados vs. coeficiente',
        'Revisión de cláusula de reconstrucción',
      ],
    },
    {
      id: 'cumplimiento',
      title: 'Cumplimiento y Fianzas',
      norm: 'Ley 80 de 1993 / Decreto 1082',
      icon: Scale,
      desc: 'Validación contractual y estatal de pólizas de cumplimiento, suficiencia de amparos (buen manejo del anticipo, cumplimiento, salarios).',
      highlights: [
        'Checklist Ley 80 para contratación pública',
        'Análisis de vigencias y porcentajes de garantía',
        'Detección de exclusiones en clausulado',
      ],
    },
    {
      id: 'salud',
      title: 'Salud & Prepagada',
      norm: 'Resolución 244 / Decreto 780',
      icon: Stethoscope,
      desc: 'Comparación de planes voluntarios de salud, preexistencias, periodos de carencia, redes hospitalarias y coberturas internacionales.',
      highlights: [
        'Matriz de preexistencias y carencias',
        'Comparativa de topes y copagos',
        'Verificación de cuadro médico/redes',
      ],
    },
    {
      id: 'transporte',
      title: 'Transporte de Mercancías',
      norm: 'Incoterms 2020 / Cod. Comercio',
      icon: Truck,
      desc: 'Evaluación de pólizas de transporte terrestre, marítimo y aéreo, cláusulas Institute Cargo Clauses (A, B, C) y concordancia con Incoterms.',
      highlights: [
        'Validación de coberturas según Incoterm',
        'Análisis de trayectos y transbordos',
        'Alertas por deducibles en falta de entrega',
      ],
    },
    {
      id: 'pyme',
      title: 'Pyme & Comercial',
      norm: 'Código de Comercio - Libro IV',
      icon: Building2,
      desc: 'Homologación de 14 categorías multiriesgo empresarial (incendio, lucro cesante, sustracción, RCE, equipo electrónico).',
      highlights: [
        'Matriz canónica homologada de 14 categorías',
        'Detección de coberturas fantasma',
        'Evaluación de sublímites y garantías',
      ],
    },
    {
      id: 'autos',
      title: 'Autos & Flotas',
      norm: 'Circular Básica Jurídica Superfinanciera',
      icon: Car,
      desc: 'Análisis masivo de cotizaciones individuales y de flotas comerciales, coberturas RCE, pérdida total/parcial y asistencias.',
      highlights: [
        'Comparativa rápida de deducibles por evento',
        'Análisis de coberturas de asistencia',
        'Evaluación de amparo patrimonial',
      ],
    },
    {
      id: 'vida',
      title: 'Vida Grupo & Colectivos',
      norm: 'Estatuto Orgánico del Sistema Financiero',
      icon: Users,
      desc: 'Pólizas colectivas de vida, invalidez, incapacidad y enfermedades graves para empleados con análisis por tablas de edades.',
      highlights: [
        'Verificación de amparos adicionales',
        'Análisis de valores asegurados por perfil',
        'Cálculo de prima promedio por asegurado',
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 overflow-x-hidden">
      {/* Navigation */}
      <nav
        className={`fixed w-full z-50 transition-all duration-300 ${
          scrolled
            ? 'bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-sm'
            : 'bg-white/80 backdrop-blur-md border-b border-slate-100'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-20 items-center">
            <div className="flex items-center space-x-3">
              <div className="bg-gradient-to-br from-indigo-600 to-blue-600 p-2.5 rounded-xl shadow-lg shadow-indigo-200">
                <ShieldCheck className="text-white w-6 h-6" />
              </div>
              <div>
                <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-700 to-blue-600">
                  Comparador CSA
                </span>
                <p className="text-xs text-slate-500 -mt-1 font-medium">
                  Multiramo & Multi-Aseguradora
                </p>
              </div>
            </div>

            {/* Desktop Menu */}
            <div className="hidden md:flex items-center space-x-8">
              <button
                onClick={() => scrollToSection('domains')}
                className="text-slate-600 hover:text-indigo-600 font-medium transition-colors"
              >
                Ramos & Normativas
              </button>
              <button
                onClick={() => scrollToSection('features')}
                className="text-slate-600 hover:text-indigo-600 font-medium transition-colors"
              >
                Capacidades RAG
              </button>
              <button
                onClick={() => scrollToSection('how-it-works')}
                className="text-slate-600 hover:text-indigo-600 font-medium transition-colors"
              >
                Cómo Funciona
              </button>
              <button
                onClick={() => scrollToSection('benefits')}
                className="text-slate-600 hover:text-indigo-600 font-medium transition-colors"
              >
                Beneficios
              </button>
              <div className="flex items-center space-x-4 ml-6 border-l border-slate-200 pl-6">
                <button
                  onClick={onLoginClick}
                  className="text-slate-700 font-medium hover:text-indigo-600 transition-colors"
                >
                  Iniciar Sesión
                </button>
                <button
                  onClick={onRegisterClick}
                  className="px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-blue-600 text-white rounded-full font-semibold shadow-lg shadow-indigo-200 hover:shadow-xl hover:scale-105 transition-all duration-300"
                >
                  Comenzar Gratis
                </button>
              </div>
            </div>

            {/* Mobile Menu Button */}
            <div className="md:hidden flex items-center">
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="text-slate-600 hover:text-indigo-600 p-2"
              >
                {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-white border-b border-slate-100 absolute w-full px-4 py-4 shadow-xl flex flex-col space-y-4">
            <button
              onClick={() => scrollToSection('domains')}
              className="text-left text-lg font-medium text-slate-700 py-2"
            >
              Ramos & Normativas
            </button>
            <button
              onClick={() => scrollToSection('features')}
              className="text-left text-lg font-medium text-slate-700 py-2"
            >
              Capacidades RAG
            </button>
            <button
              onClick={() => scrollToSection('how-it-works')}
              className="text-left text-lg font-medium text-slate-700 py-2"
            >
              Cómo Funciona
            </button>
            <button
              onClick={() => scrollToSection('benefits')}
              className="text-left text-lg font-medium text-slate-700 py-2"
            >
              Beneficios
            </button>
            <button
              onClick={onLoginClick}
              className="text-left text-lg font-medium text-slate-700 py-2"
            >
              Iniciar Sesión
            </button>
            <button
              onClick={onRegisterClick}
              className="w-full bg-gradient-to-r from-indigo-600 to-blue-600 text-white py-3 rounded-xl font-bold shadow-lg"
            >
              Crear Cuenta
            </button>
          </div>
        )}
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 lg:pt-44 lg:pb-28 relative overflow-hidden">
        <div className="absolute top-0 right-0 -mr-40 -mt-40 w-[600px] h-[600px] bg-gradient-to-br from-indigo-200/40 to-blue-200/40 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-0 -ml-40 -mb-40 w-[500px] h-[500px] bg-gradient-to-tr from-purple-200/40 to-indigo-200/40 rounded-full blur-3xl"></div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="text-center lg:text-left">
              <div className="inline-flex items-center px-4 py-2 bg-indigo-50 text-indigo-700 rounded-full text-xs sm:text-sm font-semibold mb-6 border border-indigo-100">
                <Sparkles size={16} className="mr-2 text-indigo-600" />
                IA RAG + Abogado Virtual con Respaldo Regulatorio
              </div>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-slate-900 tracking-tight mb-6 leading-tight">
                Análisis Técnico y Auditoría RAG
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-blue-600">
                  {' '}
                  Multiramo & Multi-Aseguradora
                </span>
              </h1>
              <p className="text-lg sm:text-xl text-slate-600 mb-8 leading-relaxed">
                Audita cotizaciones en PDF contrastándolas con clausulados contractuales y marcos
                legales (Ley 675, Ley 80, Res. 244, Incoterms). Detecta coberturas fantasma, evalúa
                riesgos de deducibles y genera evidencia verbatim en PDF.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start mb-10">
                <button
                  onClick={onRegisterClick}
                  className="px-8 py-4 bg-gradient-to-r from-indigo-600 to-blue-600 text-white rounded-full text-lg font-bold shadow-xl shadow-indigo-300 hover:shadow-2xl hover:scale-105 transition-all flex items-center justify-center"
                >
                  Auditar mi primera cotización <ArrowRight className="ml-2 w-5 h-5" />
                </button>
                <button
                  onClick={() => scrollToSection('domains')}
                  className="px-8 py-4 bg-white text-slate-700 border-2 border-slate-200 rounded-full text-lg font-bold hover:border-indigo-300 hover:bg-indigo-50 transition-all"
                >
                  Explorar Ramos Normativos
                </button>
              </div>

              {/* Supported Domains Chips */}
              <div className="pt-4 border-t border-slate-200/80">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 text-center lg:text-left">
                  Ramos Especializados y Normativa Integrada:
                </p>
                <div className="flex flex-wrap gap-2 justify-center lg:justify-start">
                  <span className="inline-flex items-center px-3 py-1 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 shadow-sm">
                    <Building className="w-3.5 h-3.5 mr-1.5 text-indigo-600" /> Copropiedades (Ley
                    675)
                  </span>
                  <span className="inline-flex items-center px-3 py-1 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 shadow-sm">
                    <Scale className="w-3.5 h-3.5 mr-1.5 text-blue-600" /> Cumplimiento (Ley 80)
                  </span>
                  <span className="inline-flex items-center px-3 py-1 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 shadow-sm">
                    <Stethoscope className="w-3.5 h-3.5 mr-1.5 text-teal-600" /> Salud (Res. 244)
                  </span>
                  <span className="inline-flex items-center px-3 py-1 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 shadow-sm">
                    <Truck className="w-3.5 h-3.5 mr-1.5 text-amber-600" /> Transporte (Incoterms)
                  </span>
                  <span className="inline-flex items-center px-3 py-1 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 shadow-sm">
                    <Building2 className="w-3.5 h-3.5 mr-1.5 text-purple-600" /> Pyme
                  </span>
                  <span className="inline-flex items-center px-3 py-1 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 shadow-sm">
                    <Car className="w-3.5 h-3.5 mr-1.5 text-emerald-600" /> Autos
                  </span>
                  <span className="inline-flex items-center px-3 py-1 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 shadow-sm">
                    <Briefcase className="w-3.5 h-3.5 mr-1.5 text-orange-600" /> Maquinaria (Art.
                    1083)
                  </span>
                  <span className="inline-flex items-center px-3 py-1 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 shadow-sm">
                    <Globe className="w-3.5 h-3.5 mr-1.5 text-cyan-600" /> Casco Embarcación (DIMAR)
                  </span>
                </div>
              </div>

              {/* Stats */}
              <div className="mt-8 grid grid-cols-3 gap-6 text-center lg:text-left">
                <div>
                  <div className="text-2xl font-extrabold text-indigo-600">2 min</div>
                  <div className="text-xs text-slate-500 font-medium">Análisis RAG con IA</div>
                </div>
                <div>
                  <div className="text-2xl font-extrabold text-indigo-600">10 Ramos</div>
                  <div className="text-xs text-slate-500 font-medium">Soporte regulatorio</div>
                </div>
                <div>
                  <div className="text-2xl font-extrabold text-indigo-600">100%</div>
                  <div className="text-xs text-slate-500 font-medium">Evidencia Verbatim PDF</div>
                </div>
              </div>
            </div>

            {/* Hero Visual - Realistic RAG / Abogado Virtual UI Mockup */}
            <div className="hidden lg:block relative">
              <div className="relative bg-white rounded-2xl shadow-2xl p-6 border border-slate-200">
                <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100">
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 rounded-full bg-red-400"></div>
                    <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
                    <div className="w-3 h-3 rounded-full bg-green-400"></div>
                    <span className="text-xs font-bold text-slate-600 ml-2">
                      Auditoría RAG & Abogado Virtual
                    </span>
                  </div>
                  <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-md">
                    Ley 675 / Ley 80 Verified
                  </span>
                </div>

                <div className="space-y-3.5">
                  {/* Coverage Status Bar */}
                  <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-slate-800 flex items-center">
                        <FileCheck className="w-4 h-4 mr-1 text-indigo-600" />
                        Matriz de Cobertura Bidireccional
                      </span>
                      <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                        Score 92/100
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-[11px] font-medium">
                      <div className="bg-white p-2 rounded border border-slate-200">
                        <div className="text-slate-500 text-[10px]">Incendio Pyme</div>
                        <div className="text-emerald-700 font-bold flex items-center mt-0.5">
                          ✓ Verificada
                        </div>
                      </div>
                      <div className="bg-white p-2 rounded border border-slate-200">
                        <div className="text-slate-500 text-[10px]">Bienes Comunes</div>
                        <div className="text-emerald-700 font-bold flex items-center mt-0.5">
                          ✓ Ley 675 OK
                        </div>
                      </div>
                      <div className="bg-white p-2 rounded border border-amber-200 bg-amber-50/50">
                        <div className="text-amber-800 text-[10px]">Terremoto Sublímite</div>
                        <div className="text-amber-700 font-bold flex items-center mt-0.5">
                          ⚠ Fantasma
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Virtual Lawyer Card */}
                  <div className="bg-gradient-to-br from-indigo-900 to-slate-900 text-white p-4 rounded-xl shadow-md">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <BookOpen className="w-4 h-4 text-indigo-300" />
                        <span className="text-xs font-bold text-indigo-100">
                          Abogado Virtual RAG
                        </span>
                      </div>
                      <span className="text-[10px] bg-indigo-500/30 text-indigo-200 border border-indigo-400/30 px-2 py-0.5 rounded">
                        Cita textual Pág. 14
                      </span>
                    </div>
                    <p className="text-[11px] text-indigo-200 leading-relaxed italic mb-2">
                      "La póliza omite el amparo obligatorio de reconstrucción a valor comercial
                      exigido por la Ley 675 Art 15. Se sugiere solicitar anexo aclaratorio."
                    </p>
                    <div className="flex items-center justify-between text-[10px] text-slate-300 border-t border-indigo-800/80 pt-2 mt-2">
                      <span className="text-emerald-400 font-semibold">
                        Punto de negociación #1
                      </span>
                      <span className="underline cursor-pointer text-indigo-300 hover:text-white">
                        Abrir en Visor PDF →
                      </span>
                    </div>
                  </div>

                  {/* Deductibles Gauge */}
                  <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl flex items-center justify-between">
                    <div className="flex items-center text-amber-900 text-xs">
                      <AlertTriangle className="w-4 h-4 text-amber-600 mr-2 flex-shrink-0" />
                      <div>
                        <span className="font-bold">Riesgo de Deducible: MEDIO</span>
                        <p className="text-[10px] text-amber-700">
                          10% Pérdida, Mínimo 10 SMMLV sobre suma asegurada real
                        </p>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold bg-amber-200 text-amber-900 px-2 py-1 rounded-md ml-2 flex-shrink-0">
                      Ver detalle
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trusted By Section */}
      <section className="py-12 border-y border-slate-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-8">
            Compatible con cotizaciones y clausulados de las principales aseguradoras
          </p>
          <div className="flex flex-wrap justify-center items-center gap-6 md:gap-12 opacity-80">
            {[
              'SURA',
              'MAPFRE',
              'Allianz',
              'AXA COLPATRIA',
              'Seguros Bolívar',
              'Chubb',
              'SBS',
              'BBVA Seguros',
              'Zurich',
              'Previsora',
            ].map((name, idx) => (
              <span
                key={idx}
                className="text-lg md:text-xl font-bold text-slate-600 hover:text-indigo-600 transition-colors"
              >
                {name}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* 3-Tier Hierarchy & Enterprise Governance Section */}
      <section id="hierarchy" className="py-20 bg-slate-50 border-y border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <div className="inline-flex items-center px-3 py-1 bg-indigo-100 text-indigo-800 rounded-full text-xs font-semibold mb-3 border border-indigo-200">
              <Users className="w-3.5 h-3.5 mr-1.5 text-indigo-600" />
              Gobernanza y Jerarquía Organizacional
            </div>
            <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900 tracking-tight">
              Estructura Multi-Tenant para Corredoras y Aliados
            </h2>
            <p className="mt-4 text-lg text-slate-600 max-w-3xl mx-auto">
              Control jerárquico claro en 3 niveles para la gestión centralizada de intermediarios,
              administradores de firma y equipos técnicos de analistas.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Level 1: Super Admin */}
            <div className="bg-white p-8 rounded-2xl shadow-lg shadow-slate-200/60 border border-slate-200 relative overflow-hidden group hover:border-indigo-300 transition-all">
              <div className="absolute top-0 left-0 w-full h-1.5 bg-indigo-600"></div>
              <div className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 mb-6 group-hover:scale-110 transition-transform">
                <ShieldCheck size={26} />
              </div>
              <span className="text-xs font-extrabold text-indigo-600 uppercase tracking-wider">
                Nivel 1
              </span>
              <h3 className="text-xl font-bold text-slate-900 mt-1 mb-3">Super Admin</h3>
              <p className="text-slate-600 text-sm leading-relaxed mb-4">
                Administrador General de la Aplicación. Supervisa la totalidad de
                Aliados/Intermediarios, métricas globales de mercado y gobernanza de la plataforma.
              </p>
              <ul className="space-y-2 text-xs text-slate-500 border-t border-slate-100 pt-4">
                <li className="flex items-center">
                  <CheckCircle size={14} className="text-emerald-500 mr-2" /> Monitoreo global de
                  analítica multiramo
                </li>
                <li className="flex items-center">
                  <CheckCircle size={14} className="text-emerald-500 mr-2" /> Gestión integral de
                  Corredoras y Aliados
                </li>
              </ul>
            </div>

            {/* Level 2: Ally Admin */}
            <div className="bg-white p-8 rounded-2xl shadow-lg shadow-indigo-100 border-2 border-indigo-500 relative overflow-hidden group hover:shadow-xl transition-all scale-105 z-10">
              <div className="absolute top-0 right-0 bg-indigo-600 text-white text-[10px] font-bold px-3 py-1 rounded-bl-lg uppercase tracking-wider">
                Registro en Landing
              </div>
              <div className="w-12 h-12 rounded-xl bg-indigo-600 text-white flex items-center justify-center mb-6 group-hover:scale-110 transition-transform shadow-md shadow-indigo-200">
                <Building2 size={26} />
              </div>
              <span className="text-xs font-extrabold text-indigo-600 uppercase tracking-wider">
                Nivel 2
              </span>
              <h3 className="text-xl font-bold text-slate-900 mt-1 mb-3">
                Admin de Compañía Aliada
              </h3>
              <p className="text-slate-600 text-sm leading-relaxed mb-4">
                Un Administrador por cada Firma / Corredora. Se registra con el NIT de su empresa y
                es el encargado de dar de alta y gestionar a sus técnicos.
              </p>
              <ul className="space-y-2 text-xs text-slate-600 border-t border-slate-100 pt-4">
                <li className="flex items-center font-medium">
                  <CheckCircle size={14} className="text-indigo-600 mr-2" /> Registro directo con
                  NIT en la plataforma
                </li>
                <li className="flex items-center font-medium">
                  <CheckCircle size={14} className="text-indigo-600 mr-2" /> Creación y asignación
                  de N Técnicos Analistas
                </li>
              </ul>
            </div>

            {/* Level 3: Ally Technical Analyst */}
            <div className="bg-white p-8 rounded-2xl shadow-lg shadow-slate-200/60 border border-slate-200 relative overflow-hidden group hover:border-blue-300 transition-all">
              <div className="absolute top-0 left-0 w-full h-1.5 bg-blue-600"></div>
              <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 mb-6 group-hover:scale-110 transition-transform">
                <Users size={26} />
              </div>
              <span className="text-xs font-extrabold text-blue-600 uppercase tracking-wider">
                Nivel 3
              </span>
              <h3 className="text-xl font-bold text-slate-900 mt-1 mb-3">Técnicos Analistas</h3>
              <p className="text-slate-600 text-sm leading-relaxed mb-4">
                N cantidad de usuarios analistas por cada Intermediario. Cargan cotizaciones en PDF,
                ejecutan comparaciones RAG y generan informes de riesgo.
              </p>
              <ul className="space-y-2 text-xs text-slate-500 border-t border-slate-100 pt-4">
                <li className="flex items-center">
                  <CheckCircle size={14} className="text-emerald-500 mr-2" /> Auditoría automatizada
                  de pólizas PDF
                </li>
                <li className="flex items-center">
                  <CheckCircle size={14} className="text-emerald-500 mr-2" /> Abogado Virtual y
                  consulta de clausulados
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Multidomain & Regulatory Framework Section */}
      <section id="domains" className="py-24 bg-slate-900 text-white relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <div className="inline-flex items-center px-3 py-1 bg-indigo-500/20 text-indigo-300 rounded-full text-xs font-semibold mb-3 border border-indigo-500/30">
              <Award className="w-3.5 h-3.5 mr-1.5" />
              Especialización por Ramo
            </div>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
              Análisis Multiramo con Respaldo Normativo y Regulatorio
            </h2>
            <p className="mt-4 text-lg text-slate-300 max-w-3xl mx-auto">
              Cada ramo exige un análisis legal distinto. El sistema inyecta tesauros específicos y
              verifica automáticamente el cumplimiento de las normativas vigentes en Colombia.
            </p>
          </div>

          {/* Domain Tabs Navigation */}
          <div className="flex flex-wrap justify-center gap-2 mb-10">
            {domainsInfo.map((domain) => {
              const Icon = domain.icon;
              const isActive = activeDomainTab === domain.id;
              return (
                <button
                  key={domain.id}
                  onClick={() => setActiveDomainTab(domain.id)}
                  className={`flex items-center px-4 py-2.5 rounded-xl font-semibold text-sm transition-all ${
                    isActive
                      ? 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-lg shadow-indigo-500/30 scale-105'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-700'
                  }`}
                >
                  <Icon className="w-4 h-4 mr-2" />
                  {domain.title}
                </button>
              );
            })}
          </div>

          {/* Active Domain Detail Card */}
          {domainsInfo
            .filter((d) => d.id === activeDomainTab)
            .map((domain) => {
              const Icon = domain.icon;
              return (
                <div
                  key={domain.id}
                  className="bg-slate-800/90 border border-slate-700 rounded-2xl p-8 max-w-4xl mx-auto backdrop-blur-sm grid md:grid-cols-3 gap-8 items-center"
                >
                  <div className="md:col-span-2">
                    <div className="inline-flex items-center px-3 py-1 bg-indigo-900/60 text-indigo-300 border border-indigo-700/50 rounded-md text-xs font-bold mb-3">
                      Marco Legal: {domain.norm}
                    </div>
                    <h3 className="text-2xl font-bold text-white mb-3 flex items-center">
                      <Icon className="w-6 h-6 mr-2.5 text-indigo-400" />
                      Ramo {domain.title}
                    </h3>
                    <p className="text-slate-300 leading-relaxed mb-6">{domain.desc}</p>
                    <div className="space-y-2">
                      {domain.highlights.map((h, idx) => (
                        <div key={idx} className="flex items-center text-sm text-indigo-200">
                          <CheckCircle className="w-4 h-4 text-emerald-400 mr-2 flex-shrink-0" />
                          <span>{h}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-slate-900/80 p-6 rounded-xl border border-slate-700/80 text-center flex flex-col justify-center items-center">
                    <BookOpen className="w-10 h-10 text-indigo-400 mb-3" />
                    <span className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">
                      Respaldo RAG Activo
                    </span>
                    <p className="text-sm text-slate-200 font-medium mb-4">
                      Cruzamiento automático de cotización con tesauro de {domain.title}
                    </p>
                    <button
                      onClick={onRegisterClick}
                      className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg text-sm transition-colors"
                    >
                      Probar Ramo {domain.title}
                    </button>
                  </div>
                </div>
              );
            })}
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-base text-indigo-600 font-semibold tracking-wide uppercase">
              Capacidades Reales de la Plataforma
            </h2>
            <p className="mt-2 text-3xl leading-8 font-extrabold tracking-tight text-slate-900 sm:text-4xl">
              Auditoría Técnica e Inteligencia Contractual Automatizada
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              {
                icon: <BookOpen className="w-7 h-7 text-white" />,
                title: 'Abogado Virtual RAG',
                description:
                  'Genera dictámenes legales citando textualmente clausulados contractuales de la base de datos Supabase/pgvector e identifica puntos clave de negociación.',
              },
              {
                icon: <FileCheck className="w-7 h-7 text-white" />,
                title: 'Visor PDF con Evidencia Verbatim',
                description:
                  'Visualiza cotizaciones y clausulados directamente en la UI. Haz clic en cualquier hallazgo y salta automáticamente a la página con el texto resaltado.',
              },
              {
                icon: <ShieldCheck className="w-7 h-7 text-white" />,
                title: 'Validación Bidireccional de Coberturas',
                description:
                  'Detecta "coberturas fantasma" (ofertadas en la cotización pero ausentes en el clausulado) y coberturas obligatorias omitidas por la aseguradora.',
              },
              {
                icon: <TrendingUp className="w-7 h-7 text-white" />,
                title: 'Riesgo de Deducibles y Garantías',
                description:
                  'Calcula el deducible real sobre la suma asegurada, detecta topes mínimos/máximos y clasifica exigencias técnicas, operacionales y financieras.',
              },
              {
                icon: <BarChart3 className="w-7 h-7 text-white" />,
                title: 'Auditoría HITL y Notas Consultivas',
                description:
                  'Panel Human-In-The-Loop para corregir extracciones con sincronización en tiempo real y agregar notas consultivas en Markdown celda por celda.',
              },
              {
                icon: <Lock className="w-7 h-7 text-white" />,
                title: 'Reportes Ejecutivos PDF y Excel',
                description:
                  'Exporta informes técnicos listos para entregar al cliente, con gráficos de radar por aseguradora, análisis de brechas y dictamen final.',
              },
            ].map((feature, idx) => (
              <div
                key={idx}
                className="relative group bg-white p-8 rounded-2xl hover:shadow-xl transition-all duration-300 border border-slate-200 hover:border-indigo-200"
              >
                <div className="absolute top-0 right-0 -mr-6 -mt-6 w-24 h-24 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-full opacity-5 blur-xl group-hover:opacity-10 transition-all"></div>
                <div className="inline-flex items-center justify-center p-3 bg-gradient-to-br from-indigo-600 to-blue-600 rounded-xl shadow-lg mb-6 group-hover:scale-110 transition-transform">
                  {feature.icon}
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-3">{feature.title}</h3>
                <p className="text-slate-600 leading-relaxed text-sm">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-base text-indigo-600 font-semibold tracking-wide uppercase">
              Proceso de Auditoría
            </h2>
            <p className="mt-2 text-3xl leading-8 font-extrabold tracking-tight text-slate-900 sm:text-4xl">
              De documentos sueltos a dictamen profesional en 4 pasos
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {[
              {
                step: '01',
                icon: <FileText className="w-6 h-6 text-white" />,
                title: 'Sube Cotizaciones & Selecciona Ramo',
                description:
                  'Sube PDFs de múltiples aseguradoras y vincula el perfil del cliente y el ramo específico (Copropiedades, Cumplimiento, Pyme, etc.).',
              },
              {
                step: '02',
                icon: <Zap className="w-6 h-6 text-white" />,
                title: 'IA RAG & Cruzamiento Normativo',
                description:
                  'Gemini AI extrae los datos y Supabase pgvector realiza la búsqueda semántica sobre clausulados contractuales y normas legales.',
              },
              {
                step: '03',
                icon: <BarChart3 className="w-6 h-6 text-white" />,
                title: 'Auditoría & Abogado Virtual',
                description:
                  'Genera la matriz bidireccional, identifica coberturas fantasma, evalúa riesgos de deducibles y genera el dictamen legal.',
              },
              {
                step: '04',
                icon: <CheckCircle className="w-6 h-6 text-white" />,
                title: 'Revisión HITL & Exportación',
                description:
                  'Ajusta hallazgos si es necesario con la cola HITL, edita notas consultivas y exporta informes ejecutivos en PDF y Excel.',
              },
            ].map((item, idx) => (
              <div key={idx} className="relative text-center group">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-indigo-600 to-blue-600 rounded-2xl shadow-lg mb-6 group-hover:scale-110 transition-transform">
                  {item.icon}
                </div>
                <div className="text-4xl font-bold text-slate-200 absolute -top-4 left-1/2 transform -translate-x-1/2 -z-10">
                  {item.step}
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">{item.title}</h3>
                <p className="text-slate-600 leading-relaxed text-sm">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits / Problem-Solution Section */}
      <section id="benefits" className="py-20 bg-slate-900 text-white overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold mb-6">
                El análisis manual expone a tu corretaje a riesgos legales
              </h2>
              <div className="space-y-5">
                {[
                  {
                    text: 'Incapacidad para leer clausulados de 100+ páginas en cada licitación',
                    icon: <X className="w-5 h-5" />,
                  },
                  {
                    text: 'Ignorar coberturas fantasma ofertadas sin respaldo contractual real',
                    icon: <X className="w-5 h-5" />,
                  },
                  {
                    text: 'Desconocer si la póliza cumple normativas clave (Ley 675, Ley 80, etc.)',
                    icon: <X className="w-5 h-5" />,
                  },
                  {
                    text: 'Deducibles mal calculados sobre valores de pérdida real',
                    icon: <X className="w-5 h-5" />,
                  },
                  {
                    text: 'Falta de evidencia textual ante objeciones de la aseguradora',
                    icon: <X className="w-5 h-5" />,
                  },
                ].map((item, i) => (
                  <div key={i} className="flex items-start">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center mr-4 mt-0.5">
                      <span className="text-red-400">{item.icon}</span>
                    </div>
                    <span className="text-base text-slate-300">{item.text}</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h2 className="text-3xl md:text-4xl font-bold mb-6 text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-blue-400">
                Con Comparador CSA RAG
              </h2>
              <div className="space-y-4">
                {[
                  {
                    text: 'Respaldo legal y normativo inmediato',
                    subtext: 'Dictámenes automáticos alineados con la legislación colombiana',
                  },
                  {
                    text: 'Evidencia PDF verbatim en un clic',
                    subtext: 'Demuestra el hallazgo exacto en la página del contrato',
                  },
                  {
                    text: 'Auditoría bidireccional completa',
                    subtext: 'Identifica coberturas verificadas, fantasma u omitidas',
                  },
                  {
                    text: 'Soporte Multiramo Especializado',
                    subtext: 'Copropiedades, Cumplimiento, Salud, Transporte, Pyme, Autos y Vida',
                  },
                  {
                    text: 'Control total Human-In-The-Loop',
                    subtext:
                      'Edita, agrega notas consultivas y valida antes de entregar al cliente',
                  },
                ].map((item, i) => (
                  <div
                    key={i}
                    className="flex items-start bg-white/5 p-4 rounded-xl backdrop-blur-sm border border-white/10"
                  >
                    <div className="flex-shrink-0 mr-4">
                      <CheckCircle className="w-6 h-6 text-emerald-400" />
                    </div>
                    <div>
                      <div className="font-semibold text-white">{item.text}</div>
                      <div className="text-sm text-slate-400 mt-0.5">{item.subtext}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section id="testimonials" className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-base text-indigo-600 font-semibold tracking-wide uppercase">
              Testimonios de Corredores
            </h2>
            <p className="mt-2 text-3xl leading-8 font-extrabold tracking-tight text-slate-900 sm:text-4xl">
              Confianza técnica respaldada por Inteligencia Artificial
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                text: 'En pólizas de copropiedad (Ley 675), el Abogado Virtual nos alertó de una omisión grave en bienes comunes en menos de 2 minutos. Evitamos una responsabilidad enorme.',
                author: 'Carlos Rodríguez',
                role: 'Director Técnico, Seguros Beta',
                rating: 5,
              },
              {
                text: 'El visor PDF interactivo que resalta la evidencia verbatim es increíble. Muestro la página exacta del clausulado al cliente y la discusión se cierra de inmediato.',
                author: 'Ana María Vélez',
                role: 'Gerente Comercial, Marsh',
                rating: 5,
              },
              {
                text: 'Poder comparar pólizas de Cumplimiento (Ley 80) y Transporte con la misma facilidad que Pyme transformó la operación de la correduría.',
                author: 'Jorge L. Pérez',
                role: 'Corredor Independiente',
                rating: 5,
              },
            ].map((t, i) => (
              <div
                key={i}
                className="bg-slate-50 p-8 rounded-2xl border border-slate-200 flex flex-col"
              >
                <div className="flex text-yellow-400 mb-4">
                  {[...Array(t.rating)].map((_, j) => (
                    <Star key={j} className="w-5 h-5 fill-current" />
                  ))}
                </div>
                <p className="text-slate-700 mb-6 italic flex-grow leading-relaxed text-sm">
                  "{t.text}"
                </p>
                <div className="flex items-center mt-auto pt-4 border-t border-slate-200">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center text-white font-bold">
                    {t.author.charAt(0)}
                  </div>
                  <div className="ml-3">
                    <p className="font-bold text-slate-900 text-sm">{t.author}</p>
                    <p className="text-slate-500 text-xs">{t.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-600 via-blue-600 to-indigo-800"></div>
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 left-0 w-96 h-96 bg-white rounded-full blur-3xl -ml-48 -mt-48"></div>
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-white rounded-full blur-3xl -mr-48 -mb-48"></div>
        </div>

        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
            Eleva el estándar técnico de tus comparativas de seguros
          </h2>
          <p className="text-indigo-100 text-xl mb-4 max-w-2xl mx-auto">
            Comienza a auditar cotizaciones con respaldo en clausulados reales y normativas legales.
          </p>
          <p className="text-indigo-200 text-lg mb-10">
            Copropiedades, Cumplimiento, Salud, Transporte, Pyme, Autos y Vida Grupo.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={onRegisterClick}
              className="px-10 py-5 bg-white text-indigo-600 rounded-full text-xl font-bold shadow-2xl hover:bg-indigo-50 hover:scale-105 transition-all"
            >
              Comenzar Gratis
            </button>
            <button
              onClick={onLoginClick}
              className="px-10 py-5 bg-transparent text-white border-2 border-white/30 rounded-full text-xl font-bold hover:bg-white/10 transition-all"
            >
              Iniciar Sesión
            </button>
          </div>

          <p className="mt-6 text-indigo-200 text-sm">
            Sin tarjeta de crédito • Acceso a todos los ramos y funciones RAG
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-400 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">
            {/* Brand */}
            <div className="lg:col-span-1">
              <div className="flex items-center space-x-2 mb-4">
                <div className="bg-gradient-to-br from-indigo-600 to-blue-600 p-2 rounded-lg">
                  <ShieldCheck className="text-white w-5 h-5" />
                </div>
                <span className="text-white font-bold text-lg">Comparador CSA</span>
              </div>
              <p className="text-sm leading-relaxed mb-4">
                Plataforma de análisis técnico y auditoría RAG multiramo y multi-aseguradora.
              </p>
              <div className="flex space-x-4">
                <a href="#" className="text-slate-400 hover:text-white transition-colors">
                  <Globe className="w-5 h-5" />
                </a>
                <a href="#" className="text-slate-400 hover:text-white transition-colors">
                  <MessageCircle className="w-5 h-5" />
                </a>
              </div>
            </div>

            {/* Ramos */}
            <div>
              <h4 className="text-white font-semibold mb-4">Ramos Soportados</h4>
              <ul className="space-y-2 text-sm">
                <li className="text-slate-400">Copropiedades (Ley 675)</li>
                <li className="text-slate-400">Cumplimiento (Ley 80)</li>
                <li className="text-slate-400">Salud & Prepagada (Res 244)</li>
                <li className="text-slate-400">Transporte (Incoterms)</li>
                <li className="text-slate-400">Pyme & Comercial</li>
                <li className="text-slate-400">Autos & Flotas</li>
                <li className="text-slate-400">Vida Grupo</li>
              </ul>
            </div>

            {/* Capacidades */}
            <div>
              <h4 className="text-white font-semibold mb-4">Capacidades RAG</h4>
              <ul className="space-y-2 text-sm">
                <li className="text-slate-400">Abogado Virtual RAG</li>
                <li className="text-slate-400">Visor PDF Verbatim</li>
                <li className="text-slate-400">Validación Bidireccional</li>
                <li className="text-slate-400">Auditoría HITL</li>
                <li className="text-slate-400">Riesgo de Deducibles</li>
                <li className="text-slate-400">Reportes Ejecutivos PDF/Excel</li>
              </ul>
            </div>

            {/* Contacto */}
            <div>
              <h4 className="text-white font-semibold mb-4">Contacto</h4>
              <ul className="space-y-3">
                <li className="flex items-center text-sm">
                  <Mail className="w-4 h-4 mr-2 text-slate-500" />
                  <span className="text-slate-400">info@comparadorcsa.com</span>
                </li>
                <li className="flex items-center text-sm">
                  <Phone className="w-4 h-4 mr-2 text-slate-500" />
                  <span className="text-slate-400">+57 (1) 234-5678</span>
                </li>
                <li className="flex items-start text-sm">
                  <MapPin className="w-4 h-4 mr-2 text-slate-500 mt-0.5" />
                  <span className="text-slate-400">Bogotá, Colombia</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="border-t border-slate-800 mt-12 pt-8 flex flex-col md:flex-row justify-between items-center">
            <p className="text-sm text-slate-500">
              © 2026 Comparador Seguros CSA. Todos los derechos reservados.
            </p>
            <div className="flex items-center space-x-2 mt-4 md:mt-0">
              <span className="text-xs text-slate-600">Hecho con</span>
              <Zap className="w-4 h-4 text-yellow-500" />
              <span className="text-xs text-slate-600">en Colombia</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
