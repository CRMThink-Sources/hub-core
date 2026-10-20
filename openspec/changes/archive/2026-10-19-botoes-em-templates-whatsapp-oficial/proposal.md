# Proposal

## Why

Os templates do WhatsApp Oficial (HubMessage) só podem ser criados com corpo e rodapé, e o envio monta apenas o componente `BODY`. Sem botões, o cliente não consegue usar o recurso mais comum de templates de marketing e utilidade — resposta rápida, link, ligação e cupom — e um template com URL dinâmica aprovado direto na Meta não tem como receber o valor do link no envio.

## What Changes

- O formulário de criação de template da linha oficial passa a aceitar botões: **resposta rápida**, **link (URL fixa ou com variável no final)**, **ligação (telefone)** e **copiar código (cupom)**, respeitando os limites da Meta, e envia o componente `BUTTONS` para o HubMessage.
- A lista de templates da linha passa a mostrar os botões de cada template.
- O catálogo de templates enviado ao widget e à tela do robô passa a informar os botões, indicando quais pedem valor no envio (URL dinâmica e código de cupom).
- O widget do CRM mostra os botões no preview e pede um campo por botão dinâmico; o envio só é liberado com todos preenchidos.
- O robô de template do Bitrix24 ganha uma propriedade para os valores dos botões dinâmicos (valor fixo ou campo do documento), e a tela de configuração mostra os botões no preview.
- O envio ao HubMessage passa a incluir um componente `BUTTON` por botão dinâmico, com o índice do botão no template. Os valores ficam gravados na fila de envio junto com os do corpo.
- A campanha SMS do Bitrix recusa template que tenha botão dinâmico, porque o formato da campanha não tem como carregar esses valores. Templates com botões só estáticos continuam funcionando na campanha.
- Clique em resposta rápida de template não ganha tratamento novo: chega ao chat como mensagem do contato.

## Capabilities

### New Capabilities
- `thinkzap/botoes-template-oficial`: criação de templates com botões na linha oficial, exibição dos botões, preenchimento dos valores dos botões dinâmicos no widget e no robô, montagem do envio e restrição na campanha SMS.

### Modified Capabilities
<!-- Nenhuma. `thinkzap/envio-botoes` cobre botões de sessão (mensagem interativa) e seus limites, que não mudam. -->

## Impact

- **API** (`api/src/modules/thinkzap`): tipos do HubMessage (`hubmessage.types.ts`), port `template-message-sender.port.ts`, adapter `hubmessage-template-sender.adapter.ts`, `list-widget-templates.ts`, `create-connector-template.ts` + zod do `create-template.controller.ts`, `send-widget-template.controller.ts`, `enqueue-template-send.service.ts`, `dispatch-widget-outbox-message.ts`, robô de template (`build-template-robot-params.ts`, `bitrix-template-robot-webhook-handler.controller.ts`), `bitrix-sms-provider-webhook-handler.controller.ts`, catálogo de erros.
- **Banco**: nova coluna JSON na `core_thinkerszap_widget_outbox` para os valores dos botões (migration Prisma).
- **Front**: `template-form.tsx`, `templates-lista.tsx`, `use-connector-templates.ts`, `use-widget-templates.ts`, `template-composer.tsx`, `template-variables.ts`, `conversation-view.tsx`, robô (`template-robot-form.tsx`, `robot-config.ts`), traduções em `front/messages/{pt,en,es}/thinkzap/configuracoes/templates.json`.
- **Bitrix24**: a definição do robô de template muda (nova propriedade); portais existentes recebem a atualização pelo `bizproc.robot.update` já feito em `EnsureTemplateRobot`.
- **HubMessage**: depende do repasse do formato de botões da Meta Cloud API, que a documentação do HubMessage não detalha para o envio — precisa ser confirmado com chamada real.
