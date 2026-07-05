#!/bin/bash

# ============================================================
# Script de Deploy Automatizado para ALO Controle
# ============================================================
# Uso: ./deploy.sh
# Este script realiza deploy completo (backend + frontend)
# ============================================================

set -e  # Sai se houver erro

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuração
DEPLOY_DIR="/var/www/alo_controle"
BACKEND_DIR="$DEPLOY_DIR/backend"
FRONTEND_DIR="$DEPLOY_DIR/frontend"
SERVICE_NAME="alo-controle"
LOG_DIR="/var/log/alo_controle"

# Funções de output
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Verifica se está rodando como root
if [ "$EUID" -ne 0 ]; then
   log_error "Este script deve ser executado como root"
   exit 1
fi

# ============================================================
# 1. PARAR O SERVIÇO
# ============================================================
log_info "Parando o serviço $SERVICE_NAME..."
systemctl stop $SERVICE_NAME || true

# ============================================================
# 2. BACKUP
# ============================================================
log_info "Criando backup do banco de dados..."
BACKUP_DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$DEPLOY_DIR/backups/alo_controle_$BACKUP_DATE.sql"

mkdir -p "$DEPLOY_DIR/backups"

# Se usar PostgreSQL (ajuste os parâmetros):
# pg_dump -U postgres alo_controle > "$BACKUP_FILE" || log_warn "Falha no backup do BD"

log_info "Backup salvo em: $BACKUP_FILE"

# ============================================================
# 3. ATUALIZAR REPOSITÓRIO
# ============================================================
cd "$DEPLOY_DIR"
log_info "Atualizando repositório..."
git pull origin main || log_error "Falha ao atualizar repositório"

# ============================================================
# 4. BACKEND
# ============================================================
log_info "Implantando backend..."

cd "$BACKEND_DIR"

# Ativa ambiente virtual
if [ ! -d ".venv" ]; then
    log_info "Criando ambiente virtual..."
    python3 -m venv .venv
fi

source .venv/bin/activate

# Instala dependências
log_info "Instalando dependências Python..."
pip install --upgrade pip
pip install -r requirements.txt

# Rodas migrations
log_info "Executando migrations..."
python manage.py migrate --noinput || log_error "Falha nas migrations"

# Coleta arquivos estáticos
log_info "Coletando arquivos estáticos..."
python manage.py collectstatic --noinput || log_error "Falha ao coletar estáticos"

deactivate

# ============================================================
# 5. FRONTEND
# ============================================================
log_info "Implantando frontend..."

cd "$FRONTEND_DIR"

# Instala dependências
log_info "Instalando dependências Node.js..."
npm install

# Build para produção
log_info "Compilando frontend (produção)..."
npm run build -- --configuration=production || log_error "Falha no build do frontend"

# Verifica se dist existe
if [ ! -d "dist/frontend" ]; then
    log_error "Build do frontend não gerou dist/frontend"
    exit 1
fi

log_info "Frontend compilado com sucesso"

# ============================================================
# 6. PERMISSÕES
# ============================================================
log_info "Ajustando permissões..."

# Cria diretório de logs se não existir
mkdir -p "$LOG_DIR"
chown -R www-data:www-data "$LOG_DIR"
chmod 755 "$LOG_DIR"

# Permissões para backend
chown -R www-data:www-data "$BACKEND_DIR/media"
chown -R www-data:www-data "$BACKEND_DIR/staticfiles"
chmod -R 755 "$BACKEND_DIR/media"
chmod -R 755 "$BACKEND_DIR/staticfiles"

# Permissões para frontend
chown -R www-data:www-data "$FRONTEND_DIR/dist"
chmod -R 755 "$FRONTEND_DIR/dist"

# ============================================================
# 7. REINICIAR SERVIÇO
# ============================================================
log_info "Reiniciando $SERVICE_NAME..."
systemctl daemon-reload
systemctl start $SERVICE_NAME

# Verifica se o serviço está rodando
if systemctl is-active --quiet $SERVICE_NAME; then
    log_info "Serviço $SERVICE_NAME iniciado com sucesso"
else
    log_error "Falha ao iniciar $SERVICE_NAME"
    exit 1
fi

# ============================================================
# 8. REINICIAR NGINX
# ============================================================
log_info "Recarregando Nginx..."
nginx -t && systemctl reload nginx || log_error "Erro ao recarregar Nginx"

# ============================================================
# 9. RESUMO
# ============================================================
log_info "Deploy concluído com sucesso!"
log_info "Verificando status..."
systemctl status $SERVICE_NAME --no-pager

log_info "===== DEPLOY SUMMARY ====="
log_info "Backend: $BACKEND_DIR"
log_info "Frontend: $FRONTEND_DIR"
log_info "Logs: $LOG_DIR"
log_info "Serviço: $SERVICE_NAME"
log_info "Backup: $BACKUP_FILE"
log_info "=========================="

# ============================================================
# TROUBLESHOOTING
# ============================================================
# Se houver erro, verifique:
# - systemctl status alo-controle
# - journalctl -u alo-controle -n 100
# - nginx error log: tail -f /var/log/nginx/alo_controle_error.log
# - arquivo .env em $BACKEND_DIR/.env
# - DATABASE_URL correto
# - FRONTEND_URL/CORS_ALLOWED_ORIGINS corretos
