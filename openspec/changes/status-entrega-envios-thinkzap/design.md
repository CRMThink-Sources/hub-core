# Design: status de entrega dos envios do ThinkZap

## Intenção

Um cliente teve mensagens recusadas pela Meta e não recebeu retorno. O objetivo é que
quem envia pelo widget ou por robô do Bizproc saiba o que aconteceu com cada mensagem:
no comentário do CRM, no sino do Bitrix quando há recusa ou falha, e numa aba de
consulta no ThinkZap.

Hoje, uma recusa da Meta em envio por widget ou robô não altera o envio (a row do
outbox segue `SENT`), não gera comentário no CRM, avisa só no chat do canal aberto e é
descartada se chegar antes de a conversa existir
(`process-hubmessage-delivery-status.use-case.ts`).

## Objetivos

1. Toda recusa ou falha fica gravada no envio, com motivo legível.
2. O comentário do envio mostra destinatário, número de origem, template (linha
   oficial) e, no rodapé, o status atual.
3. Quem enviou recebe notificação no Bitrix quando há recusa ou falha.
4. Aba "Envios" no ThinkZap, com 90 dias de histórico.

## Fora do escopo

- Campanha de SMS, resposta do operador no canal aberto e fala do bot (origens
  `SMS_CAMPAIGN`, `OPERATOR`, `BOT`). O comportamento atual delas não muda, inclusive o
  status de campanha e o aviso no chat.
- Reenvio ou reprocessamento pela aba nova.
- Mudar regras de envio: cadência, limite diário, tentativas, não duplicidade.
- Preencher status de mensagens enviadas antes do deploy.

## Anti-objetivos

Qualquer um destes torna a entrega um fracasso:

- afirmar "Entregue" ou "Lido" sem confirmação do provedor;
- enviar a mesma mensagem duas vezes ao contato, ou duplicar comentário no CRM;
- inundar o sino ou estourar o limite do Bitrix em disparo em massa;
- falha no registro de status derrubar ou atrasar o envio;
- um operador ver mensagens de outro.

## Abordagens

| Abordagem | A favor | Contra |
|---|---|---|
| **A. Ampliar a fila de envio** (escolhida) | Uma só fonte de verdade; a row já tem destinatário, texto, template, origem e autor | Mexe na tabela crítica do envio e na limpeza de 7 dias |
| B. Tabela de histórico separada | Não toca a limpeza; consulta isolada | Duplica dado pessoal e pode divergir justamente no status |
| C. Só eventos e comentário | Menor entrega | Sem consulta em um só lugar |

Escolhida a **A** pelo usuário, em três etapas, com o escopo widget + robôs Bizproc.

## Decisões do usuário

- Recusa ou falha: atualizar o comentário **e** notificar no Bitrix (sem comentário
  extra de falha quando o comentário do envio já existe).
- Visibilidade da aba: administrador do ThinkZap (`canManageAccess`) vê todos os
  envios; os demais usuários com acesso ao app veem só os que fizeram; envio de robô sem
  usuário aparece só para administrador.

## Decisões propostas e aceitas

- Histórico guardado por **90 dias**.
- Disparo em massa: uma notificação por disparo, agrupando recusas próximas.
- Comentário com vários destinatários: status por número; lista grande mostra totais e
  detalha só as falhas.

## Desenho

### Dados (migration aditiva)

Em `core_thinkerszap_widget_outbox`:

- `deliveryStatus` (nulo, `DELIVERED`, `READ`, `REJECTED`), `deliveredAt`, `readAt`,
  `rejectedAt`;
- `failureCode` (código da Meta, quando houver) e `failureReason` (texto cru do
  provedor; a tradução é feita na exibição, no idioma de quem lê);
- vínculo com o registro do comentário (abaixo);
- índice em `(instance_id, provider_message_id)`, que hoje não existe;
- índice para a listagem da aba (domínio + data, e domínio + operador + data).

`status` continua sendo só o estado da **fila**. Recusa posterior ao aceite não tira a
row de `SENT`, então idempotência e reprocessamento não mudam.

Tabela nova de comentários de envio: um registro por comentário publicado (entidade,
`commentId`, autor com que foi publicado, chave do disparo). As rows apontam para ele.

### Status exibido

| Exibido | Origem |
|---|---|
| Aguardando envio | `PENDING` / `SENDING` |
| Enviado | `SENT` sem `deliveryStatus` |
| Entregue | `deliveryStatus = DELIVERED` |
| Lido | `deliveryStatus = READ` |
| Falhou: motivo | `FAILED`, ou `deliveryStatus = REJECTED` |
| Sem confirmação | `UNKNOWN` (mantém o alerta "confira antes de reenviar") |

Destinatário com várias partes (texto e anexos) tem um status só: se alguma parte
falhou, "Falhou", dizendo que foi parcial quando outra saiu; senão, o menor avanço entre
as partes.

O status só avança: entregue atrasado não apaga lido. Recusa prevalece sobre "Enviado";
entregue ou lido prevalece sobre uma recusa anterior ou posterior, e o conflito vai
para o log.

### Eventos dos provedores

- **Linha oficial (HubMessage):** o webhook de status já cai na fila de entrada
  (`source: 'hubmessage-status'`). O processor passa a gravar o status na row do outbox,
  antes e independentemente do aviso ao canal aberto, que continua como está. "Lido"
  deve exigir `MESSAGE_STATUS` em `HUBMESSAGE_CHANNEL_WEBHOOK_EVENTS` e o script
  `hubmessage:sync-channel-webhook-events` nos canais existentes.
- **Z-API:** `StatusCallbackHandler` passa a enfileirar o evento
  (`MessageStatusCallback`, com `ids[]`) em vez de descartá-lo. Não volta a abrir
  conversa do canal aberto (ver o comentário do handler).
- Estado desconhecido não vira "Entregue": é registrado no log e ignorado. O caminho de
  campanha de SMS hoje trata todo estado sem erro como entregue; com o evento novo, ele
  não pode passar a reportar `delivered` para estados que não são entrega.
- Evento sem row correspondente: reagendado poucas vezes com intervalo crescente (o
  evento pode chegar antes do commit). Esgotado, é descartado com log, **sem** virar
  falha de recebimento, porque a maioria será de mensagens fora do escopo.

### Comentário no CRM

- Um comentário por disparo: uma mensagem do widget (com seus anexos), ou um disparo de
  robô com todos os destinatários.
- Campos: De (número da linha), Para, Template com idioma (linha oficial), mensagem,
  arquivos, e rodapé "Status".
- Robôs de template e de botões deixam de publicar "enfileirado" mais um comentário por
  destinatário: o comentário único nasce no enfileiramento, com "Aguardando envio".
  Widget e robô de mensagem seguem publicando no primeiro desfecho.
- Autoria como hoje (change `comentario-timeline-autor-remetente`). O serviço de
  notificação passa a devolver o id do comentário e com qual credencial publicou, para a
  edição usar a mesma e cair na da instalação se for recusada.
- Edição por `crm.timeline.comment.update`, em job atrasado com id por comentário
  (agrupa eventos próximos). O texto é remontado inteiro a partir do banco, então
  repetir é seguro. `comment.add` continua sem retentativa.
- Falha ao editar não muda o status gravado; vai para o log. Comentário apagado pelo
  usuário não é recriado.
- Textos em pt, en e es em `timeline-notices.ts`.

### Notificação

- `BitrixSystemNotificationService` (`im.notify.system.add`).
- Destinatário: o operador do envio; sem operador, o responsável pelo registro do CRM;
  sem nenhum dos dois, não notifica (fica no comentário e na aba).
- Conteúdo: quantas mensagens falharam, motivo (se for um só), link do registro e, a
  partir da etapa 3, da aba.
- Uma por disparo: job atrasado (cerca de 2 minutos) com id por disparo e `TAG` por
  disparo, para um aviso posterior substituir o anterior com o total atualizado.
- Cobre recusa posterior, falha definitiva de envio, limite diário e "sem
  confirmação" (com a redação própria, sem afirmar que não saiu).

### Aba "Envios" (`/thinkzap/envios`)

- Lista: data, linha, destinatário, tipo (texto, template, anexo, botões), origem
  (widget ou robô), remetente, status e motivo.
- Filtros: período (até 90 dias), status, linha e destinatário. Paginação no servidor.
- Detalhe: texto, template, horários de envio, entrega, leitura ou recusa, motivo
  traduzido com o código, e link para o registro no CRM.
- Rota na API depois do `thinkzapAccessMiddleware`. O filtro por remetente é aplicado no
  servidor, a partir do JWT, também no detalhe.
- Sem permissão nova nas configurações. Textos em pt, en e es.

### Retenção

- Rows das origens do escopo: 90 dias, em qualquer status final, por env nova
  (`config/env.ts`, `.env.example`, compose).
- `deleteExpiredFailuresBatch` passa a usar o prazo de 90 dias para essas origens; as
  demais e as tabelas de falhas de recebimento e tentativas seguem em 7.
- `prune-widget-outbox` apaga `SENT` após 30 dias por padrão: precisa respeitar o prazo
  novo, e o cron do host precisa ser conferido.
- A tela de falhas do backoffice continua limitada a 7 dias.
- Ambientes que dividem o banco: vence o menor prazo (ver `DEPLOY.md`).
- Privacidade: texto e telefone de envios com falha passam a ficar 90 dias, não 7.
  Nada disso é copiado para log.

## Etapas

Cada etapa vai para produção sozinha.

1. **Recusas e falhas** (resolve o caso do cliente): dados, gravação do status de
   recusa, comentário novo com rodapé e edição, notificação, retenção de 90 dias.
2. **Entregue e lido:** capturar eventos reais, assinar o que faltar, tratar Z-API e
   HubMessage.
3. **Aba "Envios".**

A retenção entra já na etapa 1 para a aba nascer com histórico.

## Restrições

- Regras do `CLAUDE.md`: migration nova, chamadas ao Bitrix por
  `shared/infra/bitrix-limits`, filas com `QUEUE_PREFIX`, código novo de erro no
  catálogo com runbook em `mcp/kb/`.
- Homologação e produção usam o mesmo portal Bitrix.
- Sem worker rodando, comentário e notificação não saem.
- A change `historico-falhas-reprocessamento` mexe na mesma limpeza; conferir se foi
  arquivada antes de escrever os deltas de spec.

## A verificar antes ou durante a implementação

- **Formato real dos eventos** de entregue e lido nos dois provedores. A documentação da
  HubMessage não o descreve (só o payload de recusa foi observado). Bloqueia a etapa 2.
- Se a Z-API envia `RECEIVED` e `READ` com a configuração atual de webhook.
- Se os canais em produção já assinam `MESSAGE_DELIVERY` (script de sincronização).
  Pode ser feito antes de qualquer etapa. Sem isso a etapa 1 não vê recusas.
- "Lido" não chega se o contato desativou a confirmação de leitura.

## A cargo de quem implementar

Nomes de colunas, tabela, filas e envs; intervalos exatos de agrupamento e de
reagendamento; limite a partir do qual o comentário resume os destinatários; layout da
aba seguindo as telas existentes do ThinkZap.
