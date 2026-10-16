# Tasks

## 1. Domínio: modelo e validação de botões

- [x] 1.1 Criar `TemplateButton` (união discriminada `QUICK_REPLY | URL | PHONE_NUMBER | COPY_CODE`) em `domain/ports/whatsapp-template-provider.port.ts`, e espelhar o tipo em `CreateTemplateParams`/`HubMessageTemplateComponent` de `infra/clients/types/hubmessage.types.ts` (decisão 1). Verificar com `yarn tsc --noEmit` em `api/`.
- [x] 1.2 Criar o helper puro `templateButtonsOf(components)`, que devolve `{ index, type, text, dynamic }[]` (decisões 1 e 2). Verificar com testes:
  - `index` conta todos os botões a partir de 0;
  - URL com `{{1}}` é dinâmica e URL fixa não é;
  - `COPY_CODE` é dinâmico;
  - tipo desconhecido vira `OTHER` estático;
  - template sem `BUTTONS` dá `[]`.
- [x] 1.3 Criar `validateTemplateButtons(buttons, category)` (decisão 7) com os limites da spec:
  - no máximo 10 botões, 2 URL, 1 ligação e 1 copiar código;
  - texto com até 25 caracteres, telefone com até 20 e código com até 15;
  - variável só no fim da URL, e URL dinâmica com exemplo;
  - nada em Autenticação, e copiar código só em Marketing.

  Verificar com um teste por regra, mais um caso válido misto.

## 2. API: criação e catálogo

- [x] 2.1 Em `create-template.controller.ts`, trocar o schema de `BUTTONS` por uma união zod por `type` e manter `passthrough` nos demais componentes. Em `create-connector-template.ts`, chamar `validateTemplateButtons` e lançar `thinkzap.template.invalid_definition` quando houver violação. Verificar com `create-template.controller.test.ts` e `create-connector-template.test.ts`, cobrindo os cenários "API recusa três botões de link" (o provider não é chamado) e "API repassa botões válidos".
- [x] 2.2 Garantir que `HubMessageTemplateProvider.createTemplate` repassa `BUTTONS` (`url`, `example`, `phone_number`) sem perder campos. Verificar com `hubmessage-template-provider.test.ts`.
- [x] 2.3 Acrescentar `buttons` em `WidgetTemplate` (`list-widget-templates.ts`) via `templateButtonsOf` (decisão 8). Verificar com `list-widget-templates.test.ts`, cobrindo o cenário "Template com link dinâmico" e um template sem botões, que deve vir com `buttons: []`.

## 3. API: fila e envio ao HubMessage

- [ ] 3.1 Criar a migration Prisma que adiciona `template_button_parameters` (JSON, nullable) em `core_thinkerszap_widget_outbox` e o campo `templateButtonParameters` no model `ThinkzapWidgetOutbox`. Verificar:
  - `npx prisma migrate dev` aplica a migration;
  - `prisma generate` compila.
- [x] 3.2 Ler e gravar `templateButtonParameters` em `prisma-widget-outbox.repository.ts` e em `enqueue-template-send.service.ts`, com valor padrão `[]` e linha antiga lida como `null` → `[]`. Verificar com os testes do repositório e do `enqueue-widget-template.use-case.test.ts`.
- [x] 3.3 Adicionar `buttonParameters` ao `TemplateMessageDescriptor` e repassá-lo em `templateDescriptorOf` (`dispatch-widget-outbox-message.ts`). Verificar com `dispatch-widget-outbox-message.test.ts`, cenário "Reprocessamento usa os mesmos valores".
- [x] 3.4 Fazer o adapter `hubmessage-template-sender.adapter.ts` montar os componentes `BUTTON` (`sub_type` `url`/`copy_code`, `index`, `coupon_code`) e tornar `HubMessageTemplateSendComponent` uma união (decisão 3). Verificar com `hubmessage-template-sender.adapter.test.ts`:
  - cenário "Link dinâmico na segunda posição";
  - envio de cupom;
  - sem corpo e sem botões, o payload não leva `components`;
  - só com corpo, o payload fica idêntico ao atual.
- [ ] 3.5 Validar o formato com chamada real ao HubMessage numa linha de homologação: um template aprovado com link dinâmico e outro com copiar código. Ajustar apenas o adapter e os tipos se o formato divergir, e registrar o formato confirmado no comentário de `SendHubMessageTemplateParams`, como foi feito para o corpo. Verificar: as duas mensagens chegam com o link e o código corretos.

## 4. API: widget, robô e campanha SMS

- [x] 4.1 Aceitar `buttonParameters: { index, subType, value }[]` (opcional) no zod de `send-widget-template.controller.ts` e repassá-lo ao enqueue. Verificar com teste do controller:
  - pedido sem o campo continua 202;
  - `value` vazio ou `index` negativo dá 400.
- [x] 4.2 Adicionar a propriedade `templateButtonParameters` (`Multiple: 'Y'`) em `build-template-robot-params.ts`. Verificar com `build-template-robot-params.test.ts` e `ensure-template-robot.test.ts`; o update deve levar a nova propriedade.
- [x] 4.3 No `bitrix-template-robot-webhook-handler.controller.ts`, quando houver valores de botão, juntar posição → `{index, subType}` usando o catálogo (decisão 5), com `toParameterList` para normalizar.
  - Faltou valor para um botão dinâmico: recusar com o comentário existente de configuração incompleta.
  - Sem a propriedade: seguir o fluxo de hoje.

  Verificar com `bitrix-template-robot-webhook-handler.controller.test.ts`, cobrindo os cenários "Robô com cupom vindo do negócio", "Robô antigo sem botões dinâmicos" e o caso de valor faltando.
- [x] 4.4 Recusar na campanha SMS (`bitrix-sms-provider-webhook-handler.controller.ts`) template com botão dinâmico, usando o motivo `template-dynamic-button-unsupported` (decisão 6). Se o motivo virar código em `errors/catalog.ts`, criar também o guia em `mcp/kb/runbooks/hubcore/thinkzap/`. Verificar:
  - `bitrix-sms-provider-webhook-handler.controller.test.ts` cobre os dois cenários da spec de campanha;
  - o teste de cruzamento catálogo × runbooks passa.

## 5. Front: criação e lista de templates

- [x] 5.1 Atualizar os tipos em `front/app/hooks/use-connector-templates.ts` (`TemplateButton`) e criar o espelho de `validateTemplateButtons` e `templateButtonsOf` num módulo puro do front, com testes vitest equivalentes aos das tarefas 1.2 e 1.3.
- [x] 5.2 Adicionar a seção de botões em `template-form.tsx`:
  - adicionar e remover botões dos quatro tipos, com os campos de cada tipo;
  - desabilitar o botão de adicionar ao atingir o limite;
  - esconder a seção em Autenticação e remover o copiar código fora de Marketing;
  - mostrar erros por campo;
  - ordenar as respostas rápidas primeiro ao montar o `BUTTONS`.

  Textos nas três línguas em `front/messages/{pt,en,es}/thinkzap/configuracoes/templates.json` (`form.botoes.*`). Verificar com teste vitest da função de montagem dos componentes (cenário "Respostas rápidas agrupadas") e manualmente criando um template de Marketing com os quatro tipos.
- [x] 5.3 Mostrar os botões (texto e tipo) em `templates-lista.tsx`, com rótulos traduzidos. Verificar manualmente com um template sincronizado que tenha botão de ligação.
- [x] 5.4 Em `templates-campanha.tsx`, desabilitar com uma dica os templates com botão dinâmico, com textos nas três línguas. Para isso, `GetLineTemplateProviders` (`manage-line-sms-provider.ts`) passa a devolver `hasDynamicButton`. Verificar com `manage-line-sms-provider.test.ts` e manualmente na tela de campanha.

## 6. Front: widget e robô

- [x] 6.1 Acrescentar `buttons` em `WidgetTemplate` (`use-widget-templates.ts`) e criar helpers em `template-variables.ts` (`dynamicButtons` e `hasAllButtonValues`). Verificar com `template-variables.test.ts`.
- [x] 6.2 No `template-composer.tsx`, mostrar os botões no preview e um campo por botão dinâmico; desabilitar o envio enquanto algum estiver vazio. No `conversation-view.tsx`, mandar `buttonParameters` no POST. Verificar:
  - os cenários "Botão dinâmico vazio bloqueia o envio" e "Botões estáticos no preview" no widget;
  - o envio real com link dinâmico abre a URL completa no WhatsApp.
- [x] 6.3 Na tela do robô (`template-robot-form.tsx` e `_lib/robot-config.ts`), mostrar os botões no preview e um `value-field` por botão dinâmico (valor fixo ou campo do documento). `buildRobotProperties` grava `templateButtonParameters` em ordem e bloqueia o salvamento com campo vazio. Verificar com `robot-config.test.ts` e salvando um robô com cupom ligado a um campo do negócio.

## 7. Integração

- [ ] 7.1 Ponta a ponta numa linha oficial de homologação:
  - criar um template com os quatro tipos de botão, sincronizar e aguardar a aprovação;
  - enviar pelo widget e pelo robô, conferindo no aparelho link, código, ligação e resposta rápida;
  - tocar na resposta rápida e conferir que o chat do canal aberto recebe o texto do botão. Se o evento chegar num tipo não tratado por `build-hubmessage-content.ts`, mapeá-lo para texto, com teste do mapeamento.
- [ ] 7.2 Rodar `yarn test` e `yarn lint` em `api/` e `front/`; verificar que tudo passa.
