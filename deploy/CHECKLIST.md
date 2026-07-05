# Checklist de Deploy - ALO Controle

## Pré-Deploy (Local)

- [ ] Rodar testes: `python manage.py test`
- [ ] Verificar migrations pendentes: `python manage.py makemigrations --check`
- [ ] Verificar erros no código: `python manage.py check`
- [ ] Fazer build do frontend: `npm run build -- --configuration=production`
- [ ] Testar frontend localmente: `npm start`
- [ ] Testar API localmente: `python manage.py runserver`
- [ ] Revisar últimas alterações: `git log --oneline -10`
- [ ] Commit e push de todas as alterações: `git push origin main`

## Configuração do Servidor (Primeira vez)

- [ ] Atualizar pacotes: `sudo apt update && sudo apt upgrade -y`
- [ ] Instalar Python 3.10+: `sudo apt install python3.10 python3.10-venv python3-pip`
- [ ] Instalar Node.js 16+: `sudo apt install nodejs npm`
- [ ] Instalar Nginx: `sudo apt install nginx`
- [ ] Instalar PostgreSQL: `sudo apt install postgresql postgresql-contrib`
- [ ] Criar usuário www-data se não existir
- [ ] Criar diretórios:
  ```bash
  sudo mkdir -p /var/www/alo_controle
  sudo mkdir -p /var/log/alo_controle
  sudo chown -R www-data:www-data /var/www/alo_controle
  ```
- [ ] Clonar repositório: `sudo git clone <repo-url> /var/www/alo_controle`
- [ ] Criar banco de dados PostgreSQL (vide deploy/README.md)
- [ ] Copiar `.env` para backend: `sudo cp deploy/.env.example /var/www/alo_controle/backend/.env`
- [ ] Preencher `.env` com valores reais
- [ ] Instalar certificado SSL: `sudo certbot certonly --nginx -d seu-dominio.com`
- [ ] Copiar arquivo systemd: `sudo cp deploy/alo-controle.service /etc/systemd/system/`
- [ ] Copiar config Nginx: `sudo cp deploy/alo-controle-nginx.conf /etc/nginx/sites-available/alo-controle`
- [ ] Habilitar site Nginx: `sudo ln -s /etc/nginx/sites-available/alo-controle /etc/nginx/sites-enabled/`
- [ ] Testar config Nginx: `sudo nginx -t`
- [ ] Copiar script deploy: `sudo cp deploy/deploy.sh /var/www/alo_controle/`
- [ ] Dar permissão ao script: `sudo chmod +x /var/www/alo_controle/deploy/deploy.sh`

## Variáveis de Ambiente (.env)

- [ ] `SECRET_KEY`: gerar com `openssl rand -base64 32` ou Python
- [ ] `DEBUG`: definir como `False`
- [ ] `DATABASE_URL`: URL correta do PostgreSQL
- [ ] `DATABASE_SSL_REQUIRE`: `True` para servidor remoto, `False` para local
- [ ] `CORS_ALLOWED_ORIGINS`: incluir domínio do frontend
- [ ] `FRONTEND_URL`: URL do frontend
- [ ] `CORS_ALLOW_CREDENTIALS`: `True`

## Banco de Dados

- [ ] Criar usuário PostgreSQL: `alo_controle`
- [ ] Criar banco de dados: `alo_controle`
- [ ] Testar conexão: `psql -U alo_controle -d alo_controle -h localhost`
- [ ] Verificar extensões necessárias (se houver)
- [ ] Fazer backup: `pg_dump -U alo_controle alo_controle > backup.sql`

## Deploy (Automático)

- [ ] Executar script de deploy: `sudo /var/www/alo_controle/deploy/deploy.sh`
- [ ] Verificar se serviço iniciou: `sudo systemctl status alo-controle`
- [ ] Verificar logs do serviço: `sudo journalctl -u alo-controle -n 50`
- [ ] Verificar logs do Nginx: `sudo tail -f /var/log/nginx/alo_controle_error.log`
- [ ] Testear API: `curl -X GET https://seu-dominio.com/api/auth/token/`

## Testes Pós-Deploy

- [ ] Acessar frontend: `https://seu-dominio.com`
- [ ] Login com usuário admin
- [ ] Testar cadastro de item
- [ ] Testar registro de entrada
- [ ] Testar registro de saída
- [ ] Testar criação de pedido
- [ ] Visualizar relatórios
- [ ] Verificar que usuário `compra` vê apenas suas opções
- [ ] Verificar que usuário `almoxarifado` não pode negar pedidos
- [ ] Testar download/upload de arquivos
- [ ] Testar código de barras
- [ ] Testar geração de relatórios em PDF

## Verificações de Segurança

- [ ] `DEBUG=False` confirmado
- [ ] `SECRET_KEY` é segura e aleatória
- [ ] `.env` não está no Git
- [ ] SSL/HTTPS está ativado
- [ ] Certificado SSL é válido: `sudo certbot certificates`
- [ ] CORS permite apenas domínios esperados
- [ ] `www-data` é o owner dos arquivos
- [ ] Permissões de arquivo estão corretas (755/644)
- [ ] Acesso SSH restrito (firewall/security groups)
- [ ] Acesso ao banco de dados restrito por IP
- [ ] Backups estão sendo feitos regularmente
- [ ] Logs estão sendo rotacionados

## Performance

- [ ] Verificar que Nginx está servindo estáticos
- [ ] Verificar cache headers: `curl -I https://seu-dominio.com`
- [ ] Verificar workers do Gunicorn: `ps aux | grep gunicorn`
- [ ] Monitorar CPU/RAM do servidor
- [ ] Verificar tamanho do banco: `sudo -u postgres psql -c "SELECT pg_size_pretty(pg_database_size('alo_controle'));"`

## Monitoramento Contínuo

- [ ] Configurar alertas de erro (email, Slack, etc.)
- [ ] Monitorar uptime do servidor
- [ ] Revisar logs diariamente
- [ ] Backup automático do BD (cron job)
- [ ] Atualizar dependências regularmente
- [ ] Testar restore de backup mensalmente

## Rollback (Se necessário)

- [ ] Parar o serviço: `sudo systemctl stop alo-controle`
- [ ] Reverter commit: `sudo git revert <commit-hash>`
- [ ] Restaurar backup do BD: `sudo -u postgres psql < backup.sql`
- [ ] Executar migrations compatíveis
- [ ] Reiniciar serviço: `sudo systemctl start alo-controle`
- [ ] Verificar logs

## Documentação

- [ ] Atualizar README com URL de produção
- [ ] Documentar credenciais (armazenar em local seguro, ex. LastPass/1Password)
- [ ] Documentar processo de deploy em Wiki/Confluence
- [ ] Treinar time sobre como acessar logs e fazer troubleshooting

---

## Comandos Úteis Pós-Deploy

```bash
# Status do serviço
sudo systemctl status alo-controle

# Logs em tempo real
sudo journalctl -u alo-controle -f

# Últimas 100 linhas de erro
sudo journalctl -u alo-controle -n 100

# Recarregar Nginx
sudo systemctl reload nginx

# Teste de conectividade com BD
sudo -u postgres psql -c "SELECT datname FROM pg_database;"

# Tamanho do BD
sudo -u postgres psql -c "SELECT pg_size_pretty(pg_database_size('alo_controle'));"

# Backup rápido
sudo -u postgres pg_dump alo_controle > /var/www/alo_controle/backups/backup_$(date +%Y%m%d_%H%M%S).sql

# Ver processos do Gunicorn
ps aux | grep gunicorn

# Testa configuração Nginx
sudo nginx -t

# Ver certificado SSL
sudo certbot certificates

# Renova certificado SSL (manual)
sudo certbot renew --dry-run
```

---

**Data do Deploy:** _______________

**Quem fez o deploy:** _______________

**Versão do código:** _______________

**Notas adicionais:**
