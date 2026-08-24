# Recuperação de senha no Render

A funcionalidade depende de um provedor SMTP externo. No painel do serviço Render, abra o serviço web, acesse **Environment** e defina as variáveis abaixo. Depois, faça um novo deploy.

```text
APP_ENV=production
APP_BASE_URL=https://SEU-SERVICO.onrender.com
SECRET_KEY=<chave-secreta-aleatoria-e-longa>
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60

SMTP_HOST=<servidor-SMTP>
SMTP_PORT=587
SMTP_USER=<usuario-SMTP>
SMTP_PASSWORD=<senha-de-aplicativo-ou-senha-SMTP>
SMTP_FROM=<endereco-remetente>
SMTP_TLS=true
SMTP_SSL=false
```

Use a URL pública HTTPS real no `APP_BASE_URL` (domínio próprio ou o endereço `onrender.com`). Ela é usada para montar o link que chega no e-mail.

Para SMTP do Gmail, use uma **senha de app** e não a senha normal da conta. O Gmail deve estar com verificação em duas etapas ativa. Para servidores na porta 465, use `SMTP_SSL=true` e `SMTP_TLS=false`.

O Render não envia e-mails por conta própria: sem essas variáveis, a rota responde que a recuperação está indisponível. O código agora não expõe detalhes internos de SMTP ao navegador e o front-end trata também respostas de erro que não sejam JSON.
