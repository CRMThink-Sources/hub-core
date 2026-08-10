# MCP — Base de conhecimento do suporte (CRMThink)

Servidor MCP (Streamable HTTP, stateless) que serve o KB de triagem de erros pro
Claude do suporte via connector do claude.ai. Camada 2B+2C do plano
`tasks/geral/suporte.md`.

## Tools

- `list_error_catalog({ app? })` — errorCodes conhecidos + resumo de 1 linha.
- `get_runbook(errorCode)` — runbook completo (o que é / causa / verificar /
  resolver / escalar).
- `describe_app(app)` — o que o app faz, fluxos, modos de falha.

Fluxo de triagem vai nas `instructions` do server (o connector carrega automático).

## Fonte do conteúdo (fonte da verdade = repo)

Lê markdown de `mcp/kb/` no boot (versionado no pacote, viaja junto no deploy):

- `kb/runbooks/<app>/<area>/<causa>.md` — o **errorCode é derivado do caminho**
  (`clicksign/webhook/signature_invalid.md` → `clicksign.webhook.signature_invalid`).
  Frontmatter só carrega `category` + `summary`; app/area vêm do path.
- `kb/apps/<app>.md` — contexto do app.

Convenção do errorCode: `app.area.causa`, minúsculo, `_` só dentro de palavra
composta. Pasta espelha o código — impossível divergir.

Dev edita o markdown no repo; redeploy do MCP recarrega. Sobrescreve o caminho
com `KB_DIR=/caminho/para/kb`.

## Rodar local

```bash
yarn install
PORT=3200 yarn dev
curl localhost:3200/health
```

Smoke test das tools: POST em `/mcp` com header
`Accept: application/json, text/event-stream`.

## Falta pro deploy (não feito ainda)

1. **Hosting**: expor `/mcp` em HTTPS público (a definir — provável service no
   docker-compose + reverse proxy num subdomínio).
2. **Auth**: OAuth pro connector claude.ai (runbooks não têm dado de cliente,
   mas o connector espera fluxo de auth). Sem auth serve pra teste interno.
3. **Registrar connector** no claude.ai apontando pra URL pública.

## Próximas camadas (fora deste MVP)

- 2A tools de log (`query_by_trace`, `query_errors`) reusando
  `api/src/shared/infra/loki-query.service.ts` + backend BetterStack.
- Camada 0 (`AppError`/`errorCode` no código) pra popular runbooks reais.
