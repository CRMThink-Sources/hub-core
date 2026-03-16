# API (Hubthink Core)

Backend único com módulos por aplicação: domain/entities, repositories, infra.

## Estrutura

- **shared/** – Domain (Domain, InstalledApp, AvailableApp), repositórios e infra de persistência compartilhada.
- **modules/thinkerszap/** – Módulo ThinkersZap: entity, repository, use cases, rotas.
- **middleware/auth.ts** – Autenticação (header `X-Installed-App-Id`; em produção trocar por OAuth Bitrix).
- **composition-root.ts** – Monta repositórios, use cases e rotas (DI).

## Como rodar

Na raiz do monorepo:

```bash
pnpm install
pnpm --filter api run db:generate   # gera cliente Prisma
pnpm --filter api run db:push       # cria tabelas (MySQL)
pnpm --filter api run dev           # sobe a API em http://localhost:4000
```

### 1. Criar o banco no localhost (MySQL)

Com o MySQL instalado e rodando:

**Linha de comando:**

```bash
mysql -u root -p -e "CREATE DATABASE hubthink;"
```

(Use o usuário que você configurou, ex.: `root`; a porta padrão é 3306.)

**Ou pelo MySQL Workbench / phpMyAdmin:** crie um banco com nome `hubthink`.

### 2. Configurar variáveis de ambiente

Crie o arquivo `apps/api/.env` com a URL do banco (troque usuário e senha pelos seus):

```
PORT=4000
DATABASE_URL="mysql://root:SUA_SENHA@localhost:3306/hubthink"
```

### 3. Gerar cliente Prisma e criar tabelas

```bash
pnpm --filter api run db:generate   # gera o cliente Prisma (obrigatório antes de rodar a API)
pnpm --filter api run db:push       # cria/atualiza as tabelas no banco
```

## Endpoints

- `GET /health` – health check
- `GET /api/thinkerszap/settings` – retorna configurações (requer header `X-Installed-App-Id`)
- `PUT /api/thinkerszap/settings` – salva configurações (body: `webhookUrl`, `apiKey`, `isActive`)

Para testar, crie um Domain, AvailableApp e InstalledApp no banco e use o `id` do InstalledApp no header `X-Installed-App-Id`.
