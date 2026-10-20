#!/bin/bash
# Script para verificar la conexión a Redis
# Uso: ./scripts/verify-redis.sh [REDIS_URL]

REDIS_URL=${1:-$REDIS_URL}

if [ -z "$REDIS_URL" ]; then
    echo "❌ No se proporcionó REDIS_URL"
    echo "Uso: ./scripts/verify-redis.sh redis://localhost:6379"
    echo "   o: REDIS_URL=redis://localhost:6379 ./scripts/verify-redis.sh"
    exit 1
fi

echo "🔍 Verificando conexión a Redis..."
echo "   URL: $REDIS_URL"
echo ""

# Verificar si redis-cli está instalado
if command -v redis-cli &> /dev/null; then
    echo "✅ redis-cli encontrado"
    
    # Extraer host y puerto de la URL
    HOST=$(echo $REDIS_URL | sed -n 's/.*@\([^:]*\):.*/\1/p')
    PORT=$(echo $REDIS_URL | sed -n 's/.*:\([0-9]*\)$/\1/p')
    
    # Si no hay @, extraer directamente
    if [ -z "$HOST" ]; then
        HOST=$(echo $REDIS_URL | sed -n 's/redis:\/\/\([^:]*\):.*/\1/p')
    fi
    
    # Default port
    if [ -z "$PORT" ]; then
        PORT=6379
    fi
    
    echo "   Host: $HOST"
    echo "   Puerto: $PORT"
    echo ""
    
    # Intentar ping
    if redis-cli -h $HOST -p $PORT ping &> /dev/null; then
        echo "✅ Redis responde correctamente"
        
        # Obtener info
        echo ""
        echo "📊 Información del servidor:"
        redis-cli -h $HOST -p $PORT INFO server | grep -E "redis_version|redis_mode|os|process_id"
        
        echo ""
        echo "💾 Uso de memoria:"
        redis-cli -h $HOST -p $PORT INFO memory | grep -E "used_memory_human|maxmemory_human"
        
        echo ""
        echo "📈 Estadísticas:"
        redis-cli -h $HOST -p $PORT INFO stats | grep -E "total_connections_received|total_commands_processed"
        
        echo ""
        echo "🔑 Keys en la base de datos:"
        DBSIZE=$(redis-cli -h $HOST -p $PORT DBSIZE)
        echo "   Total keys: $DBSIZE"
        
        if [ "$DBSIZE" -gt 0 ]; then
            echo ""
            echo "📋 Prefijos de keys encontrados:"
            redis-cli -h $HOST -p $PORT KEYS "*" | cut -d: -f1 | sort | uniq -c | sort -rn | head -10
        fi
        
        exit 0
    else
        echo "❌ No se puede conectar a Redis"
        echo "   Verifica que el servidor esté corriendo y la URL sea correcta"
        exit 1
    fi
else
    echo "⚠️  redis-cli no está instalado"
    echo "   Instálalo con: sudo apt-get install redis-tools"
    echo ""
    echo "   Alternativa: Verifica los logs de tu aplicación"
    echo "   Deberías ver: '✅ [Redis] Connected and available'"
    exit 1
fi
