# Tasks

Caminhos relativos a `front/app/(thinkzap)/thinkzap/` salvo indicação.

## 1. Traduções da Campanha de SMS

- [x] 1.1 Criar `front/messages/{pt,en,es}/thinkzap/configuracoes/campanha-sms.json` com o conteúdo de `ajustes.json > smsProvider` achatado na raiz, mais `carregando`, `erroLeitura`/`erroLeituraTitulo`/`tentarNovamente` (leitura do entitlement) e o bloco `bloqueada` (trial/inativa) copiado de `ajustes.json`; verificar que os três arquivos têm o mesmo conjunto de chaves (ex.: script `node -e` comparando `Object.keys` recursivo)
- [x] 1.2 Em `_components/configuracoes/sms-provider-card.tsx`, trocar para `useTranslation('thinkzap/configuracoes/campanha-sms')` e remover o prefixo `smsProvider.` das chaves; verificar com `grep -n "smsProvider\." front -r --include=*.tsx` sem resultados e `yarn check-types` passando
- [x] 1.3 Remover o bloco `smsProvider` de `ajustes.json` (pt, en, es) e verificar que nenhuma chave `smsProvider` é referenciada no código

## 2. Aba Campanha de SMS

- [x] 2.1 Criar `_components/configuracoes/campanha-sms-tab.tsx` (`CampanhaSmsTab({ itemId })`): lê `api.getSettings()` só para o `entitlement`, trata `bloqueada = true` enquanto carrega ou em erro (com aviso e "Tentar novamente"), mostra `LinhaBloqueadaAviso` com namespace `thinkzap/configuracoes/campanha-sms` quando bloqueada, e renderiza `SmsProviderCard`; verificar com `yarn check-types`
- [x] 2.2 Em `conexoes/[subscriptionItemId]/configuracoes/page.tsx`, adicionar `'campanha'` ao `TabId`, incluir a aba após Ajustes nas variantes Z-API e oficial, renderizar `CampanhaSmsTab`, e corrigir o ramo da linha oficial que trata "não templates/ajustes" como Conexão para excluir também `campanha`; adicionar `tabs.campanha` em `page.json` (pt "Campanha de SMS", en "SMS campaign", es "Campaña de SMS"); verificar manualmente no `yarn dev` que as duas variantes mostram as abas na ordem da spec e que a aba abre o card (Z-API) ou a lista de templates (oficial)
- [x] 2.3 Remover `<SmsProviderCard>` (e o import e o comentário) de `ajustes-tab.tsx`; verificar no navegador que Ajustes mostra só Identificação, Canal aberto e Comportamento

## 3. Barra de salvamento da aba Ajustes

- [x] 3.1 Criar `_components/configuracoes/ajustes-alteracoes.ts` com `contarAlteracoes(inicial, atual)` (nome comparado com `trim()`, um por toggle em `TOGGLE_KEYS`, que passa a ser exportado daqui) e `ajustes-alteracoes.test.ts` cobrindo: sem alteração, só nome, só toggle, nome+toggle = 2, nome com espaços nas pontas = 0, toggle ida-e-volta = 0; verificar com `yarn test ajustes-alteracoes`
- [x] 3.2 Criar `_components/configuracoes/save-changes-bar.tsx` (baseado em `permissions-footer-bar.tsx`: `sticky bottom-0`, blur, margens negativas da casca) com texto de estado, Descartar (outline) e Salvar alterações (primário, `Loader2` ao salvar); adicionar `barra.{semAlteracoes, alteracoes_one, alteracoes_other, salvar, salvando, descartar}` em `ajustes.json` (pt, en, es); verificar com `yarn check-types`
- [x] 3.3 Em `ajustes-tab.tsx`: usar `contarAlteracoes` para `dirtyCount`/`podeSalvar`, remover o botão de dentro do card Comportamento, renderizar `SaveChangesBar` ao fim da aba (fora dos cards, só no estado `ready`), implementar `handleDescartar` restaurando `inicial` sem chamar a api, e remover `salvar`/`salvando` antigos de `ajustes.json` se ficarem sem uso; verificar no navegador os cenários da spec: sem alterações (botões desabilitados), nome+toggle salvos juntos com toast e barra zerada, contagem "2 alterações", Descartar restaura, nome vazio desabilita só Salvar, vincular canal não gera pendência, linha bloqueada desabilita Salvar

## 4. Proteção contra perda de alterações

- [x] 4.1 Em `ajustes-tab.tsx`, adicionar prop `onDirtyChange?: (dirty: boolean) => void` notificada por `useEffect` e registrar `beforeunload` enquanto `dirtyCount > 0` (com cleanup); verificar no navegador que recarregar com alteração pendente mostra o aviso nativo e sem alteração não mostra
- [x] 4.2 Em `page.tsx`, guardar `ajustesDirty`, criar `requestTab(id)` usado pelo `Tabs` e pelo link "Voltar para conexões", e abrir `ConfirmModal` ao sair de Ajustes com pendência (confirmar = descarta e navega; cancelar = fica); adicionar `sairSemSalvar.{titulo, descricao, confirmar, cancelar}` em `page.json` (pt, en, es); verificar no navegador os três cenários da spec (trocar com pendência → confirmar/cancelar; trocar sem pendência → imediato; Voltar com pendência → modal)

## 5. Integração

- [x] 5.1 Rodar `yarn check-types`, `yarn lint` e `yarn test` no `front/` sem erros novos
- [x] 5.2 Conferir em pt, en e es (seletor de idioma) que as abas, a barra e a aba Campanha não mostram chave crua de tradução, numa linha Z-API e numa oficial, incluindo uma linha com trial encerrado (aviso de bloqueio nas abas Ajustes e Campanha, ações desabilitadas)
