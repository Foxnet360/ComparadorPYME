
import React from 'react';
import { ShieldCheck, Zap, FileText, CheckCircle, BarChart, ArrowRight, Star, Menu, X } from 'lucide-react';

interface LandingPageProps {
    onLoginClick: () => void;
    onRegisterClick: () => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ onLoginClick, onRegisterClick }) => {
    const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

    return (
        <div className="min-h-screen bg-slate-50 font-sans text-slate-900 overflow-x-hidden">

            {/* Navigation */}
            <nav className="fixed w-full z-50 bg-white/80 backdrop-blur-md border-b border-slate-100 transition-all duration-300">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between h-20 items-center">
                        <div className="flex items-center space-x-2">
                            <div className="bg-indigo-600 p-2 rounded-xl shadow-lg shadow-indigo-200">
                                <ShieldCheck className="text-white w-6 h-6" />
                            </div>
                            <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-700 to-indigo-500">
                                Comparador CSA
                            </span>
                        </div>

                        {/* Desktop Menu */}
                        <div className="hidden md:flex items-center space-x-8">
                            <a href="#features" className="text-slate-600 hover:text-indigo-600 font-medium transition-colors">Características</a>
                            <a href="#benefits" className="text-slate-600 hover:text-indigo-600 font-medium transition-colors">Beneficios</a>
                            <a href="#testimonials" className="text-slate-600 hover:text-indigo-600 font-medium transition-colors">Testimonios</a>
                            <div className="flex items-center space-x-4 ml-6">
                                <button
                                    onClick={onLoginClick}
                                    className="text-slate-700 font-medium hover:text-indigo-600 transition-colors"
                                >
                                    Iniciar Sesión
                                </button>
                                <button
                                    onClick={onRegisterClick}
                                    className="px-6 py-2.5 bg-indigo-600 text-white rounded-full font-semibold shadow-lg shadow-indigo-200 hover:bg-indigo-700 hover:scale-105 transition-all duration-300"
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
                    <div className="md:hidden bg-white border-b border-slate-100 absolute w-full px-4 py-4 shadow-xl flex flex-col space-y-4 animate-in slide-in-from-top-10">
                        <a href="#features" onClick={() => setMobileMenuOpen(false)} className="text-lg font-medium text-slate-700">Características</a>
                        <a href="#benefits" onClick={() => setMobileMenuOpen(false)} className="text-lg font-medium text-slate-700">Beneficios</a>
                        <button onClick={onLoginClick} className="w-full text-left text-lg font-medium text-slate-700 py-2">Iniciar Sesión</button>
                        <button onClick={onRegisterClick} className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold shadow-lg">Crear Cuenta</button>
                    </div>
                )}
            </nav>

            {/* Hero Section */}
            <section className="pt-32 pb-20 lg:pt-48 lg:pb-32 relative overflow-hidden">
                <div className="absolute top-0 right-0 -mr-20 -mt-20 w-96 h-96 bg-indigo-100 rounded-full blur-3xl opacity-50"></div>
                <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-72 h-72 bg-blue-100 rounded-full blur-3xl opacity-50"></div>

                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
                    <div className="inline-flex items-center px-4 py-2 bg-indigo-50 text-indigo-700 rounded-full text-sm font-semibold mb-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                        <Zap size={16} className="mr-2" />
                        Potenciado con Gemini AI
                    </div>
                    <h1 className="text-5xl md:text-7xl font-extrabold text-slate-900 tracking-tight mb-8 leading-tight animate-in fade-in slide-in-from-bottom-6 duration-1000">
                        Tu Corretaje de Seguros,<br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-blue-500">Inteligente y Escalable.</span>
                    </h1>
                    <p className="mt-4 max-w-2xl mx-auto text-xl text-slate-600 mb-10 animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-100">
                        Analiza PDFs de cotizaciones en segundos, genera cuadros comparativos automáticos y entrega informes profesionales que cierran ventas.
                    </p>
                    <div className="flex flex-col sm:flex-row justify-center items-center space-y-4 sm:space-y-0 sm:space-x-6 animate-in fade-in slide-in-from-bottom-10 duration-1000 delay-200">
                        <button
                            onClick={onRegisterClick}
                            className="px-8 py-4 bg-indigo-600 text-white rounded-full text-lg font-bold shadow-xl shadow-indigo-300 hover:bg-indigo-700 hover:scale-105 transition-all w-full sm:w-auto flex items-center justify-center"
                        >
                            Auditar mi primer caso <ArrowRight className="ml-2 w-5 h-5" />
                        </button>
                        <button
                            onClick={() => document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' })}
                            className="px-8 py-4 bg-white text-slate-700 border border-slate-200 rounded-full text-lg font-bold shadow-sm hover:bg-slate-50 transition-all w-full sm:w-auto"
                        >
                            Ver Demo Interactiva
                        </button>
                    </div>
                </div>
            </section>

            {/* Trusted By Section (Dummy Data) */}
            <section className="py-10 border-y border-slate-200 bg-white/50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                    <p className="text-sm font-semibold text-slate-400 uppercase tracking-widest mb-8">Compatible con documentos de</p>
                    <div className="flex flex-wrap justify-center items-center gap-8 md:gap-16 opacity-60 grayscale hover:grayscale-0 transition-all duration-500">
                        {/* Text Logos for simplicity, in a real app these would be SVGs */}
                        <span className="text-2xl font-bold text-slate-700">Allianz</span>
                        <span className="text-2xl font-bold text-slate-700">MAPFRE</span>
                        <span className="text-2xl font-bold text-slate-700">SURA</span>
                        <span className="text-2xl font-bold text-slate-700">Chubb</span>
                        <span className="text-2xl font-bold text-slate-700">AXA COLPATRIA</span>
                        <span className="text-2xl font-bold text-slate-700">Zurich</span>
                    </div>
                </div>
            </section>

            {/* Value Proposition / Features */}
            <section id="features" className="py-24 bg-white relative">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center mb-16">
                        <h2 className="text-base text-indigo-600 font-semibold tracking-wide uppercase">Características Clave</h2>
                        <p className="mt-2 text-3xl leading-8 font-extrabold tracking-tight text-slate-900 sm:text-4xl">
                            Todo lo que necesitas para optimizar tu operación técnica
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
                        {[
                            {
                                icon: <FileText className="w-8 h-8 text-white" />,
                                title: "Extracción Automática",
                                description: "Olvídate de copiar y pegar. Nuestro motor AI lee cotizaciones en PDF e imagen y normaliza la data en segundos."
                            },
                            {
                                icon: <BarChart className="w-8 h-8 text-white" />,
                                title: "Comparativas Estandarizadas",
                                description: "Genera cuadros comparativos 'peras con peras'. Homologamos coberturas y deducibles para un análisis justo."
                            },
                            {
                                icon: <ShieldCheck className="w-8 h-8 text-white" />,
                                title: "Auditoría de Riesgos",
                                description: "Detecta vacíos de cobertura ('Silencios') y cláusulas abusivas automáticamente antes de presentar al cliente."
                            }
                        ].map((feature, idx) => (
                            <div key={idx} className="relative group bg-slate-50 p-8 rounded-3xl hover:bg-indigo-50 transition-colors duration-300 border border-slate-100 hover:border-indigo-100">
                                <div className="absolute top-0 right-0 -mr-8 -mt-8 w-24 h-24 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full opacity-10 blur-xl group-hover:opacity-20 transition-all"></div>
                                <div className="inline-flex items-center justify-center p-3 bg-gradient-to-br from-indigo-600 to-indigo-700 rounded-xl shadow-lg mb-6 group-hover:scale-110 transition-transform duration-300">
                                    {feature.icon}
                                </div>
                                <h3 className="text-xl font-bold text-slate-900 mb-3">{feature.title}</h3>
                                <p className="text-slate-600 leading-relaxed">
                                    {feature.description}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Problem Comparison Section */}
            <section className="py-20 bg-slate-900 text-white overflow-hidden">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
                        <div>
                            <h2 className="text-3xl md:text-4xl font-bold mb-6">El método tradicional te está costando dinero.</h2>
                            <ul className="space-y-6">
                                {[
                                    "Horas perdidas pasando datos a Excel.",
                                    "Errores humanos al digitar sumas aseguradas.",
                                    "Dificultad para comparar textos de clausulados.",
                                    "Presentaciones visualmente pobres al cliente."
                                ].map((item, i) => (
                                    <li key={i} className="flex items-start opacity-80">
                                        <div className="flex-shrink-0 w-6 h-6 rounded-full bg-red-500/20 flex items-center justify-center mr-3 mt-1">
                                            <X className="w-4 h-4 text-red-500" />
                                        </div>
                                        <span className="text-lg">{item}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>

                        <div className="relative">
                            {/* Visual representation of 'The Solution' */}
                            <div className="bg-gradient-to-br from-indigo-600 to-blue-600 rounded-2xl p-8 shadow-2xl transform rotate-3 hover:rotate-0 transition-all duration-500">
                                <h3 className="text-2xl font-bold mb-6 flex items-center">
                                    <CheckCircle className="mr-3 text-green-300" /> Con Comparador CSA
                                </h3>
                                <ul className="space-y-4">
                                    <li className="flex items-center bg-white/10 p-3 rounded-lg backdrop-blur-sm">
                                        <Zap className="mr-3 text-yellow-300" /> Análisis en <span className="font-bold ml-1">30 segundos</span>
                                    </li>
                                    <li className="flex items-center bg-white/10 p-3 rounded-lg backdrop-blur-sm">
                                        <BarChart className="mr-3 text-green-300" /> Reportes PDF de Alta Gerencia
                                    </li>
                                    <li className="flex items-center bg-white/10 p-3 rounded-lg backdrop-blur-sm">
                                        <ShieldCheck className="mr-3 text-indigo-200" /> Compliance Automático
                                    </li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Testimonials (Dummy Data) */}
            <section id="testimonials" className="py-24 bg-slate-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                    <h2 className="text-3xl font-bold text-slate-900 mb-16">Lo que dicen los expertos</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {[
                            {
                                text: "Ha reducido mi tiempo de análisis en un 80%. Ahora puedo dedicarme a vender y no a llenar Excels.",
                                author: "Carlos Rodríguez",
                                role: "Director Técnico, Seguros Beta",
                                avatar: "https://ui-avatars.com/api/?name=Carlos+Rodriguez&background=0D8ABC&color=fff"
                            },
                            {
                                text: "La capacidad de detectar 'silencios' en los clausulados nos salvó de un siniestro no cubierto. Imprescindible.",
                                author: "Ana María Velez",
                                role: "Gerente Comercial, Marsh & McLennan (Demo)",
                                avatar: "https://ui-avatars.com/api/?name=Ana+Maria&background=random"
                            },
                            {
                                text: "Mis clientes quedan impresionados con la calidad de los reportes PDF. Se ve extremadamente profesional.",
                                author: "Jorge L. Pérez",
                                role: "Corredor Independiente",
                                avatar: "https://ui-avatars.com/api/?name=Jorge+Perez&background=random"
                            }
                        ].map((t, i) => (
                            <div key={i} className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center text-center">
                                <div className="flex text-yellow-400 mb-4">
                                    {[...Array(5)].map((_, j) => <Star key={j} className="w-5 h-5 fill-current" />)}
                                </div>
                                <p className="text-slate-600 mb-6 italic">"{t.text}"</p>
                                <div className="flex items-center mt-auto">
                                    <img src={t.avatar} alt={t.author} className="w-10 h-10 rounded-full mr-3" />
                                    <div className="text-left">
                                        <p className="font-bold text-slate-900 text-sm">{t.author}</p>
                                        <p className="text-slate-500 text-xs">{t.role}</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* CTA */}
            <section className="py-20 relative overflow-hidden">
                <div className="absolute inset-0 bg-indigo-600 skew-y-3 origin-bottom-left scale-110"></div>
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
                    <h2 className="text-4xl font-bold text-white mb-8">¿Listo para transformar tu operación?</h2>
                    <p className="text-indigo-100 text-xl mb-10">Únete a cientos de intermediarios que ya están usando Inteligencia Artificial.</p>
                    <button
                        onClick={onRegisterClick}
                        className="px-10 py-5 bg-white text-indigo-600 rounded-full text-xl font-bold shadow-2xl hover:bg-slate-50 hover:scale-105 transition-all"
                    >
                        Crear Cuenta Gratis
                    </button>
                    <p className="mt-4 text-indigo-200 text-sm">No requiere tarjeta de crédito • 14 días de prueba</p>
                </div>
            </section>

            {/* Footer */}
            <footer className="bg-slate-900 text-slate-400 py-12 border-t border-slate-800">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center">
                    <div className="flex items-center space-x-2 mb-4 md:mb-0">
                        <ShieldCheck className="text-indigo-500 w-6 h-6" />
                        <span className="text-white font-bold text-lg">Comparador CSA</span>
                    </div>
                    <div className="text-sm">
                        © 2024 Comparador Seguros CSA. Todos los derechos reservados.
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default LandingPage;
