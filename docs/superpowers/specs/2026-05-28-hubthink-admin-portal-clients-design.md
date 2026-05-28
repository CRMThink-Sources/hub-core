# Hubthink Admin Portal — Clients Listing Design Spec

**Date:** 2026-05-28  
**Status:** Approved  
**Depends on:** [2026-05-28-hubthink-admin-portal-auth-design.md](./2026-05-28-hubthink-admin-portal-auth-design.md)  
**Scope:** Listagem e detalhe de clientes (`Domain`) no portal interno (Fase 2)

---

## 1. Context

Operadores autenticados no portal (`PortalUser`, JWT `type: 'portal'`) precisam visualizar os portais Bitrix24 cadastrados (`core_domains`) e as aplicações instaladas em cada um (`core_apps` + `core_app_codes`).

### Goals

1. API `GET /api/portal/domains` — lista todos os domínios com apps resumidas
2. API `GET /api/portal/domains/:id` — detalhe de um domínio com apps completas
3. UI `/admin/clientes` — tabela com badges de apps e link para detalhe
4. UI `/admin/clientes/[id]` — metadados do domínio + tabela de apps
5. Navegação no header (Início, Clientes) e card na home

### Non-Goals

- Paginação, busca e filtros server-side
- CRUD de domínios ou apps
- Billing, assinaturas, RBAC avançado
- Sidebar completa

---

## 2. Data Model

**Cliente** = `Domain` (`core_domains`):

| Campo | Descrição |
|-------|-----------|
| `id` | UUID |
| `name` | Domínio Bitrix24 (único) |
| `memberId` | Member ID da instalação (único) |
| `createdAt` / `updatedAt` | Timestamps |

**App instalada** (por domínio) = `App` + `AppCode`:

| Campo | Descrição |
|-------|-----------|
| `id` | UUID da instalação |
| `appCode` | `AppCode.code` |
| `appName` | `AppCode.name` |
| `status` | `AppStatus` |
| `email` | E-mail da instalação |
| `installedAt` | Data de instalação |

---

## 3. API Contracts

Todas as rotas exigem `Authorization: Bearer <portal JWT>`.

### GET `/api/portal/domains`

**Success (200):**

```json
{
  "result": {
    "domains": [
      {
        "id": "uuid",
        "name": "empresa.bitrix24.com.br",
        "memberId": "member-id",
        "createdAt": "2026-01-01T00:00:00.000Z",
        "updatedAt": "2026-01-02T00:00:00.000Z",
        "apps": [
          {
            "id": "uuid",
            "appCode": "thinkzap",
            "appName": "ThinkZap",
            "status": "ACTIVE",
            "email": "admin@empresa.com",
            "installedAt": "2026-01-01T12:00:00.000Z"
          }
        ]
      }
    ],
    "total": 1
  }
}
```

Ordenação: `createdAt desc`.

### GET `/api/portal/domains/:id`

**Success (200):** um item com o mesmo shape de `domains[]`.

**Errors:**

- 404 — domínio inexistente

---

## 4. Backend Architecture

Módulo `api/src/modules/portal/`:

- `PortalDomainReadRepository` (port)
- `PrismaPortalDomainReadRepository` (adapter)
- `ListPortalDomains`, `GetPortalDomainDetail` (use cases)
- `ListPortalDomainsController`, `GetPortalDomainController`

---

## 5. Frontend

| Rota | Componente |
|------|------------|
| `/admin/clientes` | `AdminClientsPage` + `AdminClientsTable` |
| `/admin/clientes/[id]` | `AdminClientDetailPage` |

**i18n:** `admin/clients`, `admin/client-detail` (pt/en/es).

**Auth:** `AdminAuthGuard` + `axiosPortal()` com token em `sessionStorage`.

---

## 6. Security

- Rotas protegidas por `portalAuthMiddleware`
- Sem exposição de `passwordHash`, secrets ou tokens OAuth
- Listagem global apenas para operadores portal (não escopo Bitrix por app)

---

## 7. Manual Verification

1. Login em `/admin/login`
2. Abrir `/admin/clientes` — lista com badges de apps
3. Clicar "Ver" → detalhe com tabela de apps
4. ID inválido → mensagem de erro
5. Sem token → redirect para login
