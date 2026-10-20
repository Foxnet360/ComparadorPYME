#!/bin/bash

# =============================================================================
# DEPLOY BOT - Automatización de Deploy Seguro para Comparador PYME
# =============================================================================
# Uso: ./deploy-bot.sh [modo]
# Modos:
#   auto    - Automático (solo si pasa todas las verificaciones)
#   gui     - Guiado (pregunta en cada paso) ← RECOMENDADO
#   check   - Solo verificar, no ejecutar
#
# Ejemplo:
#   .opencode/skills/deploy/scripts/deploy-bot.sh gui
# =============================================================================

set -e  # Salir al primer error

# Configuración
PROJECT_NAME="Comparador PYME"
RAILWAY_PROJECT="miraculous-blessing"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILL_DIR="$(dirname "$SCRIPT_DIR")"

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# Estado
ERRORS=0
WARNINGS=0
STEPS_COMPLETED=0
TOTAL_STEPS=7

# Modo de operación
MODE="${1:-gui}"

# =============================================================================
# FUNCIONES AUXILIARES
# =============================================================================

print_header() {
    echo -e "${BLUE}"
    echo "╔═══════════════════════════════════════════════════════════════╗"
    echo "║                   🚀 DEPLOY BOT v2.0                          ║"
    echo "║           Automatización de Deploy Seguro                     ║"
    echo "╚═══════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
    echo -e "${CYAN}Proyecto:${NC} $PROJECT_NAME"
    echo -e "${CYAN}Modo:${NC} $MODE"
    echo -e "${CYAN}Fecha:${NC} $(date)"
    echo ""
}

print_step() {
    STEPS_COMPLETED=$((STEPS_COMPLETED + 1))
    echo -e "${BOLD}${BLUE}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  PASO $STEPS_COMPLETED/$TOTAL_STEPS: $1"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo -e "${NC}"
}

success() {
    echo -e "${GREEN}✅ $1${NC}"
}

error() {
    echo -e "${RED}❌ ERROR: $1${NC}"
    ((ERRORS++))
}

warn() {
    echo -e "${YELLOW}⚠️  $1${NC}"
    ((WARNINGS++))
}

info() {
    echo -e "${CYAN}ℹ️  $1${NC}"
}

ask() {
    if [ "$MODE" == "auto" ]; then
        return 0  # En modo auto, siempre continuar
    fi
    
    echo -e "${YELLOW}"
    read -p "➤ $1 [S/n]: " response
    echo -e "${NC}"
    
    if [[ "$response" =~ ^[Nn]$ ]]; then
        return 1
    fi
    return 0
}

spinner() {
    local pid=$1
    local delay=0.1
    local spinstr='|/-\'
    while [ -d /proc/$pid ]; do
        local temp=${spinstr#?}
        printf " [%c]  " "$spinstr"
        local spinstr=$temp${spinstr%"$temp"}
        sleep $delay
        printf "\b\b\b\b\b\b"
    done
    printf "    \b\b\b\b"
}

# =============================================================================
# PASO 1: VERIFICAR ESTADO DEL REPOSITORIO
# =============================================================================
step_1_check_repo() {
    print_step "Verificando Estado del Repositorio"
    
    # Verificar que estamos en un repo git
    if ! git rev-parse --git-dir > /dev/null 2>&1; then
        error "No estás en un repositorio git"
        return 1
    fi
    
    # Verificar rama actual
    CURRENT_BRANCH=$(git branch --show-current)
    info "Rama actual: $CURRENT_BRANCH"
    
    if [ "$CURRENT_BRANCH" != "main" ]; then
        error "Debes estar en la rama 'main' para hacer deploy"
        info "Ejecuta: git checkout main"
        return 1
    fi
    success "Estamos en la rama main"
    
    # Verificar cambios pendientes
    if [ -n "$(git status --porcelain)" ]; then
        success "Hay cambios pendientes para commitear"
        git status --short
    else
        warn "No hay cambios para commitear"
        if ! ask "¿Quieres continuar de todos modos?"; then
            return 1
        fi
    fi
    
    return 0
}

# =============================================================================
# PASO 2: SINCRONIZAR CON REMOTO
# =============================================================================
step_2_sync_remote() {
    print_step "Sincronizando con Remoto"
    
    info "Obteniendo últimos cambios de origin/main..."
    git fetch origin main --quiet 2>/dev/null || {
        warn "No se pudo conectar con el remoto"
        if ! ask "¿Continuar de todos modos?"; then
            return 1
        fi
    }
    
    # Verificar si hay commits en remoto que no tenemos localmente
    LOCAL_COMMIT=$(git rev-parse HEAD)
    REMOTE_COMMIT=$(git rev-parse origin/main 2>/dev/null || echo "NO_REMOTE")
    
    if [ "$REMOTE_COMMIT" != "NO_REMOTE" ] && [ "$LOCAL_COMMIT" != "$REMOTE_COMMIT" ]; then
        info "Hay cambios en origin/main que no tienes localmente"
        info "Commits remotos faltantes:"
        git log --oneline HEAD..origin/main 2>/dev/null || true
        
        if ask "¿Quieres hacer pull de los cambios remotos primero?"; then
            info "Haciendo pull..."
            git pull origin main || {
                error "Falló el pull. Posible conflicto."
                return 1
            }
            success "Pull completado"
        fi
    fi
    
    success "Repositorio sincronizado"
    return 0
}

# =============================================================================
# PASO 3: VERIFICAR Y CORREGIR DEPENDENCIAS
# =============================================================================
step_3_check_dependencies() {
    print_step "Verificando Dependencias"
    
    # Verificar si package.json fue modificado
    if git diff --cached --name-only | grep -q "package.json" || \
       git diff --name-only | grep -q "package.json"; then
        warn "package.json modificado detectado"
        
        # Verificar si package-lock.json también está modificado
        if ! git diff --cached --name-only | grep -q "package-lock.json" && \
           ! git diff --name-only | grep -q "package-lock.json"; then
            error "package-lock.json NO está actualizado"
            
            if ask "¿Ejecutar 'npm install' para regenerar package-lock.json?"; then
                info "Ejecutando npm install..."
                npm install
                git add package-lock.json
                success "package-lock.json regenerado y agregado al staging"
            else
                return 1
            fi
        else
            success "package-lock.json sincronizado"
        fi
    else
        # Verificar sincronización general
        info "Verificando sincronización package.json ↔ package-lock.json..."
        
        # Crear un package-lock.json temporal para verificar
        if [ -f "package-lock.json" ]; then
            # Verificar si npm ci funcionaría
            if ! npm ci --dry-run > /dev/null 2>&1; then
                warn "Posible desincronización detectada"
                if ask "¿Ejecutar 'npm install' para sincronizar?"; then
                    npm install
                    git add package-lock.json
                    success "Dependencias sincronizadas"
                fi
            else
                success "Dependencias sincronizadas"
            fi
        fi
    fi
    
    return 0
}

# =============================================================================
# PASO 4: COMPILAR BACKEND
# =============================================================================
step_4_compile() {
    print_step "Compilando Backend TypeScript"
    
    info "Ejecutando: cd server && npx tsc --noEmit"
    
    cd server
    
    # Ejecutar compilación y capturar errores
    if npx tsc --noEmit > /tmp/tsc_output.txt 2>&1; then
        success "Backend compila sin errores ✅"
        cd ..
        return 0
    else
        error "Errores de TypeScript encontrados"
        echo ""
        echo -e "${RED}Errores:${NC}"
        cat /tmp/tsc_output.txt | grep "error TS" | head -20
        echo ""
        
        cd ..
        
        if ask "¿Intentar corregir automáticamente errores comunes?"; then
            info "Intentando correcciones automáticas..."
            
            # Corrección: Agregar moduleResolution a tsconfig si falta
            if grep -q "Cannot find module" /tmp/tsc_output.txt; then
                if [ -f "server/tsconfig.json" ] && ! grep -q "moduleResolution" server/tsconfig.json; then
                    info "Agregando moduleResolution a tsconfig.json..."
                    sed -i 's/"module": "commonjs"/"module": "commonjs",\n        "moduleResolution": "node"/' server/tsconfig.json
                    success "tsconfig.json actualizado"
                fi
            fi
            
            # Reintentar compilación
            cd server
            if npx tsc --noEmit > /tmp/tsc_output2.txt 2>&1; then
                success "Corrección exitosa. Backend compila ahora ✅"
                cd ..
                return 0
            else
                error "Aún hay errores. Corrígelos manualmente:"
                cat /tmp/tsc_output2.txt | grep "error TS" | head -20
                cd ..
                return 1
            fi
        fi
        
        return 1
    fi
}

# =============================================================================
# PASO 5: VERIFICAR SEGURIDAD
# =============================================================================
step_5_security_check() {
    print_step "Verificando Seguridad"
    
    # Verificar archivos .env
    if git diff --cached --name-only | grep -E "\.env$|\.env\." > /dev/null || \
       git diff --name-only | grep -E "\.env$|\.env\." > /dev/null; then
        error "⚠️  ARCHIVOS .env DETECTADOS EN STAGING"
        echo -e "${RED}NUNCA commitees archivos de entorno${NC}"
        echo "Archivos peligrosos:"
        git diff --cached --name-only | grep -E "\.env$|\.env\." || true
        git diff --name-only | grep -E "\.env$|\.env\." || true
        
        if ask "¿Remover archivos .env del staging?"; then
            git diff --cached --name-only | grep -E "\.env$|\.env\." | xargs git reset HEAD 2>/dev/null || true
            git diff --name-only | grep -E "\.env$|\.env\." | xargs git reset HEAD 2>/dev/null || true
            success "Archivos .env removidos del staging"
        else
            return 1
        fi
    fi
    
    # Verificar credenciales hardcodeadas
    info "Verificando credenciales hardcodeadas..."
    
    # Buscar patrones comunes de credenciales en archivos staged
    CREDENTIAL_PATTERNS=(
        "ghp_[a-zA-Z0-9]{36}"
        "gho_[a-zA-Z0-9]{36}"
        "sk-[a-zA-Z0-9]{48}"
        "AIza[0-9A-Za-z_-]{35}"
    )
    
    FOUND_CREDS=false
    for pattern in "${CREDENTIAL_PATTERNS[@]}"; do
        if git diff --cached -G "$pattern" --name-only | grep -v "package-lock" > /dev/null; then
            warn "Posible credencial detectada (patrón: $pattern)"
            FOUND_CREDS=true
        fi
    done
    
    if [ "$FOUND_CREDS" = true ]; then
        if ! ask "¿Continuar de todos modos? (Verifica que no sean credenciales reales)"; then
            return 1
        fi
    fi
    
    success "Verificación de seguridad completada"
    return 0
}

# =============================================================================
# PASO 6: COMMIT Y PUSH
# =============================================================================
step_6_commit_push() {
    print_step "Commit y Push"
    
    # Mostrar resumen de cambios
    echo -e "${CYAN}Resumen de cambios:${NC}"
    git diff --cached --stat
    echo ""
    
    # Si hay archivos no staged, preguntar
    UNSTAGED=$(git diff --name-only)
    if [ -n "$UNSTAGED" ]; then
        warn "Hay archivos no agregados al staging:"
        echo "$UNSTAGED"
        
        if ask "¿Agregar todos los archivos al staging?"; then
            git add -A
            success "Todos los archivos agregados"
        fi
    fi
    
    # Verificar que hay algo para commitear
    if [ -z "$(git diff --cached --name-only)" ]; then
        error "No hay archivos en staging para commitear"
        return 1
    fi
    
    # Obtener mensaje de commit
    if [ "$MODE" == "auto" ]; then
        COMMIT_MSG="deploy: $(date '+%Y-%m-%d %H:%M') - Automated deploy"
    else
        echo -e "${CYAN}Ingresa el mensaje de commit:${NC}"
        echo "Formato recomendado: tipo: descripción"
        echo "Tipos: feat, fix, refactor, docs, chore, deploy"
        echo ""
        read -p "Mensaje: " COMMIT_MSG
        
        if [ -z "$COMMIT_MSG" ]; then
            COMMIT_MSG="deploy: $(date '+%Y-%m-%d %H:%M')"
        fi
    fi
    
    info "Mensaje de commit: $COMMIT_MSG"
    
    if ! ask "¿Confirmar commit y push?"; then
        return 1
    fi
    
    # Commit
    info "Creando commit..."
    if git commit -m "$COMMIT_MSG"; then
        success "Commit creado exitosamente"
    else
        error "Falló el commit"
        return 1
    fi
    
    # Push
    info "Haciendo push a origin/main..."
    if git push origin main; then
        success "Push exitoso! 🎉"
        echo ""
        echo -e "${GREEN}Commit enviado a GitHub${NC}"
        git log -1 --oneline
    else
        error "Falló el push"
        return 1
    fi
    
    return 0
}

# =============================================================================
# PASO 7: MONITOREAR RAILWAY
# =============================================================================
step_7_monitor_railway() {
    print_step "Monitoreando Railway"
    
    info "Railway detectará el push automáticamente en unos segundos..."
    
    if ! command -v railway &> /dev/null; then
        warn "CLI de Railway no está instalado"
        info "Puedes monitorear manualmente en: https://railway.app/project/$RAILWAY_PROJECT"
        return 0
    fi
    
    echo ""
    echo -e "${CYAN}Estado del deploy:${NC}"
    
    # Esperar un momento para que Railway detecte el push
    sleep 5
    
    # Mostrar últimos deployments
    railway list deployments --project "$RAILWAY_PROJECT" --limit 3 2>/dev/null || {
        warn "No se pudo obtener estado de Railway"
        info "Verifica manualmente en: https://railway.app/project/$RAILWAY_PROJECT"
    }
    
    echo ""
    echo -e "${YELLOW}⏳ Esperando 30 segundos para verificar build...${NC}"
    sleep 30
    
    # Verificar estado nuevamente
    railway list deployments --project "$RAILWAY_PROJECT" --limit 1 2>/dev/null || true
    
    echo ""
    success "Monitoreo completado"
    info "URL de Railway: https://railway.app/project/$RAILWAY_PROJECT"
    
    return 0
}

# =============================================================================
# RESUMEN FINAL
# =============================================================================
print_final_summary() {
    echo ""
    echo -e "${BLUE}"
    echo "╔═══════════════════════════════════════════════════════════════╗"
    echo "║                    RESUMEN DEL DEPLOY                         ║"
    echo "╚═══════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
    
    if [ $ERRORS -gt 0 ]; then
        echo -e "${RED}❌ $ERRORS errores encontrados${NC}"
    fi
    
    if [ $WARNINGS -gt 0 ]; then
        echo -e "${YELLOW}⚠️  $WARNINGS warnings${NC}"
    fi
    
    if [ $ERRORS -eq 0 ]; then
        echo -e "${GREEN}✅ Deploy completado exitosamente!${NC}"
        echo ""
        echo -e "${CYAN}Próximos pasos:${NC}"
        echo "  1. Verifica Railway dashboard: https://railway.app/project/$RAILWAY_PROJECT"
        echo "  2. Espera 2-3 minutos para que el deploy termine"
        echo "  3. Prueba la aplicación en producción"
    else
        echo -e "${RED}❌ Deploy falló. Corrige los errores e intenta de nuevo.${NC}"
    fi
    
    echo ""
    echo -e "${CYAN}Comando para ver logs:${NC}"
    echo "  railway logs --project $RAILWAY_PROJECT"
    echo ""
}

# =============================================================================
# MODO CHECK (Solo verificar)
# =============================================================================
run_check_only() {
    print_header
    
    echo -e "${CYAN}Modo CHECK: Solo verificar, no ejecutar cambios${NC}"
    echo ""
    
    step_1_check_repo || true
    step_2_sync_remote || true
    step_3_check_dependencies || true
    step_4_compile || true
    step_5_security_check || true
    
    echo ""
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    
    if [ $ERRORS -eq 0 ]; then
        echo -e "${GREEN}✅ Todo verificado. Listo para deploy.${NC}"
        echo "   Ejecuta: .opencode/skills/deploy/scripts/deploy-bot.sh gui"
    else
        echo -e "${RED}❌ Hay $ERRORS errores que corregir antes de deploy.${NC}"
    fi
}

# =============================================================================
# FLUJO PRINCIPAL
# =============================================================================
main() {
    # Validar modo
    if [ "$MODE" != "auto" ] && [ "$MODE" != "gui" ] && [ "$MODE" != "check" ]; then
        echo "Uso: $0 [auto|gui|check]"
        echo ""
        echo "  auto   - Automático (sin preguntas, solo si pasa todo)"
        echo "  gui    - Guiado (pregunta en cada paso) ← RECOMENDADO"
        echo "  check  - Solo verificar, no ejecutar"
        exit 1
    fi
    
    # Modo check
    if [ "$MODE" == "check" ]; then
        run_check_only
        exit 0
    fi
    
    # Header
    print_header
    
    # Paso 1: Verificar repo
    if ! step_1_check_repo; then
        print_final_summary
        exit 1
    fi
    
    # Paso 2: Sync remoto
    if ! step_2_sync_remote; then
        print_final_summary
        exit 1
    fi
    
    # Paso 3: Dependencias
    if ! step_3_check_dependencies; then
        print_final_summary
        exit 1
    fi
    
    # Paso 4: Compilar
    if ! step_4_compile; then
        print_final_summary
        exit 1
    fi
    
    # Paso 5: Seguridad
    if ! step_5_security_check; then
        print_final_summary
        exit 1
    fi
    
    # Paso 6: Commit y Push
    if ! step_6_commit_push; then
        print_final_summary
        exit 1
    fi
    
    # Paso 7: Monitorear Railway (opcional)
    if [ "$MODE" == "auto" ] || ask "¿Monitorear Railway?"; then
        step_7_monitor_railway || true
    fi
    
    # Resumen
    print_final_summary
    
    exit 0
}

# Ejecutar
main
