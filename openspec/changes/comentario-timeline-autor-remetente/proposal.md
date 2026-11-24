# Proposal

## Why

Quando o operador envia uma mensagem pelo widget (texto, anexo, template, botões) ou quando um robô do Bizproc dispara, o servidor registra o envio como comentário na timeline do CRM. Hoje esse comentário é publicado com o token da instalação do app, então aparece com a foto e o nome de **quem instalou** o ThinkZap, e não de quem realmente enviou. Isso confunde o histórico do negócio/contato (parece que o administrador falou com o cliente) e o texto, em linhas soltas (`De:`, `Para:`, `Mensagem:`), é difícil de ler.

## What Changes

- O comentário de timeline de envio (widget e robôs Bizproc) passa a ser publicado **em nome de quem enviou**: o operador que clicou em enviar no widget, e o usuário em cujo contexto o robô rodou. A publicação usa o token OAuth desse usuário (o mesmo mecanismo `ThinkzapOperatorOAuth` já usado no espelhamento de mensagens).
- Se não houver token utilizável para o remetente (nunca autorizou o app, refresh falhou, execução sem usuário), o comentário **continua sendo publicado como hoje** (token da instalação) e o remetente é identificado no corpo do texto. Nunca deixa de publicar por causa disso.
- O widget grava o remetente na row do outbox (`operatorBitrixUserId` já existe) e o worker usa esse dado para publicar, pois o comentário de envio pela fila é publicado fora da request.
- Layout do comentário melhorado, em BBCode nativo do Bitrix: título com o tipo do envio, destinatário/linha em destaque, a mensagem separada e citada, template e arquivos em linhas próprias. Vale para os três idiomas (pt, en, es) e para sucesso e falha (envio, template, botões, robôs, aviso de limite).
- Sem mudança de comportamento no envio ao contato, nas filas, nem na idempotência do comentário (`crm.timeline.comment.add` segue sem ser retentado).

## Capabilities

### New Capabilities
- `thinkzap/comentario-timeline-envio`: autoria e formato do comentário que o servidor publica na timeline do CRM quando uma mensagem é enviada pelo widget ou por robô do Bizproc.

### Modified Capabilities
<!-- Nenhuma: os requisitos existentes (idioma, limite diário, arquivos do robô) mantêm o conteúdo; muda só a apresentação e o autor. -->

## Impact

- API, `modules/thinkzap`: `shared/application/send-bitrix-notificatio.service.ts` (aceitar autor), `shared/data/contracts/send-notification.ts`, `domain/notices/timeline-notices.ts` (+ testes por idioma), `application/send-widget-message.use-case.ts`, `application/notify-widget-send-outcome.ts`, `workers/thinkzap-widget-send.processor.ts`, os quatro controllers de robô (`bitrix-robot`, `bitrix-template-robot`, `bitrix-button-robot`) e seus `make-*` de wiring.
- Reaproveita `ResolveOperatorBitrixAccessToken` e `BitrixClient.withUserToken`. Sem migration, sem env nova.
- Risco: o comentário feito com token de usuário depende de permissão do usuário na entidade; erro de acesso cai no fallback.
- Front: nenhuma mudança (o texto é gerado no servidor).
