"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.supabaseAnon = exports.supabase = void 0;
exports.verifySupabaseConnection = verifySupabaseConnection;
exports.handleSupabaseError = handleSupabaseError;
const supabase_js_1 = require("@supabase/supabase-js");
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('❌ [Supabase Config] Missing required environment variables:');
    if (!SUPABASE_URL)
        console.error('   - SUPABASE_URL');
    if (!SUPABASE_SERVICE_KEY)
        console.error('   - SUPABASE_SERVICE_ROLE_KEY');
    throw new Error('Supabase configuration incomplete');
}
// Cliente con Service Role (privilegios completos - solo backend)
exports.supabase = (0, supabase_js_1.createClient)(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});
// Cliente anónimo (solo para operaciones públicas si es necesario)
exports.supabaseAnon = process.env.SUPABASE_ANON_KEY
    ? (0, supabase_js_1.createClient)(SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    })
    : null;
// Verificar conexión
function verifySupabaseConnection() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { data, error } = yield exports.supabase.from('insurers').select('count').limit(1);
            if (error)
                throw error;
            console.log('✅ [Supabase] Connection verified successfully');
            return true;
        }
        catch (error) {
            console.error('❌ [Supabase] Connection failed:', error);
            return false;
        }
    });
}
// Helper para manejar errores de Supabase
function handleSupabaseError(error) {
    var _a;
    if (error.code === '23505') {
        return new Error('Duplicate entry: El documento ya existe');
    }
    if (error.code === '23503') {
        return new Error('Foreign key violation: Referencia inválida');
    }
    if ((_a = error.message) === null || _a === void 0 ? void 0 : _a.includes('bucket')) {
        return new Error('Storage error: ' + error.message);
    }
    return new Error(error.message || 'Database error');
}
console.log('📦 [Supabase] Client initialized for project:', SUPABASE_URL);
