# Design

## Context

Toda resolução de destinos a partir de uma entidade do CRM passa por `resolveRelatedDestinations` (`api/src/modules/thinkzap/application/related-destinations.resolver.ts`). Ela é chamada pelo widget (`ListDestinationsService`) e pelos três robôs do Bizproc (`bitrix-robot-`, `bitrix-button-robot-` e `bitrix-template-robot-webhook-handler`), que convertem o `document_id` em placement via `bizprocEntityToPlacement`.

Hoje o placement escolhe o conjunto de ids a carregar (`getRelatedDestinationIds`):

- `CRM_CONTACT_DETAIL_TAB` → `getContactDestinations`: o próprio contato, **os `contactIds` da empresa principal** (`companyId` → `crm.item.get` na empresa) e o `leadId`. É daqui que vêm os números de terceiros (ver proposal.md – Why).
- `CRM_COMPANY_DETAIL_TAB` → `getCompanyDestinations`: a própria empresa e os `contactIds` do próprio item — já é o comportamento pedido.

Depois, cada id é carregado por `crm.item.get`, os telefones saem do `fm`, falhas individuais são logadas e ignoradas, e o resultado é deduplicado por telefone.

## Goals / Non-Goals

**Goals:**
- Contato resolve apenas ele mesmo; Empresa mantém empresa + contatos vinculados, agora coberta por teste.
- Mesma regra no widget e nos robôs, sem ramificar por origem da chamada.

**Non-Goals:**
- Mudar Deal, Lead ou SPA dinâmica — eles continuam trazendo os contatos da empresa vinculada.
- Mudar formato do rótulo, normalização ou dedup de telefone.
- Considerar `companyIds` (empresas secundárias) no placement de Empresa ou em qualquer outro.

## Decisions

**1. Simplificar `getContactDestinations` para devolver só `{ entityTypeId: 3, id: contextId }`.**
Remove a leitura da empresa (`getCompanyContactIdsFromEntity`) e do `leadId`. A função deixa de ser `async` e de receber `getCrmItem`, no mesmo formato de `getCompanyDestinations`. Com isso a abertura no Contato faz um único `crm.item.get` (o do próprio contato, já feito e memoizado pelo cache da resolução).
*Alternativa considerada:* filtrar os destinos depois de montados. Rejeitada — continuaria fazendo as chamadas à empresa e aos contatos dela só para descartá-las.

**2. Regra única no resolver compartilhado, sem flag por consumidor.**
O usuário confirmou que widget e robôs seguem a mesma regra. Um parâmetro "modo widget/robô" duplicaria o contrato sem necessidade.

**3. Empresa: sem mudança de código, só teste.**
`getCompanyDestinations` já lê `contactIds` do item da empresa. Adicionamos testes que fixam empresa + contatos, dedup e falha parcial, para que a regra não regrida.

## Risks / Trade-offs

- [Robôs de disparo em Contato atingem menos destinatários do que antes] → é o comportamento desejado; registrar no changelog/release notes que robôs em Contato deixam de enviar para os contatos da empresa e para o lead vinculado.
- [Helpers `getCompanyContactIdsFromEntity`/`getEntityId` podem ficar com menos usos] → continuam usados por Deal, Lead e SPA; não remover.
- [Testes existentes de Contato podem afirmar o comportamento antigo] → revisar e ajustar os casos de `CRM_CONTACT_DETAIL_TAB` em `list-destinations.service.test.ts`.

## Migration Plan

Mudança só de código no backend, sem dados nem migração. Deploy normal da API; rollback revertendo o commit.
