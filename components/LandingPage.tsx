import React, { useState, useEffect } from 'react';
import {
  Shield,
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
  Check,
  ChevronRight,
  FolderKanban,
  Clock,
  PieChart,
} from 'lucide-react';
import { LegalModal } from './legal/LegalModal';

interface LandingPageProps {
  onLoginClick: () => void;
  onRegisterClick: () => void;
  onOpenLegal?: (tab?: 'terms' | 'privacy' | 'security' | 'disclaimer') => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  onLoginClick,
  onRegisterClick,
  onOpenLegal,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [activeDomainTab, setActiveDomainTab] = useState<string>('copropiedades');
  const [showLegalModal, setShowLegalModal] = useState(false);
  const [legalTab, setLegalTab] = useState<'terms' | 'privacy' | 'security' | 'disclaimer'>('terms');

  const handleOpenLegal = (tab: 'terms' | 'privacy' | 'security' | 'disclaimer') => {
    if (onOpenLegal) {
      onOpenLegal(tab);
    } else {
      setLegalTab(tab);
      setShowLegalModal(true);
    }
  };

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
      subtitle: 'Edificios, Conjuntos & Ley 675',
      norm: 'Ley 675 de 2001 (Art. 15) & Ley 1796',
      icon: Building,
      badgeColor: 'bg-amber-100 text-amber-800 border-amber-200',
      desc: 'Auditoría integral para asambleas y administradores: amparos obligatorios de bienes comunes, reconstrucción a nuevo y RCE de copropiedad.',
      highlights: [
        'Verificación de amparo obligatorio de áreas comunes',
        'Cálculo de valores asegurados vs. coeficiente de copropiedad',
        'Validación de cláusulas de reconstrucción y terremoto',
      ],
      sampleCoverage: 'Bienes Comunes y Privados al 100%',
      sampleDeductible: 'Terremoto 2% Valor Asegurado, Mín. 10 SMMLV',
    },
    {
      id: 'cumplimiento',
      title: 'Cumplimiento & Seriedad',
      subtitle: 'Garantías Estatales & Privadas',
      norm: 'Ley 80 de 1993 / Decreto 1082 de 2015',
      icon: Scale,
      badgeColor: 'bg-blue-100 text-blue-800 border-blue-200',
      desc: 'Blindaje jurídico en licitaciones públicas y privadas: buen manejo de anticipo, cumplimiento, salarios y estabilidad de obra.',
      highlights: [
        'Checklist automático para pliegos de contratación estatal (SECOP)',
        'Análisis de suficiencia de vigencias y porcentajes de garantía',
        'Detección de exclusiones absolutas en cláusulas particulares',
      ],
      sampleCoverage: 'Buen Manejo del Anticipo (100%)',
      sampleDeductible: 'Sin deducible contractual',
    },
    {
      id: 'pyme',
      title: 'Pyme & Comercial',
      subtitle: 'Multirriesgo Empresarial',
      norm: 'Código de Comercio - Libro IV / Estatuto Orgánico',
      icon: Building2,
      badgeColor: 'bg-purple-100 text-purple-800 border-purple-200',
      desc: 'Homologación canónica de 14 categorías comerciales (incendio, lucro cesante, sustracción, RCE y equipo electrónico) en una sola matriz.',
      highlights: [
        'Matriz canónica homologada entre cotizaciones dispares',
        'Detección de coberturas fantasma (sin clausulado vigente)',
        'Evaluación de sublímites ocultos y garantías exigidas',
      ],
      sampleCoverage: 'Lucro Cesante Forma Inglesa (12 meses)',
      sampleDeductible: '10% de la Pérdida, Mín. 3 SMMLV',
    },
    {
      id: 'salud',
      title: 'Salud & Prepagada',
      subtitle: 'Planes Voluntarios & Colectivos',
      norm: 'Resolución 244 de 2019 / Decreto 780',
      icon: Stethoscope,
      badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-200',
      desc: 'Comparativa de beneficios en salud, preexistencias, periodos de carencia, topes ambulatorios y cuadro médico hospitalario.',
      highlights: [
        'Matriz de preexistencias declaradas y tiempos de espera',
        'Comparativa transparente de copagos y bonos de atención',
        'Verificación de cobertura internacional y repatriación',
      ],
      sampleCoverage: 'Hospitalización y Cirugía Ilimitada',
      sampleDeductible: 'Copago fijo por consulta médica',
    },
    {
      id: 'transporte',
      title: 'Transporte de Carga',
      subtitle: 'Terrestre, Marítimo & Aéreo',
      norm: 'Incoterms 2020 / Institute Cargo Clauses',
      icon: Truck,
      badgeColor: 'bg-orange-100 text-orange-800 border-orange-200',
      desc: 'Evaluación de trayectos, cláusulas inglesas ICC (A, B, C), concordancia con Incoterms y trasbordos multimodales.',
      highlights: [
        'Validación de concordancia con Incoterm contractual (CIF, CIP, FOB)',
        'Alertas por falta de entrega y avería gruesa',
        'Deducibles de piratería terrestre y robo de mercancía',
      ],
      sampleCoverage: 'Todo Riesgo ICC (A) Internacional',
      sampleDeductible: '15% del Embarque en Hurto Calificado',
    },
    {
      id: 'autos',
      title: 'Autos & Flotas',
      subtitle: 'Vehículos Comerciales & Particulares',
      norm: 'Circular Básica Jurídica Superfinanciera',
      icon: Car,
      badgeColor: 'bg-rose-100 text-rose-800 border-rose-200',
      desc: 'Comparación masiva de flotas y vehículos individuales: RCE extracontractual, pérdida total/parcial, amparo patrimonial y asistencias.',
      highlights: [
        'Comparativa visual de deducibles en salarios mínimos y porcentajes',
        'Análisis de coberturas de asistencia jurídica y grúa nacional',
        'Evaluación de amparo patrimonial sin deducible',
      ],
      sampleCoverage: 'RCE Daños y Lesiones hasta $4.000 Millones',
      sampleDeductible: 'Pérdida Parcial Daños: 10%, Mín. 1 SMMLV',
    },
    {
      id: 'vida',
      title: 'Vida Grupo & Personas',
      subtitle: 'Pólizas Colectivas & Beneficios',
      norm: 'Estatuto Orgánico del Sistema Financiero',
      icon: Users,
      badgeColor: 'bg-indigo-100 text-indigo-800 border-indigo-200',
      desc: 'Protección colectiva para empresas: muerte por cualquier causa, invalidez, desmembración y anticipo de enfermedades graves.',
      highlights: [
        'Verificación de amparos adicionales (gastos de sepelio, canasta familiar)',
        'Análisis de valores asegurados por categorías de empleados',
        'Cálculo de prima promedio mensual y anual por asegurado',
      ],
      sampleCoverage: 'Vida Básica + ITP (Invalidez Total y Permanente)',
      sampleDeductible: 'Sin deducible',
    },
    {
      id: 'hogar',
      title: 'Hogar & Habitacional',
      subtitle: 'Vivienda, Contenidos & RCE',
      norm: 'Circular Básica Jurídica / Ley 1796',
      icon: Shield,
      badgeColor: 'bg-teal-100 text-teal-800 border-teal-200',
      desc: 'Auditoría para créditos hipotecarios y pólizas familiares: estructura vs. contenidos, hidrometeorológicos y RCE predios.',
      highlights: [
        'Separación clara de valor asegurable en estructura vs contenidos',
        'Amparo de eventos de la naturaleza (terremoto, inundación)',
        'Límites de responsabilidad civil por daños a vecinos',
      ],
      sampleCoverage: 'Estructura a Valor de Reconstrucción',
      sampleDeductible: 'Terremoto 2% Valor Asegurado',
    },
    {
      id: 'equipo_maquinaria',
      title: 'Maquinaria & Equipos',
      subtitle: 'Línea Amarilla, Industrial & Agrícola',
      norm: 'Código de Comercio (Art. 1083)',
      icon: Briefcase,
      badgeColor: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      desc: 'Protección para maquinaria en operación, tránsito y permanencia: rotura de maquinaria, vuelco, incendio y robo en faena.',
      highlights: [
        'Exigencias de mantenimiento preventivo y horómetro en contrato',
        'Cobertura de derrumbe, inundación y rescate de equipo',
        'Deducibles aplicados sobre valor de reposición a nuevo',
      ],
      sampleCoverage: 'Rotura de Maquinaria + Tránsito Nacional',
      sampleDeductible: '10% de la Pérdida, Mín. 5 SMMLV',
    },
    {
      id: 'casco_embarcacion',
      title: 'Cascos & Embarcaciones',
      subtitle: 'Fluvial, Marítimo & Portuario',
      norm: 'Código de Comercio Marítimo / Regulación DIMAR',
      icon: Globe,
      badgeColor: 'bg-cyan-100 text-cyan-800 border-cyan-200',
      desc: 'Auditoría de pólizas náuticas, remolcadores, lanchas y barcazas: avería gruesa, salvamento, P&I y zonas autorizadas.',
      highlights: [
        'Delimitación de zonas de navegación autorizadas por DIMAR',
        'Avería gruesa, gastos de salvamento y remolque',
        'Protección e Indemnización (P&I) para tripulación',
      ],
      sampleCoverage: 'Casco y Máquinas Institute Time Clauses (Hulls)',
      sampleDeductible: 'Franquicia deducible por evento',
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 overflow-x-hidden selection:bg-indigo-500 selection:text-white">
      {/* Top Advisory Bar */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white text-[11px] sm:text-xs py-2 px-4 text-center font-medium border-b border-indigo-900/40 flex items-center justify-center gap-2">
        <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-bold text-[10px] uppercase tracking-wider border border-indigo-500/30">
          Tecnología para Corredores
        </span>
        <span>
          Auditoría técnica RAG con respaldo en clausulados de Colombia (SURA, MAPFRE, Allianz, Bolívar, AXA y más).
        </span>
      </div>

      {/* Navigation */}
      <nav
        className={`fixed w-full z-50 transition-all duration-300 ${
          scrolled
            ? 'bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-sm top-0'
            : 'bg-white/80 backdrop-blur-md border-b border-slate-100 top-8'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-20 items-center">
            {/* Logo */}
            <div className="flex items-center space-x-3 cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
              <div className="bg-gradient-to-br from-indigo-600 via-blue-600 to-indigo-800 p-2.5 rounded-xl shadow-lg shadow-indigo-200">
                <ShieldCheck className="text-white w-6 h-6" />
              </div>
              <div>
                <span className="text-xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-indigo-700 via-blue-600 to-indigo-900">
                  Comparador CSA
                </span>
                <p className="text-[11px] text-slate-500 -mt-1 font-semibold tracking-wide">
                  Plataforma para Corredores & Asesores
                </p>
              </div>
            </div>

            {/* Desktop Menu */}
            <div className="hidden md:flex items-center space-x-8">
              <button
                onClick={() => scrollToSection('brokers-solution')}
                className="text-slate-600 hover:text-indigo-600 text-sm font-semibold transition-colors"
              >
                Para tu Correduría
              </button>
              <button
                onClick={() => scrollToSection('domains')}
                className="text-slate-600 hover:text-indigo-600 text-sm font-semibold transition-colors"
              >
                10 Ramos Normativos
              </button>
              <button
                onClick={() => scrollToSection('capabilities')}
                className="text-slate-600 hover:text-indigo-600 text-sm font-semibold transition-colors"
              >
                Auditoría RAG
              </button>
              <button
                onClick={() => scrollToSection('how-it-works')}
                className="text-slate-600 hover:text-indigo-600 text-sm font-semibold transition-colors"
              >
                Cómo Funciona
              </button>
              <div className="flex items-center space-x-3 ml-4 border-l border-slate-200 pl-6">
                <button
                  onClick={onLoginClick}
                  className="px-4 py-2 text-slate-700 font-semibold text-sm hover:text-indigo-600 transition-colors"
                >
                  Acceso Intermediarios
                </button>
                <button
                  onClick={onRegisterClick}
                  className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-blue-600 text-white rounded-xl text-sm font-bold shadow-md shadow-indigo-200 hover:shadow-lg hover:from-indigo-700 hover:to-blue-700 hover:scale-[1.02] transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <span>Probar Auditoría Gratis</span>
                  <ArrowRight size={15} />
                </button>
              </div>
            </div>

            {/* Mobile Menu Button */}
            <div className="md:hidden flex items-center">
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="text-slate-600 hover:text-indigo-600 p-2 rounded-lg"
                aria-label="Abrir menú"
              >
                {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Menu Dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-white border-b border-slate-200 px-6 py-5 shadow-xl space-y-4 animate-in slide-in-from-top-2">
            <button
              onClick={() => scrollToSection('brokers-solution')}
              className="block w-full text-left font-semibold text-slate-700 py-1.5"
            >
              Para tu Correduría
            </button>
            <button
              onClick={() => scrollToSection('domains')}
              className="block w-full text-left font-semibold text-slate-700 py-1.5"
            >
              10 Ramos Normativos
            </button>
            <button
              onClick={() => scrollToSection('capabilities')}
              className="block w-full text-left font-semibold text-slate-700 py-1.5"
            >
              Auditoría RAG
            </button>
            <button
              onClick={() => scrollToSection('how-it-works')}
              className="block w-full text-left font-semibold text-slate-700 py-1.5"
            >
              Cómo Funciona
            </button>
            <div className="pt-3 border-t border-slate-100 flex flex-col gap-2.5">
              <button
                onClick={onLoginClick}
                className="w-full py-2.5 text-center font-bold text-slate-700 bg-slate-100 rounded-xl"
              >
                Acceso Intermediarios
              </button>
              <button
                onClick={onRegisterClick}
                className="w-full py-3 text-center font-bold text-white bg-gradient-to-r from-indigo-600 to-blue-600 rounded-xl shadow-md"
              >
                Probar Auditoría Gratis
              </button>
            </div>
          </div>
        )}
      </nav>

      {/* Hero Section */}
      <section className="pt-36 pb-20 lg:pt-48 lg:pb-32 relative overflow-hidden bg-gradient-to-b from-white via-indigo-50/20 to-slate-50">
        <div className="absolute top-0 right-0 -mr-40 -mt-40 w-[600px] h-[600px] bg-gradient-to-br from-indigo-200/40 via-blue-200/30 to-purple-200/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 -ml-40 -mb-40 w-[500px] h-[500px] bg-gradient-to-tr from-blue-200/30 via-indigo-200/20 to-transparent rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid lg:grid-cols-12 gap-12 items-center">
            {/* Hero Copy */}
            <div className="lg:col-span-7 text-center lg:text-left">
              <div className="inline-flex items-center px-3.5 py-1.5 bg-indigo-50 border border-indigo-200/80 rounded-full text-xs font-bold text-indigo-700 mb-6 shadow-xs">
                <Sparkles size={14} className="mr-2 text-indigo-600" />
                <span>Inteligencia Contractual RAG para Corredores de Seguros</span>
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-slate-900 tracking-tight leading-[1.12] mb-6">
                Cierra más licitaciones con auditorías que{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 via-blue-600 to-indigo-900">
                  ninguna aseguradora puede refutar
                </span>
              </h1>

              <p className="text-base sm:text-lg text-slate-600 mb-8 leading-relaxed max-w-2xl mx-auto lg:mx-0">
                Sube las cotizaciones en PDF de tus clientes y en <strong>menos de 2 minutos</strong>{' '}
                obtén un cuadro comparativo bidireccional que cruza cada cobertura, deducible y
                exclusión contra los <strong>clausulados reales registrados</strong> y el marco legal
                colombiano (Ley 675, Ley 80, Res. 244).
              </p>

              {/* CTAs */}
              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start mb-6">
                <button
                  onClick={onRegisterClick}
                  className="px-8 py-4 bg-gradient-to-r from-indigo-600 via-blue-600 to-indigo-700 text-white rounded-xl text-base font-bold shadow-xl shadow-indigo-300/40 hover:shadow-2xl hover:scale-[1.02] active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer group"
                >
                  <span>Auditar Mi Primera Cotización</span>
                  <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                </button>
                <button
                  onClick={() => scrollToSection('domains')}
                  className="px-6 py-4 bg-white text-slate-700 border border-slate-300 rounded-xl text-base font-bold hover:bg-slate-50 hover:border-indigo-300 transition-all flex items-center justify-center cursor-pointer shadow-xs"
                >
                  Ver los 10 Ramos Soportados
                </button>
              </div>

              {/* Trust Badges */}
              <div className="flex flex-wrap items-center justify-center lg:justify-start gap-4 text-xs font-semibold text-slate-500 mb-8">
                <span className="flex items-center gap-1.5 text-slate-700">
                  <Check size={14} className="text-emerald-600 stroke-[3]" /> Sin tarjeta de crédito
                </span>
                <span className="flex items-center gap-1.5 text-slate-700">
                  <Check size={14} className="text-emerald-600 stroke-[3]" /> Evidencia verbatim en PDF
                </span>
                <span className="flex items-center gap-1.5 text-slate-700">
                  <Check size={14} className="text-emerald-600 stroke-[3]" /> Aislamiento total de cartera
                </span>
              </div>

              {/* Quick metrics banner */}
              <div className="grid grid-cols-3 gap-4 pt-6 border-t border-slate-200/80 max-w-lg mx-auto lg:mx-0">
                <div className="text-left">
                  <div className="text-2xl sm:text-3xl font-black text-indigo-700">2 min</div>
                  <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    Tiempo de Análisis
                  </div>
                </div>
                <div className="text-left border-l border-slate-200 pl-4">
                  <div className="text-2xl sm:text-3xl font-black text-slate-900">10 Ramos</div>
                  <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    Normativa Integrada
                  </div>
                </div>
                <div className="text-left border-l border-slate-200 pl-4">
                  <div className="text-2xl sm:text-3xl font-black text-emerald-600">0%</div>
                  <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    Fugas de Cobertura
                  </div>
                </div>
              </div>
            </div>

            {/* Hero Visual Mockup */}
            <div className="lg:col-span-5 relative">
              <div className="relative bg-white rounded-3xl shadow-2xl p-6 border border-slate-200/90 ring-1 ring-slate-900/5">
                {/* Header of mockup */}
                <div className="flex items-center justify-between pb-3.5 mb-4 border-b border-slate-100">
                  <div className="flex items-center space-x-2">
                    <span className="w-3 h-3 rounded-full bg-rose-400 inline-block" />
                    <span className="w-3 h-3 rounded-full bg-amber-400 inline-block" />
                    <span className="w-3 h-3 rounded-full bg-emerald-400 inline-block" />
                    <span className="text-xs font-bold text-slate-700 ml-2">
                      Auditoría Comparativa #AUD-2026-89
                    </span>
                  </div>
                  <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full">
                    Ley 675 / Propiedad Horizontal
                  </span>
                </div>

                {/* Body of mockup */}
                <div className="space-y-3.5">
                  {/* Score & Verdict Card */}
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
                    <div className="flex items-center justify-between mb-2.5">
                      <div className="flex items-center gap-2">
                        <Award className="text-indigo-600 w-4 h-4" />
                        <span className="text-xs font-bold text-slate-800">
                          Matriz Bidireccional Homologada
                        </span>
                      </div>
                      <span className="px-2 py-0.5 text-[10px] font-extrabold bg-emerald-100 text-emerald-800 rounded-md">
                        Score 94 / 100
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs">
                        <span className="text-[10px] text-slate-400 font-bold uppercase block">
                          Aseguradora A (SURA)
                        </span>
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-emerald-700 font-bold text-xs flex items-center gap-1">
                            <CheckCircle size={13} className="text-emerald-600" /> 16 Verificadas
                          </span>
                          <span className="text-[11px] font-mono text-slate-600 font-bold">
                            $48.5M COP
                          </span>
                        </div>
                      </div>

                      <div className="bg-white p-2.5 rounded-xl border border-amber-200 bg-amber-50/30 shadow-2xs">
                        <span className="text-[10px] text-amber-700 font-bold uppercase block">
                          Aseguradora B (Competencia)
                        </span>
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-amber-800 font-bold text-xs flex items-center gap-1">
                            <AlertTriangle size={13} className="text-amber-600" /> 2 Fantasma
                          </span>
                          <span className="text-[11px] font-mono text-slate-600 font-bold">
                            $42.0M COP
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Virtual Lawyer Finding */}
                  <div className="bg-gradient-to-br from-indigo-950 via-slate-900 to-indigo-900 text-white p-4 rounded-2xl shadow-lg border border-indigo-800/60">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1.5">
                        <BookOpen size={14} className="text-indigo-300" />
                        <span className="text-xs font-bold text-indigo-100">
                          Dictamen del Abogado Virtual RAG
                        </span>
                      </div>
                      <span className="text-[10px] font-mono bg-indigo-500/30 text-indigo-200 border border-indigo-400/30 px-1.5 py-0.5 rounded">
                        Clausulado Pág. 19
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-200 leading-relaxed italic mb-3">
                      "La cotización de Aseguradora B excluye terremoto sobre bienes comunes
                      bajo el sublímite del 50%, infringiendo el Art. 15 de la Ley 675. Se objeta
                      por riesgo de responsabilidad para la administración."
                    </p>
                    <div className="flex items-center justify-between text-[10px] text-indigo-200 border-t border-indigo-800/80 pt-2">
                      <span className="text-emerald-400 font-bold flex items-center gap-1">
                        <Check size={12} /> Argumento ganador para licitación
                      </span>
                      <span className="underline font-semibold cursor-pointer hover:text-white">
                        Ver texto resaltado →
                      </span>
                    </div>
                  </div>

                  {/* Deductibles Bar */}
                  <div className="bg-amber-50/80 border border-amber-200/90 p-3.5 rounded-2xl flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center text-amber-700 flex-shrink-0">
                        <AlertTriangle size={16} />
                      </div>
                      <div>
                        <span className="text-xs font-bold text-amber-950 block">
                          Alerta Actuarial de Deducibles
                        </span>
                        <span className="text-[11px] text-amber-800">
                          Mínimo de 10 SMMLV ($14.2M COP) sobre reclamo de maquinaria
                        </span>
                      </div>
                    </div>
                    <span className="text-[10px] font-extrabold bg-amber-200 text-amber-900 px-2 py-1 rounded-md">
                      Impacto Alto
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Insurers Logos Bar */}
      <section className="py-12 bg-white border-y border-slate-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-8">
            Auditoría cruzada compatible con las principales aseguradoras autorizadas en Colombia
          </p>
          <div className="flex flex-wrap justify-center items-center gap-8 md:gap-14 opacity-75">
            {[
              'SURA',
              'MAPFRE',
              'Allianz',
              'AXA COLPATRIA',
              'Seguros Bolívar',
              'Chubb',
              'SBS Seguros',
              'BBVA Seguros',
              'Zurich',
              'La Previsora',
            ].map((name, idx) => (
              <span
                key={idx}
                className="text-lg md:text-xl font-black text-slate-600 hover:text-indigo-600 transition-colors"
              >
                {name}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Target Audience Section: Solución para Corredoras y Agencias de Seguros */}
      <section id="brokers-solution" className="py-24 bg-slate-900 text-white relative overflow-hidden">
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <div className="inline-flex items-center px-3.5 py-1.5 bg-indigo-500/20 text-indigo-300 rounded-full text-xs font-bold mb-4 border border-indigo-500/30">
              <Users className="w-3.5 h-3.5 mr-1.5 text-indigo-400" />
              <span>Diseñado para Intermediarios de Seguros</span>
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight mb-4">
              La plataforma central de auditoría y cartera para tu Correduría
            </h2>
            <p className="text-base sm:text-lg text-slate-300 leading-relaxed">
              Equipa a tus directores técnicos y analistas comerciales con una herramienta que
              profesionaliza la entrega ante clientes corporativos, protege tus renovaciones y mantiene
              tus cuentas organizadas.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Value 1: Equipo y Gestión Técnica */}
            <div className="bg-slate-800/80 border border-slate-700/80 rounded-3xl p-8 hover:border-indigo-500/50 transition-all flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-400 mb-6">
                  <Users size={24} />
                </div>
                <h3 className="text-xl font-bold text-white mb-3">
                  Organización de Equipo y Roles Técnicos
                </h3>
                <p className="text-slate-300 text-sm leading-relaxed mb-6">
                  Tus directores de firma supervisan el volumen global de cotizaciones mientras que los
                  analistas técnicos cargan PDFs, auditan y formulan notas consultivas sin interferir entre cuentas.
                </p>
              </div>
              <ul className="space-y-2.5 text-xs text-slate-300 border-t border-slate-700/60 pt-4">
                <li className="flex items-center gap-2">
                  <CheckCircle size={15} className="text-emerald-400 flex-shrink-0" />
                  <span>Separación clara entre gestión comercial y análisis técnico</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle size={15} className="text-emerald-400 flex-shrink-0" />
                  <span>Trazabilidad de quién analizó y aprobó cada dictamen</span>
                </li>
              </ul>
            </div>

            {/* Value 2: Cartera y Renovaciones Automáticas */}
            <div className="bg-gradient-to-b from-slate-800 to-indigo-950/60 border-2 border-indigo-500 rounded-3xl p-8 relative shadow-xl hover:shadow-indigo-500/10 transition-all flex flex-col justify-between scale-[1.02]">
              <div className="absolute -top-3.5 right-6 bg-gradient-to-r from-indigo-500 to-blue-600 text-white text-[10px] font-black uppercase px-3 py-1 rounded-full tracking-wider shadow-sm">
                Retención de Cartera
              </div>
              <div>
                <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center mb-6 shadow-md shadow-indigo-600/30">
                  <FolderKanban size={24} />
                </div>
                <h3 className="text-xl font-bold text-white mb-3">
                  Ciclo de Renovaciones y Alertas de Vencimiento
                </h3>
                <p className="text-slate-200 text-sm leading-relaxed mb-6">
                  Convierte pólizas vigentes en procesos activos de renovación a 60, 30 y 15 días.
                  Compara la póliza actual contra nuevas ofertas del mercado para evitar fugas de clientes.
                </p>
              </div>
              <ul className="space-y-2.5 text-xs text-indigo-100 border-t border-indigo-700/60 pt-4">
                <li className="flex items-center gap-2">
                  <CheckCircle size={15} className="text-emerald-400 flex-shrink-0" />
                  <span>Estados claros: Detectada, En Revisión, Cotizada y Cerrada</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle size={15} className="text-emerald-400 flex-shrink-0" />
                  <span>Historial de prima final y motivos de pérdida para auditoría</span>
                </li>
              </ul>
            </div>

            {/* Value 3: Privacidad y Marca Propia */}
            <div className="bg-slate-800/80 border border-slate-700/80 rounded-3xl p-8 hover:border-indigo-500/50 transition-all flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded-2xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-400 mb-6">
                  <Lock size={24} />
                </div>
                <h3 className="text-xl font-bold text-white mb-3">
                  Aislamiento Total de Clientes y Cotizaciones
                </h3>
                <p className="text-slate-300 text-sm leading-relaxed mb-6">
                  Tus bases de clientes, NITs y acuerdos de prima permanecen 100% aislados bajo tu firma.
                  Genera reportes técnicos en PDF con diseño profesional listos para asambleas y comités de compras.
                </p>
              </div>
              <ul className="space-y-2.5 text-xs text-slate-300 border-t border-slate-700/60 pt-4">
                <li className="flex items-center gap-2">
                  <CheckCircle size={15} className="text-emerald-400 flex-shrink-0" />
                  <span>Exportación en PDF ejecutivo y matrices dinámicas en Excel</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle size={15} className="text-emerald-400 flex-shrink-0" />
                  <span>Seguridad enterprise alineada con la Ley 1581 de Habeas Data</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Multidomain & Regulatory Framework Section */}
      <section id="domains" className="py-24 bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <div className="inline-flex items-center px-3.5 py-1.5 bg-indigo-50 text-indigo-700 rounded-full text-xs font-bold mb-4 border border-indigo-200">
              <Award className="w-3.5 h-3.5 mr-1.5 text-indigo-600" />
              <span>Especialización Multiramo</span>
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 tracking-tight mb-4">
              Auditoría Técnica en 10 Ramos con Normativa Colombiana
            </h2>
            <p className="text-base sm:text-lg text-slate-600 leading-relaxed">
              No todos los seguros son iguales. El motor RAG adapta el tesauro de búsqueda y las reglas de
              validación según el ramo y su legislación aplicable.
            </p>
          </div>

          {/* Domain Tabs Navigation */}
          <div className="flex flex-wrap justify-center gap-2.5 mb-10">
            {domainsInfo.map((domain) => {
              const Icon = domain.icon;
              const isActive = activeDomainTab === domain.id;
              return (
                <button
                  key={domain.id}
                  onClick={() => setActiveDomainTab(domain.id)}
                  className={`flex items-center px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all cursor-pointer ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200 scale-105'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200/80'
                  }`}
                >
                  <Icon className="w-4 h-4 mr-2" />
                  <span>{domain.title}</span>
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
                  className="bg-slate-50 border border-slate-200 rounded-3xl p-8 lg:p-10 max-w-5xl mx-auto shadow-sm grid md:grid-cols-12 gap-8 items-center"
                >
                  <div className="md:col-span-8">
                    <div className="flex items-center gap-2 mb-3">
                      <span className={`px-2.5 py-1 rounded-md text-xs font-bold border ${domain.badgeColor}`}>
                        {domain.norm}
                      </span>
                    </div>

                    <h3 className="text-2xl sm:text-3xl font-black text-slate-900 mb-2 flex items-center gap-2.5">
                      <Icon className="w-7 h-7 text-indigo-600" />
                      <span>{domain.title}</span>
                      <span className="text-sm font-semibold text-slate-500">({domain.subtitle})</span>
                    </h3>

                    <p className="text-slate-600 text-sm sm:text-base leading-relaxed mb-6">
                      {domain.desc}
                    </p>

                    <div className="space-y-2.5 mb-6">
                      {domain.highlights.map((h, idx) => (
                        <div key={idx} className="flex items-center text-sm font-medium text-slate-800">
                          <CheckCircle className="w-4 h-4 text-emerald-600 mr-2.5 flex-shrink-0" />
                          <span>{h}</span>
                        </div>
                      ))}
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-4 border-t border-slate-200 text-xs">
                      <div className="bg-white p-3 rounded-xl border border-slate-200">
                        <span className="text-[10px] font-bold text-slate-400 uppercase block">
                          Ejemplo Cobertura Verificada
                        </span>
                        <span className="font-bold text-slate-800 mt-1 block">
                          {domain.sampleCoverage}
                        </span>
                      </div>
                      <div className="bg-white p-3 rounded-xl border border-slate-200">
                        <span className="text-[10px] font-bold text-slate-400 uppercase block">
                          Deducible Monitoreado
                        </span>
                        <span className="font-bold text-amber-900 mt-1 block">
                          {domain.sampleDeductible}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="md:col-span-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-md text-center flex flex-col justify-center items-center">
                    <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-4">
                      <BookOpen size={28} />
                    </div>
                    <span className="text-xs font-black text-indigo-700 uppercase tracking-wider mb-1">
                      Tesauro Activo
                    </span>
                    <p className="text-xs text-slate-500 mb-5 leading-relaxed">
                      Indexación semántica PGVector de 3072 dimensiones sobre los clausulados colombianos de{' '}
                      <strong>{domain.title}</strong>.
                    </p>
                    <button
                      onClick={onRegisterClick}
                      className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs sm:text-sm shadow-md transition-all cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <span>Auditar Cotización de {domain.title}</span>
                      <ArrowRight size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
        </div>
      </section>

      {/* Real Capabilities Grid */}
      <section id="capabilities" className="py-24 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-xs font-extrabold text-indigo-600 tracking-wider uppercase mb-2">
              Tecnología Que Realmente Funciona
            </h2>
            <p className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 tracking-tight">
              Herramientas de Auditoría Técnica para Ganar Cuentas
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              {
                icon: <BookOpen className="w-6 h-6 text-white" />,
                title: 'Abogado Virtual RAG',
                description:
                  'Genera dictámenes legales citando página y artículo exacto del clausulado registrado ante la SFC. Identifica argumentos de objeción y negociación al instante.',
              },
              {
                icon: <FileCheck className="w-6 h-6 text-white" />,
                title: 'Visor PDF con Evidencia Verbatim',
                description:
                  'Haz clic en cualquier celda de la comparativa y el visor integrado salta automáticamente a la página del contrato con la cláusula resaltada en color.',
              },
              {
                icon: <ShieldCheck className="w-6 h-6 text-white" />,
                title: 'Detección de Coberturas Fantasma',
                description:
                  'Identifica amparos prometidos en la carátula o cotización que no tienen respaldo en las condiciones generales de la aseguradora, evitando litigios.',
              },
              {
                icon: <TrendingUp className="w-6 h-6 text-white" />,
                title: 'Simulador de Riesgo en Deducibles',
                description:
                  'Calcula el deducible monetario real en salarios mínimos (SMMLV 2026) y porcentajes de pérdida sobre el valor asegurable real del cliente.',
              },
              {
                icon: <BarChart3 className="w-6 h-6 text-white" />,
                title: 'Ajuste Humano (HITL) y Notas',
                description:
                  'Control total: edita coberturas, recalcula sumas aseguradas e inserta notas consultivas en Markdown personalizadas para el cliente final.',
              },
              {
                icon: <FileText className="w-6 h-6 text-white" />,
                title: 'Exportación Ejecutiva PDF y Excel',
                description:
                  'Descarga informes listos para comités de compras y asambleas de copropiedad con cuadros de radar, análisis de brechas y cuadro de primas.',
              },
            ].map((feature, idx) => (
              <div
                key={idx}
                className="bg-white p-8 rounded-3xl border border-slate-200/90 shadow-sm hover:shadow-xl hover:border-indigo-300 transition-all duration-300 flex flex-col justify-between"
              >
                <div>
                  <div className="inline-flex items-center justify-center p-3 bg-gradient-to-br from-indigo-600 to-blue-600 rounded-2xl shadow-md mb-6">
                    {feature.icon}
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-3">{feature.title}</h3>
                  <p className="text-slate-600 text-sm leading-relaxed">{feature.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-24 bg-white border-t border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-xs font-extrabold text-indigo-600 tracking-wider uppercase mb-2">
              Flujo Simple y Eficiente
            </h2>
            <p className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
              De cotizaciones en PDF a dictamen comercial en 4 pasos
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {[
              {
                step: '01',
                icon: <FileText className="w-6 h-6 text-white" />,
                title: 'Sube las Cotizaciones',
                description:
                  'Arrastra los PDFs de las diferentes aseguradoras y asocia el cliente o copropiedad.',
              },
              {
                step: '02',
                icon: <Zap className="w-6 h-6 text-white" />,
                title: 'Extracción & Cruzamiento RAG',
                description:
                  'La IA extrae primas, amparos y deducibles, cruzándolos contra los clausulados registrados.',
              },
              {
                step: '03',
                icon: <BarChart3 className="w-6 h-6 text-white" />,
                title: 'Revisión Técnica & Dictamen',
                description:
                  'Revisa alertas de coberturas fantasma, notas del Abogado Virtual y deducibles críticos.',
              },
              {
                step: '04',
                icon: <CheckCircle className="w-6 h-6 text-white" />,
                title: 'Presenta & Gana el Negocio',
                description:
                  'Exporta el informe ejecutivo en PDF o Excel y promueve la cotización ganadora a póliza.',
              },
            ].map((item, idx) => (
              <div key={idx} className="relative text-center group">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-indigo-600 to-blue-600 text-white rounded-2xl shadow-lg mb-6 group-hover:scale-105 transition-transform">
                  {item.icon}
                </div>
                <div className="text-5xl font-black text-slate-100 absolute -top-5 left-1/2 transform -translate-x-1/2 -z-10 select-none">
                  {item.step}
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">{item.title}</h3>
                <p className="text-slate-600 text-xs sm:text-sm leading-relaxed">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Comparison: Traditional vs Comparador CSA */}
      <section className="py-24 bg-slate-900 text-white relative overflow-hidden">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-xs font-extrabold text-indigo-400 tracking-wider uppercase mb-2">
              Transformación Operativa
            </h2>
            <p className="text-3xl sm:text-4xl font-black tracking-tight">
              ¿Por qué las mejores corredurías abandonaron el análisis manual en Excel?
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {/* The Old Way */}
            <div className="bg-slate-800/60 border border-rose-900/40 rounded-3xl p-8">
              <div className="flex items-center gap-2 mb-6 text-rose-400 font-bold text-lg">
                <X size={22} className="stroke-[3]" />
                <span>Análisis Manual Tradicional</span>
              </div>
              <ul className="space-y-4 text-sm text-slate-300">
                <li className="flex items-start gap-3">
                  <X className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" />
                  <span>Horas interminables transcribiendo primas y deducibles a hojas de Excel.</span>
                </li>
                <li className="flex items-start gap-3">
                  <X className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" />
                  <span>Imposibilidad de leer clausulados de más de 120 páginas por cada cotización.</span>
                </li>
                <li className="flex items-start gap-3">
                  <X className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" />
                  <span>Riesgo de recomendar pólizas que excluyen amparos exigidos por la Ley 675 o Ley 80.</span>
                </li>
                <li className="flex items-start gap-3">
                  <X className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" />
                  <span>Sin respaldo de texto verbatim cuando la aseguradora objeta un siniestro.</span>
                </li>
              </ul>
            </div>

            {/* The CSA Way */}
            <div className="bg-gradient-to-br from-indigo-950 to-slate-800 border-2 border-indigo-500 rounded-3xl p-8 shadow-xl shadow-indigo-950/50">
              <div className="flex items-center gap-2 mb-6 text-emerald-400 font-bold text-lg">
                <CheckCircle size={22} />
                <span>Con Comparador CSA</span>
              </div>
              <ul className="space-y-4 text-sm text-slate-200">
                <li className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5 stroke-[3]" />
                  <span>Auditoría completa en menos de 2 minutos directamente desde los PDFs originales.</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5 stroke-[3]" />
                  <span>Cruzamiento automático contra los clausulados reales registrados ante la SFC.</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5 stroke-[3]" />
                  <span>Detección de alertas jurídicas y coberturas fantasma antes de presentar al cliente.</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5 stroke-[3]" />
                  <span>Evidencia textual verbatim con enlace directo a la página y artículo del contrato.</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section id="testimonials" className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-xs font-extrabold text-indigo-600 tracking-wider uppercase mb-2">
              Casos de Éxito en Colombia
            </h2>
            <p className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
              Respaldado por Corredores y Directores Técnicos
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                text: 'En una licitación de copropiedad con 4 aseguradoras, el dictamen del Abogado Virtual detectó que dos propuestas omitían la reconstrucción obligatoria del Art. 15. Ganamos la cuenta de inmediato demostrando la falta técnica de la competencia.',
                author: 'Carlos Rodríguez',
                role: 'Director Técnico de Correduría',
                rating: 5,
              },
              {
                text: 'El visor interactivo que salta a la página exacta del PDF del clausulado nos ahorró semanas de discusiones. Le proyectamos la evidencia al cliente en la junta directiva y la decisión fue unánime.',
                author: 'Ana María Vélez',
                role: 'Gerente de Cuentas Corporativas',
                rating: 5,
              },
              {
                text: 'Administrar el portafolio de renovaciones con alertas automáticas a 60 y 30 días elevó nuestra retención de pólizas comerciales en más de un 25% este trimestre.',
                author: 'Jorge L. Pérez',
                role: 'Corredor de Seguros Independiente',
                rating: 5,
              },
            ].map((t, i) => (
              <div
                key={i}
                className="bg-slate-50 p-8 rounded-3xl border border-slate-200 flex flex-col justify-between"
              >
                <div>
                  <div className="flex text-amber-400 mb-4">
                    {[...Array(t.rating)].map((_, j) => (
                      <Star key={j} className="w-4 h-4 fill-current" />
                    ))}
                  </div>
                  <p className="text-slate-700 text-sm leading-relaxed italic mb-6">
                    "{t.text}"
                  </p>
                </div>
                <div className="flex items-center pt-4 border-t border-slate-200">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-blue-600 text-white font-bold flex items-center justify-center text-sm">
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

      {/* High-Converting Final CTA Section */}
      <section className="py-24 relative overflow-hidden bg-gradient-to-br from-indigo-700 via-blue-700 to-indigo-900 text-white">
        <div className="absolute inset-0 opacity-10 pointer-events-none">
          <div className="absolute top-0 left-0 w-96 h-96 bg-white rounded-full blur-3xl -ml-48 -mt-48" />
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-white rounded-full blur-3xl -mr-48 -mb-48" />
        </div>

        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
          <span className="inline-flex items-center px-3.5 py-1.5 rounded-full bg-white/10 text-indigo-100 text-xs font-bold mb-6 border border-white/20">
            Prueba Sin Compromiso
          </span>
          <h2 className="text-3xl sm:text-5xl font-black mb-6 tracking-tight leading-tight">
            Eleva el estándar técnico de tus comparativas y protege a tus clientes
          </h2>
          <p className="text-base sm:text-xl text-indigo-100 mb-10 max-w-2xl mx-auto leading-relaxed">
            Comienza a auditar cotizaciones en Copropiedades, Cumplimiento, Salud, Transporte, Pyme y más
            con el respaldo de la Inteligencia Contractual RAG.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={onRegisterClick}
              className="px-9 py-4.5 bg-white text-indigo-700 rounded-xl text-lg font-black shadow-2xl hover:bg-indigo-50 hover:scale-105 active:scale-95 transition-all cursor-pointer"
            >
              Comenzar Auditoría Gratuita
            </button>
            <button
              onClick={onLoginClick}
              className="px-9 py-4.5 bg-indigo-900/40 text-white border-2 border-white/40 rounded-xl text-lg font-bold hover:bg-white/10 transition-all cursor-pointer"
            >
              Acceso Corredores
            </button>
          </div>

          <div className="mt-8 flex flex-wrap justify-center items-center gap-6 text-xs text-indigo-200">
            <span>✓ Sin requerir tarjeta de crédito</span>
            <span>✓ Resultados en menos de 2 minutos</span>
            <span>✓ Compatible con cotizaciones de toda aseguradora</span>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-950 text-slate-400 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8">
            {/* Brand */}
            <div className="lg:col-span-1">
              <div className="flex items-center space-x-2.5 mb-4">
                <div className="bg-gradient-to-br from-indigo-600 to-blue-600 p-2 rounded-xl">
                  <ShieldCheck className="text-white w-5 h-5" />
                </div>
                <span className="text-white font-black text-lg">Comparador CSA</span>
              </div>
              <p className="text-xs leading-relaxed mb-4 text-slate-400">
                Plataforma de análisis técnico, auditoría contractual RAG y gestión de cartera para
                intermediarios de seguros en Colombia.
              </p>
              <div className="flex space-x-3">
                <span className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 hover:text-white transition-colors cursor-pointer">
                  <Globe size={16} />
                </span>
                <span className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 hover:text-white transition-colors cursor-pointer">
                  <MessageCircle size={16} />
                </span>
              </div>
            </div>

            {/* 10 Ramos */}
            <div>
              <h4 className="text-white text-xs font-bold uppercase tracking-wider mb-4">
                10 Ramos Soportados
              </h4>
              <ul className="space-y-2 text-xs">
                <li>Copropiedades (Ley 675)</li>
                <li>Cumplimiento (Ley 80)</li>
                <li>Pyme & Comercial</li>
                <li>Salud & Medicina Prepagada</li>
                <li>Transporte de Carga</li>
                <li>Autos & Flotas Comerciales</li>
                <li>Vida Grupo & Personas</li>
                <li>Hogar & Habitacional</li>
                <li>Maquinaria & Equipos</li>
                <li>Casco Embarcación (DIMAR)</li>
              </ul>
            </div>

            {/* Capacidades */}
            <div>
              <h4 className="text-white text-xs font-bold uppercase tracking-wider mb-4">
                Capacidades RAG
              </h4>
              <ul className="space-y-2 text-xs">
                <li>Abogado Virtual RAG</li>
                <li>Visor PDF Verbatim</li>
                <li>Validación Bidireccional</li>
                <li>Simulador de Deducibles</li>
                <li>Auditoría HITL y Notas</li>
                <li>Gestión de Renovaciones</li>
                <li>Reportes Ejecutivos PDF / Excel</li>
              </ul>
            </div>

            {/* Legal */}
            <div>
              <h4 className="text-white text-xs font-bold uppercase tracking-wider mb-4">
                Marco Legal & Seguridad
              </h4>
              <ul className="space-y-2 text-xs">
                <li>
                  <button
                    type="button"
                    onClick={() => handleOpenLegal('terms')}
                    className="hover:text-white transition-colors text-left cursor-pointer"
                  >
                    Términos y Condiciones
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => handleOpenLegal('privacy')}
                    className="hover:text-white transition-colors text-left cursor-pointer"
                  >
                    Privacidad (Ley 1581)
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => handleOpenLegal('security')}
                    className="hover:text-white transition-colors text-left cursor-pointer"
                  >
                    Seguridad de la Información
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => handleOpenLegal('disclaimer')}
                    className="hover:text-white transition-colors text-left cursor-pointer"
                  >
                    Aviso Regulatorio SFC
                  </button>
                </li>
              </ul>
            </div>

            {/* Contacto */}
            <div>
              <h4 className="text-white text-xs font-bold uppercase tracking-wider mb-4">
                Contacto Intermediarios
              </h4>
              <ul className="space-y-2.5 text-xs">
                <li className="flex items-center gap-2">
                  <Globe size={14} className="text-indigo-400" />
                  <a
                    href="https://correseguros.co/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-white transition-colors"
                  >
                    correseguros.co
                  </a>
                </li>
                <li className="flex items-center gap-2">
                  <Mail size={14} className="text-indigo-400" />
                  <span>soporte@comparadorcsa.com</span>
                </li>
                <li className="flex items-center gap-2">
                  <Phone size={14} className="text-indigo-400" />
                  <span>+57 (601) 345-6789</span>
                </li>
                <li className="flex items-start gap-2">
                  <MapPin size={14} className="text-indigo-400 mt-0.5" />
                  <span>Bogotá D.C., Colombia</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="border-t border-slate-900 mt-12 pt-8 flex flex-col md:flex-row justify-between items-center text-xs text-slate-500">
            <p>
              © 2026 Comparador Seguros CSA · Desarrollado por{' '}
              <a
                href="https://correseguros.co/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-slate-400 hover:text-slate-300 underline underline-offset-2"
              >
                Corredores de Seguros Asociados S.A.
              </a>{' '}
              · Todos los derechos reservados.
            </p>
            <div className="flex items-center space-x-1.5 mt-4 md:mt-0">
              <span>Tecnología desarrollada para el mercado asegurador colombiano</span>
              <Zap size={13} className="text-amber-400" />
            </div>
          </div>
        </div>
      </footer>

      <LegalModal
        isOpen={showLegalModal}
        onClose={() => setShowLegalModal(false)}
        initialTab={legalTab}
      />
    </div>
  );
};

export default LandingPage;
