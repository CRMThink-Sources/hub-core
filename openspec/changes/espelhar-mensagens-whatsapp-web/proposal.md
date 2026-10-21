# Proposal

## Why

Na linha não oficial (Z-API), o que o cliente escreve no próprio aparelho — celular ou WhatsApp Web — não aparece no canal aberto do Bitrix24. O operador vê só metade da conversa: as respostas do contato chegam, mas o que foi dito a ele fora do Bitrix fica invisível, e o histórico do atendimento no CRM fica incompleto.

Hoje o `ReceivedMessageHandler` descarta todo evento com `fromMe=true`, e nenhuma instância tem o "notificar as enviadas por mim" da Z-API ligado. Então o evento nem chega.

## What Changes

- Novo toggle por linha Z-API na aba Ajustes, card Comportamento: **"Espelhar mensagens enviadas pelo aparelho"**. Vem desligado por padrão, e linhas existentes não mudam de comportamento.
- Ligar ou desligar o toggle liga ou desliga, na Z-API, a notificação de mensagens enviadas pelo próprio número (`update-notify-sent-by-me`), para a instância só gerar esse tráfego quando ele for usado.
- O webhook `ReceivedCallback` deixa de descartar `fromMe=true` incondicionalmente:
  - `fromMe=true` e `fromApi=true` (enviada pela nossa integração: operador no canal aberto, widget, robôs) continua descartada, para não duplicar o que já está no Bitrix.
  - `fromMe=true` e `fromApi=false` (enviada do aparelho ou do WhatsApp Web) segue para um caminho novo de espelhamento.
- O espelhamento posta a mensagem no canal aberto **só quando o contato (ou grupo) já tem conversa no canal aberto** daquela linha. Sem conversa conhecida, o evento é descartado com log, e nenhuma conversa nova é aberta por mensagem saída do aparelho.
- Vale para conversas 1:1 e para grupos.
- A mensagem espelhada é postada **como o operador da sessão**, do lado da empresa no canal aberto: o último operador que respondeu naquela conversa, usando o token OAuth dele (`ThinkzapOperatorOAuth`). Sem operador conhecido, sem token válido ou com recusa do Bitrix, ela sai como o contato (comportamento da primeira versão), e o log do job diz qual autor foi usado.
- A mensagem espelhada leva um prefixo que a identifica como enviada pelo WhatsApp do aparelho, no idioma da instalação (pt/en/es), qualquer que seja o autor. É o mesmo padrão do `[Mensagem enviada a partir do CRM]` do widget.
- Postar como operador dispara `ONIMCONNECTORMESSAGEADD`. O worker de saída reconhece a mensagem espelhada e a descarta, para nunca reenviá-la ao WhatsApp.
- Texto, legenda, mídia (imagem, vídeo, áudio, documento, sticker) e contato encaminhado são espelhados. Nesta iteração, a mídia continua saindo como o contato (ver design, Open Questions). Edição e remoção de uma mensagem já espelhada atualizam ou removem a cópia no canal aberto, com o mesmo autor.

## Capabilities

### New Capabilities
- `thinkzap/espelhamento-mensagens-aparelho`: toggle da linha, ativação da notificação na Z-API, filtro `fromMe`/`fromApi`, regra de "só com conversa existente", espelhamento 1:1 e de grupo, edição e remoção.

### Modified Capabilities
- `thinkzap/idioma-avisos-servidor`: o requisito "Textos no histórico do canal aberto" passa a cobrir também o prefixo da mensagem enviada pelo aparelho.

## Impact

- **API (`api/src`)**:
  - `shared/infra/handlers/z-api/received-message.handler.ts`: filtro e roteamento por `fromMe`/`fromApi`.
  - `modules/thinkzap/application/process-z-api-inbound-message.use-case.ts`, ou um use case irmão, para o espelhamento.
  - `ConnectorSettings` e o schema dele.
  - `UpdateLineSettings`: chamada à Z-API ao mudar o toggle.
  - `ZApiClient`: novo método `update-notify-sent-by-me`.
  - `PrismaThinkzapMessageRepository`: nova busca da conversa existente por `(instanceId, chatId)`.
  - `history-notices.ts`: novo prefixo nos 3 idiomas.
  - `line-settings.mapper.ts` e `update-line-settings.controller.ts`.
  - `workers/bitrix-received-message.processor.ts`: gravar o operador (`message.user_id`) na row `BITRIX`, upsert oportunista do token do operador quando o evento traz `refresh_token`, e guard anti-loop da mensagem espelhada.
  - `ResolveOperatorBitrixAccessToken` (reuso) para postar, editar e remover como o operador.
- **Redis**: reserva de curta duração por mensagem espelhada postada como operador, consumida pelo worker de saída.
- **Front (`front/`)**: o toggle no card Comportamento (`ajustes-tab.tsx`, `ajustes-alteracoes.ts`, `use-line-api.ts`) e os textos em `messages/{pt,en,es}/thinkzap/configuracoes/ajustes.json`. Só aparece em linha Z-API.
- **Z-API**: chamada `PUT /update-notify-sent-by-me` por instância. Com ela ligada, aumenta o volume de webhooks `ReceivedCallback` na fila `thinkzap-inbound`.
- **Banco**: migration de índice `(instance_id, chat_id)` em `core_thinkerszap_messages`, para a busca de conversa existente; e coluna nullable `bitrix_user_id` na mesma tabela, com índice `(bitrix_chat_id, created_at)`, para saber o operador da sessão e o autor de cada mensagem espelhada (ver design, Decisões 7 e 10).
- Sem impacto na linha oficial (HubMessage).
