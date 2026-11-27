# Tarefas: status de entrega dos envios do ThinkZap

Etapa 1 (recusas e falhas) implementada na branch `task/status-entrega-envios-thinkzap`.
Etapa 2 (entregue e lido, linha oficial) implementada na branch
`task/status-entrega-envios-etapa-2`. Falta a Z-API e a etapa 3 (aba "Envios").

## Etapa 1: validar em staging antes de produção

- [ ] Migration `add_send_notices_to_thinkzap` aplicada pelo deploy. São três DDLs sem
  transação: se o deploy parar no meio, rodar `prisma migrate resolve` e repetir.
- [ ] `worker:widget-outbound` no ar e consumindo a fila `thinkzap-send-notices`
  (mesmo processo, concorrência 1). Sem ele, comentário e notificação não saem.
- [ ] Conferir `THINKZAP_UNIFIED_OUTBOX_DOMAINS` no portal: desligada, o envio com
  anexo pelo widget e o robô "Enviar mensagem" ficam sem status (síncronos).
- [ ] Envio pelo widget (texto, template oficial, anexo, botões): um comentário com
  "De", "Para", template e rodapé de status, atualizado depois.
- [ ] Cada robô (mensagem, template, botões): um comentário por disparo, sem o
  "enfileirado" antigo; vários destinatários com status por número.
- [ ] Recusa real da Meta na linha oficial: row com `rejected_at` e motivo, rodapé
  "Falhou: motivo" e notificação no sino do Bitrix para quem enviou.
- [ ] Portal sem token do operador: comentário sai com o nome do remetente no texto.
- [ ] `crm.timeline.comment.update`: confirmar o erro devolvido para comentário apagado
  (`NOT_FOUND`) e se a credencial da instalação edita comentário feito por usuário.
- [ ] `hubmessage:sync-channel-webhook-events` conferido nos canais existentes: sem o
  evento `MESSAGE_DELIVERY`, a recusa nunca chega.
- [ ] Retenção: definir `THINKZAP_SEND_HISTORY_DAYS` (padrão 90) e conferir
  `FAILURE_PURGE_ENABLED`; staging e produção no mesmo banco usam o menor prazo.
  Conferir o cron do `prune-widget-outbox` (agora poupa os envios rastreados).
- [ ] Observar o expurgo de avisos em banco real: o cursor pode encerrar a página
  cedo e deixar o resto para a rodada seguinte.

## Pendências conhecidas (não bloqueiam a etapa 1)

- Envio síncrono (sem row) mantém o comentário antigo, sem status e fora da aba.
- Destinatário com "sem confirmação" já avisado que vira falha não gera nova notificação.
- Exceção inesperada na última tentativa, ou stall acima do limite, não agenda aviso.
- Recusa de envio sem row no outbox (síncrono, bot) cria 5 jobs de retentativa.
- Notificações de todos os portais passam pela mesma fila com concorrência 1; avaliar
  trava por aviso se houver lentidão.
- Frase de limite diário (longa) repete por destinatário no comentário; criar versão curta.
- FAILED sem `lastError` mostra "Falhou: " sem motivo.
- Lista acima de 20 destinatários não tem teto para as linhas de falha.
- `saveComment` é retentado sem intervalo; `saveAlerted` é incondicional.
- A tela de falhas do backoffice segue limitada a 7 dias; rastreadas mais antigas
  ficam fora da janela dela (o detalhe por id ainda abre).
- Teste do repasse de `sendNoticeId` no serviço de template e do `crm.item.get` com erro
  permanente.

## Antes de produção (revisão final)

- [ ] Notificações em massa: um disparo de robô sobre N registros do CRM gera N avisos
  para o mesmo usuário (um por disparo, `TAG` diferente). Agregar por usuário e janela,
  ou limitar.
- [ ] Concorrência 1 da fila de avisos serializa todos os portais; avaliar trava por aviso.
- [ ] Confirmar `FAILURE_PURGE_ENABLED=true` em produção: sem o expurgo, as linhas
  rastreadas (com texto e telefone) nunca são apagadas.
- [ ] Ordem de deploy: migration, depois API e os dois workers juntos; imagens misturadas
  postam o comentário antigo e o novo para o mesmo envio.

## Resíduos da re-revisão final (menores)

- [ ] Um 503 sem código na primeira tentativa, seguido de limite na última, pode ser lido
  como "não escreveu" e permitir um segundo `comment.add`: marcar a requisição quando
  alguma tentativa foi `HTTP_503` e tratar o erro final como ambíguo.
- [ ] Em `update`, resolver o remetente (`user.get`) fora do `try` que interpreta
  `NOT_FOUND` como "comentário apagado".
- [ ] Publicação que demora mais de 2 minutos faz um job seguinte desistir da reivindicação.

## Etapas seguintes

- [x] Etapa 2, linha oficial (HubMessage): `RECEIVED` grava Entregue e `READ` grava Lido
  (colunas `delivered_at`/`read_at`), com rodapé no comentário. Plano em `plan-etapa-2.md`.
- [ ] Etapa 2, Z-API: sem amostra do `MessageStatusCallback` (`ids[]`); hoje o evento é
  descartado. Capturar o corpo bruto antes de implementar.
- [ ] Etapa 3: aba "Envios" (`/thinkzap/envios`), com filtro por perfil.

## Etapa 2 (linha oficial): validar em staging

- [ ] Migration `add_delivery_read_to_thinkzap_outbox` aplicada pelo deploy (duas colunas
  nulas; DDL instantâneo no MariaDB 10.3+).
- [ ] Rodar `hubmessage:sync-channel-webhook-events` nos canais que ainda não assinam
  `MESSAGE_STATUS` (8 de 17 em produção em 27/11); o script só acrescenta eventos.
  Sem isso, "Lido" não chega nesses canais (Entregue chega pelo `MESSAGE_DELIVERY`).
- [ ] Enviar um template oficial e ver o rodapé do comentário ir de Enviado a Entregue e
  a Lido; conferir o caso de `READ` chegando antes do `RECEIVED`.
- [ ] Envio de operador ou bot (fora do escopo): nenhum erro nem escrita.
- [ ] Observar o volume de jobs de retentativa de status para envios fora do outbox:
  até 4 jobs retidos 24 h por mensagem de operador fora da outbox unificada.
- [ ] **Mudança no caminho de campanha de SMS:** agora só reporta `delivered` para
  `RECEIVED` ou `READ` (antes, qualquer estado sem erro, inclusive `SENT`) e ignora os
  demais. Na tela de campanha, "delivered" passa a aparecer alguns segundos depois do
  aceite. Conferir em staging com uma campanha real.
- [ ] Antes de rodar o script de sincronização, ler nos logs dos 9 canais que já assinam
  `MESSAGE_STATUS` o que esse evento traz: se também manda `SENT`, `ERROR` ou `RECEIVED`
  repetidos com outro `identifier` (um `ERROR` duplicado repetiria o aviso no chat).
- [ ] Ordem: deploy com a migration primeiro; só depois rodar o script, em cada ambiente com
  o `.env` dele.

### Resíduos da etapa 2 (menores)

- [ ] `alertedFailures` é marca d'água: A recusada (alerta), depois entregue, depois B
  recusada não gera novo alerta.
- [ ] `publishSendState` ainda agenda o job de alerta quando há `rejectedAt`, mesmo com a
  mensagem entregue (sem efeito, só um job a mais).
- [ ] `recordProgress` e `reportCampaignStatus` fazem a mesma consulta ao outbox.
- [ ] O aviso `deliveryAfterRejection` não leva `traceKey` e repete em reentrega.
- [ ] Timestamp da migration (`20261128120000`) está à frente da data de criação.
- [ ] Faltam testes: `PARTIAL` com entregue e falha, `READ` + `DELIVERED` resultando em
  `DELIVERED`, `DELIVERED` com parte na fila, rótulos em es para Entregue/Lido.
