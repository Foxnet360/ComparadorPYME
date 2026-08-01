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
  Clock,
  Lock,
  TrendingUp,
  AlertTriangle,
  Mail,
  Phone,
  MapPin,
  Globe,
  MessageCircle,
} from 'lucide-react';

interface LandingPageProps {
  onLoginClick: () => void;
  onRegisterClick: () => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ onLoginClick, onRegisterClick }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

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
                <p className="text-xs text-slate-500 -mt-1">Multi-Aseguradora PYME</p>
              </div>
            </div>

            {/* Desktop Menu */}
            <div className="hidden md:flex items-center space-x-8">
              <button
                onClick={() => scrollToSection('features')}
                className="text-slate-600 hover:text-indigo-600 font-medium transition-colors"
              >
                Características
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
              <button
                onClick={() => scrollToSection('testimonials')}
                className="text-slate-600 hover:text-indigo-600 font-medium transition-colors"
              >
                Testimonios
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
              onClick={() => scrollToSection('features')}
              className="text-left text-lg font-medium text-slate-700 py-2"
            >
              Características
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
              onClick={() => scrollToSection('testimonials')}
              className="text-left text-lg font-medium text-slate-700 py-2"
            >
              Testimonios
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
      <section className="pt-32 pb-20 lg:pt-48 lg:pb-32 relative overflow-hidden">
        <div className="absolute top-0 right-0 -mr-40 -mt-40 w-[600px] h-[600px] bg-gradient-to-br from-indigo-200/40 to-blue-200/40 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-0 -ml-40 -mb-40 w-[500px] h-[500px] bg-gradient-to-tr from-purple-200/40 to-indigo-200/40 rounded-full blur-3xl"></div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="text-center lg:text-left">
              <div className="inline-flex items-center px-4 py-2 bg-indigo-50 text-indigo-700 rounded-full text-sm font-semibold mb-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                <Zap size={16} className="mr-2" />
                Análisis en 2 minutos con Gemini AI
              </div>
              <h1 className="text-5xl md:text-6xl font-extrabold text-slate-900 tracking-tight mb-6 leading-tight">
                Compara Cotizaciones de Seguros
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-blue-600">
                  {' '}
                  Multi-Aseguradora
                </span>
              </h1>
              <p className="text-xl text-slate-600 mb-8 leading-relaxed">
                Sube PDFs de cotizaciones de múltiples aseguradoras y obtén un análisis comparativo
                detallado en solo 2 minutos. Inteligencia Artificial que lee, entiende y compara por
                ti.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                <button
                  onClick={onRegisterClick}
                  className="px-8 py-4 bg-gradient-to-r from-indigo-600 to-blue-600 text-white rounded-full text-lg font-bold shadow-xl shadow-indigo-300 hover:shadow-2xl hover:scale-105 transition-all flex items-center justify-center"
                >
                  Analizar mi primera cotización <ArrowRight className="ml-2 w-5 h-5" />
                </button>
                <button
                  onClick={() => scrollToSection('how-it-works')}
                  className="px-8 py-4 bg-white text-slate-700 border-2 border-slate-200 rounded-full text-lg font-bold hover:border-indigo-300 hover:bg-indigo-50 transition-all"
                >
                  Ver cómo funciona
                </button>
              </div>

              {/* Stats */}
              <div className="mt-12 grid grid-cols-3 gap-8">
                {[
                  { value: '2 min', label: 'Tiempo de análisis' },
                  { value: '14', label: 'Categorías comparadas' },
                  { value: '100%', label: 'Automatizado' },
                ].map((stat, i) => (
                  <div key={i} className="text-center lg:text-left">
                    <div className="text-2xl font-bold text-indigo-600">{stat.value}</div>
                    <div className="text-sm text-slate-500">{stat.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Hero Visual */}
            <div className="hidden lg:block relative">
              <div className="relative bg-white rounded-2xl shadow-2xl p-6 border border-slate-200">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex space-x-2">
                    <div className="w-3 h-3 rounded-full bg-red-400"></div>
                    <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
                    <div className="w-3 h-3 rounded-full bg-green-400"></div>
                  </div>
                  <span className="text-xs text-slate-400">Comparador CSA</span>
                </div>
                <div className="space-y-3">
                  <div className="bg-gradient-to-r from-indigo-50 to-blue-50 p-4 rounded-xl">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-slate-800">Matriz de Coberturas</span>
                      <span className="text-xs text-green-600 bg-green-100 px-2 py-1 rounded-full">
                        Análisis Completo
                      </span>
                    </div>
                    <div className="grid grid-cols-4 gap-2 text-xs">
                      <div className="bg-white p-2 rounded">Incendio</div>
                      <div className="bg-green-100 p-2 rounded text-center">✓</div>
                      <div className="bg-green-100 p-2 rounded text-center">✓</div>
                      <div className="bg-red-100 p-2 rounded text-center">✗</div>
                    </div>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-xl">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-slate-800">Score: 85/100</span>
                      <div className="flex text-yellow-400">
                        {[...Array(4)].map((_, i) => (
                          <Star key={i} className="w-4 h-4 fill-current" />
                        ))}
                      </div>
                    </div>
                    <div className="h-2 bg-slate-200 rounded-full">
                      <div className="h-full w-[85%] bg-gradient-to-r from-indigo-500 to-blue-500 rounded-full"></div>
                    </div>
                  </div>
                  <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl">
                    <div className="flex items-center text-amber-800 text-sm">
                      <AlertTriangle className="w-4 h-4 mr-2" />
                      Deducible Terremoto: 15% sobre valor asegurado
                    </div>
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
          <p className="text-sm font-semibold text-slate-400 uppercase tracking-widest mb-8">
            Compatible con documentos de
          </p>
          <div className="flex flex-wrap justify-center items-center gap-6 md:gap-12 opacity-75">
            <span className="text-xl font-bold text-slate-600 hover:text-indigo-600 transition-colors">
              Allianz
            </span>
            <span className="text-xl font-bold text-slate-600 hover:text-indigo-600 transition-colors">
              MAPFRE
            </span>
            <span className="text-xl font-bold text-slate-600 hover:text-indigo-600 transition-colors">
              SURA
            </span>
            <span className="text-xl font-bold text-slate-600 hover:text-indigo-600 transition-colors">
              AXA COLPATRIA
            </span>
            <span className="text-xl font-bold text-slate-600 hover:text-indigo-600 transition-colors">
              SBS
            </span>
            <span className="text-xl font-bold text-slate-600 hover:text-indigo-600 transition-colors">
              BBVA
            </span>
            <span className="text-xl font-bold text-slate-600 hover:text-indigo-600 transition-colors">
              Seguros Bolívar
            </span>
            <span className="text-xl font-bold text-slate-600 hover:text-indigo-600 transition-colors">
              Chubb
            </span>
            <span className="text-xl font-bold text-slate-600 hover:text-indigo-600 transition-colors">
              Zurich
            </span>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-base text-indigo-600 font-semibold tracking-wide uppercase">
              Cómo Funciona
            </h2>
            <p className="mt-2 text-3xl leading-8 font-extrabold tracking-tight text-slate-900 sm:text-4xl">
              De PDF a reporte profesional en 4 pasos
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {[
              {
                step: '01',
                icon: <FileText className="w-6 h-6 text-white" />,
                title: 'Sube los PDFs',
                description:
                  'Sube hasta 10 cotizaciones simultáneas en formato PDF de cualquier aseguradora.',
              },
              {
                step: '02',
                icon: <Zap className="w-6 h-6 text-white" />,
                title: 'IA Analiza',
                description:
                  'Gemini AI extrae automáticamente coberturas, deducibles, sumas aseguradas y exclusiones.',
              },
              {
                step: '03',
                icon: <BarChart3 className="w-6 h-6 text-white" />,
                title: 'Compara',
                description:
                  'Homologa las 14 categorías de cobertura PYME y genera matrices comparativas lado a lado.',
              },
              {
                step: '04',
                icon: <CheckCircle className="w-6 h-6 text-white" />,
                title: 'Reporta',
                description:
                  'Genera informes PDF ejecutivos con análisis de riesgos, scores y recomendaciones.',
              },
            ].map((item, idx) => (
              <div key={idx} className="relative text-center group">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-indigo-600 to-blue-600 rounded-2xl shadow-lg mb-6 group-hover:scale-110 transition-transform">
                  {item.icon}
                </div>
                <div className="text-4xl font-bold text-slate-200 absolute -top-4 left-1/2 transform -translate-x-1/2 -z-10">
                  {item.step}
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-3">{item.title}</h3>
                <p className="text-slate-600 leading-relaxed">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-base text-indigo-600 font-semibold tracking-wide uppercase">
              Características Clave
            </h2>
            <p className="mt-2 text-3xl leading-8 font-extrabold tracking-tight text-slate-900 sm:text-4xl">
              Todo el poder del análisis técnico automatizado
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              {
                icon: <FileText className="w-7 h-7 text-white" />,
                title: 'Extracción Inteligente de PDFs',
                description:
                  'Lee cotizaciones en PDF e imágenes usando visión computacional. Extrae coberturas, deducibles, sumas aseguradas y primas sin intervención manual.',
              },
              {
                icon: <BarChart3 className="w-7 h-7 text-white" />,
                title: 'Matriz Unificada 14 Categorías',
                description:
                  'Compara "peras con peras" homologando automáticamente las 14 coberturas estándar PYME: Incendio, Lucro Cesante, Sustracción, RC, Terremoto y más.',
              },
              {
                icon: <ShieldCheck className="w-7 h-7 text-white" />,
                title: 'Auditoría de Riesgos con IA',
                description:
                  'Detecta "silencios" (coberturas omitidas), cláusulas abusivas, deducibles desfavorables y sublímites restrictivos antes de presentar al cliente.',
              },
              {
                icon: <TrendingUp className="w-7 h-7 text-white" />,
                title: 'Scoring Multidimensional',
                description:
                  'Cálculo automático de score 0-100 basado en: coberturas (25%), deducibles (20%), exclusiones (20%), precio (15%), sublímites (10%) y garantías (10%).',
              },
              {
                icon: <Clock className="w-7 h-7 text-white" />,
                title: 'Análisis en 2 Minutos',
                description:
                  'Procesa múltiples cotizaciones simultáneamente. El análisis completo con extracción, comparación y generación de reporte toma menos de 2 minutos.',
              },
              {
                icon: <Lock className="w-7 h-7 text-white" />,
                title: 'Reportes PDF Ejecutivos',
                description:
                  'Genera informes profesionales en PDF con gráficos de radar, análisis cualitativo, cuadros comparativos y dictamen del auditor listos para entregar al cliente.',
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
                <p className="text-slate-600 leading-relaxed">{feature.description}</p>
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
                El método tradicional te está costando tiempo y dinero
              </h2>
              <div className="space-y-6">
                {[
                  {
                    text: 'Horas copiando datos de PDFs a Excel manualmente',
                    icon: <X className="w-5 h-5" />,
                  },
                  {
                    text: 'Errores al digitar sumas aseguradas y deducibles',
                    icon: <X className="w-5 h-5" />,
                  },
                  {
                    text: 'Dificultad para comparar cláusulas entre aseguradoras',
                    icon: <X className="w-5 h-5" />,
                  },
                  {
                    text: 'Presentaciones genéricas que no impresionan al cliente',
                    icon: <X className="w-5 h-5" />,
                  },
                  {
                    text: 'Riesgo de no detectar exclusiones críticas',
                    icon: <X className="w-5 h-5" />,
                  },
                ].map((item, i) => (
                  <div key={i} className="flex items-start">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center mr-4 mt-0.5">
                      <span className="text-red-400">{item.icon}</span>
                    </div>
                    <span className="text-lg text-slate-300">{item.text}</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h2 className="text-3xl md:text-4xl font-bold mb-6 text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-blue-400">
                Con Comparador CSA
              </h2>
              <div className="space-y-4">
                {[
                  {
                    text: 'Análisis completo en 2 minutos',
                    subtext: 'Sube PDFs y recibe el reporte automáticamente',
                  },
                  {
                    text: 'Extracción sin errores con IA',
                    subtext: 'Gemini lee y comprende cada detalle del documento',
                  },
                  {
                    text: 'Comparación "peras con peras"',
                    subtext: '14 categorías estandarizadas lado a lado',
                  },
                  {
                    text: 'Reportes ejecutivos en PDF',
                    subtext: 'Gráficos, scores y recomendaciones profesionales',
                  },
                  {
                    text: 'Detección de riesgos ocultos',
                    subtext: 'Alertas automáticas de silencios y exclusiones',
                  },
                ].map((item, i) => (
                  <div
                    key={i}
                    className="flex items-start bg-white/5 p-4 rounded-xl backdrop-blur-sm border border-white/10"
                  >
                    <div className="flex-shrink-0 mr-4">
                      <CheckCircle className="w-6 h-6 text-green-400" />
                    </div>
                    <div>
                      <div className="font-semibold text-white">{item.text}</div>
                      <div className="text-sm text-slate-400 mt-1">{item.subtext}</div>
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
              Testimonios
            </h2>
            <p className="mt-2 text-3xl leading-8 font-extrabold tracking-tight text-slate-900 sm:text-4xl">
              Lo que dicen los corredores de seguros
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                text: 'Reduje mi tiempo de análisis de 3 horas a 2 minutos. Ahora puedo atender 5 veces más clientes con la misma calidad técnica.',
                author: 'Carlos Rodríguez',
                role: 'Director Técnico, Seguros Beta',
                rating: 5,
              },
              {
                text: "El detector de 'silencios' nos salvó de un siniestro no cubierto. Identificó una exclusión de terremoto que ninguno de nosotros había visto.",
                author: 'Ana María Velez',
                role: 'Gerente Comercial, Marsh',
                rating: 5,
              },
              {
                text: 'Mis clientes quedan impresionados con los reportes PDF. El análisis de radar y las recomendaciones dan un nivel de profesionalismo que no tenía antes.',
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
                <p className="text-slate-700 mb-6 italic flex-grow leading-relaxed">"{t.text}"</p>
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
            ¿Listo para revolucionar tu corretaje?
          </h2>
          <p className="text-indigo-100 text-xl mb-4 max-w-2xl mx-auto">
            Únete a cientos de intermediarios que ya usan Inteligencia Artificial para analizar
            cotizaciones.
          </p>
          <p className="text-indigo-200 text-lg mb-10">
            Tu primera comparación está lista en 2 minutos.
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
            No requiere tarjeta de crédito • Análisis ilimitados durante prueba
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
                Comparador multi-aseguradora para PYMEs potenciado con Inteligencia Artificial.
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

            {/* Producto */}
            <div>
              <h4 className="text-white font-semibold mb-4">Producto</h4>
              <ul className="space-y-3">
                <li>
                  <button
                    onClick={() => scrollToSection('features')}
                    className="text-slate-400 hover:text-white transition-colors text-sm"
                  >
                    Características
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => scrollToSection('how-it-works')}
                    className="text-slate-400 hover:text-white transition-colors text-sm"
                  >
                    Cómo Funciona
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => scrollToSection('benefits')}
                    className="text-slate-400 hover:text-white transition-colors text-sm"
                  >
                    Beneficios
                  </button>
                </li>
                <li>
                  <span className="text-slate-500 text-sm">Pricing (Próximamente)</span>
                </li>
              </ul>
            </div>

            {/* Compañía */}
            <div>
              <h4 className="text-white font-semibold mb-4">Compañía</h4>
              <ul className="space-y-3">
                <li>
                  <span className="text-slate-400 text-sm">Sobre Nosotros</span>
                </li>
                <li>
                  <span className="text-slate-400 text-sm">Blog</span>
                </li>
                <li>
                  <span className="text-slate-400 text-sm">Contacto</span>
                </li>
                <li>
                  <span className="text-slate-400 text-sm">Términos de Servicio</span>
                </li>
                <li>
                  <span className="text-slate-400 text-sm">Privacidad</span>
                </li>
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
