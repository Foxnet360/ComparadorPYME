#!/bin/bash

# Script de verificación pre-push
# Ejecutar antes de hacer push a main
# Uso: ./scripts/pre-push-check.sh

set -e  # Salir al primer error

echo "🔍 Iniciando verificación pre-push..."
echo ""

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

ERRORS=0
WARNINGS=0

# Función para mostrar errores
error() {
    echo -e "${RED}❌ ERROR:${NC} $1"
    ((ERRORS++))
}

# Función para mostrar warnings
warn() {
    echo -e "${YELLOW}⚠️  WARNING:${NC} $1"
    ((WARNINGS++))
}

# Función para mostrar éxito
success() {
    echo -e "${GREEN}✅${NC} $1"
}

# ============================================
# 1. VERIFICAR ESTADO DEL REPOSITORIO
# ============================================
echo "📋 1. Verificando estado del repositorio..."

if [ -n "$(git status --porcelain)" ]; then
    success "Hay cambios pendientes para commitear"
else
    warn "No hay cambios para commitear"
fi

# Verificar si estamos en main
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "main" ]; then
    error "No estás en la rama main. Estás en: $CURRENT_BRANCH"
    echo "   Cambia a main con: git checkout main"
fi

# ============================================
# 2. VERIFICAR SINCRONIZACIÓN CON REMOTO
# ============================================
echo ""
echo "🔄 2. Verificando sincronización con remoto..."

git fetch origin main --quiet 2>/dev/null || true

LOCAL_COMMIT=$(git rev-parse HEAD)
REMOTE_COMMIT=$(git rev-parse origin/main 2>/dev/null || echo "NO_REMOTE")

if [ "$REMOTE_COMMIT" == "NO_REMOTE" ]; then
    warn "No se pudo obtener información del remoto"
elif [ "$LOCAL_COMMIT" == "$REMOTE_COMMIT" ]; then
    warn "Tu main está sincronizado con origin. No hay cambios nuevos."
else
    success "Hay cambios locales listos para push"
fi

# ============================================
# 3. VERIFICAR DEPENDENCIAS
# ============================================
echo ""
echo "📦 3. Verificando dependencias..."

# Verificar si package.json fue modificado
if git diff --cached --name-only | grep -q "package.json"; then
    echo "   package.json modificado detectado"
    
    # Verificar que package-lock.json también esté modificado
    if ! git diff --cached --name-only | grep -q "package-lock.json"; then
        error "package.json modificado pero package-lock.json NO está en staging"
        echo "   Ejecuta: npm install && git add package-lock.json"
    else
        success "package-lock.json sincronizado con package.json"
    fi
else
    # Verificar que package.json y package-lock.json estén sincronizados
    if [ -f "package-lock.json" ]; then
        # Intentar npm ci en modo dry-run (simulación)
        if npm ci --dry-run 2>&1 | grep -q "can only install packages"; then
            error "package.json y package-lock.json están DESINCRONIZADOS"
            echo "   Ejecuta: npm install && git add package-lock.json"
        else
            success "Dependencias sincronizadas"
        fi
    fi
fi

# ============================================
# 4. COMPILAR BACKEND
# ============================================
echo ""
echo "🔨 4. Compilando backend TypeScript..."

cd server

if npx tsc --noEmit 2>&1 | grep -q "error TS"; then
    error "Errores de TypeScript en el backend"
    echo ""
    echo "   Errores encontrados:"
    npx tsc --noEmit 2>&1 | grep "error TS" | head -10
    echo ""
    echo "   Corrige los errores antes de hacer push."
else
    success "Backend compila sin errores"
fi

cd ..

# ============================================
# 5. VERIFICAR ARCHIVOS SENSIBLES
# ============================================
echo ""
echo "🔒 5. Verificando archivos sensibles..."

# Verificar que no hay .env en staging
if git diff --cached --name-only | grep -E "\.env$|\.env\." > /dev/null; then
    error "Archivos .env detectados en staging"
    echo "   NUNCA commitees archivos de entorno"
    echo "   Remuévelos del staging: git reset HEAD <archivo>"
fi

# Verificar que .gitignore existe y tiene .env
if [ ! -f ".gitignore" ]; then
    warn "No existe archivo .gitignore"
else
    if ! grep -q "\.env" .gitignore; then
        warn ".gitignore no ignora archivos .env"
    else
        success ".gitignore configura correctamente"
    fi
fi

# ============================================
# 6. VERIFICAR MENSAJE DE COMMIT
# ============================================
echo ""
echo "📝 6. Verificando mensaje de commit..."

# Verificar si hay commits pendientes de push
PENDING_COMMITS=$(git log origin/main..HEAD --oneline 2>/dev/null | wc -l)
if [ "$PENDING_COMMITS" -gt 0 ]; then
    echo "   Commits pendientes de push: $PENDING_COMMITS"
    git log origin/main..HEAD --oneline | head -5
fi

# ============================================
# RESUMEN
# ============================================
echo ""
echo "═══════════════════════════════════════════"
echo "           RESUMEN DE VERIFICACIÓN"
echo "═══════════════════════════════════════════"
echo ""

if [ $ERRORS -gt 0 ]; then
    echo -e "${RED}❌ $ERRORS errores encontrados${NC}"
    echo "   Corrige los errores antes de hacer push."
    echo ""
    echo "   Para bypass en emergencias (NO recomendado):"
    echo "   git push origin main --no-verify"
    echo ""
    exit 1
elif [ $WARNINGS -gt 0 ]; then
    echo -e "${YELLOW}⚠️  $WARNINGS warnings${NC}"
    echo -e "${GREEN}✅ Sin errores críticos${NC}"
    echo ""
    echo "   Puedes proceder con precaución."
    echo ""
    exit 0
else
    echo -e "${GREEN}✅ Todo verificado correctamente${NC}"
    echo ""
    echo "   Listo para push:"
    echo "   git push origin main"
    echo ""
    exit 0
fi
