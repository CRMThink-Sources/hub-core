# Tasks

Comandos rodam em `front/`: `yarn check-types`, `yarn lint`, `yarn test`.

## 1. Home do ThinkZap traduzida

- [x] 1.1 Criar `messages/pt/thinkzap/home.json` com todas as strings atuais da home (hero com `saudacao` interpolando `{{nome}}`, subtítulo, onboarding, título "Mensagens no período", seletor de período "De"/"Até"/aviso de 6 meses, cards "Enviadas"/"Recebidas", `linhasAtivas_one`/`linhasAtivas_other`, resumo "Total enviadas"/"Total recebidas", barra "Web vs Business no período", badge "novo", atalhos com título/rótulo/descrição, "Carregando...", "Não foi possível carregar sua instalação", fallback de erro das estatísticas). Criar também `en` e `es` com as mesmas chaves. Verificar que os três arquivos têm o mesmo conjunto de chaves (script rápido ou comparação manual).
- [x] 1.2 Criar em `app/(thinkzap)/thinkzap/_lib/` o helper `useNumberFormatter()`, que mapeia `i18n.language` (`pt→pt-BR`, `en→en-US`, `es→es-ES`, fallback `pt-BR`) para um `Intl.NumberFormat` memoizado. Adicionar teste unitário do mapeamento (`12345` → `12.345` em pt, `12,345` em en) e verificar que `yarn test` passa.
- [x] 1.3 Trocar os textos fixos de `home-hero.tsx`, `onboarding-cta.tsx`, `home-shortcuts.tsx` (`SHORTCUTS` passa a guardar só `href`/`icon`/chave), `message-stats-period-picker.tsx` e `trend-badge.tsx` por `useTranslation('thinkzap/home')`. Verificar com `yarn check-types` e `grep` que não sobra string PT de interface nesses arquivos.
- [x] 1.4 Trocar os textos e o `Intl.NumberFormat('pt-BR')` de `message-stats-card.tsx` (plural via `t('linhasAtivas', { count })`), `message-stats-summary.tsx` e `provider-share-bar.tsx` por `t(...)` + `useNumberFormatter()`. Verificar com `yarn check-types` e `grep "pt-BR"` sem resultado em `_components/home/`.
- [x] 1.5 Trocar os textos de `_layout/home-layout.tsx` ("Carregando...", erro de instalação, "Mensagens no período", fallback passado a `thinkzapApiErrorMessage`) por `t(...)`. Verificar com `yarn check-types` e `yarn lint`.
- [ ] 1.6 Validação manual no Bitrix: abrir `/thinkzap`, trocar a bandeira para EN e ES no menu lateral e confirmar que todos os textos mudam sem recarregar e que o período selecionado fica o mesmo. Confirmar também o estado vazio (sem linhas) em EN e o singular/plural de "linha ativa".

## 2. Estrutura de idioma da LP

- [x] 2.1 Criar `lp/thinkzap/_components/content/types.ts` com os tipos atuais de `content.ts` (`TutorialStep`, `TutorialTrack`, `TutorialVariant`, `Tutorial`, `FeatureIcon`, `TUTORIAL_SLUGS`, os `*Screen`, `tutorialTracks`) e o tipo `LpContent`, que cobre `metadata`, `nav`, `languageSwitch`, `hero`, `chatPreview`, `features`, `tutorialsSection`, `player`, `frame` (rótulos dos menus simulados), `tutorials` (trilhas + bloco `screens` por tutorial), `faq`, `finalCta`, `ctaButtons`, `footer` e `whatsappMessage`. Verificar com `yarn check-types`.
- [x] 2.2 Mover a copy atual de `content.ts` para `content/pt.ts` (`satisfies LpContent`), sem mudar o texto, e criar `content/index.ts` com `LpLocale`, `resolveLpLocale` e `getLpContent`. Apagar `content.ts` e atualizar os imports (`tutorial-hash.ts`, `tutorial-player.tsx`, `tutorial-tabs.tsx`, `tutorials/*.tsx`, `resolve-ctas.ts`, testes). Adicionar teste de `resolveLpLocale` (`'en'`→en; `undefined`, `'pt'`, `'fr'`, `['en']`→pt) e verificar que `yarn test` passa com os testes existentes da LP inalterados em comportamento.
- [x] 2.3 Criar `content/locale-context.tsx` (client) com `LpLocaleProvider` e `useLpCopy()`. Verificar com `yarn check-types`.

## 3. Seções server da LP recebendo copy por prop

- [x] 3.1 Fazer `page.tsx` ler `searchParams.lang`, resolver `locale`/`content` e passar a copy a `LpHeader`, `Hero` (inclui `ChatPreview`), `Features`/`SectionHeading`, `HowItWorks`, `Faq`, `FinalCta`, `LpFooter` e `CtaButtons`. As seções deixam de importar constantes globais. Envolver o conteúdo num wrapper com `lang` (`pt-BR`/`en`) e remover `lang="pt-BR"` de `(marketing)/layout.tsx`. Verificar com `yarn check-types` e confirmar que a LP em PT não mudou visualmente.
- [x] 3.2 Fazer `resolveThinkzapCtas` receber a mensagem do WhatsApp do idioma e atualizar `cta-buttons.test.ts`. Adicionar caso que confirma a mensagem EN no link `wa.me`. Verificar que `yarn test` passa.
- [x] 3.3 Fazer `generateMetadata` receber `searchParams` e usar `content.metadata` para title/description, `openGraph.locale` (`pt_BR`/`en_US`), `alternates.canonical` e `alternates.languages`. Verificar abrindo `/lp/thinkzap` e `/lp/thinkzap?lang=en` e inspecionando o `<head>`.

## 4. Tutoriais da LP traduzíveis

- [x] 4.1 Passar `locale` a `TutorialTabs` (prop string), fazer ele resolver `getLpContent(locale)` e envolver o player em `LpLocaleProvider`. Mover para `content.player` as strings de `tutorial-tabs.tsx` e `tutorial-player.tsx` ("Tutoriais", "Passo X de Y", "Concluído", "Próximo", "Concluir", `aria-label` dos pontos de passo e demais textos). `tutorial-hash.ts` passa a usar só a estrutura (slugs/variantes), independente de idioma. Atualizar `tutorials.test.ts` e `tutorial-hash.test.ts` e verificar que `yarn test` passa.
- [x] 4.2 Em `tutorials/shared/frame.tsx`, fazer os itens de `BITRIX_MENU`/`APP_MENU` virarem ids, com rótulos vindos de `useLpCopy().frame`, e extrair os demais textos de `frame.tsx`, `app-pages.tsx`, `crm.tsx` e `open-channel-chat.tsx` para o dicionário. Verificar com `yarn check-types` e a LP em PT visualmente igual.
- [x] 4.3 Extrair para `content.tutorials.<slug>.screens` os textos de `instalacao.tsx` e `ativacao.tsx` (inclui arrays de módulo como `TERMS`). Verificar com `yarn check-types` e percorrendo os dois tutoriais em PT.
- [x] 4.4 Extrair os textos de `thinkbot.tsx` e `api-oficial.tsx`. Verificar com `yarn check-types` e percorrendo os dois tutoriais (e variantes) em PT.
- [x] 4.5 Extrair os textos de `robos.tsx` e `grupos.tsx`. Verificar com `yarn check-types` e percorrendo os dois tutoriais (e variantes) em PT.

## 5. Copy em inglês e seletor EN/PT

- [x] 5.1 Escrever `content/en.ts` (`satisfies LpContent`) com a tradução completa: metadata, header, hero, chat de exemplo, funcionalidades, seção e player de tutoriais, menus simulados, trilhas e telas de todos os tutoriais, FAQ, CTA final, botões, rodapé e mensagem do WhatsApp. Nomes de produto ficam como estão. Verificar com `yarn check-types`.
- [x] 5.2 Adicionar teste de paridade em `tutorials.test.ts`: PT e EN com os mesmos slugs na mesma ordem, as mesmas chaves de variante e a mesma sequência de `screen` por trilha. Verificar que `yarn test` passa.
- [x] 5.3 Adicionar teste de renderização em inglês: `renderToStaticMarkup` de `HowItWorks` (e das seções server) com a copy EN não contém marcadores PT como "Passo", "Próximo", "Concluir", "Tutoriais", "Dúvidas frequentes", "Conexões". Verificar que `yarn test` passa.
- [x] 5.4 Criar `language-switch.tsx` no `LpHeader`, fora do `<nav>` escondido no mobile: grupo com `aria-label`, idioma atual como `<span aria-current="true">`, o outro como link (`/lp/thinkzap?lang=en` ou `/lp/thinkzap`). No clique (client), acrescentar `window.location.hash` ao destino. Adicionar teste de render: EN marcado quando `locale='en'` e link para PT sem parâmetro. Verificar que `yarn test` passa.

## 6. Verificação integrada

- [x] 6.1 Rodar `yarn check-types`, `yarn lint` e `yarn test` em `front/`, todos sem erro.
- [ ] 6.2 Validação manual da LP: `/lp/thinkzap` em PT igual ao atual; `/lp/thinkzap?lang=en` todo em inglês (percorrer cada tutorial e variante até a conclusão, abrir a FAQ, ver o link do WhatsApp); `?lang=fr` cai em PT; seletor visível em largura de celular; trocar de idioma com `#tutorial-thinkbot` aberto mantém o tutorial; HTML sem JS já vem no idioma certo (view-source); `lang` do wrapper e `og:locale` corretos.
- [ ] 6.3 Registrar no PR que a copy em inglês (`content/en.ts`) precisa de revisão do comercial antes de divulgar a URL em inglês.
