# Deploy ALO Controle

Arquivos de configuração e scripts para implantar a aplicação em produção.

## Arquivos inclusos

### 1. `alo-controle.service`
Arquivo de unidade `systemd` que gerencia o serviço Django/Gunicorn.

**Como usar:**
```bash
sudo cp alo-controle.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl start alo-controle
sudo systemctl enable alo-controle  # Inicia na inicialização
```

**Verificar status:**
```bash
sudo systemctl status alo-controle
sudo journalctl -u alo-controle -n 50  # Últimas 50 linhas de log
```

### 2. `alo-controle-nginx.conf`
Configuração Nginx que:
- Redireciona HTTP → HTTPS
- Serve frontend (Angular SPA)
- Proxeia requisições `/api/*` para Gunicorn
- Gerencia arquivos estáticos e de mídia

**Como usar:**
```bash
# Copiar para sites-available
sudo cp alo-controle-nginx.conf /etc/nginx/sites-available/alo-controle

# Criar link simbólico em sites-enabled
sudo ln -s /etc/nginx/sites-available/alo-controle /etc/nginx/sites-enabled/

# Testar configuração
sudo nginx -t

# Recarregar Nginx
sudo systemctl reload nginx
```

**Importante:**
- Substitua `seu-dominio.com` por seu domínio real
- Configure certificados SSL (veja abaixo)

### 3. `deploy.sh`
Script que automatiza todo o deploy (backend + frontend).

**Como usar:**
```bash
# Dar permissão de execução
chmod +x deploy.sh

# Rodar como root
sudo ./deploy.sh
```

O script faz:
1. Para o serviço
2. Faz backup do banco de dados
3. Atualiza repositório Git
4. Instala dependências Python (pip)
5. Roda migrations
6. Coleta arquivos estáticos
7. Instala dependências Node.js (npm)
8. Faz build do frontend
9. Ajusta permissões
10. Reinicia serviço
11. Recarrega Nginx

## Setup Inicial (primeira vez)

### Pré-requisitos
```bash
sudo apt update
sudo apt install -y python3.10 python3.10-venv python3-pip nodejs npm nginx postgresql postgresql-contrib
```

### Estrutura de diretórios
```bash
sudo mkdir -p /var/www/alo_controle
sudo mkdir -p /var/log/alo_controle
sudo chown -R www-data:www-data /var/www/alo_controle
sudo chown -R www-data:www-data /var/log/alo_controle
```

### Clonar repositório
```bash
cd /var/www/alo_controle
sudo git clone https://seu-repo.git .
```

### Configurar banco de dados (PostgreSQL)
```bash
sudo -u postgres psql

CREATE USER alo_controle WITH PASSWORD 'sua_senha_segura';
CREATE DATABASE alo_controle OWNER alo_controle;
ALTER ROLE alo_controle SET client_encoding TO 'utf8';
ALTER ROLE alo_controle SET default_transaction_isolation TO 'read committed';
ALTER ROLE alo_controle SET default_transaction_deferrable TO on;
ALTER ROLE alo_controle SET default_transaction_level TO 'read committed';
ALTER ROLE alo_controle SET timezone TO 'UTC';
GRANT ALL PRIVILEGES ON DATABASE alo_controle TO alo_controle;
\q
```

### Configurar variáveis de ambiente
```bash
sudo nano /var/www/alo_controle/backend/.env
```

Adicione:
```
SECRET_KEY=gere-uma-chave-aleatoria-segura-aqui
DEBUG=False
DATABASE_URL=postgres://alo_controle:sua_senha_segura@localhost:5432/alo_controle
DATABASE_SSL_REQUIRE=False
CORS_ALLOW_CREDENTIALS=True
CORS_ALLOWED_ORIGINS=https://seu-dominio.com
FRONTEND_URL=https://seu-dominio.com
```

### Configurar SSL com Let's Encrypt
```bash
# Instalar Certbot
sudo apt install -y certbot python3-certbot-nginx

# Gerar certificado
sudo certbot certonly --nginx -d seu-dominio.com -d www.seu-dominio.com

# Renovação automática (já ativa por padrão)
sudo systemctl enable certbot.timer
```

## Rodando o deploy completo

Após o setup inicial:

```bash
cd /var/www/alo_controle/deploy
sudo ./deploy.sh
```

## Troubleshooting

### Verificar logs do serviço
```bash
sudo journalctl -u alo-controle -n 100 -f
```

### Verificar logs do Nginx
```bash
sudo tail -f /var/log/nginx/alo_controle_error.log
sudo tail -f /var/log/nginx/alo_controle_access.log
```

### Tester a API diretamente
```bash
curl -X POST http://localhost:8000/api/auth/token/ \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"senha"}'
```

### Reset de permissões
```bash
sudo chown -R www-data:www-data /var/www/alo_controle
sudo chmod -R 755 /var/www/alo_controle
```

### Limpar cache do frontend
```bash
sudo rm -rf /var/www/alo_controle/frontend/dist
sudo rm -rf /var/www/alo_controle/frontend/node_modules
```

## Variáveis de ambiente importantes

| Variável | Descrição | Exemplo |
|----------|-----------|---------|
| `SECRET_KEY` | Chave secreta Django | (gerar com `openssl rand -base64 32`) |
| `DEBUG` | Modo debug | `False` (sempre em produção) |
| `DATABASE_URL` | URL de conexão DB | `postgres://user:pass@host:5432/db` |
| `CORS_ALLOWED_ORIGINS` | Origens permitidas | `https://seu-dominio.com` |
| `FRONTEND_URL` | URL do frontend | `https://seu-dominio.com` |
| `DATABASE_SSL_REQUIRE` | Exigir SSL na conexão | `True` ou `False` |

## Gerar chave secreta
```bash
python3 -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"
```

## Monitoramento

### Ver se o serviço está ativo
```bash
sudo systemctl is-active alo-controle
```

### Ver tamanho do BD
```bash
sudo -u postgres psql -d alo_controle -c "SELECT pg_size_pretty(pg_database_size('alo_controle'));"
```

### Backup manual
```bash
sudo -u postgres pg_dump alo_controle > /var/www/alo_controle/backups/alo_controle_$(date +%Y%m%d).sql
```

### Restore de backup
```bash
sudo -u postgres psql alo_controle < /var/www/alo_controle/backups/alo_controle_YYYYMMDD.sql
```

## Dicas de performance

1. **Gunicorn workers**: Ajustar `--workers` baseado em núcleos de CPU
   - Fórmula: `(2 × CPU_cores) + 1`
   - Exemplo: CPU com 4 cores = 9 workers

2. **Nginx caching**: Adicionar cache-control headers para estáticos

3. **Database**: Índices em campos de query frequente

4. **Frontend**: Usar cache-busting em builds (Angular já faz isso)

5. **Logs**: Rotação regular com `logrotate`

Exemplo `/etc/logrotate.d/alo_controle`:
```
/var/log/alo_controle/*.log {
    daily
    rotate 7
    compress
    delaycompress
    notifempty
    create 0640 www-data www-data
    sharedscripts
    postrotate
        systemctl reload alo-controle > /dev/null 2>&1 || true
    endscript
}
```

## Suporte

Para dúvidas ou problemas:
1. Checar logs do serviço: `journalctl -u alo-controle`
2. Checar logs do Nginx: `/var/log/nginx/alo_controle_error.log`
3. Verificar variáveis de ambiente: `.env`
4. Testar conectividade: `psql -U alo_controle -d alo_controle -h localhost`
