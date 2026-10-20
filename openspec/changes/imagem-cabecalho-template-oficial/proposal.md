# Proposal

## Why

Nos conectores oficiais (HubMessage), o formulário de template do ThinkZap só aceita corpo, rodapé e botões. A Meta permite um cabeçalho com imagem (`HEADER` com `format: IMAGE`), que é o formato mais usado em campanhas de marketing. Hoje o cliente precisa criar esse template direto na Meta. E, quando cria, o template aprovado aparece no widget e no robô, mas o envio falha porque o ThinkZap não manda a imagem que a Meta exige em cada envio.

## What Changes

- O formulário de criação de template da linha oficial ganha um **cabeçalho opcional com imagem**: o operador **envia o arquivo** da imagem de exemplo (JPEG/PNG, até 5 MB) **ou informa um link público**. A Meta usa essa imagem na aprovação.
- A API de criação aceita e valida o componente `HEADER` de imagem e o entrega ao provedor. A HubMessage agora é a **Z-API Omni** (`developer.omni.z-api.io`). Arquivo vai pela rota de upload (`POST /whatsapp/businesses/{wabaId}/templates/media`), que devolve o identificador usado em `example.header_handle`; ela exige App ID e App Secret da Meta cadastrados na conta. Link vai direto em `example.header_handle`, que a Omni converte no identificador da Meta. Nada é guardado no ThinkZap.
- A lista de templates mostra que o template tem cabeçalho com imagem, inclusive nos templates sincronizados da Meta.
- O catálogo de envio (widget e robô) informa quando o template tem cabeçalho com imagem.
- **Widget do CRM**: ao escolher um template com imagem, o operador informa a URL pública da imagem que vai no envio. O envio fica bloqueado sem ela.
- **Robô de template do Bitrix24**: nova propriedade com a URL da imagem do cabeçalho, com valor fixo ou campo do documento.
- O envio à HubMessage inclui o componente `HEADER` com a imagem. A URL fica gravada na fila de envio para reenvios e reprocessamentos.
- A **campanha SMS** recusa template com cabeçalho de imagem, como já faz com botão dinâmico.
- Fica de fora: vídeo, documento, cabeçalho de texto com variável e upload de arquivo no widget e no robô (a imagem do envio vai sempre por URL pública).

## Capabilities

### New Capabilities
- `thinkzap/imagem-template-oficial`: criação de template oficial com cabeçalho de imagem e envio desse template pelo widget, pelo robô e pela fila, mais a recusa na campanha SMS.

### Modified Capabilities
<!-- Nenhuma: `thinkzap/botoes-template-oficial` continua igual. O cabeçalho entra ao lado dos botões, sem mudar nenhuma regra de botão. -->

## Impact

- **API** (`api/src/modules/thinkzap`): `create-template.controller.ts` (schema do `HEADER` e multipart com o arquivo), `create-connector-template.ts` (validação do link e do arquivo), `hubmessage-template-provider.ts` e `hubmessage.client.ts` (link em `header_handle` e a rota de upload `templates/media`), `list-widget-templates.ts` e `template-buttons.ts` (catálogo), `send-widget-template.controller.ts` / `send-widget-template.types.ts`, `enqueue-template-send.service.ts`, `dispatch-widget-outbox-message.ts`, `template-message-sender.port.ts`, `hubmessage-template-sender.adapter.ts` e `hubmessage.types.ts` (componente `HEADER` no envio), `build-template-robot-params.ts` e `bitrix-template-robot-webhook-handler.controller.ts` (nova propriedade do robô), `manage-line-sms-provider.ts` e o handler da campanha SMS (recusa).
- **Banco**: nova coluna anulável na fila de envio (`core_thinkerszap_widget_outbox`) para a URL da imagem do cabeçalho. A migration é aditiva.
- **Front**: `template-form.tsx` (cabeçalho, arquivo ou link), `use-connector-templates.ts` (multipart), lista de templates, `template-composer.tsx` e `conversation-view.tsx` (widget), `template-robot-form.tsx` e `robot-config.ts` (robô), `templates-campanha.tsx` (aviso da campanha) e as traduções.
- **Robôs já instalados** precisam ser reinstalados (re-registro) para ganhar a nova propriedade. Robôs antigos continuam funcionando com templates sem imagem.
- **Externo**: depende de a Meta conseguir baixar a URL pública da imagem, tanto na criação (amostra) quanto no envio. O upload de arquivo depende de App ID/App Secret da Meta cadastrados no painel da Omni. Falta confirmar com um envio real se a conversão do link na criação também exige essas credenciais.
