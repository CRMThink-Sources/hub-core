# Tasks

## 1. Confirmação na Z-API Omni (D1 e D3)

- [ ] 1.1 Numa WABA de teste, criar um template de Marketing com `HEADER` `format: IMAGE` e `example.header_handle: ["<url https pública>"]`, como documentado em `developer.omni.z-api.io/templates/validation`. Se vier `MISSING_APP_CREDENTIALS` ou erro de conversão, testar `POST /whatsapp/businesses/{wabaId}/templates/media` e criar com o `h` devolvido (plano B de D1). Registrar também se `api.hubmessage.io` e `api.omni.z-api.io` respondem igual. Verificação: as respostas ficam anotadas no PR.
- [ ] 1.2 Com o template aprovado, enviar por `POST /v1/channels/{channelId}/messages` com `{ type: 'HEADER', parameters: [{ type: 'image', image: { link } }] }`. Se for recusado, testar `header` em minúsculo, como no exemplo da doc nova. Verificação: mensagem recebida no aparelho de teste, com a imagem.
- [ ] 1.3 Registrar o formato confirmado de criação e de envio no JSDoc de `CreateTemplateParams` e `HubMessageTemplateSendComponent` em `hubmessage.types.ts`, com o link da doc da Omni. Verificação: JSDoc atualizado no diff.

## 2. Domínio: leitura do cabeçalho

- [x] 2.1 Criar `domain/template-header.ts` com `templateHeaderOf(components)` → `NONE | TEXT | IMAGE | UNSUPPORTED` (texto com `{{` = `UNSUPPORTED`) e o tipo neutro do componente de criação `{ type: 'HEADER', format: 'IMAGE', example: { imageUrl } }`. Verificação: `template-header.test.ts` cobre os cinco casos, incluindo vídeo, documento e texto com variável.
- [x] 2.2 Adicionar `validateTemplateHeader(components, category)` (no máximo um `HEADER`, só `IMAGE`, `imageUrl` `https`, proibido em `AUTHENTICATION`) com códigos de violação, no padrão de `validateTemplateButtons`. Verificação: testes de cada código.

## 3. Criação de template (API)

- [x] 3.1 Em `create-template.controller.ts`, aceitar o componente de cabeçalho de imagem no schema zod (`format: 'IMAGE'`, `example.imageUrl`). Verificação: teste do controller que aceita o cabeçalho válido e devolve 400 com cabeçalho `VIDEO`.
- [x] 3.2 Em `CreateConnectorTemplateUseCase.validate`, chamar `validateTemplateHeader` e mapear as mensagens em pt-br para `InvalidTemplateError`. Verificação: `create-connector-template.test.ts` cobre cabeçalho em Autenticação, dois cabeçalhos e exemplo sem `https`, sem chamar o provider.
- [x] 3.3 Criar o download validado da imagem de exemplo (port no domínio, adapter axios na infra): só `https`, recusa dos domínios do CDN da Meta (`whatsapp.net`, `fbcdn.net`, `fbsbx.com`), recusa de IP privado ou de loopback, timeout curto, `maxContentLength` de 5 MB, `Content-Type` `image/jpeg` ou `image/png`. Chamar no use case antes do provider. Verificação: testes do adapter com mock para imagem válida, 8 MB, `text/html`, link `scontent.whatsapp.net` e host privado.
- [x] 3.4 Em `HubMessageTemplateProvider.createTemplate`, traduzir o cabeçalho neutro para `example.header_handle: [imageUrl]`. Se a tarefa 1.1 exigir o plano B, adicionar `uploadTemplateMedia` no `HubMessageClient` (multipart, `file` + `type`) e usar o `h`. Verificação: `hubmessage-template-provider.test.ts` confere o payload enviado ao client.
- [x] 3.5 Registrar no catálogo de erros os códigos novos `thinkzap.template.header_image_invalid` e `thinkzap.template.header_image_app_credentials_missing` (para o `422 MISSING_APP_CREDENTIALS`, se o plano B entrar), com runbooks em `mcp/kb/runbooks/hubcore/thinkzap/template/`. Mapear também as recusas `2388215` e `380` da Meta para mensagens legíveis. Verificação: o teste do catálogo de erros passa e os runbooks existem.

## 4. Criação de template (front)

- [x] 4.1 Em `template-form.tsx`, adicionar a seção de cabeçalho (nenhum / imagem), com campo de URL de exemplo, dica de proporção 1.91:1 e de que o link precisa ser direto para o arquivo, preview da imagem acima do corpo e remoção ao trocar para Autenticação. Verificação: teste do form (ou manual em dev) cobrindo exemplo vazio, `http://` e troca de categoria.
- [x] 4.2 Montar o componente `HEADER` neutro no envio do form, antes do `BODY`. Verificação: teste do builder de componentes, ou checagem do request no navegador.
- [x] 4.3 Na lista de templates da linha, mostrar um indicador "Imagem" para templates com `templateHeaderOf === 'IMAGE'`. Verificação: template sincronizado com imagem aparece marcado em dev.
- [x] 4.4 Adicionar as chaves de tradução (pt-br, en, es) do cabeçalho, dos erros e do indicador. Verificação: o lint/teste de chaves de i18n passa.

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

- [ ] 10.1 Em staging, de ponta a ponta: criar um template com imagem pelo ThinkZap, aguardar a aprovação, sincronizar, enviar pelo widget e pelo robô com URL vinda de um campo do negócio, e conferir a imagem no aparelho e o histórico no CRM. Verificação: checklist anexado ao PR.
- [ ] 10.2 Rodar `yarn lint`, `yarn test` e `tsc` na API e no front. Verificação: tudo verde.
