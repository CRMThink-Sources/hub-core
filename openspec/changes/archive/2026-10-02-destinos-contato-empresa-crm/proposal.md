# Proposal

## Why

Quando um contato tem uma ou mais empresas vinculadas, o widget de CRM do ThinkZap, aberto na ficha do **Contato**, lista como destinos os telefones de **todos os contatos da empresa principal** desse contato (e do lead vinculado). O operador vê números de outras pessoas misturados aos do contato que está atendendo e pode acabar enviando mensagem para quem não devia. A lista de destinos tem de refletir a entidade aberta: no Contato, só o contato; na Empresa, a empresa e as pessoas vinculadas a ela.

## What Changes

- **BREAKING (comportamento)**: na ficha do **Contato** (`CRM_CONTACT_DETAIL_TAB`), os destinos passam a ser **somente os telefones do próprio contato**. Deixam de entrar:
  - os contatos da empresa vinculada ao contato (`companyId` → `contactIds` da empresa);
  - o lead vinculado ao contato (`leadId`).
- Na ficha da **Empresa** (`CRM_COMPANY_DETAIL_TAB`), a regra fica formalizada: destinos são os telefones da própria empresa **mais** os telefones de cada contato vinculado a ela (`contactIds` do item da empresa). É o comportamento atual; passa a ser coberto por spec e teste.
- A regra vale para todo consumidor do resolver compartilhado de destinos: o widget (lista de destinos) e os robôs do Bizproc (disparo, botão interativo e template) executados sobre um documento de Contato ou Empresa.
- Deal, Lead e SPA dinâmica **não mudam**.

## Capabilities

### New Capabilities
- `thinkzap/destinos-crm`: quais telefones são oferecidos/usados como destino a partir de uma entidade do CRM (Contato e Empresa), no widget e nos robôs do Bizproc.

### Modified Capabilities
<!-- Nenhuma: a spec existente (thinkzap/configuracao-linha) trata das abas de configuração da linha, não dos destinos. -->

## Impact

- **Código**: `api/src/modules/thinkzap/application/related-destinations.resolver.ts` (`getContactDestinations` e sua chamada em `getRelatedDestinationIds`).
- **Testes**: `related-destinations.resolver.test.ts` e `list-destinations.service.test.ts` (casos de `CRM_CONTACT_DETAIL_TAB` e `CRM_COMPANY_DETAIL_TAB`).
- **Consumidores afetados (sem mudança de código)**: `list-destinations.service.ts` (widget) e os controllers `bitrix-robot-webhook-handler`, `bitrix-button-robot-webhook-handler` e `bitrix-template-robot-webhook-handler` — um robô de disparo em Contato passa a atingir só o contato.
- **Chamadas ao Bitrix**: a abertura do widget no Contato deixa de fazer o `crm.item.get` da empresa e dos contatos dela (menos chamadas).
- Sem mudança de API, banco ou front-end.
