# Design

## Context

O motivo está em proposal.md. Os requisitos estão em `specs/thinkzap/idioma-avisos-servidor/spec.md`. O que existe e molda a solução:

- **Mecanismo da change `limite-diario-mensagens-linha`**, que esta change pressupõe:
  - `core_apps.locale` (`pt` | `en` | `es` | `null`), gravado pelo `PUT /api/thinkzap/locale` quando o idioma é trocado no menu;
  - `InstallationLocaleRepository` com `byAppId` e `byInstallation(domainId, appCodeId)`, que nunca lançam e caem em `pt`;
  - `domain/daily-limit-notices.ts`, com `NoticeLocale`, `parseNoticeLocale` e um `Record<NoticeLocale, …>` de textos.
- **Avisos de hoje**, todos em português fixo. Para cada um, o que o ponto de envio já tem para achar a instalação:

  | Aviso | Onde o texto nasce | Chave da instalação já disponível |
  |---|---|---|
  | Janela de 24h fechada | `notify-operator-window-closed.ts` | `context.app.id` no `bitrix-received-message.processor.ts` |
  | Falha no envio de botões | `notify-operator-button-action-failed.ts` | `context.app.id`, idem |
  | Recusa da Meta após aceite | `describe-hubmessage-delivery-failure.ts`, montado em `process-hubmessage-delivery-status.use-case.ts` | só `domainId`; o `appCodeId` do ThinkZap sai de `resolveByMarketplaceCode(env.appCodes.thinkzap)` |
  | Resumo do bot | `domain/bot-flow/handoff-summary.ts` (puro), chamado por `advance.ts` | `domainId` e `appCode` no `bitrix-bot-event.processor.ts` |
  | Falha / incerto / enviado do widget | `notify-widget-send-outcome.ts` e `notifySentFor` no `thinkzap-widget-send.processor.ts` | `row.domainId` + `row.appCode` |
  | Envio síncrono com anexo | `send-widget-message.use-case.ts` | `context.aplication.id` |
  | Robôs "Enviar mensagem", botões e template | `bitrix-*-robot-webhook-handler.controller.ts` | `app.id` (via `getByAppCodeAndDomainId`) |
  | Linha conectada / desconectada | `thinkzap-connection-notify.processor.ts` | `app.id` |
  | Prefixo e marcadores no histórico | `BitrixClient.sendToOpenChannel` (shared) e `describe-attachment-text.ts` | `domainId` + `appCode` do job em `ensure-widget-open-channel-conversation.ts` |

- **Nenhum código lê esses textos de volta.** Não há filtro de eco nem parser que compare o prefixo "[Mensagem enviada a partir do CRM]" ou o título do resumo. Traduzir não muda comportamento.

## Goals / Non-Goals

**Goals:**
- Uma fonte única de textos do servidor por idioma, em que faltar um texto num idioma seja erro de compilação, não queda silenciosa para outro idioma.
- Cada ponto de envio lê o idioma só quando vai de fato enviar o aviso, com a chave que já tem em mãos.
- As funções que montam texto continuam puras e testáveis: recebem `locale`, com padrão `pt`.

**Non-Goals:**
- Mudar o canal ou a forma de entrega de qualquer aviso. A correção dos avisos postados como bot sem a segunda tentativa vai em change separada.
- Cache do idioma. A leitura é por chave única e só acontece em caminho de aviso.
- Traduzir o widget do CRM ou texto de terceiros (provedor, validador, autor do fluxo).

## Decisions

### 1. Catálogo de textos tipado por idioma, ao lado do limite diário
- **Decisão:** módulos em `domain/notices/`, um por grupo, todos no formato `Record<NoticeLocale, Textos>`:
  - `open-channel-notices.ts`: janela de 24h, botões, prefixo da recusa da Meta, resumo do bot;
  - `delivery-failure-notices.ts`: variantes da Meta;
  - `timeline-notices.ts`: widget e robôs;
  - `connection-notices.ts`;
  - `history-notices.ts`.

  `NoticeLocale`, `parseNoticeLocale` e `DEFAULT_NOTICE_LOCALE` passam para `domain/notices/notice-locale.ts`. `daily-limit-notices.ts` passa a importar de lá, e os exports antigos seguem funcionando.
- **Por quê:** o `Record<NoticeLocale, Textos>` faz o TypeScript recusar um idioma sem algum texto. Isso cumpre o requisito de "aviso sem texto é defeito" antes de chegar a teste ou a produção. Separar por grupo mantém cada arquivo legível e perto do domínio que o usa.
- **Alternativa descartada:** JSON de i18n como o do front, carregado no servidor. Perde a checagem de tipo das funções com interpolação (`(destination, text) => string`) e traz uma dependência de i18n para o backend sem ganho.

### 2. Funções de texto puras com `locale` e padrão `pt`
- **Decisão:**
  - `notifyOperatorWindowClosed`, `notifyOperatorButtonActionFailed`, `describeHubMessageDeliveryFailure`, `buildHandoffSummary`, `notifyWidgetSendOutcome`, `buildMessage` do aviso de conexão e `resolveOpenChannelText` ganham um parâmetro `locale: NoticeLocale = 'pt'`.
  - O chamador resolve o idioma e passa adiante.
  - Mensagens vindas de fora entram como dado interpolado, nunca como chave de tradução: retorno do provedor, motivo do validador, rótulos e respostas do fluxo, motivo da desconexão.
- **Por quê:** quem lê o idioma é a camada que já conhece a instalação. Os testes de texto não precisam de banco, e os chamadores atuais continuam em português até serem ligados.

### 3. Leitura do idioma no ponto de envio, com a chave disponível
- **Decisão:**
  - `byAppId` onde há `core_apps.id`: operador, envio síncrono, robôs, conexão;
  - `byInstallation(domainId, appCodeId)` onde há o par: outbox, histórico, bot;
  - na recusa da Meta, que só tem `domainId`, `byInstallation(domainId, thinkzapAppCodeId)`, com o `appCodeId` resolvido como nos demais workers (`resolveByMarketplaceCode`).

  A leitura acontece só no ramo que vai postar. Não acontece no início do job.
- **Por quê:** evita uma ida ao banco por mensagem nos caminhos quentes. Por exemplo, o processor do operador só lê o idioma quando a janela está fechada.

### 4. Resumo do bot: idioma lido uma vez por turno, passado ao motor do fluxo
- **Decisão:**
  - `bitrix-bot-event.processor.ts` resolve o idioma da instalação e o entrega a `runBotTurn`.
  - `runBotTurn` repassa o idioma a `advance`, que o repassa a `buildHandoffSummary`.
  - Só o título e o texto de "não respondeu nada" vêm do catálogo.
- **Por quê:** o resumo nasce dentro do motor do fluxo, que é puro e não acessa infraestrutura. Uma leitura por turno, por chave única, é aceitável e mantém o motor sem porta nova.
- **Alternativa descartada:** devolver o resumo como efeito estruturado e renderizar o texto fora do motor. É mais invasivo e muda o contrato dos efeitos só por causa de duas strings.

### 5. Prefixo do histórico passado por parâmetro ao cliente Bitrix
- **Decisão:** `BitrixClient.sendToOpenChannel` (shared) recebe o prefixo pronto, num parâmetro opcional cujo padrão é o texto atual em português. `ensure-widget-open-channel-conversation.ts` resolve o idioma pelo job e passa o prefixo traduzido e os marcadores de anexo (`resolveOpenChannelText(…, locale)`).
- **Por quê:** o cliente Bitrix é compartilhado entre apps e não deve conhecer idioma de instalação do ThinkZap. Com o padrão, os outros chamadores não mudam.

### 6. O rótulo "Template" segue sendo "Template"
- **Decisão:** na confirmação de envio do outbox, o rótulo é traduzido, mas "Template" é a mesma palavra nos três idiomas. A linha continua existindo em todos.
- **Por quê:** o código avisa que é por essa linha que o cliente concilia o que a Meta cobrou ("não remover"). Manter a mesma forma reduz o risco para quem filtra por ela.

## Risks / Trade-offs

- **[Instalação com usuários em idiomas diferentes]** → Vale a última escolha no menu para todos. Já é a regra do limite diário. Os avisos são da instalação, não de uma pessoa.
- **[Instalação que já usava inglês antes do deploy do idioma]** → Ela só passa a receber avisos traduzidos depois de alguém trocar o idioma de novo, porque o idioma só é gravado na troca explícita. Comunicar no release.
- **[Texto traduzido sem revisão nativa]** → en e es serão escritos pelo time. Pedir revisão antes do release, sobretudo das variantes da Meta, que têm termos do produto.
- **[Leitura extra do banco em caminho de aviso]** → Uma consulta por chave única, só quando o aviso vai ser postado. No resumo do bot, uma por turno. Se aparecer em métricas, cachear por instalação com TTL curto.
- **[Comentários antigos ficam em português]** → Esperado: a tradução vale para avisos novos.

## Migration Plan

- Sem migration: usa `core_apps.locale`, criada em `limite-diario-mensagens-linha`.
- Pode ir para produção junto com aquela change, ou logo depois dela.
- Rollback: reverter o deploy. Os avisos voltam a sair em português, e nenhum dado é alterado.

## Open Questions

- Quem revisa os textos em inglês e espanhol antes do release. Não muda o desenho.
