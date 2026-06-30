# PMO Board

Aplicacao full stack para gestao de atividades em Kanban, com frontend React, API REST em Express, Prisma e PostgreSQL.

## Stack

- Frontend: React, TypeScript, Vite, Tailwind CSS, dnd-kit, TanStack Query, React Hook Form e Zod.
- Backend: Node.js, Express, TypeScript, Prisma, PostgreSQL, JWT e Zod.
- Banco local: PostgreSQL via Docker Compose.

## Como rodar localmente

1. Instale as dependencias:

```bash
npm install
```

2. Crie o arquivo `.env` na raiz a partir de `.env.example`:

```bash
cp .env.example .env
```

No PowerShell:

```powershell
Copy-Item .env.example .env
```

3. Para usar imediatamente sem banco instalado, ajuste:

```env
DATA_DRIVER="json"
DATABASE_URL="postgresql://pmo:pmo@localhost:5432/pmo_board?schema=public"
VITE_API_URL="http://localhost:3333/api"
CORS_ORIGIN="http://localhost:5173"
```

Nesse modo a API persiste os dados em `apps/api/data/local-store.json`.

4. Para usar PostgreSQL com Prisma, altere para:

```env
DATA_DRIVER="prisma"
```

E suba o PostgreSQL:

```bash
docker compose up -d
```

5. Gere o Prisma Client, sincronize o schema e rode o seed:

```bash
npm run db:generate
npm run db:push
npm run db:seed
```

6. Rode frontend e backend:

```bash
npm run dev
```

- Frontend: http://localhost:5173
- API: http://localhost:3333/api
- Health check: http://localhost:3333/api/health

## Deploy na VPS

O deploy de producao segue o fluxo:

```text
Codex altera o codigo -> commit/push no GitHub -> GitHub Actions conecta na VPS via SSH -> git pull -> docker compose up -d --build
```

Arquitetura em producao:

- `web`: Nginx servindo o build React na porta `80` e fazendo proxy de `/api` para a API.
- `api`: Node/Express na porta interna `3333`.
- `postgres`: PostgreSQL 16 com volume Docker persistente.

### Secrets do GitHub Actions

Crie estes secrets no repositorio:

```text
VPS_HOST      IP da VPS Contabo
VPS_USER      usuario SSH da VPS
VPS_SSH_KEY   chave privada usada pelo GitHub Actions para acessar a VPS
APP_ENV_B64   arquivo .env de producao codificado em base64
```

Opcionalmente, use `VPS_SSH_PORT` se o SSH nao estiver na porta `22`.

O `.env` de producao deve seguir `.env.example`, usando `DATA_DRIVER="prisma"`, `VITE_API_URL="/api"` e `DATABASE_URL` apontando para o host Docker `postgres`, por exemplo:

```env
POSTGRES_DB="pmo_board"
POSTGRES_USER="pmo"
POSTGRES_PASSWORD="uma-senha-forte"
DATABASE_URL="postgresql://pmo:uma-senha-forte@postgres:5432/pmo_board?schema=public"
JWT_SECRET="um-segredo-longo-e-forte"
PORT=3333
CORS_ORIGIN="http://IP_DA_VPS"
VITE_API_URL="/api"
DATA_DRIVER="prisma"
WEB_PORT=80
SEED_DEFAULT_PASSWORD="senha-inicial-admin"
```

Para gerar o valor de `APP_ENV_B64` no PowerShell:

```powershell
[Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes((Get-Content .env.production -Raw)))
```

Na VPS zerada, instale Docker/git e prepare `/opt/board_pmo`:

```bash
DEPLOY_PUBLIC_KEY="ssh-ed25519 ..." bash scripts/bootstrap-vps.sh
```

Depois do primeiro push na branch `main`, acompanhe a execucao em GitHub Actions. O seed cria os usuarios iniciais somente quando o banco ainda nao tem usuarios; nos deploys seguintes ele apenas pula essa etapa.

> Nunca commite `.env`, token GitHub, senha da VPS ou chave SSH. Se algum token foi colado em conversa, rotacione ou revogue no GitHub.

## Login de teste

```text
E-mail: rogerio@pmo.local
Senha: 123456
```

Usuarios do seed: Rogerio, Ana, Matheus e Gabrielle.

Se `DATA_DRIVER="json"` estiver ativo, o login funciona sem Docker/PostgreSQL. Se `DATA_DRIVER="prisma"` estiver ativo, rode `db:push` e `db:seed` antes de entrar.

## Scripts principais

```bash
npm run dev          # API e web juntos
npm run build        # build dos dois apps
npm run typecheck    # TypeScript dos dois apps
npm run db:generate  # gera Prisma Client
npm run db:push      # aplica schema no banco
npm run db:seed      # popula dados iniciais
npm run db:studio    # abre Prisma Studio
```

## Estrutura

```text
apps/
  api/
    prisma/
      schema.prisma
      seed.ts
    src/
      controllers/
      middleware/
      routes/
      schemas/
      services/
  web/
    src/
      components/
      hooks/
      pages/
      services/
      utils/
```

## Endpoints

Todas as rotas abaixo usam o prefixo `/api`.

### Autenticacao

```http
POST /auth/login
Content-Type: application/json

{
  "email": "rogerio@pmo.local",
  "password": "123456"
}
```

### Usuarios

```http
GET /users
Authorization: Bearer <token>
```

### Atividades

```http
GET /activities?status=TODO&priority=HIGH&search=lembrete
Authorization: Bearer <token>
```

```http
POST /activities
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "Configurar lembrete automatico",
  "description": "Configurar lembrete automatico de atualizacao de atividades.",
  "status": "TODO",
  "priority": "HIGH",
  "assigneeId": "uuid",
  "dueDate": "2026-07-10",
  "tags": ["Automacao", "WhatsApp"],
  "checklist": ["Definir regras", "Configurar templates"]
}
```

```http
GET /activities/:id
PATCH /activities/:id
PATCH /activities/:id/status
DELETE /activities/:id
```

Ao mover status:

```http
PATCH /activities/:id/status
Authorization: Bearer <token>
Content-Type: application/json

{
  "status": "BLOCKED",
  "reason": "Dependencia externa"
}
```

### Checklist

```http
POST /activities/:id/checklist
PATCH /checklist/:itemId
DELETE /checklist/:itemId
```

### Comentarios e historico

```http
POST /activities/:id/comments
GET /activities/:id/comments
GET /activities/:id/history
```

### Alertas

```http
GET /alerts
```

Retorna atividades atrasadas, em risco, bloqueadas, sem responsavel e proximas do vencimento.

## Regras implementadas

- Card sem responsavel nao entra em `IN_PROGRESS`.
- Card sem descricao nao entra em `IN_REVIEW`.
- Card com checklist incompleto nao entra em `DONE`.
- Movimentos para `BLOCKED` e `CANCELED` exigem motivo.
- Criacao, edicao, movimentacao, comentarios e checklist registram historico.
- O frontend usa API real via services e TanStack Query, com optimistic update ao mover cards.
