# DEPLOY RÁPIDO - ALO Controle

Passe a passe para implantar em 5 minutos.

## 1. Preparar servidor (primeira vez)

```bash
# Instalar dependências
sudo apt update
sudo apt install -y python3.10 python3.10-venv python3-pip nodejs npm nginx postgresql postgresql-contrib

# Criar diretórios
sudo mkdir -p /var/www/alo_controle /var/log/alo_controle
sudo chown -R www-data:www-data /var/www/alo_controle

# Clonar código
cd /var/www/alo_controle
sudo git clone https://seu-repo.git .

# Criar BD PostgreSQL
sudo -u postgres psql << EOF
CREATE USER alo_controle WITH PASSWORD 'sua_senha_segura';
CREATE DATABASE alo_controle OWNER alo_controle;
GRANT ALL PRIVILEGES ON DATABASE alo_controle TO alo_controle;
EOF

# SSL (Let's Encrypt)
sudo apt install -y certbot python3-certbot-nginx
sudo certbot certonly --nginx -d seu-dominio.com -d www.seu-dominio.com
```

## 2. Configurar ambiente (.env)

```bash
sudo cp deploy/.env.example backend/.env
sudo nano backend/.env  # Preencher valores reais
```

Variáveis críticas:
```
SECRET_KEY=gerar-com-openssl
DEBUG=False
DATABASE_URL=postgres://alo_controle:senha@localhost:5432/alo_controle
CORS_ALLOWED_ORIGINS=https://seu-dominio.com
FRONTEND_URL=https://seu-dominio.com
```

## 3. Instalar systemd + Nginx

```bash
# Systemd
sudo cp deploy/alo-controle.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable alo-controle

# Nginx
sudo cp deploy/alo-controle-nginx.conf /etc/nginx/sites-available/alo-controle
sudo ln -s /etc/nginx/sites-available/alo-controle /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

## 4. Executar deploy

```bash
cd /var/www/alo_controle
sudo chmod +x deploy/deploy.sh
sudo ./deploy/deploy.sh
```

O script fará:
- Migrations do Django
- Collectstatic
- Build do frontend
- Reinicia serviço

## 5. Verificar

```bash
# Serviço rodando?
sudo systemctl status alo-controle

# Nginx ativo?
sudo systemctl status nginx

# Logs?
sudo journalctl -u alo-controle -n 20
sudo tail -f /var/log/nginx/alo_controle_error.log

# API respondendo?
curl -v https://seu-dominio.com/api/auth/token/

# Frontend carrega?
curl -I https://seu-dominio.com/
```

## 6. Criar usuário admin

```bash
cd /var/www/alo_controle/backend
source .venv/bin/activate
python manage.py createsuperuser
```

## 7. Login

- URL: `https://seu-dominio.com`
- Admin: `https://seu-dominio.com/admin`

---

## Troubleshooting Rápido

| Problema | Solução |
|----------|---------|
| 502 Bad Gateway | `sudo systemctl restart alo-controle` |
| DB connection error | Verificar `DATABASE_URL` em `.env` |
| CORS error no frontend | Adicionar domínio em `CORS_ALLOWED_ORIGINS` |
| Certificado expirado | `sudo certbot renew --force-renewal` |
| Nginx error 404 | `sudo nginx -t` e revisar `root` do site |
| Permissões negadas | `sudo chown -R www-data:www-data /var/www/alo_controle` |

---

## Deploy de Atualizações

Quando houver mudanças no código:

```bash
cd /var/www/alo_controle
sudo ./deploy/deploy.sh
```

Pronto! ✅

---

## Suporte

- **Logs do serviço**: `sudo journalctl -u alo-controle -f`
- **Logs do Nginx**: `/var/log/nginx/alo_controle_*.log`
- **README completo**: `deploy/README.md`
- **Checklist**: `deploy/CHECKLIST.md`
