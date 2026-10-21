# Proposal

## Why

O limite diário (`thinkzap/limite-diario-mensagens`) controla **quanto** uma linha não oficial (Web, Z-API) envia no dia, mas não controla o **ritmo**. Uma linha com limite de 1000 pode disparar as 1000 mensagens em poucos minutos, e rajadas assim são o principal gatilho de bloqueio pelo WhatsApp. Precisamos de um cadenciador por linha que segure o ritmo de envio **sem recusar** mensagens: o excesso espera na fila e sai sozinho na próxima janela.

Escopo de origem: `docs/escopos/cadenciador-mensagens.md`.

## What Changes

- **Cadenciador por linha não oficial**, desativado por padrão. O usuário define:
  - **N** mensagens por janela;
  - a duração da janela, **D** minutos;
  - opcionalmente, uma **pausa** de P minutos.
- **Janela ancorada no primeiro envio.** A janela começa no primeiro envio feito sem nenhuma janela aberta e dura D minutos.
  - Ao enviar a N-ésima mensagem, a janela atinge o limite.
  - Com pausa configurada, a pausa começa nesse instante e **substitui** o restante da janela.
  - A próxima janela só pode abrir no fim da pausa, ou no fim da janela quando não há pausa, e começa no primeiro envio feito depois disso.
- **Excesso enfileirado, nunca recusado.**
  - A mensagem acima do ritmo fica na fila e sai automaticamente quando abrir a próxima janela, em ordem **FIFO por linha** e sem prioridade entre origens.
  - Não há tempo máximo de espera.
  - O adiamento não consome tentativas de envio.
- **Todas as origens de envio da linha passam pela fila e pela cadência**, com a cadência ativa ou não:
  - resposta do operador no canal aberto (texto, mídia e botões);
  - widget (texto, botões e envio com anexo);
  - robô "Enviar mensagem" (texto e arquivos) e robô de botões;
  - Campanha de SMS;
  - falas do bot.
- **BREAKING (comportamento):** a resposta do operador, a fala do bot, o envio com anexo pelo widget e o robô "Enviar mensagem" deixam de ser enviados de forma síncrona. Eles passam a ser persistidos e enfileirados. Sem cadência ativa, saem assim que o worker os processa.
  - O envio com anexo pelo widget e o robô "Enviar mensagem" deixam de devolver o resultado final na resposta da requisição. O resultado passa a ir para a timeline quando o envio termina.
  - O limite diário continua valendo do mesmo jeito: ele é checado no momento do envio real.
- **Mensagens espelhadas do WhatsApp Web** (enviadas pelo aparelho) **contam** na janela, mas não esperam, porque já saíram.
- **Mudança de configuração vale só na próxima janela**, inclusive a desativação. A janela ou pausa em andamento termina com os valores com que começou.
- **Visibilidade:**
  - no widget, a mensagem adiada aparece como "aguardando janela de envio", com o horário previsto de saída;
  - no canal aberto, o operador recebe um aviso no chat quando a resposta dele é adiada;
  - na configuração da linha, o estado atual da janela e a quantidade de mensagens aguardando;
  - a timeline do CRM não muda: continua registrando só o resultado final.
- **Nova aba "Limites de envio"** na configuração da linha não oficial. Ela reúne o limite diário, que sai da aba Ajustes, e o cadenciador. Os dois são independentes e vêm desativados.
- Avisos novos do servidor nos três idiomas (pt, en, es).
- **Fora do escopo:**
  - linhas oficiais (HubMessage);
  - cadência por destinatário;
  - intervalo aleatório entre mensagens;
  - janela de horário comercial;
  - perfis prontos de cadência.

## Capabilities

### New Capabilities

- `thinkzap/cadencia-envio-mensagens`: cadência de envio por linha não oficial. Cobre:
  - a configuração (N, D e pausa);
  - o modelo de janela e pausa;
  - a contagem, incluindo as mensagens espelhadas;
  - o enfileiramento FIFO sem recusa;
  - o envio assíncrono de todas as origens;
  - a regra de mudança de configuração na próxima janela;
  - os avisos de espera (widget e operador) e a exibição do estado.

### Modified Capabilities

- `thinkzap/configuracao-linha`:
  - nova aba "Limites de envio" na linha não oficial, com o card do limite diário (movido da aba Ajustes) e o card do cadenciador;
  - barra de salvamento e proteção contra perda de alterações próprias da aba;
  - a aba Ajustes perde o card Limite diário.
- `thinkzap/limite-diario-mensagens`: a recusa por origem se ajusta ao envio enfileirado.
  - A resposta do operador, o envio com anexo pelo widget, o robô "Enviar mensagem" e a fala do bot passam a ser recusados **no momento do envio real**, e não mais na hora da requisição.
  - A pré-checagem no enfileiramento continua valendo.
  - A tela de uso do dia passa a ficar na aba "Limites de envio". O conteúdo dela não muda.
- `thinkzap/robo-envio-arquivos`: o robô "Enviar mensagem" passa a enfileirar cada parte por destinatário. O comentário da timeline é publicado quando o disparo termina de ser enviado, e não no fim da requisição do robô.
- `thinkzap/idioma-avisos-servidor`: o aviso de espera ao operador no chat do canal aberto entra na lista de avisos traduzidos. O status "aguardando janela de envio" do widget é texto do front e segue o i18n do front.

## Impact

- **API, domínio e settings:**
  - `ConnectorSettings` e o schema dele, com os campos de cadência, e o schema do cache do item;
  - `update-line-settings.controller.ts`, `update-line-settings.ts`, `get-line-settings.ts` e `line-settings.mapper.ts`.
- **Cadência em Redis:** nova porta e adapter com Lua atômico por linha (`thinkzap:cadence:{zApiInstanceId}`), que guarda o snapshot da configuração da janela.
- **Fila de saída:**
  - `ThinkzapWidgetOutbox` ganha a origem da mensagem e os dados que as origens síncronas precisam no envio. Exige **migration**.
  - Ajustes em `dispatch-widget-outbox-message.ts`, `thinkzap-widget-send.processor.ts` e `thinkzap-widget-outbound.worker.ts`, com sequenciamento FIFO por linha.
- **Origens migradas para a fila:**
  - `workers/bitrix-received-message.processor.ts`;
  - `workers/bitrix-bot-event.processor.ts` e `HybridBotSessionAdapter`;
  - `application/send-widget-message.use-case.ts`;
  - `presentation/controllers/bitrix-robot-webhook-handler.controller.ts`.
- **Espelhamento:** `mirror-z-api-sent-by-me-message.use-case.ts` registra o envio na janela. Isso depende do change ativo `espelhar-mensagens-whatsapp-web`.
- **Front:**
  - nova aba em `front/app/(thinkzap)/thinkzap/_components/configuracoes/`, com o card do limite diário movido de `ajustes-tab.tsx`;
  - `use-line-api.ts`;
  - status de espera no widget;
  - i18n em pt, en e es.
- **Erros:** novos códigos `thinkzap.line.cadence_*` em `errors/catalog.ts`, com os guias de resolução.
- **Rollout:** como todas as linhas Z-API passam a enviar pela fila, uma flag de rollout libera o caminho novo aos poucos.
