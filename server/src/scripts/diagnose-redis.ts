import Redis from 'ioredis';

/**
 * Script de diagnóstico para Redis
 * Uso: npx ts-node server/src/scripts/diagnose-redis.ts
 */

async function diagnoseRedis() {
    const REDIS_URL = process.env.REDIS_URL;
    
    console.log('🔍 Diagnóstico de Redis');
    console.log('========================');
    console.log('');
    
    // 1. Verificar si REDIS_URL está configurada
    if (!REDIS_URL) {
        console.log('❌ REDIS_URL no está configurada');
        console.log('   Solución: Agrega la variable en Railway Dashboard');
        console.log('   Valor: redis://default:YymaPFEKzRuNdHsyCnElykqZXmuaCkHC@redis.railway.internal:6379');
        process.exit(1);
    }
    
    console.log('✅ REDIS_URL está configurada');
    console.log(`   URL: ${REDIS_URL.replace(/:([^@]+)@/, ':***@')}`); // Ocultar password
    console.log('');
    
    // 2. Parsear URL
    try {
        const url = new URL(REDIS_URL);
        console.log('✅ URL parseada correctamente');
        console.log(`   Protocolo: ${url.protocol}`);
        console.log(`   Host: ${url.hostname}`);
        console.log(`   Puerto: ${url.port || '6379'}`);
        console.log(`   Usuario: ${url.username || 'default'}`);
        console.log(`   Password: ${url.password ? '***' : 'NO TIENE'}`);
        console.log('');
    } catch (error) {
        console.log('❌ URL malformada');
        console.log(`   Error: ${error}`);
        process.exit(1);
    }
    
    // 3. Intentar conexión
    console.log('🔄 Intentando conexión...');
    const redis = new Redis(REDIS_URL, {
        connectTimeout: 5000,
        commandTimeout: 5000,
        retryStrategy: () => null, // No reintentar
    });
    
    try {
        const result = await redis.ping();
        console.log('✅ Conexión exitosa');
        console.log(`   Respuesta PING: ${result}`);
        
        // 4. Verificar capacidades
        console.log('');
        console.log('📊 Información del servidor:');
        
        const info = await redis.info('server');
        const version = info.match(/redis_version:(.+)/)?.[1]?.trim();
        console.log(`   Versión: ${version}`);
        
        const memory = await redis.info('memory');
        const usedMemory = memory.match(/used_memory_human:(.+)/)?.[1]?.trim();
        console.log(`   Memoria usada: ${usedMemory}`);
        
        const dbsize = await redis.dbsize();
        console.log(`   Keys almacenadas: ${dbsize}`);
        
        console.log('');
        console.log('✅ Redis está funcionando correctamente');
        
    } catch (error: unknown) {
        const err = error instanceof Error ? error : new Error(String(error));
        console.log('');
        console.log('❌ Error de conexión');
        console.log(`   Tipo: ${err.name}`);
        console.log(`   Mensaje: ${err.message}`);
        console.log('');
        
        if (err.message.includes('ECONNREFUSED')) {
            console.log('🔍 Posibles causas:');
            console.log('   1. Redis no está corriendo');
            console.log('   2. URL incorrecta');
            console.log('   3. Firewall bloqueando conexión');
            console.log('   4. En Railway: Redis no está en el mismo proyecto');
        }
        
        if (err.message.includes('ENOTFOUND')) {
            console.log('🔍 Posibles causas:');
            console.log('   1. Host no existe');
            console.log('   2. En Railway: usar RAILWAY_PRIVATE_DOMAIN');
        }
        
        if (err.message.includes('ERR invalid password')) {
            console.log('🔍 Posibles causas:');
            console.log('   1. Password incorrecto');
        }
        
        process.exit(1);
    } finally {
        await redis.quit();
    }
}

diagnoseRedis().catch(console.error);
