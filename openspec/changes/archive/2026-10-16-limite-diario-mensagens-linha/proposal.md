# Proposal

## Why

Linhas não oficiais (Web, Z-API) estão sendo bloqueadas pelo WhatsApp por excesso de envio num mesmo dia. Hoje nada no ThinkZap segura o volume. Não existe limite, cota nem contagem diária por linha em nenhum caminho de envio. O cliente só descobre o problema quando a linha já caiu. Precisamos de um teto diário configurável por linha não oficial. A linha oficial (Business, HubMessage) fica de fora: ela segue os limites da própria Meta.

## What Changes

- **Configuração por linha não oficial**, na aba Ajustes:
  - ativar ou desativar o limite diário de mensagens;
  - definir o limite (inteiro positivo).

  Os campos entram na mesma barra de salvamento da aba. Quem pode editar é quem já edita a linha (permissão `connectors:update`).
- **Uso do dia na mesma tela**: mensagens já enviadas hoje, o limite efetivo e o percentual que falta para atingi-lo. O uso aparece mesmo com o limite desativado, para o cliente calibrar antes de ativar.
- **Liberação temporária**: soma um número de mensagens extras ao limite **só no dia corrente**. Na virada do dia (fuso `America/Sao_Paulo`), volta ao limite configurado. É uma ação imediata, fora da barra de salvamento. Uma nova liberação no mesmo dia soma à anterior.
- **Contagem de toda mensagem de saída** da linha:
  - resposta do operador no canal aberto (texto, mídia e botões);
  - widget: texto, envio com anexo e botões;
  - robôs: "Enviar mensagem" e o de botões;
  - Campanha de SMS;
  - falas do bot.

  O dia é o dia de calendário em `America/Sao_Paulo`. Cada mensagem aceita pela Z-API conta; um texto com dois anexos conta 3. O envio que a Z-API recusou com erro não consome cota. O envio com entrega incerta (tempo de resposta esgotado) conta.
- **Bloqueio ao atingir o limite**: com o limite ativo e atingido, novos envios pela linha são recusados até a virada do dia, sem chamar a Z-API. Cada origem avisa do seu jeito:
  - **Operador no canal aberto**: aviso no chat, no mesmo padrão do aviso de janela de 24h fechada. Não há retentativa.
  - **Widget e robô de botões**: o pedido é recusado na hora, com erro próprio. Se o limite for atingido enquanto a mensagem espera na fila, ela falha de forma definitiva, com comentário na timeline.
  - **Envio com anexo pelo widget**: recusado na hora se o limite já foi atingido. Se o limite acabar no meio, as partes que já saíram ficam registradas e a timeline avisa quais anexos não foram enviados.
  - **Robô "Enviar mensagem"**: os destinatários além do limite não recebem, e a timeline lista quem ficou sem.
  - **Campanha de SMS**: status `failed` reportado ao Bitrix24.
  - **Bot**: a fala não é entregue e o motivo vai para o log do job.
- Novos códigos de erro `thinkzap.line.daily_limit_*`, cada um com seu guia de resolução.
- Fora do escopo agora:
  - limite para a linha oficial (HubMessage);
  - alertas proativos (ex.: aviso em 80%);
  - limite definido pelo backoffice.

## Capabilities

### New Capabilities

- `thinkzap/limite-diario-mensagens`: limite diário de envio por linha não oficial, que cobre:
  - a configuração do limite;
  - a contagem do dia;
  - a liberação temporária;
  - a recusa de envio por origem quando o limite é atingido.

### Modified Capabilities

- `thinkzap/configuracao-linha`:
  - a aba Ajustes da linha não oficial ganha o card "Limite diário";
  - a barra de salvamento passa a cobrir os campos do limite;
  - a liberação temporária entra como ação imediata, que não conta como alteração pendente.

## Impact

- **API, domínio e settings**
  - `api/src/modules/thinkzap/domain/value-objects/connector-settings.ts` e `connector-settings.schema.ts`: campos `dailyLimitEnabled` e `dailyLimit`, gravados no settings do item da SPA 1146. O cache do item (`cached-subscription-item.repository.ts`) passa a guardar os campos.
  - `presentation/controllers/line/update-line-settings.controller.ts`, `presentation/mappers/line-settings.mapper.ts`, `application/update-line-settings.ts` e `application/get-line-settings.ts`: aceitar e expor os campos, e devolver o uso do dia.
- **API, contador e liberação**
  - Contador diário atômico em Redis, por instância Z-API e por dia, junto com a liberação temporária do dia.
  - Novo endpoint `POST /api/thinkzap/lines/:itemId/daily-limit/extra`.
- **Pontos de envio**
  - Reserva da vaga em `workers/bitrix-received-message.processor.ts`, `application/dispatch-widget-outbox-message.ts`, `workers/bitrix-bot-event.processor.ts`, `application/send-widget-message.use-case.ts` (envio com anexo) e `presentation/controllers/bitrix-robot-webhook-handler.controller.ts` (robô "Enviar mensagem").
  - Pré-checagem em `enqueue-widget-message.use-case.ts` (texto e Campanha de SMS) e `enqueue-interactive-button-send.service.ts`, com resposta 429 em `presentation/helpers/handle-widget-send-error.ts`.
- **Erros**: `errors/catalog.ts` e os guias em `mcp/kb/runbooks/hubcore/thinkzap/line/`.
- **Front**
  - `front/app/(thinkzap)/thinkzap/_components/configuracoes/ajustes-tab.tsx`, `ajustes-alteracoes.ts` e o novo `limite-diario-card.tsx`;
  - `front/app/hooks/use-line-api.ts`;
  - i18n em `front/messages/{pt,en,es}/thinkzap/configuracoes/ajustes.json`.
- **Sem migration**: a configuração vive no settings do item da SPA e o contador vive no Redis.
