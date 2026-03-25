import React, { useState } from 'react';
import { ShieldCheck, UserPlus, ArrowRight, Loader2, ArrowLeft, Mail, Lock, User, Briefcase, Phone, Building } from 'lucide-react';
import { storageService } from '../services/storageService';
import { UserProfile } from '../types';

interface RegisterScreenProps {
    onRegisterSuccess: (user: UserProfile) => void;
    onBackToLogin: () => void;
}

const RegisterScreen: React.FC<RegisterScreenProps> = ({ onRegisterSuccess, onBackToLogin }) => {
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
        confirmPassword: '',
        intermediaryName: '',
        phone: '',
        field: '',
        bio: ''
    });

    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');

        if (formData.password !== formData.confirmPassword) {
            setError('Las contraseñas no coinciden.');
            setIsLoading(false);
            return;
        }

        try {
            const newUser: UserProfile = {
                name: formData.name,
                email: formData.email,
                password: formData.password,
                role: 'TECHNICAL', // Default role
                intermediaryName: formData.intermediaryName,
                avatarUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(formData.name)}&background=4f46e5&color=fff`,
                agentDetails: {
                    phone: formData.phone,
                    field: formData.field,
                    bio: formData.bio
                }
            };

            const registeredUser = await storageService.register(newUser);
            onRegisterSuccess(registeredUser);
        } catch (err: any) {
            console.error(err);
            setError(err.message || 'Error al registrar usuario.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
            <div className="sm:mx-auto sm:w-full sm:max-w-md">
                <div className="flex justify-center">
                    <div className="bg-indigo-600 p-3 rounded-xl shadow-lg shadow-indigo-200">
                        <ShieldCheck className="text-white w-10 h-10" />
                    </div>
                </div>
                <h2 className="mt-6 text-center text-3xl font-extrabold text-slate-900 tracking-tight">
                    Crear Nueva Cuenta
                </h2>
                <p className="mt-2 text-center text-sm text-slate-600">
                    Únete para gestionar tus auditorías de seguros
                </p>
            </div>

            <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-lg">
                <div className="bg-white py-8 px-4 shadow-xl shadow-slate-200 border border-slate-100 sm:rounded-2xl sm:px-10">
                    <form className="space-y-6" onSubmit={handleSubmit}>

                        {/* --- Sección Personal --- */}
                        <div className="space-y-4">
                            <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Información Personal</h3>

                            <div className="grid grid-cols-1 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700">Nombre Completo</label>
                                    <div className="mt-1 relative rounded-md shadow-sm">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                            <User className="h-5 w-5 text-slate-400" />
                                        </div>
                                        <input name="name" type="text" required value={formData.name} onChange={handleChange} className="pl-10 focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-slate-300 rounded-lg p-2.5 border" placeholder="Juan Perez" />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700">Correo Electrónico</label>
                                    <div className="mt-1 relative rounded-md shadow-sm">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                            <Mail className="h-5 w-5 text-slate-400" />
                                        </div>
                                        <input name="email" type="email" required value={formData.email} onChange={handleChange} className="pl-10 focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-slate-300 rounded-lg p-2.5 border" placeholder="juan@empresa.com" />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* --- Sección Profesional --- */}
                        <div className="space-y-4 pt-4 border-t border-slate-100">
                            <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Detalles Profesionales</h3>

                            <div>
                                <label className="block text-sm font-medium text-slate-700">Intermediario (Agencia/Aseguradora)</label>
                                <div className="mt-1 relative rounded-md shadow-sm">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <Building className="h-5 w-5 text-slate-400" />
                                    </div>
                                    <input name="intermediaryName" type="text" required value={formData.intermediaryName} onChange={handleChange} className="pl-10 focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-slate-300 rounded-lg p-2.5 border" placeholder="Seguros Global Ltda." />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700">Celular</label>
                                    <div className="mt-1 relative rounded-md shadow-sm">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                            <Phone className="h-5 w-5 text-slate-400" />
                                        </div>
                                        <input name="phone" type="tel" required value={formData.phone} onChange={handleChange} className="pl-10 focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-slate-300 rounded-lg p-2.5 border" placeholder="300 123 4567" />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700">Ramo Principal</label>
                                    <div className="mt-1 relative rounded-md shadow-sm">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                            <Briefcase className="h-5 w-5 text-slate-400" />
                                        </div>
                                        <input name="field" type="text" required value={formData.field} onChange={handleChange} className="pl-10 focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-slate-300 rounded-lg p-2.5 border" placeholder="Vida / Autos" />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* --- Seguridad --- */}
                        <div className="space-y-4 pt-4 border-t border-slate-100">
                            <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Seguridad</h3>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700">Contraseña</label>
                                    <div className="mt-1 relative rounded-md shadow-sm">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                            <Lock className="h-5 w-5 text-slate-400" />
                                        </div>
                                        <input name="password" type="password" required value={formData.password} onChange={handleChange} className="pl-10 focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-slate-300 rounded-lg p-2.5 border" placeholder="••••••••" />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700">Confirmar</label>
                                    <div className="mt-1 relative rounded-md shadow-sm">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                            <Lock className="h-5 w-5 text-slate-400" />
                                        </div>
                                        <input name="confirmPassword" type="password" required value={formData.confirmPassword} onChange={handleChange} className="pl-10 focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-slate-300 rounded-lg p-2.5 border" placeholder="••••••••" />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {error && (
                            <div className="text-red-500 text-sm bg-red-50 p-3 rounded-lg border border-red-100 flex items-center">
                                <span className="font-medium mr-1">Error:</span> {error}
                            </div>
                        )}

                        <div className="flex flex-col space-y-3 pt-2">
                            <button
                                type="submit"
                                disabled={isLoading}
                                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all disabled:opacity-70"
                            >
                                {isLoading ? (
                                    <Loader2 className="animate-spin h-5 w-5" />
                                ) : (
                                    <span className="flex items-center">
                                        Crear Cuenta <UserPlus className="ml-2 h-4 w-4" />
                                    </span>
                                )}
                            </button>

                            <button
                                type="button"
                                onClick={onBackToLogin}
                                className="w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium text-slate-600 hover:text-indigo-600 transition-colors"
                            >
                                <ArrowLeft className="mr-2 h-4 w-4" /> Volver al Inicio de Sesión
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default RegisterScreen;
