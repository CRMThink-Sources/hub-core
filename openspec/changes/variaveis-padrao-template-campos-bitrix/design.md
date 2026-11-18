# Design

## Context

Ver `proposal.md` (Why). Estado atual, observado no código:

- A **imagem padrão** é o modelo a seguir: tabela `core_thinkerszap_template_defaults` (`ThinkzapTemplateDefault`), chave `domainId + subscriptionItemId + templateName + language`, repositório `PrismaTemplateDefaultsRepository`, caso de uso `SetTemplateDefaultImageUseCase`, rota `PUT /lines/:itemId/templates/:name/:language/default-image` (permissão `connectors:update`), diálogo `template-default-image-dialog.tsx` aberto pelo `template-actions-menu.tsx`. O catálogo do widget (`ListWidgetTemplatesUseCase`) já junta a imagem padrão à lista ao vivo da Meta.
- O widget (`conversation-view.tsx` + `template-composer.tsx`) guarda os valores em `templateValues: Record<string, string>` (chave = variável do corpo, extraída por `extractTemplateVariables`, mesma regex de `resolve-template-body.ts` na API). Já conhece `entity` e `entityId` via `resolveWidgetEntity(placement, options)`.
- A API lê o CRM por `BitrixClient.getCrmItem(entityTypeId, id)` (`crm.item.get`) e `getCrmItemFields(entityTypeId)` (`crm.item.fields`); `related-destinations.resolver.ts` já navega Negócio/Lead/SPA → Contato/Empresa (`contactIds`, `companyId`) com cache por `entityTypeId:id`, e `ENTITY_TYPE_ID` mapeia o placement para o `entityTypeId`.
- O robô de Bizproc já tem seu próprio mapeamento variável → campo (`front/app/bitrix/bizproc/template/_lib/document-fields.ts`, via `BX24`). Não é reaproveitado: lá o Bitrix resolve a expressão antes de chamar o webhook; aqui quem lê o CRM é o ThinkZap.
- Chamadas ao Bitrix passam por `shared/infra/bitrix-limits`; nunca contornar.

## Goals / Non-Goals

**Goals:**
- Um mapeamento por template **e por tipo de entidade**, com campos da própria entidade e do Contato/Empresa vinculados.
- Resolver os valores **no servidor**, com um endpoint pensado para o widget, devolvendo texto pronto.
- Falha na resolução nunca bloqueia o envio.

**Non-Goals:**
- Robô de Bizproc, variáveis de botão dinâmico (`dynamic`), campanha SMS e template de linha não oficial.
- Valor fixo/literal como "campo" (ex.: sempre "Equipe Comercial") e transformações (maiúscula, formatação customizada).
- Resolver a variável no momento do envio no servidor: o valor é **sugestão** editável no widget; o envio continua recebendo os valores que o widget manda.
- Mostrar na lista de templates que há mapeamento (selo/filtro).

## Decisions

### 1. Tabela própria, e não uma coluna em `template_defaults`
Nova `ThinkzapTemplateVariableMapping` → `core_thinkerszap_template_variable_mappings`: `id`, `domainId`, `subscriptionItemId`, `templateName`, `language`, `entityTypeId Int`, `mappings Json`, `createdAt`, `updatedAt`; `@@unique([domainId, subscriptionItemId, templateName, language, entityTypeId], name: "uq_template_variable_mapping")` e `@@index([domainId, subscriptionItemId])`.

*Por quê:* `template_defaults.headerImageUrl` é `NOT NULL` (a linha existe porque há imagem) e a granularidade é outra (aqui há uma linha por tipo de entidade). *Alternativa descartada:* coluna JSON em `template_defaults` — obrigaria tornar a imagem opcional e misturaria dois ciclos de vida.

`entityTypeId` (1 Lead, 2 Negócio, 3 Contato, 4 Empresa, N para SPA) em vez de texto: é o que `crm.item.get`/`crm.item.fields` recebem e o que o resolver existente já usa. A migration é nova (nunca editar antigas) e só cria tabela, sem mexer em dados.

### 2. Formato do mapeamento
`mappings`: `{ "<variável>": { "source": "self" | "contact" | "company", "fieldId": "<chave de crm.item>" } }`.

- `fieldId` é a chave **camelCase de `crm.item.fields`/`crm.item.get`** (`title`, `opportunity`, `ufCrm_1712345678`), a mesma nos dois métodos — assim o catálogo e a leitura nunca divergem. (O robô usa `UPPER_CASE` porque o Bizproc exige; aqui não.)
- `source` por tipo de entidade: Lead/Negócio/SPA → `self|contact|company`; Contato → `self|company`; Empresa → `self`. Validado na API.
- Variável sem campo = chave ausente. Mapeamento vazio apaga a linha (spec: "deixa de existir").
- Chaves que não existem mais no corpo (template editado) ficam guardadas, mas são **ignoradas** na resolução; a validação só vale na gravação. Evita reescrever dados quando o template muda.

### 3. Endpoints (mesmo módulo `thinkzap`, `routes.ts`)
- `GET /crm-entity-types` → Lead, Negócio, Contato, Empresa e as SPAs do portal (`crm.type.list`, com título). Falha ao listar SPAs mantém as quatro padrão. Permissão `connectors:read`.
- `GET /crm-fields?entityTypeId=` → `[{ source, id, title, type, multiple, custom }]`, já com os campos de Contato/Empresa conforme o tipo (usa `getCrmItemFields` para 3 e 4 também). Só entram campos de tipo que viram texto útil. Permissão `connectors:read`.
- `GET /lines/:itemId/templates/:name/:language/variable-mappings?entityTypeId=` e `PUT` com `{ entityTypeId, mappings }` — `connectors:read` / `connectors:update`. O `PUT` segue `SetTemplateDefaultImageUseCase`: `resolveTemplateContext(..., { requireEnabled: true })`, confere que o template existe na lista ao vivo e valida chaves contra o corpo.
- `GET /messages/widget-templates/:subscriptionItemId/:name/:language/variable-values?entity=&entityId=` → `{ values: Record<string,string> }`, só com as variáveis que resolveram para texto não vazio. Mora no bloco do widget, ao lado do catálogo de templates, sem permissão de conector (quem envia não administra).

*Alternativa descartada:* devolver o mapeamento no catálogo do widget e resolver os valores no front via `BX24.callMethod`. Teria menos hops, mas duplicaria as regras de formatação no front, rodaria fora do `bitrix-limits` e, para Contato/Empresa vinculados, exigiria a navegação que já existe só no servidor.

### 4. Resolução de valores (caso de uso novo, sem importar infra)
1. Lê o mapeamento do tipo da entidade; sem mapeamento → `{}` (sem chamar o Bitrix).
2. Descobre quais `source` o mapeamento usa e lê **só** esses registros: `self` = `getCrmItem(entityTypeId, id)`; `contact`/`company` a partir de `contactId`/`contactIds`/`companyId` do próprio item, com o cache `entityTypeId:id` do resolver de destinos (extrair `createCrmItemCache` e a escolha do contato principal para um helper compartilhado, sem mudar o comportamento dos destinos).
3. Contato principal: o marcado `isPrimary` (quando `contactBindings` vier) senão o primeiro de `contactIds`.
4. `getCrmItemFields` só é chamado quando um valor lido é ambíguo (número ou `Y`/`N`, que pode ser o código de uma opção de lista ou um sim/não); resultado reaproveitado na mesma requisição. Sem a descrição dos campos, o valor ambíguo é omitido em vez de mostrar o código.
5. Formata (`format-crm-field-value.ts`, função pura e testável): lista → rótulo; `phone`/`email`/`im`/`web` → primeiro `value`; múltiplo → junta com `, `; data/datetime → `dd/mm/aaaa`; dinheiro `"1500|BRL"` → `1500`; boolean (`Y/N`, `true/false`) → `Sim`/`Não`; vazio/`null`/objeto desconhecido → omitido.
6. Qualquer falha do Bitrix (inclusive pausa por limite) → `{ values: {} }` com log pelo `logThinkzapError`; **nunca** 5xx para o widget por isso.

### 5. Widget
- Ao escolher o template (e já tendo `entity`/`entityId`), chama `variable-values` uma vez; descarta a resposta se o template mudou nesse meio-tempo (mesmo padrão do upload de imagem, que já descarta resposta atrasada).
- Aplica com `setTemplateValues(prev => ...)` preenchendo **só chaves vazias e que existem no corpo do template**, para nunca sobrescrever o que o operador digitou. O filtro de chaves obsoletas fica no widget, que já tem o corpo: o servidor não precisaria consultar a Meta só para isso.
- Trocar de template já zera `templateValues` hoje; mantém-se.
- Sem estado de erro visível: falha = campos vazios.

### 6. Front da configuração
`TemplateVariablesDialog` (irmão do `template-default-image-dialog`), aberto por novo item no `template-actions-menu` quando `extractTemplateVariables(body)` não é vazio. Tipo de entidade = seletor com Lead, Negócio, Contato, Empresa e SPAs, alimentado por `GET /crm-entity-types`. Seletor de campo pesquisável (`Combobox`), com a opção "Sem campo". Hook `useTemplateVariableMappings` em `use-connector-templates.ts` (mesma forma de `useSetTemplateDefaultImage`). Textos em `messages/{pt,en,es}/thinkzap/configuracoes/templates.json`, namespace `variaveisPadrao.*`.

## Risks / Trade-offs

- **Vazamento de dado de CRM**: o servidor lê com a credencial do app, não a do operador. → O endpoint só devolve campos do registro em que o widget está aberto (e do Contato/Empresa vinculados a ele) e só os que o administrador mapeou; mapear exige `connectors:update`.
- **Custo no Bitrix** (até 3 `crm.item.get` + 1 `crm.item.fields` por escolha de template). → Só lê as fontes que o mapeamento usa, cache por requisição, tudo via `bitrix-limits`; sem mapeamento não chama o Bitrix.
- **Campo some ou muda de tipo no Bitrix**: o valor vira vazio. → Variável fica em branco e o envio exige preenchimento (comportamento de hoje); o diálogo marca campo mapeado que não existe mais como "campo não encontrado".
- **Valor formatado errado para um tipo raro** (ex.: campo `address`, `file`). → Tipos não suportados são omitidos do seletor de campos, e não resolvidos com texto estranho.
- **Sem gate de permissão no front**: a ação aparece como a de imagem padrão; quem não tem `connectors:update` leva o erro da API ao salvar. Igual ao comportamento existente.

## Migration Plan

1. Migration nova só cria a tabela (aditiva, sem backfill); `prisma migrate deploy` do CI aplica.
2. Deploy da API antes do front (front novo chama endpoints novos; front antigo ignora).
3. Rollback: reverter o front esconde a ação; a tabela pode ficar sem uso. Não há flag nova nem variável de ambiente.

## Open Questions

- Nenhuma. A origem da lista de SPAs foi resolvida com o endpoint `GET /crm-entity-types` (a consulta existente, `listSpaEntityTypes`, devolve só ids, sem título).
