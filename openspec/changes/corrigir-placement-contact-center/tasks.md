# Tasks

## 1. Página do placement fora do layout do ThinkZap

- [x] 1.1 Criar `front/app/(widgets)/thinkzap/connector/page.tsx` no fluxo de `/widgets/conversations`: `isInsideIframe()` falso → `BitrixOnlyNotice`; dentro → `BX24Script` + `useBX24` + `authenticateBitrixWithBackend` + `writeAppToken`, com estados "Autenticando..." e erro de autenticação, e só então renderizar `ContactCenterView`. Comentário no topo explicando que a URL é o `PLACEMENT_HANDLER` registrado e por isso vive em `(widgets)`. Verificar: `yarn tsc --noEmit` (ou `next build`) sem erro.
- [x] 1.2 Remover `front/app/(thinkzap)/thinkzap/connector/` e o prefixo `/thinkzap/connector` do `accessBlocked` em `front/app/(thinkzap)/layout.tsx`. Verificar: `next build` sem conflito de rota e `/thinkzap/connector` presente na lista de rotas geradas.

## 2. Leitura do placement e montagem da lista (lógica pura com teste)

- [x] 2.1 Criar helper `resolvePlacementLine(info)` em `front/shared/thinkzap/contact-center-placement.ts` (o vitest não inclui `components/**`) que lê `options.LINE` com fallback `LINE_ID`, aceita `options` como objeto ou string JSON, e devolve número ou `null`. Verificar: `contact-center-placement.test.ts` cobre objeto, string JSON, `LINE_ID`, ausente e não numérico — `yarn test` passa.
- [x] 2.2 No mesmo módulo, `toLineOptions(lines, lineId)` que rotula cada linha (`phone — name` do `phoneData`, senão `instance.name`), marca a vinculada a este canal (`instance.vinculatedChannel === String(lineId)`) e devolve o id pré-selecionado. Verificar: testes de rótulo com e sem `phoneData`, linha vinculada, nenhuma vinculada e lista vazia passam.
- [x] 2.3 No mesmo módulo, `toChannelOptions(channels, lines, placementLine)`: rótulo pelo nome do canal (`(inativo)` quando inativo), `— vinculado a <linha>` quando outra linha ocupa o canal, e `preselectedChannelId` só quando alguma linha já está vinculada ao `placementLine` (o `LINE` do placement nunca vira destino sozinho). Verificar: testes de "Conectar" sem vínculo (nada pré-selecionado), "Alterar" (pré-seleciona), canal ocupado, inativo e lista vazia passam.

## 3. `ContactCenterView` com vínculo real

- [x] 3.1 Reescrever `front/components/layouts/widgets/contact-center.tsx`: remover autenticação própria e prop `scriptLoaded` (passa a assumir token), manter `fitWindow` e `placement.info()`, carregar `/thinkzap/connector/list` com `try/catch` e `thinkzapApiErrorMessage` (sem `throw` em efeito), usar os helpers do grupo 2, mostrar "vinculada a este canal", lista vazia sem botão, e aviso + botão desabilitado quando `resolvePlacementLine` for `null`. Verificar: `yarn tsc --noEmit` e `yarn lint` sem erros no arquivo.
- [x] 3.2 Implementar "Vincular" com `useLineApi(selectedId).linkChannel(line)`: estado de envio, confirmação só após resposta ok, recarregar a lista para refletir o vínculo, erro via `thinkzapApiErrorMessage(e, 'Falha ao vincular o canal aberto')` mantendo a seleção. Remover o código comentado de `imconnector.activate` e os `console.log`. Verificar: `yarn tsc --noEmit` passa e não há `console.log` no arquivo.
- [x] 3.3 Adicionar o seletor de canal aberto em `ContactCenterView`: carregar `/thinkzap/openchannels` em paralelo às linhas, pré-selecionar só via `toChannelOptions`, botão exige linha e canal, `linkChannel(Number(canal escolhido))`, recarregar linhas após vincular; falha nos canais mostra erro e desabilita o botão. Remover o aviso "canal não identificado" e o texto "ao Canal Aberto N". Verificar: `tsc`, `eslint` e `next build` passam.

## 4. Verificação integrada no Bitrix24 (homolog)

- [x] 4.1 Em homolog, abrir Contact Center → conector ThinkZap → clicar em "Conectar" numa janela anônima (sem token prévio). Verificar: a tela carrega sem `Token not found` no console, sem aside do app, lista as linhas e os canais, e nada vem selecionado.
- [x] 4.2 Escolher uma linha livre e um canal e vincular. Verificar: confirmação na tela, conector ativo no canal no painel do Bitrix, e a linha mostra o canal vinculado em `/thinkzap/conexoes`; reabrindo por "Alterar" naquele canal, linha e canal vêm pré-selecionados.
- [x] 4.3 Tentar vincular outra linha ao mesmo canal e repetir com usuário sem permissão `connectors:update`. Verificar: mensagens do backend aparecem na tela e nada é gravado.

## 5. Tradução da tela

- [x] 5.1 Mover `BITRIX_LANG_TO_LOCALE` de `front/app/bitrix/install/page.tsx` para `front/bitrix/` com um helper `localeFromBitrixLang` (testado: `br`, `en`, `la`, desconhecido) e usá-lo na instalação e na página do placement (aplica só sem `readStoredLocale()`). Verificar: teste do helper passa e a instalação continua compilando.
- [x] 5.2 Criar `messages/{pt,en,es}/thinkzap/contact-center.json` e trocar todos os textos fixos da página do placement e de `ContactCenterView` por `t(...)`. Os helpers de `contact-center-placement.ts` passam a devolver dados (nome, inativo, ocupante) em vez de texto em português, e a view monta os rótulos. Falhas de autenticação com causa conhecida (`reason`) e a falha do BX24 também são traduzidas na página; falhas do backend mostram a mensagem da API. Verificar: testes dos helpers ajustados passam; `grep` sem texto em português fixo nos dois componentes; os três JSON com as mesmas chaves; `tsc`, `eslint` e `next build` passam.
- [ ] 5.3 Em homolog, abrir o placement com o portal em inglês e em espanhol (sem idioma escolhido no app). Verificar: todos os textos da tela no idioma do portal.
