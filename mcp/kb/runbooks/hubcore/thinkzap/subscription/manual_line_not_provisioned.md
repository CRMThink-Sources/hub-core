---
category: internal
audience: dev
summary: Observabilidade — item de assinatura criado à mão no CRM não virou linha; nenhum recurso foi criado.
---
# thinkzap.subscription.manual_line_not_provisioned

## O que significa
Alguém criou um item de assinatura à mão na SPA 1146 do CRM interno, o job de provisionamento rodou e **decidiu não criar recurso nenhum**. Nada foi cobrado e nada foi criado no provedor — o item continua exatamente como estava.

O item nesse estado normalmente é **ilegal para a leitura de domínio**: provider declarado sem credencial faz `mapBitrixSpaSubscriptionItemToSubscriptionItem` recusar o item, e como a listagem mapeia item por item, isso derruba a leitura da assinatura inteira. Ou seja: enquanto o item estiver assim, a instalação pode não conseguir listar linha nenhuma.

Não há cliente esperando resposta — o gatilho é ato de operador, não requisição de app.

## Causa provável
Lida no campo `reason` da linha do log:

- `provider-not-declared` — `ufCrm93Provider` vazio. Item de cobrança sem conector é `NONE` **escrito**, não campo em branco.
- `provider-unknown` — valor fora de `ZAPI` / `HUBMESSAGE` / `NONE` (erro de digitação).
- `zapi-pair-incomplete` — só o id da instância, ou só o token. Provisionar sobrescreveria o campo preenchido de propósito.
- `orphan-waba` — WABA preenchida sem o id do canal.
- `credential-provider-mismatch` — item declara um provider e carrega a credencial do outro.
- `none-with-credential` — `NONE` com credencial preenchida.
- `missing-item` — o item foi apagado entre o evento e a execução do job.
- `missing-parent` — item sem o campo parent da assinatura (`parentId1142`): sem pai não há contrato a cobrar.
- `provision-failed` — o provedor recusou ou não respondeu à criação do recurso. Neste caso **nada** foi criado lá; é seguro tentar de novo.

## Como verificar
1. Na tela de Logs, filtre pelo `traceKey` do job.
2. Confirme `código de erro: thinkzap.subscription.manual_line_not_provisioned`.
3. Leia `subscriptionItemId` e `reason`.
4. Abra o item na SPA 1146 e confira `ufCrm93Provider` e os quatro campos de credencial.

## Como resolver
1. Corrija o item na SPA 1146 conforme o `reason`: preencher o provider, corrigir a digitação, completar o par da Z-API, ou escrever `NONE` se for item de cobrança sem conector.
2. Dispare o evento de novo. O job só é acionado por criação (`ADD`) — na prática, editar o item **não** reenfileira. Recriar o item é o caminho, ou acionar o desenvolvimento para enfileirar o job à mão.
3. Em `provision-failed`, confira o status do provedor antes de repetir: nada foi criado lá, então repetir é seguro.

## Quando escalar
Escale ao desenvolvimento quando o `reason` for `provision-failed` recorrente (indisponibilidade do provedor) ou quando o item estiver correto e o job continuar recusando. Anexe: `traceKey`, código de erro, id do item na SPA 1146, `reason` e horário.
