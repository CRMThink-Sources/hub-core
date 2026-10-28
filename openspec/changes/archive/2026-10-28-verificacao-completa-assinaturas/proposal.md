# Proposal

## Why

Hoje a varredura de expiração só grava status: ela passa uma assinatura manual para `Vencido` e as linhas dela continuam assinadas no Z-API e na HubMessage indefinidamente, então pagamos aos providers por clientes que deixaram de pagar. Além disso, nada confere se as linhas de uma assinatura `Ativo` estão de fato assinadas no provider. A marca de assinado no espelho só reflete o que o produto fez, não o estado real, e qualquer divergência passa despercebida.

## What Changes

- A varredura horária vira a **verificação de assinaturas**:
  - ao passar uma manual para `Vencido`, grava a data em um campo novo da SPA 1142 ("Vencido em"). Um `Vencido` sem data, feito à mão no CRM ou anterior ao deploy, recebe a data de hoje na primeira vez que o job o vê;
  - **BREAKING** (comportamento de cobrança): assinatura manual `Vencido` há 5 dias ou mais tem as linhas **desassinadas** no Z-API/HubMessage. O status continua `Vencido`;
  - assinatura manual `Vencido` há 10 dias ou mais passa para `Cancelado`, com a data de cancelamento. O fluxo de cancelamento que já existe encontra as linhas com a marca de desassinado e não chama o provider de novo;
  - assinatura que saiu de `Vencido` tem a data "Vencido em" limpa, para um novo vencimento contar do zero.
- **Reconciliação diária**: uma vez por dia, e também no "Rodar agora", o job chama o `subscribe` em toda linha `active` com credencial de assinatura `Ativo`, independentemente da marca de assinado. Linhas que estavam sem assinatura no provider passam a ser cobradas, e isso fica registrado.
- O `subscribe` dos providers passa a informar se assinou agora ou se a linha já estava assinada, para o histórico distinguir divergência de confirmação.
- As etapas que tocam o provider só rodam com os efeitos de provider ligados no ambiente (`THINKZAP_SPA_PROVIDER_EFFECTS_ENABLED`), mesmo que a varredura esteja ligada.
- O histórico de rodadas ganha contadores e registros por linha (desassinada, assinada) e por cancelamento. A tela do job no backoffice passa a se chamar "Verificação de assinaturas" e mostra essas ações. O aviso "a varredura não cancela assinaturas" deixa de valer.
- Fora do escopo: assinaturas Stripe (ficam com o change `sincronizacao-status-stripe`) e `Teste expirado`, que continua como está.

## Capabilities

### New Capabilities
<!-- nenhuma: tudo é extensão de capacidades existentes -->

### Modified Capabilities
- `pagamentos/expiracao-assinatura`:
  - entra o registro da data de vencimento;
  - entra a desassinatura no dia 5 e o cancelamento no dia 10;
  - entra a reconciliação diária;
  - o requisito "Outros status não são alterados" muda (`Vencido` agora pode virar `Cancelado`);
  - o requisito "Mudança de status segue o ciclo de provider existente" muda (`Vencido` passa a desassinar depois de 5 dias).
- `pagamentos/historico-expiracao-assinatura`:
  - novos contadores e tipos de registro por rodada;
  - a página de detalhe do job mostra as ações de provider e o novo nome;
  - "Rodar agora" inclui a reconciliação.
- `thinkzap/ciclo-provider-spa-assinatura`: "só `cancelled` desassina" deixa de valer. `past_due` passa a desassinar, mas só pela verificação depois de 5 dias, nunca pelo evento da SPA.
- `portal-admin/catalogo-jobs`: o job do catálogo passa a se chamar "Verificação de assinaturas". O identificador continua o mesmo.

## Impact

- **Dependência:** este change parte das specs do change `identidade-visual-portal-admin`, que precisa ser arquivado antes deste. Os deltas de `historico-expiracao-assinatura` e `catalogo-jobs` são escritos sobre a versão de lá.
- **CRM:** campo `UF_CRM_91_PAST_DUE_AT` ("Vencido em", `datetime` como os outros campos de data) já criado na SPA 1142. O portal é compartilhado por produção e homologação.
- **API:**
  - `modules/application`: verificação, lister da SPA 1142, mapper, entidade e repositório de rodadas;
  - `modules/thinkzap`: regra de cobrança por linha, `ProviderResourceBilling`, clients Z-API e HubMessage;
  - `shared/infra/scheduler/subscription-expiration.job.ts`.
- **Banco:** migration nas tabelas `core_subscription_expiration_runs` e `core_subscription_expiration_changes`. Só colunas novas com default, compatível com as linhas antigas.
- **Front:** detalhe do job (`admin-expiration-job-page.tsx`, tabela, drawer da rodada) e i18n `admin/jobs`.
- **Risco operacional:** a primeira rodada em produção pode desassinar e cancelar assinaturas que já estão `Vencido` há tempo. Como os `Vencido` sem data recebem "hoje" no primeiro contato, a primeira desassinatura acontece 5 dias depois do deploy, e não no deploy.
