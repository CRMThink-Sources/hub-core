# Proposal

## Why

O ThinkZap tem tela em português, inglês e espanhol, mas os avisos que o servidor gera sozinho saem sempre em português. Isso vale para o chat do canal aberto, a timeline do CRM, o sininho do Bitrix e o histórico da conversa. Um cliente que usa o app em inglês lê a tela em inglês e os avisos em português. A change `limite-diario-mensagens-linha` criou o mecanismo: idioma gravado por instalação em `core_apps.locale` e textos por idioma. Hoje ele só cobre os avisos do limite diário. Esta change estende o mecanismo aos demais avisos.

## What Changes

- **Chat do canal aberto**, no idioma da instalação:
  - aviso de janela de 24h fechada (linha oficial);
  - aviso de falha no envio de botões pela tela do canal aberto: a parte fixa do texto. O motivo do validador continua cru;
  - aviso de recusa da Meta depois do aceite: o prefixo e todas as variantes por código (131047, 131026, 131048, 131049, 131051, 132000, 132001, 132015, 132016), por texto (nome de exibição, número inválido, limite de envio), sem motivo e a genérica. O retorno cru do provedor dentro da genérica continua como veio;
  - resumo do bot na transferência: só o título "Resumo do atendimento automático" e o "O cliente não respondeu nada antes da transferência." Rótulos e respostas ficam como o autor do fluxo e o contato escreveram.
- **Timeline do CRM**, no idioma da instalação:
  - falha e entrega incerta do envio pelo widget;
  - confirmações de envio pelo widget, tanto pela fila quanto no envio síncrono com anexo: os rótulos "Para", "De", "Mensagem" e "Template";
  - robô "Enviar mensagem": resultado e "nenhum destinatário";
  - robô de botões e robô de template: todos os textos de recusa, de "nenhum destinatário" e de "enfileirado para".
- **Sininho do Bitrix** (`im.notify.system.add`), no idioma da instalação: linha conectada e linha desconectada.
- **Histórico do canal aberto**, no idioma da instalação: o prefixo "[Mensagem enviada a partir do CRM]" e os marcadores de envio só com anexo ("[Imagem enviada]", "[Vídeo enviado]", "[Áudio enviado]", "[Arquivo enviado]").
- Uma fonte única de textos por idioma no servidor, com a mesma regra do limite diário: idioma da instalação, português sem escolha ou com falha de leitura, e as mesmas chaves nos três idiomas.
- Fora do escopo:
  - corrigir a entrega dos avisos que postam como bot sem a segunda tentativa (janela de 24h, botões, resumo do bot). Vai em change separada;
  - o widget do CRM, que é todo em português fixo;
  - mensagens cruas de provedor e de validador, e textos escritos pelo autor do fluxo do bot;
  - os avisos do limite diário, já traduzidos em `limite-diario-mensagens-linha`.

## Capabilities

### New Capabilities

- `thinkzap/idioma-avisos-servidor`: idioma dos avisos que o servidor do ThinkZap gera sem tela aberta. Cobre a regra de escolha do idioma (instalação, padrão português) e a lista de avisos por destino (chat, timeline, sininho, histórico) que a seguem.

### Modified Capabilities

_Nenhuma._ As specs existentes (`envio-botoes`, `widget-entidade-crm`, `destinos-crm`) não descrevem o texto desses avisos. O que muda é só o idioma, e isso é requisito da capability nova.

## Impact

- **Dependência**: o mecanismo da change `limite-diario-mensagens-linha` precisa estar em produção ou entrar junto: `core_apps.locale`, `InstallationLocaleRepository`, `PUT /api/thinkzap/locale` e a gravação no menu do ThinkZap.
- **Textos**: um módulo de textos por idioma em `api/src/modules/thinkzap/domain/`, ao lado de `daily-limit-notices.ts`.
- **Pontos de envio** (em `api/src/`):
  - `modules/thinkzap/application/notify-operator-window-closed.ts` e `notify-operator-button-action-failed.ts`, chamados por `workers/bitrix-received-message.processor.ts`;
  - `modules/thinkzap/application/describe-hubmessage-delivery-failure.ts` e `process-hubmessage-delivery-status.use-case.ts`;
  - `modules/thinkzap/domain/bot-flow/handoff-summary.ts`, com o idioma passado pelo turno do bot (`run-bot-turn.ts`, `workers/bitrix-bot-event.processor.ts`);
  - `modules/thinkzap/application/notify-widget-send-outcome.ts`, `workers/thinkzap-widget-send.processor.ts` (`notifySentFor`) e `application/send-widget-message.use-case.ts`;
  - `presentation/controllers/bitrix-robot-webhook-handler.controller.ts`, `bitrix-button-robot-webhook-handler.controller.ts` e `bitrix-template-robot-webhook-handler.controller.ts`;
  - `workers/thinkzap-connection-notify.processor.ts`;
  - `shared/infra/clients/bitrix.client.ts` (`sendToOpenChannel`), `modules/thinkzap/application/helpers/describe-attachment-text.ts` e `ensure-widget-open-channel-conversation.ts`.
- **Sem migration nova** e sem mudança de API pública.
