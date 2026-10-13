# Tasks

## 1. Página do placement fora do layout do ThinkZap

- [x] 1.1 Criar `front/app/(widgets)/thinkzap/connector/page.tsx` no fluxo de `/widgets/conversations`: `isInsideIframe()` falso → `BitrixOnlyNotice`; dentro → `BX24Script` + `useBX24` + `authenticateBitrixWithBackend` + `writeAppToken`, com estados "Autenticando..." e erro de autenticação, e só então renderizar `ContactCenterView`. Comentário no topo explicando que a URL é o `PLACEMENT_HANDLER` registrado e por isso vive em `(widgets)`. Verificar: `yarn tsc --noEmit` (ou `next build`) sem erro.
- [x] 1.2 Remover `front/app/(thinkzap)/thinkzap/connector/` e o prefixo `/thinkzap/connector` do `accessBlocked` em `front/app/(thinkzap)/layout.tsx`. Verificar: `next build` sem conflito de rota e `/thinkzap/connector` presente na lista de rotas geradas.

## 2. Leitura do placement e montagem da lista (lógica pura com teste)

- [x] 2.1 Criar helper `resolvePlacementLine(info)` em `front/shared/thinkzap/contact-center-placement.ts` (o vitest não inclui `components/**`) que lê `options.LINE` com fallback `LINE_ID`, aceita `options` como objeto ou string JSON, e devolve número ou `null`. Verificar: `contact-center-placement.test.ts` cobre objeto, string JSON, `LINE_ID`, ausente e não numérico — `yarn test` passa.
- [x] 2.2 No mesmo módulo, `toLineOptions(lines, lineId)` que rotula cada linha (`phone — name` do `phoneData`, senão `instance.name`), marca a vinculada a este canal (`instance.vinculatedChannel === String(lineId)`) e devolve o id pré-selecionado. Verificar: testes de rótulo com e sem `phoneData`, linha vinculada, nenhuma vinculada e lista vazia passam.

## 3. `ContactCenterView` com vínculo real

- [x] 3.1 Reescrever `front/components/layouts/widgets/contact-center.tsx`: remover autenticação própria e prop `scriptLoaded` (passa a assumir token), manter `fitWindow` e `placement.info()`, carregar `/thinkzap/connector/list` com `try/catch` e `thinkzapApiErrorMessage` (sem `throw` em efeito), usar os helpers do grupo 2, mostrar "vinculada a este canal", lista vazia sem botão, e aviso + botão desabilitado quando `resolvePlacementLine` for `null`. Verificar: `yarn tsc --noEmit` e `yarn lint` sem erros no arquivo.
- [x] 3.2 Implementar "Vincular" com `useLineApi(selectedId).linkChannel(line)`: estado de envio, confirmação só após resposta ok, recarregar a lista para refletir o vínculo, erro via `thinkzapApiErrorMessage(e, 'Falha ao vincular o canal aberto')` mantendo a seleção. Remover o código comentado de `imconnector.activate` e os `console.log`. Verificar: `yarn tsc --noEmit` passa e não há `console.log` no arquivo.

## 4. Verificação integrada no Bitrix24 (homolog)

- [ ] 4.1 Em homolog, abrir Contact Center → conector ThinkZap → configurar num canal aberto com janela anônima (sem token prévio). Verificar: a tela carrega sem `Token not found` no console, sem aside do app, e lista as linhas.
- [ ] 4.2 Vincular uma linha livre ao canal. Verificar: confirmação na tela, conector ativo no canal no painel do Bitrix, e a linha mostra o canal vinculado em `/thinkzap/conexoes`; reabrindo o placement, a linha aparece como vinculada a este canal.
- [ ] 4.3 Tentar vincular outra linha ao mesmo canal e repetir com usuário sem permissão `connectors:update`. Verificar: mensagens do backend aparecem na tela e nada é gravado.
