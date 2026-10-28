# Tasks

## 1. Confirmação na Z-API Omni (D1 e D3)

- [ ] 1.1 Numa WABA de teste, criar um template de Marketing com `HEADER` `format: IMAGE` e `example.header_handle: ["<url https pública>"]`, como documentado em `developer.omni.z-api.io/templates/validation`. Testar também o upload por `POST /whatsapp/businesses/{wabaId}/templates/media` (em 2026-10-20 respondia `405`: rota documentada mas não publicada; com o bucket R2 o arquivo segue pelo link e não depende dela) e criar outro template com o `h` devolvido, registrando se a conta tem App ID/App Secret cadastrados (sem eles vem `MISSING_APP_CREDENTIALS`). Registrar também se `api.hubmessage.io` e `api.omni.z-api.io` respondem igual. Verificação: as respostas ficam anotadas no PR.
- [ ] 1.2 Com o template aprovado, enviar por `POST /v1/channels/{channelId}/messages` com `{ type: 'HEADER', parameters: [{ type: 'image', image: { link } }] }`. Se for recusado, testar `header` em minúsculo, como no exemplo da doc nova. Verificação: mensagem recebida no aparelho de teste, com a imagem.
- [ ] 1.3 Registrar o formato confirmado de criação e de envio no JSDoc de `CreateTemplateParams` e `HubMessageTemplateSendComponent` em `hubmessage.types.ts`, com o link da doc da Omni. Verificação: JSDoc atualizado no diff.
- [ ] 1.4 Na WABA de teste, editar por `PUT /whatsapp/businesses/{wabaId}/templates/{templateId}` um template rejeitado e um aprovado (corpo e imagem de exemplo). Registrar: a resposta, a volta para `PENDING`, a recusa ao editar um template pendente, ao trocar a categoria de um aprovado e ao editar o mesmo aprovado duas vezes em 24 h, com os códigos de erro de cada caso. Verificação: respostas anotadas no PR e no JSDoc de `HubMessageClient.updateTemplate`.
- [ ] 1.5 Conferir no painel do R2 a regra de ciclo de vida de 30 dias e restringi-la ao prefixo `template-headers/`, para não apagar `template-defaults/`. Verificação: print ou export da regra anexado ao PR.

## 2. Domínio: leitura do cabeçalho

- [x] 2.1 Criar `domain/template-header.ts` com `templateHeaderOf(components)` → `NONE | TEXT | IMAGE | UNSUPPORTED` (texto com `{{` = `UNSUPPORTED`) e o tipo neutro do componente de criação `{ type: 'HEADER', format: 'IMAGE', example: { imageUrl } }`. Verificação: `template-header.test.ts` cobre os cinco casos, incluindo vídeo, documento e texto com variável.
- [x] 2.2 Adicionar `validateTemplateHeader(components, category)` (no máximo um `HEADER`, só `IMAGE`, `imageUrl` `https`, proibido em `AUTHENTICATION`) com códigos de violação, no padrão de `validateTemplateButtons`. Verificação: testes de cada código.

## 3. Criação de template (API)

- [x] 3.1 Em `create-template.controller.ts`, aceitar o componente de cabeçalho de imagem no schema zod (`format: 'IMAGE'`, `example.imageUrl`). Verificação: teste do controller que aceita o cabeçalho válido e devolve 400 com cabeçalho `VIDEO`.
- [x] 3.2 Em `CreateConnectorTemplateUseCase.validate`, chamar `validateTemplateHeader` e mapear as mensagens em pt-br para `InvalidTemplateError`. Verificação: `create-connector-template.test.ts` cobre cabeçalho em Autenticação, dois cabeçalhos e exemplo sem `https`, sem chamar o provider.
- [x] 3.3 Criar o download validado da imagem de exemplo (port no domínio, adapter axios na infra): só `https`, recusa dos domínios do CDN da Meta (`whatsapp.net`, `fbcdn.net`, `fbsbx.com`), recusa de IP privado ou de loopback, timeout curto, `maxContentLength` de 5 MB, `Content-Type` `image/jpeg` ou `image/png`. Chamar no use case antes do provider. Verificação: testes do adapter com mock para imagem válida, 8 MB, `text/html`, link `scontent.whatsapp.net` e host privado.
- [x] 3.4 Em `HubMessageTemplateProvider.createTemplate`, traduzir o cabeçalho neutro com link para `example.header_handle: [imageUrl]` (o caminho do arquivo é a tarefa 3.8). Verificação: `hubmessage-template-provider.test.ts` confere o payload enviado ao client.
- [x] 3.5 Registrar no catálogo de erros o código novo `thinkzap.template.header_image_invalid` (o de credenciais é a tarefa 3.9), com runbook em `mcp/kb/runbooks/hubcore/thinkzap/template/`. Mapear também as recusas `2388215` e `380` da Meta para mensagens legíveis. Verificação: o teste do catálogo de erros passa e os runbooks existem.
- [x] 3.6 Em `create-template.controller.ts`, aceitar multipart (`payload` JSON + arquivo `headerImage`, multer em memória com limite de 5 MB) mantendo o pedido JSON atual. `validateTemplateHeader` passa a aceitar cabeçalho sem `imageUrl` quando há arquivo e exige exatamente uma fonte. Verificação: testes do controller com arquivo, com arquivo + URL (400) e JSON como antes.
- [x] 3.7 Validar o arquivo no use case, antes do provider: JPEG/PNG pela assinatura (`FF D8 FF` / `89 50 4E 47`) e no máximo 5 MB, mapeando para `InvalidTemplateHeaderImageError`. Verificação: testes com PNG, PDF renomeado para `.png` e 6 MB.
- [x] 3.8 Adicionar `uploadTemplateMedia(wabaId, file, type)` no `HubMessageClient` (multipart) e, em `HubMessageTemplateProvider.createTemplate`, usar o `h` em `example.header_handle` quando houver arquivo, mantendo o link nos demais casos. Verificação: `hubmessage-template-provider.test.ts` confere o upload e o `header_handle: [h]`.
- [x] 3.9 Mapear o `422 MISSING_APP_CREDENTIALS` do upload para `thinkzap.template.header_image_app_credentials_missing`, com runbook e mensagem que sugere usar o link. Verificação: teste do catálogo e teste do controller.
- [x] 3.10 Com o bucket R2 configurado, gravar o arquivo da imagem de exemplo no bucket (depois das recusas de linha) e criar o template pelo caminho do link; sem o bucket, manter o upload da Omni e traduzir o `404`/`405` da rota `templates/media` em mensagem pedindo o link. Bucket fora do ar vira `503` sugerindo o link. Verificação: testes do use case (arquivo vira `example.imageUrl`, linha recusada não grava, bucket fora do ar não chama o provider) e do controller (`503` e `405`).

## 4. Criação de template (front)

- [x] 4.1 Em `template-form.tsx`, adicionar a seção de cabeçalho (nenhum / imagem), com campo de URL de exemplo, dica de proporção 1.91:1 e de que o link precisa ser direto para o arquivo, preview da imagem acima do corpo e remoção ao trocar para Autenticação. Verificação: teste do form (ou manual em dev) cobrindo exemplo vazio, `http://` e troca de categoria.
- [x] 4.2 Montar o componente `HEADER` neutro no envio do form, antes do `BODY`. Verificação: teste do builder de componentes, ou checagem do request no navegador.
- [x] 4.3 Na lista de templates da linha, mostrar um indicador "Imagem" para templates com `templateHeaderOf === 'IMAGE'`. Verificação: template sincronizado com imagem aparece marcado em dev.
- [x] 4.4 Adicionar as chaves de tradução (pt-br, en, es) do cabeçalho, dos erros e do indicador. Verificação: o lint/teste de chaves de i18n passa.
- [x] 4.5 Em `template-form.tsx`, oferecer "Enviar arquivo" / "Usar link" para a imagem de exemplo, com checagem de tipo e tamanho no cliente, preview por object URL e envio multipart em `useCreateTemplate` quando houver arquivo. Verificação: teste do helper de validação do arquivo e checagem manual em dev.
- [x] 4.6 Adicionar as chaves de tradução (pt-br, en, es) do upload e do erro de credenciais. Verificação: lint e `tsc` do front sem erro.

## 5. Catálogo de envio

- [x] 5.1 Em `list-widget-templates.ts`, adicionar `header: { type }` em `WidgetTemplate` e filtrar `UNSUPPORTED`. Verificação: `list-widget-templates.test.ts` cobre imagem oferecida, vídeo filtrado e texto com variável filtrado.
- [x] 5.2 Atualizar o tipo `WidgetTemplate` em `front/app/hooks/use-widget-templates.ts`. Verificação: `tsc` do front sem erro.

## 6. Envio: domínio, fila e adapter

- [x] 6.1 Adicionar `headerImageUrl?: string` em `TemplateMessageDescriptor` e `SendWidgetTemplateInput`. Verificação: `tsc` da API sem erro.
- [x] 6.2 Criar a migration Prisma com `template_header_image_url TEXT NULL` em `core_thinkerszap_widget_outbox`, gravar o valor em `EnqueueTemplateSendService.enqueue` / `PrismaWidgetOutboxRepository.create` e ler em `templateDescriptorOf`. Verificação: os testes de `enqueue-widget-template.use-case.test.ts` e `dispatch-widget-outbox-message.test.ts` confirmam que a URL vai e volta pela row, inclusive no reprocessamento.
- [x] 6.3 Em `hubmessage-template-sender.adapter.ts`, montar o componente `HEADER` de imagem (formato da tarefa 1.2) antes do `BODY`, e adicionar o tipo em `HubMessageTemplateSendComponent`. Verificação: `hubmessage-template-sender.adapter.test.ts` confere a ordem `HEADER`, `BODY`, `BUTTON` e o envio sem imagem igual ao atual.

## 7. Widget do CRM

- [x] 7.1 Em `send-widget-template.controller.ts`, aceitar `headerImageUrl` opcional (`https`) e repassar. Verificação: teste do controller com URL válida e 400 com `http://`.
- [x] 7.2 Em `template-composer.tsx` / `conversation-view.tsx`, exibir o campo de URL e o preview quando `header.type === 'IMAGE'`, e desabilitar o envio sem URL `https`. Verificação: teste de `template-variables.ts` (ou do helper de "pode enviar") cobre o bloqueio, e envio manual em dev chega com a imagem.

## 8. Robô de template do Bitrix24

- [x] 8.1 Adicionar a propriedade `templateHeaderImageUrl` em `build-template-robot-params.ts`. Verificação: `build-template-robot-params.test.ts` atualizado.
- [x] 8.2 No handler `bitrix-template-robot-webhook-handler.controller.ts`, resolver a URL (valor fixo ou campo do documento) e, se o template for `IMAGE` e a URL estiver vazia ou não for `https`, registrar o aviso novo `templateRobot.missingHeaderImage` (pt-br, en, es em `timeline-notices.ts`) sem enfileirar. Verificação: testes do handler para URL do negócio, campo vazio e robô antigo sem a propriedade com template sem imagem.
- [x] 8.3 Em `robot-config.ts` e `template-robot-form.tsx`, adicionar o campo de imagem (fixo ou campo do documento), o preview e o bloqueio de salvar sem valor. Verificação: testes de `robot-config` cobrem salvar/ler a propriedade e a validação.

## 9. Campanha SMS

- [x] 9.1 Em `manage-line-sms-provider.ts`, adicionar `hasImageHeader` e, no handler da campanha, recusar template com imagem pelo mesmo caminho do botão dinâmico, com um código de motivo novo no catálogo de erros e um runbook. Verificação: `bitrix-sms-provider-webhook-handler.controller.test.ts` ganha "recusa template com cabeçalho de imagem, sem enfileirar".
- [x] 9.2 Em `templates-campanha.tsx`, sinalizar templates com imagem como indisponíveis para a campanha, como já é feito com botão dinâmico. Verificação: `manage-line-sms-provider.test.ts` cobre a flag, e a tela mostra o aviso em dev.

## 10. Integração

- [ ] 10.1 Em staging, de ponta a ponta: criar um template com imagem por arquivo e outro por link pelo ThinkZap, aguardar a aprovação, sincronizar, enviar pelo widget com a imagem padrão e com uma imagem trocada, enviar pelo robô com o campo vazio (imagem padrão) e com URL vinda de um campo do negócio, definir a imagem padrão de um template criado direto na Meta, editar um template rejeitado e um aprovado, e conferir a imagem no aparelho e o histórico no CRM. Verificação: checklist anexado ao PR.
- [ ] 10.2 Rodar `yarn lint`, `yarn test` e `tsc` na API e no front. Verificação: tudo verde.

## 11. Imagem padrão do envio (D8 e D9)

- [x] 11.1 Migration Prisma com a tabela `core_thinkerszap_template_defaults` (`domain_id`, `item_id`, `template_name`, `language`, `header_image_url`, `updated_at`, única em `domain_id, item_id, template_name, language`), port `TemplateDefaultsRepository` (`find`, `findMany`, `upsert`) e adapter Prisma. Verificação: teste do repository cobre upsert (cria e substitui) e `findMany` por linha.
- [x] 11.2 Em `TemplateImageStorage.store`, aceitar `retention: 'temporary' | 'permanent'`; `permanent` grava em `template-defaults/<domainId>/<uuid>.<ext>`. O widget continua usando `temporary`. Verificação: `r2-template-image-storage.adapter.test.ts` confere as duas chaves.
- [x] 11.3 Em `CreateConnectorTemplateUseCase`, depois que o provider aceita o template com cabeçalho de imagem, gravar a imagem padrão (link informado, ou arquivo gravado como `permanent`). Falha ao gravar só gera log. Verificação: testes do use case para link, arquivo, falha do repository sem desfazer a criação e template sem imagem sem gravar nada.
- [x] 11.4 Criar `SetTemplateDefaultImageUseCase` e o controller `PUT /lines/:itemId/templates/:name/:language/default-image` (JSON `imageUrl` ou multipart `image`), com as travas da amostra (D2 e 3.7) e recusa para template sem cabeçalho de imagem ou inexistente na linha. Verificação: testes do use case e do controller cobrem link válido, link do CDN da Meta, arquivo PDF renomeado, template sem imagem e bucket fora do ar (`503`).
- [x] 11.5 Devolver `defaultImageUrl` em cada template com imagem na listagem da configuração (`GET /lines/:itemId/templates` e `/sync`) e em `WidgetTemplate.header` (`list-widget-templates.ts`), juntando com `findMany` da linha. Atualizar os tipos do front (`use-connector-templates.ts`, `use-widget-templates.ts`). Verificação: testes de `list-widget-templates.test.ts` e da listagem cobrem template com e sem imagem padrão; `tsc` do front sem erro.
- [x] 11.6 Widget (`template-composer.tsx` / `conversation-view.tsx`): pré-preencher o preview com `defaultImageUrl`, liberar o envio com ela e enviar `headerImageUrl` explícito; permitir trocar por arquivo ou link só naquele envio; bloquear só sem imagem padrão e sem imagem informada. Verificação: teste do helper de "pode enviar" cobre os três casos, e envio manual em dev chega com a imagem padrão.
- [x] 11.7 Robô: no handler `bitrix-template-robot-webhook-handler.controller.ts`, usar a imagem padrão quando a URL resolvida vier vazia, e só registrar `templateRobot.missingHeaderImage` sem nenhuma das duas. Em `robot-config.ts` / `template-robot-form.tsx`, tornar o campo opcional quando o template tem imagem padrão e mostrar a padrão no preview. Verificação: testes do handler (campo vazio com padrão, campo vazio sem padrão, robô antigo sem a propriedade com template de imagem) e de `robot-config`.

## 12. Edição de template (D10)

- [x] 12.1 Adicionar `updateTemplate` no `HubMessageClient` (`PUT /whatsapp/businesses/{wabaId}/templates/{templateId}`), no port `WhatsAppTemplateProvider` (`UpdateTemplateInput`) e no `HubMessageTemplateProvider`, com a mesma tradução de cabeçalho da criação. Verificação: `hubmessage-template-provider.test.ts` confere o payload com link e com arquivo.
- [x] 12.2 Extrair a validação de `CreateConnectorTemplateUseCase` para uma função compartilhada e criar `UpdateConnectorTemplateUseCase`, com as recusas de template inexistente, status não editável, nome/idioma alterados e categoria alterada em aprovado, a amostra vinda da imagem padrão quando a imagem não muda, e a gravação da nova imagem padrão quando muda. Verificação: testes do use case para cada recusa (sem chamar o provider), edição de rejeitado, edição mantendo a imagem padrão e edição sem imagem padrão nem imagem nova.
- [x] 12.3 Controller `PUT /lines/:itemId/templates/:templateId` (JSON ou multipart, como a criação) e rota em `routes.ts`. Verificação: teste do controller com JSON, multipart e `400` de validação.
- [x] 12.4 Registrar no catálogo de erros `thinkzap.template.edit_limit_reached` e `thinkzap.template.not_editable`, com runbooks em `mcp/kb/runbooks/hubcore/thinkzap/template/`, mapeando as recusas da Meta confirmadas na tarefa 1.4. Verificação: teste do catálogo e runbooks existentes.
- [x] 12.5 Em `template-form.tsx`, adicionar `mode: 'create' | 'edit'` e `initial`: campos pré-preenchidos, nome e idioma desabilitados, categoria desabilitada em aprovado, aviso de nova análise, imagem atual vinda da imagem padrão e exigência de imagem nova sem padrão. `useUpdateTemplate` em `use-connector-templates.ts`. Verificação: teste do helper que monta o estado inicial a partir do template e checagem manual em dev.
- [x] 12.6 Adicionar as chaves de tradução (pt-br, en, es) da edição e dos erros novos. Verificação: lint e `tsc` do front sem erro.

## 13. Aba de templates (D11)

- [x] 13.1 Criar `template-preview.tsx` (bolha estilo WhatsApp com cabeçalho de imagem, corpo com variáveis destacadas, rodapé e botões) e usá-lo no formulário, em duas colunas em telas largas, com os campos em seções. Verificação: teste do helper que destaca as variáveis e checagem visual no navegador.
- [x] 13.2 Criar `templates-toolbar.tsx` com busca (nome e corpo), filtros por status, categoria e "com imagem", contagem de resultados e "limpar filtros", com a filtragem num helper puro. Verificação: teste do helper de filtragem cobre busca, filtros combinados e lista vazia.
- [x] 13.3 Criar `template-card.tsx` (miniatura da imagem padrão ou aviso de imagem faltando, selo de status com ponto, categoria, idioma, corpo resumido, botões) e `template-actions-menu.tsx` (Editar com motivo quando indisponível, Imagem padrão do envio, Ver detalhes), substituindo `templates-lista.tsx`. Verificação: checagem visual no navegador com template aprovado, pendente, rejeitado, com e sem imagem padrão.
- [x] 13.4 Criar `template-default-image-dialog.tsx` (arquivo ou link, preview 1.91:1, erros da API) e `template-details-sheet.tsx` (preview completo e metadados), com `useSetTemplateDefaultImage` em `use-connector-templates.ts`. Verificação: definir a imagem de um template sincronizado em dev e ver a miniatura atualizar.
- [x] 13.5 Reestruturar `templates-tab.tsx`: cabeçalho com título, contagem, Sincronizar e Novo template; esqueleto no carregamento; estado vazio com "Criar primeiro template"; estado sem resultado; erro com "Tentar de novo"; troca entre lista e formulário de criação/edição. Seguir a skill `design-taste-frontend` (telas de app). Verificação: checagem visual no navegador em tema claro e escuro, em largura de desktop e de celular.
- [x] 13.6 Adicionar as chaves de tradução (pt-br, en, es) da aba nova. Verificação: lint e `tsc` do front sem erro.
- [x] 13.7 Refinar o formulário de criação e edição: seções em painéis, categoria em cartões com descrição, "Inserir variável" e contador de caracteres no corpo e no rodapé, barra de ações fixa com o que falta para salvar, e layout por `@container` (prévia recolhível no topo quando o formulário é estreito, como no slider do Bitrix24). Verificação: testes de `insertNextVariable` e `firstMissingKey` em `template-view.test.ts` e checagem visual no navegador em 1100px e 600px.
