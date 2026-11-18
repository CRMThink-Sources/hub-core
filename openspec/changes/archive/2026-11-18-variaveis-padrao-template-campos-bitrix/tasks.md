# Tasks

## 1. Persistência do mapeamento (API)

- [x] 1.1 Adicionar o model `ThinkzapTemplateVariableMapping` (`core_thinkerszap_template_variable_mappings`, único por linha+nome+idioma+`entityTypeId`) em `api/prisma/schema.prisma`, criar a migration nova com `npx prisma migrate dev --name add_thinkzap_template_variable_mappings` e rodar `yarn prisma:generate`; verificar que a migration só cria a tabela e que nenhuma migration antiga foi alterada
- [x] 1.2 Criar o port `TemplateVariableMappingsRepository` (`find`, `upsert`, `delete`) e o `PrismaTemplateVariableMappingsRepository`; verificar com teste de repositório no padrão de `prisma-template-defaults.repository.test.ts` (criar, substituir, apagar, isolamento por linha e por tipo de entidade)
- [x] 1.3 Definir o tipo `VariableMapping` (`source` + `fieldId`) e a regra de `source` permitido por `entityTypeId` em função pura do domínio; verificar com teste unitário cobrindo Lead/Negócio/SPA, Contato e Empresa

## 2. Casos de uso (API)

- [x] 2.1 Extrair `createCrmItemCache` e a escolha do Contato principal de `related-destinations.resolver.ts` para um helper compartilhado sem mudar o comportamento; verificar que `list-destinations.service.test.ts` e os testes do resolver continuam passando sem edição
- [x] 2.2 Implementar `ListCrmFieldsUseCase` (campos da entidade + Contato/Empresa vinculados, rotulados pela origem, omitindo tipos sem texto útil); verificar com teste usando `BitrixClient` mockado, inclusive falha do Bitrix
- [x] 2.3 Implementar `SetTemplateVariableMappingUseCase` e `GetTemplateVariableMappingUseCase`, seguindo `set-template-default-image.ts` (`resolveTemplateContext` com `requireEnabled`, template existente na lista ao vivo, variáveis conferidas contra o corpo, `source` permitido, mapeamento vazio apaga a linha); verificar com testes para cada cenário de recusa da spec e para substituir/limpar
- [x] 2.4 Implementar `format-crm-field-value.ts` (lista→rótulo, telefone/e-mail→primeiro valor, múltiplo→`, `, data→`dd/mm/aaaa`, dinheiro→número, booleano→Sim/Não, vazio→omitido); verificar com teste de tabela por tipo, incluindo `null`/`undefined` que nunca viram texto
- [x] 2.5 Implementar `ResolveTemplateVariableValuesUseCase` (lê só as fontes usadas, `crm.item.fields` só se houver campo de lista, Contato principal, ignora chaves que não estão mais no corpo, falha do Bitrix → `{}` com `logThinkzapError`); verificar com testes: Negócio com Contato vinculado, sem mapeamento (zero chamadas ao Bitrix), contato inexistente, campo vazio e falha/pausa do Bitrix

## 3. Controllers e rotas (API)

- [x] 3.1 Criar controllers e factories `main/` para `GET /crm-fields`, `GET|PUT .../variable-mappings` e `GET .../variable-values`, com schema Zod, mensagens de erro em pt-BR e permissões (`connectors:read`/`update`; `variable-values` com a guarda do catálogo do widget); registrar em `routes.ts` e `composition-root.ts`
- [x] 3.2 Escrever testes de controller no padrão de `set-template-default-image.controller.test.ts` (validação, 4xx de template inexistente/linha bloqueada, 200 com `{ values }`); rodar `yarn check-types`, `yarn lint` e `yarn test` em `api/` sem falhas novas

## 4. Configuração no front (lista de templates)

- [x] 4.1 Criar `useTemplateVariableMappings` (ler/gravar mapeamento, carregar campos do CRM) em `front/app/hooks/use-connector-templates.ts`, no formato de `useSetTemplateDefaultImage`; verificar com teste no padrão de `use-connector-templates.test.ts`
- [x] 4.2 Criar `TemplateVariablesDialog` (tipo de entidade, uma linha por variável na ordem do corpo, seletor de campo agrupado por origem, "sem campo", estado de erro ao carregar campos, mapeamento salvo reaparece) e o item "Variáveis padrão" em `template-actions-menu.tsx`, exibido só com variáveis no corpo e respeitando a permissão; verificar com teste de função pura da regra de exibição e conferindo no navegador (`yarn dev`) os cenários de aparecer/não aparecer/reabrir
- [x] 4.3 Adicionar os textos `variaveisPadrao.*` e `acoes.variaveisPadrao` em `front/messages/{pt,en,es}/thinkzap/configuracoes/templates.json`; verificar que o app compila e que as três línguas têm as mesmas chaves
- [x] 4.4 Listar as SPAs do portal no seletor de tipo; verificar escolhendo uma SPA no diálogo e salvando o mapeamento dela

## 5. Preenchimento no widget (front)

- [x] 5.1 Adicionar em `template-variables.ts` a função pura que mescla valores do CRM só nas chaves vazias; verificar com testes em `template-variables.test.ts` (não sobrescreve digitado, ignora chave inexistente, resposta vazia)
- [x] 5.2 Em `conversation-view.tsx`, chamar `variable-values` ao escolher o template com entidade identificada, descartar resposta de template anterior, aplicar a mescla e tratar falha como "sem preenchimento"; verificar com `yarn test` e no navegador: preenche, operador edita e envia, entidade sem mapeamento, troca de template, falha da API
- [x] 5.3 Rodar `yarn check-types`, `yarn lint` e `yarn test` em `front/` sem falhas novas

## 6. Integração

- [x] 6.1 Em staging, com um Negócio real que tem Contato vinculado: mapear `{{1}}` a "Contato › Nome" e `{{2}}` a "Título", abrir o widget no Negócio, conferir o preenchimento e enviar; registrar o resultado em `tasks.md` (validação em staging é pendência declarada no commit)
