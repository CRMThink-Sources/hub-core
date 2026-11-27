# Tarefas: status de entrega dos envios do ThinkZap

Etapa 1 (recusas e falhas) implementada na branch `task/status-entrega-envios-thinkzap`.
Etapas 2 (entregue e lido) e 3 (aba "Envios") ainda não começaram.

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

## Etapas seguintes

- [ ] Etapa 2: capturar eventos reais de entregue e lido (Z-API e HubMessage,
  `MESSAGE_STATUS`) e gravar `DELIVERED`/`READ`. O callback de campanha de SMS hoje
  trata todo estado sem erro como entregue: não pode regredir.
- [ ] Etapa 3: aba "Envios" (`/thinkzap/envios`), com filtro por perfil.
