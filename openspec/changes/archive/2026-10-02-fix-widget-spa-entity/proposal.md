# Proposal

## Why

Quando o widget do ThinkZap está aberto na aba de um item de SPA (Smart Process, placement `CRM_DYNAMIC_<entityTypeId>_DETAIL_TAB`), o envio falha com `400 Invalid request … path: ["entity"] … expected string, received undefined`. O widget só converte placement em `entity` para Lead, Negócio, Contato e Empresa (`PLACEMENT_TO_ENTITY` em `front/app/(widgets)/layouts/conversation-view.tsx`), então em SPA o campo vai `undefined` e o JSON o omite. A lista de destinos já funciona em SPA (o backend reconhece o placement dinâmico), então o operador vê os telefones, mas não consegue enviar nada.

## What Changes

- O widget passa a derivar `entity` de placements de SPA: `CRM_DYNAMIC_<entityTypeId>_DETAIL_TAB` → `DYNAMIC_<entityTypeId>`, a mesma forma de owner type que os robôs do Bizproc já usam (`parseBizprocDocumentId`) e que `crm.timeline.comment.add` aceita em `ENTITY_TYPE`.
- A derivação vale para os quatro envios do widget, que compartilham `entity`/`entityId`: `send-widget`, `send-widget-multipart`, `send-widget-template` e `send-widget-button`.
- Placement que o widget não reconhece passa a ser recusado **no próprio widget**, com mensagem legível ao operador, em vez de mandar o request e mostrar um erro de validação cru.
- A busca do nome do contato para a conversa no canal aberto (`makeGetCrmContactName`) passa a usar `crm.item.get` com o `entityTypeId` quando a entidade é `DYNAMIC_<id>` — hoje ela chamaria `crm.dynamic_<id>.get`, método que não existe, e o nome cairia sempre no telefone.
- Sem mudança de contrato das rotas: `entity` continua obrigatório e string.

## Capabilities

### New Capabilities
- `thinkzap/widget-entidade-crm`: como o widget de CRM identifica a entidade (tipo + id) em que está aberto e a envia junto com as mensagens, incluindo itens de SPA.

### Modified Capabilities
<!-- Nenhuma: os requisitos de destinos-crm e envio-botoes não mudam. -->

## Impact

- **Front**: `front/app/(widgets)/layouts/conversation-view.tsx` (mapeamento placement → entity e guarda antes do envio); novo helper puro testável ao lado.
- **API**: `api/src/modules/thinkzap/application/get-crm-contact-name.ts` (ramo SPA via `crm.item.get`).
- **Fluxos já existentes que passam a funcionar em SPA sem alteração**: comentário de timeline (`ENTITY_TYPE: entity.toUpperCase()` → `DYNAMIC_1060`), outbox/worker (gravam `entity` como string).
- Sem migração, sem mudança de API pública, sem dependências novas.
