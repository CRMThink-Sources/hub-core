# Design

## Context

O motivo está em proposal.md e o comportamento em `specs/thinkzap/botoes-template-oficial/spec.md`. O que existe hoje:

- **Catálogo sempre ao vivo.** Não existe tabela de templates. `HubMessageTemplateProvider` lista, cria e sincroniza direto no HubMessage, e repassa os `components` como vieram (`{...component}`). O `TemplateComponent` do port já aceita `BUTTONS`, mas a estrutura fica solta (`[key: string]: unknown`).
- **Criação.** Só `template-form.tsx` monta componentes: `BODY` com `example.body_text` e `FOOTER` opcional. O zod de `create-template.controller.ts` usa `.passthrough()`, então um `BUTTONS` já passaria sem validação. `CreateConnectorTemplateUseCase` só confere nome, categoria, idioma e a presença do `BODY`.
- **Envio.** Os três caminhos (widget, robô e campanha SMS) passam por `EnqueueTemplateSendService` → linha na `core_thinkerszap_widget_outbox` (`templateName`, `templateLanguage`, `templateParameters`) → worker → `dispatch-widget-outbox-message` → `HubMessageTemplateSender`. O descriptor só tem `bodyParameters`, e o adapter só monta `{ type: 'BODY', parameters }`.
- **Widget e robô** recebem `WidgetTemplate {name, language, body}`, que descarta header, footer e botões.
- **HubMessage.** A documentação de criação mostra `BUTTONS` no formato da Meta (`type`, `text`, `url`, `example`). A de envio cita só `type: button` no componente, sem `sub_type` nem `index`. A API tem armadilhas já registradas em `hubmessage.types.ts`: o template vai em `attachments[0].template`, e o `type` do componente precisa estar em MAIÚSCULAS.

## Goals / Non-Goals

**Goals:**
- Um modelo de botão tipado, compartilhado por criação, catálogo e envio, que funcione também com templates criados direto na Meta.
- Valores de botões dinâmicos com o mesmo ciclo de vida dos valores do corpo: gravados na fila e reaproveitados nos reprocessamentos.

**Non-Goals:**
- Header com mídia ou texto, e botões de fluxo, OTP, catálogo, MPM ou voz.
- Edição de template existente.
- Tratamento dedicado do clique em resposta rápida, como payload customizado ou gatilho de robô.
- Valores de botão na campanha SMS.
- Traduzir o `template-composer` e o formulário do robô, que hoje têm texto fixo em português. Os textos novos seguem o mesmo padrão dessas telas.

## Decisions

### 1. Modelo de botão no domínio, derivado dos `components`
Criar `TemplateButton` no port (`whatsapp-template-provider.port.ts`) como união discriminada:

```ts
type TemplateButton =
  | { type: 'QUICK_REPLY'; text: string }
  | { type: 'URL'; text: string; url: string; example?: string[] }
  | { type: 'PHONE_NUMBER'; text: string; phone_number: string }
  | { type: 'COPY_CODE'; example: string }
```

Junto, criar um helper puro `templateButtonsOf(components)`. Ele lê o `BUTTONS` cru e devolve `{ index, type, text, dynamic }[]`. Um botão é dinâmico quando é `URL` com `{{n}}` na URL, ou quando é `COPY_CODE`. Tipo desconhecido vira `{ type: 'OTHER', dynamic: false }` (spec: "tipo não reconhecido SHALL aparecer como estático").

- *Por que derivar e não persistir:* o catálogo já é ao vivo. Persistir criaria um segundo dono do dado, e a sincronização teria de reconciliar.
- *Alternativa descartada:* calcular a parte dinâmica no front. O robô e a campanha SMS (no backend) também precisam saber quais botões são dinâmicos.

### 2. `index` é a posição no array `BUTTONS` do template aprovado
Na Meta, o `index` do componente de envio é a posição do botão entre **todos** os botões, a partir de 0. O `templateButtonsOf` numera a partir do array cru, e esse `index` vai junto pelo catálogo, pela fila e pelo envio. Assim o front não precisa recontar.

### 3. Valores dos botões como lista de `{ index, subType, value }`
- O port `TemplateMessageDescriptor` ganha `buttonParameters: { index: number; subType: 'URL' | 'COPY_CODE'; value: string }[]`, com valor padrão `[]`.
- O adapter acrescenta, depois do `BODY`, um componente por item:
  - URL: `{ type: 'BUTTON', sub_type: 'url', index: '<n>', parameters: [{ type: 'text', text }] }`
  - Copiar código: `{ type: 'BUTTON', sub_type: 'copy_code', index: '<n>', parameters: [{ type: 'coupon_code', coupon_code }] }`
- `components` continua omitido quando não há nem corpo nem botões (o formato atual não muda).
- `HubMessageTemplateSendComponent` passa a ser uma união `BODY | BUTTON`.

*Alternativa descartada:* uma lista posicional de strings, igual a `templateParameters`. Ela perderia o `index` e o subtipo. O robô (ver 5) ainda grava os valores em ordem, mas a conversão para `{index, subType}` acontece **antes** da fila, com o catálogo em mãos.

> O formato exato (`BUTTON` em maiúsculas, `sub_type` em minúsculas, `index` como string, `coupon_code`) segue a Meta e as armadilhas conhecidas do HubMessage. A doc do HubMessage não o confirma, então a primeira tarefa de envio é validar com uma chamada real e ajustar só o adapter.

### 4. Fila: nova coluna `template_button_parameters`
- Migration Prisma adiciona `templateButtonParameters Json? @map("template_button_parameters")` em `ThinkzapWidgetOutbox`.
- O repositório lê e grava a coluna, e `templateDescriptorOf` a repassa (`?? []`).
- Linhas antigas ficam `null` e são enviadas como hoje.
- *Alternativa descartada:* reaproveitar `templateParameters` com um formato misto. Isso quebraria leitores atuais e a nota de timeline do worker.

### 5. Entrada dos valores por canal
- **Widget:** o front já conhece o `index` e o subtipo pelo catálogo. Ele envia `buttonParameters: [{index, subType, value}]` no `POST /messages/send-widget-template`. O zod valida o formato (`index` inteiro ≥ 0, `value` não vazio), e o valor é repassado ao enqueue.
- **Robô:** nova propriedade `templateButtonParameters` (`Type: 'string'`, `Multiple: 'Y'`), com um valor por botão dinâmico na ordem do template. Como o Bitrix grava só a ordem, o handler do robô converte posição → `{index, subType}`:
  1. lê o catálogo do template, que já é consultado por `resolveRobotTemplateBody` quando falta `templateBody`. Passa a consultá-lo sempre que houver valores de botão;
  2. junta os valores aos botões dinâmicos.

  Robô sem a propriedade ou sem valores não consulta o catálogo nem envia botões, o que mantém a compatibilidade. Se faltar valor para um botão dinâmico (ou o template não estiver no catálogo), o robô recusa com um comentário próprio, `templateRobot.missingButtonValues`, nos três idiomas. O comentário de configuração incompleta existente fala em "sem linha ou sem template" e confundiria o operador. Se o catálogo falhar, recusa com o aviso de linha que não pode enviar, levando a mensagem do erro. O corpo e os botões dividem uma única consulta ao catálogo por disparo.
- `toParameterList` (já usado em `templateParameters`) é reaproveitado para normalizar array, objeto indexado ou string.

### 6. Campanha SMS
Depois de achar o template no catálogo, o handler checa `templateButtonsOf(...).some(b => b.dynamic)` e recusa pelo mesmo `refuse(...)` já usado, com um novo motivo `template-dynamic-button-unsupported`. Na tela `templates-campanha.tsx`, templates com botão dinâmico aparecem desabilitados com uma dica, para não oferecer um provedor que sempre falharia.

### 7. Validação na criação
Uma função pura `validateTemplateButtons(buttons, category)` no domínio aplica os limites da spec. Ela roda em dois lugares:
- no use case, que lança o erro existente `thinkzap.template.invalid_definition`;
- no front, que mantém uma cópia espelhada, como já acontece com a regex de placeholder.

O zod do controller ganha um schema específico para `BUTTONS` (união por `type`). Os demais componentes continuam com `passthrough`.

O form ordena os botões antes de enviar: respostas rápidas primeiro, depois os demais na ordem em que foram adicionados.

### 8. Catálogo para widget e robô
`WidgetTemplate` ganha `buttons: { index; type; text; dynamic }[]`. É o mínimo para renderizar e para preencher os campos, sem expor `url` nem exemplo. O front reaproveita `resolveTemplatePreview` para o corpo e renderiza os botões como chips abaixo dele. Os campos dinâmicos ficam numa seção "Botões" do composer.

## Risks / Trade-offs

- **[Formato de envio de botão não documentado no HubMessage]** → tarefa explícita de chamada real (link dinâmico e cupom) antes de fechar o adapter. A mudança fica isolada no adapter e nos tipos do client.
- **[Clique em resposta rápida de template pode chegar num tipo de evento que `build-hubmessage-content.ts` não reconhece]** → tarefa de capturar o webhook real. Se o tipo for novo, mapeá-lo para texto com o título do botão; fora isso, nada muda.
- **[O robô passa a consultar o catálogo no disparo quando há valores de botão]** → é a mesma chamada que já acontece no fallback de `templateBody`. Com o provedor fora do ar, o erro segue o tratamento atual de indisponibilidade.
- **[Ordem dos valores do robô depende do template]** → se o template for trocado por outro com botões diferentes, a tela do robô reconstrói os campos. Valores a mais são ignorados, e valores a menos recusam.
- **[Limites da Meta mudam com o tempo]** → ficam centralizados em `validateTemplateButtons` e no espelho do front. A Meta continua sendo a validação final, e o erro dela chega pelo `provider_rejected` existente.

## Migration Plan

1. Deploy da migration (coluna nullable, sem backfill).
2. Deploy da API: os novos campos são opcionais, então o front antigo continua funcionando.
3. Deploy do front.
4. A definição do robô é atualizada nos portais pelo `EnsureTemplateRobot` (add → update) já existente, na próxima reinstalação ou execução do ensure.

Rollback: reverter front e API. A coluna nullable pode ficar.

## Open Questions

- Payload exato do webhook de clique em resposta rápida de template no HubMessage (ver Risks). Não muda a spec.
