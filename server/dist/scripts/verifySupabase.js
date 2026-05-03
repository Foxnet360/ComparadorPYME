#!/usr/bin/env node
"use strict";
/**
 * Script para verificar la conexión y configuración de Supabase
 * Ejecutar: npx ts-node src/scripts/verifySupabase.ts
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
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
const database_1 = require("../config/database");
const embeddingService_1 = require("../services/vector/embeddingService");
function verifyConnection() {
    return __awaiter(this, void 0, void 0, function* () {
        console.log('🔍 Verificando conexión a Supabase...\n');
        try {
            // 1. Verificar conexión básica
            console.log('1️⃣  Conexión a base de datos...');
            const { data: insurers, error: insurersError } = yield database_1.supabase
                .from('insurers')
                .select('count')
                .limit(1);
            if (insurersError) {
                console.error('   ❌ Error:', insurersError.message);
                return false;
            }
            console.log('   ✅ Conexión exitosa');
            // 2. Verificar extensión pgvector
            console.log('\n2️⃣  Extensión pgvector...');
            const { data: vectorData, error: vectorError } = yield database_1.supabase.rpc('search_chunks_by_coverage', {
                p_embedding: Array(768).fill(0),
                p_insurer_id: '00000000-0000-0000-0000-000000000000',
                p_coverage_tag: null,
                p_match_count: 1
            });
            if (vectorError && !vectorError.message.includes('insurer')) {
                console.error('   ❌ Error:', vectorError.message);
                return false;
            }
            console.log('   ✅ Funciones vectoriales listas');
            // 3. Verificar Storage
            console.log('\n3️⃣  Storage (clause-pages)...');
            const { data: buckets, error: bucketError } = yield database_1.supabase.storage.listBuckets();
            if (bucketError) {
                console.error('   ❌ Error:', bucketError.message);
                return false;
            }
            const clauseBucket = buckets === null || buckets === void 0 ? void 0 : buckets.find(b => b.name === 'clause-pages');
            if (!clauseBucket) {
                console.warn('   ⚠️  Bucket no encontrado');
                console.log('   ℹ️  Ejecuta: npx ts-node src/scripts/setupSupabase.ts');
            }
            else {
                console.log('   ✅ Bucket listo');
            }
            // 4. Verificar Gemini Embeddings
            console.log('\n4️⃣  API de Gemini Embeddings...');
            try {
                const testEmbedding = yield embeddingService_1.embeddingService.generateEmbedding('test de conexión');
                if (testEmbedding.length === 768) {
                    console.log('   ✅ Embeddings funcionando (dimensión: 768)');
                }
                else {
                    console.warn(`   ⚠️  Dimensión inesperada: ${testEmbedding.length}`);
                }
            }
            catch (embeddingError) {
                console.error('   ❌ Error:', embeddingError);
                return false;
            }
            // 5. Verificar tesauro
            console.log('\n5️⃣  Tesauro...');
            try {
                const { thesaurusService } = yield Promise.resolve().then(() => __importStar(require('../services/normalization/thesaurusService')));
                const coberturas = thesaurusService.listCoberturas();
                console.log(`   ✅ Tesauro cargado (${coberturas.length} coberturas)`);
                console.log(`   📚 Ejemplo: ${coberturas.slice(0, 3).join(', ')}...`);
            }
            catch (thesaurusError) {
                console.error('   ❌ Error cargando tesauro:', thesaurusError);
                return false;
            }
            console.log('\n✅ Todas las verificaciones pasaron!');
            console.log('\nEl sistema está listo para usar.');
            return true;
        }
        catch (error) {
            console.error('\n❌ Error durante verificación:', error);
            return false;
        }
    });
}
verifyConnection().then(success => {
    process.exit(success ? 0 : 1);
});
