# Proposal

## Why

Nos conectores oficiais (HubMessage), o formulário de template do ThinkZap só aceita corpo, rodapé e botões. A Meta permite um cabeçalho com imagem (`HEADER` com `format: IMAGE`), que é o formato mais usado em campanhas de marketing. Hoje o cliente precisa criar esse template direto na Meta. E, quando cria, o template aprovado aparece no widget e no robô, mas o envio falha porque o ThinkZap não manda a imagem que a Meta exige em cada envio.

Com o cabeçalho de imagem disponível, um cliente relatou o passo seguinte: quer escolher o template e enviar a imagem cadastrada nele, sem precisar escolher uma imagem a cada envio. A Meta não guarda uma imagem fixa para o template — a imagem cadastrada é só a amostra da aprovação, e a de cada envio tem que ir no `HEADER`. Então o ThinkZap precisa guardar uma **imagem padrão do envio** por template.

Além disso, o template não pode ser corrigido depois de criado (um template rejeitado precisa ser recriado com outro nome) e a aba de templates é uma lista simples, sem busca, filtro nem ações, destoando de um SaaS moderno.

## What Changes

- O formulário de criação de template da linha oficial ganha um **cabeçalho opcional com imagem**: o operador **envia o arquivo** da imagem de exemplo (JPEG/PNG, até 5 MB) **ou informa um link público**. A Meta usa essa imagem na aprovação.
- A API de criação aceita e valida o componente `HEADER` de imagem e o entrega ao provedor. A HubMessage agora é a **Z-API Omni** (`developer.omni.z-api.io`). Com o bucket R2 configurado, o arquivo é gravado no bucket e segue como link; sem o bucket, vai pela rota de upload da Omni (`POST /whatsapp/businesses/{wabaId}/templates/media`), que exige App ID e App Secret da Meta cadastrados na conta. Link vai direto em `example.header_handle`, que a Omni converte no identificador da Meta.
- **Imagem padrão do envio por template**: a imagem de exemplo usada na criação passa a ser a imagem padrão do envio desse template, guardada pelo ThinkZap sem expiração. A lista de templates ganha a ação "Imagem padrão do envio" para definir ou trocar essa imagem (arquivo ou link), inclusive em templates criados direto na Meta e trazidos pela sincronização.
- A lista de templates mostra que o template tem cabeçalho com imagem, inclusive nos templates sincronizados da Meta.
- O catálogo de envio (widget e robô) informa quando o template tem cabeçalho com imagem e qual é a imagem padrão dele, se houver.
- **Widget do CRM**: ao escolher um template com imagem, a imagem padrão já vem preenchida e o operador pode enviar direto ou trocar por outra imagem (arquivo ou link). O envio só fica bloqueado quando o template não tem imagem padrão e nenhuma imagem foi informada.
- **Robô de template do Bitrix24**: nova propriedade, opcional, com a URL da imagem do cabeçalho (valor fixo ou campo do documento). Vazia, o robô usa a imagem padrão do template.
- O envio à HubMessage inclui o componente `HEADER` com a imagem. A URL que valeu no envio fica gravada na fila para reenvios e reprocessamentos.
- **Edição de template**: templates aprovados, rejeitados ou pausados podem ser editados pelo mesmo formulário da criação, pela rota `PUT /whatsapp/businesses/{wabaId}/templates/{templateId}` da Omni. Nome e idioma não mudam, e a categoria não muda em template já aprovado. O operador é avisado de que o template volta para análise da Meta e fica indisponível para envio até ser aprovado de novo.
- **Aba de templates no estilo SaaS moderno**: cabeçalho com contagem e ações, busca, filtros por status e categoria, cards com miniatura da imagem e selo de status, menu de ações por template (editar, imagem padrão, detalhes), estado vazio com chamada para criar, carregamento em esqueleto e formulário de criação/edição em duas colunas com preview estilo WhatsApp fixo ao lado.
- A **campanha SMS** recusa template com cabeçalho de imagem, como já faz com botão dinâmico.
- Fica de fora: excluir template, vídeo, documento, cabeçalho de texto com variável e upload de arquivo no robô (no robô a imagem vai por URL ou pela imagem padrão).

## Capabilities

### New Capabilities
- `thinkzap/imagem-template-oficial`: criação de template oficial com cabeçalho de imagem, imagem padrão do envio por template e envio desse template pelo widget, pelo robô e pela fila, mais a recusa na campanha SMS.
- `thinkzap/gestao-templates-oficial`: aba de templates da linha oficial (busca, filtros, cards, ações, estados e preview) e edição de templates.

### Modified Capabilities
<!-- Nenhuma: `thinkzap/botoes-template-oficial` continua igual. O cabeçalho entra ao lado dos botões, sem mudar nenhuma regra de botão, e a aba nova continua mostrando os botões de cada template. -->

## Impact

- **API** (`api/src/modules/thinkzap`): `create-template.controller.ts` (schema do `HEADER` e multipart com o arquivo), `create-connector-template.ts` (validação do link e do arquivo, gravação da imagem padrão), `hubmessage-template-provider.ts` e `hubmessage.client.ts` (link em `header_handle`, rota de upload `templates/media` e rota `PUT` de edição), `whatsapp-template-provider.port.ts` (`updateTemplate`), novos use case e controller de edição e de imagem padrão, `list-widget-templates.ts` e `template-buttons.ts` (catálogo), `send-widget-template.controller.ts` / `send-widget-template.types.ts`, `enqueue-template-send.service.ts`, `dispatch-widget-outbox-message.ts`, `template-message-sender.port.ts`, `hubmessage-template-sender.adapter.ts` e `hubmessage.types.ts` (componente `HEADER` no envio), `build-template-robot-params.ts` e `bitrix-template-robot-webhook-handler.controller.ts` (nova propriedade do robô e fallback para a imagem padrão), `manage-line-sms-provider.ts` e o handler da campanha SMS (recusa), `template-image-storage.port.ts` e `r2-template-image-storage.adapter.ts` (prefixo sem expiração), catálogo de erros e runbooks.
- **Banco**: nova coluna anulável na fila de envio (`core_thinkerszap_widget_outbox.template_header_image_url`) e nova tabela `core_thinkerszap_template_defaults` (imagem padrão por linha, nome e idioma do template). As migrations são aditivas.
- **Armazenamento**: prefixo novo `template-defaults/` no bucket R2, sem expiração. A regra de ciclo de vida de 30 dias precisa estar restrita ao prefixo `template-headers/`.
- **Front**: `templates-tab.tsx`, `templates-lista.tsx` e componentes novos da aba (filtros, card, menu de ações, diálogo de imagem padrão, preview), `template-form.tsx` (cabeçalho, arquivo ou link, modo edição), `use-connector-templates.ts` (multipart, edição, imagem padrão), `template-composer.tsx` e `conversation-view.tsx` (widget), `template-robot-form.tsx` e `robot-config.ts` (robô), `templates-campanha.tsx` (aviso da campanha) e as traduções.
- **Robôs já instalados** precisam ser reinstalados (re-registro) para ganhar a nova propriedade. Robôs antigos continuam funcionando com templates sem imagem e, com template de imagem, usam a imagem padrão.
- **Externo**: depende de a Meta conseguir baixar a URL pública da imagem, tanto na criação (amostra) quanto no envio. O upload pela Omni (sem bucket) depende de App ID/App Secret da Meta cadastrados no painel da Omni. A edição segue as regras da Meta (estados editáveis e limite de edições), que a doc da Omni não descreve e precisam ser confirmadas numa WABA de teste.
