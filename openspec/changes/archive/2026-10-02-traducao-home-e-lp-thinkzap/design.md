# Design

## Context

**Home (`/thinkzap`)**: o app usa `i18next` + `react-i18next` (`front/i18n/provider.tsx`) com namespaces JSON em `front/messages/{pt,en,es}/…`, carregados sob demanda por `resourcesToBackend`. O menu lateral chama `setLocale(code)`, que grava o cookie `hub_locale` e chama `i18n.changeLanguage`. As outras telas do ThinkZap (`conexoes`, `bots`, `administracao`, `ajuda`) usam `useTranslation('thinkzap/<ns>')` e trocam de idioma na hora. A home não usa: `home-layout.tsx` e os 8 componentes em `_components/home/` têm todo o texto fixo em português, e `message-stats-card.tsx`, `message-stats-summary.tsx` e `provider-share-bar.tsx` criam `new Intl.NumberFormat('pt-BR')` no módulo. Por isso a home não traduz. Não há falha no mecanismo de idioma, só falta a home usá-lo.

**LP (`/lp/thinkzap`)**: é um server component, fora de qualquer provider do app. O layout `(marketing)/layout.tsx` fixa `lang="pt-BR"` num `div`. A copy fica centralizada em `_components/content.ts` (660 linhas: `HERO`, `FEATURES`, `TUTORIALS` com passos, `FAQ`, `FINAL_CTA`, `WHATSAPP_MESSAGE`) para o comercial revisar num lugar só. Mas as telas simuladas dos tutoriais (`tutorials/*.tsx` e `tutorials/shared/*.tsx`, cerca de 3.000 linhas) têm muito texto direto no JSX: rótulos de mock, menus do Bitrix/app, mensagens de exemplo. `TutorialTabs` e `TutorialPlayer` são client components e importam `TUTORIALS` direto do módulo. O player tem strings fixas ("Passo X de Y", "Próximo", "Concluir", `aria-label`). Os testes (`tutorials.test.ts` etc.) importam as constantes de `content.ts` e renderizam `HowItWorks` com `renderToStaticMarkup`.

## Goals / Non-Goals

**Goals:**
- A home traduzida em pt/en/es, reagindo à troca de idioma do menu lateral.
- A LP inteira em pt e en, escolhida por `?lang=en`, renderizada no servidor, com seletor EN/PT no header.
- Os dois idiomas da LP com a mesma estrutura de tutoriais, garantida pelo sistema de tipos e por testes.

**Non-Goals:**
- Espanhol na LP.
- Usar i18next na LP ou ligar a LP ao cookie `hub_locale`.
- Rotas por segmento (`/en/lp/thinkzap`) ou middleware de idioma.
- Revisar a tradução das demais telas do ThinkZap.

## Decisions

### D1. Home: namespace `thinkzap/home` no i18next já existente
Criar `front/messages/{pt,en,es}/thinkzap/home.json` e trocar cada string da home por `t('…')` com `useTranslation('thinkzap/home')`, no padrão das outras telas. A contagem de linhas usa o plural do i18next (`linhasAtivas_one` / `linhasAtivas_other` com `count`), como já fazem `bots/editor.json` e `bots/lista.json`. A saudação usa interpolação (`"saudacao": "Olá, {{nome}}"`). O fallback de erro de `thinkzapApiErrorMessage(error, …)` passa a receber `t('erroEstatisticas')`. A mensagem que vem do servidor continua intacta.

Os atalhos (`SHORTCUTS`) deixam de guardar texto e guardam só `href`, `icon` e uma chave (`conexoes`, `diretrizes`, `logs`, `ajuda`). O texto é resolvido no render.

*Alternativa descartada:* reaproveitar `thinkzap/aside.json` para os rótulos dos atalhos. As descrições não existem lá, e misturar namespaces só para economizar três chaves acopla a home ao menu.

### D2. Home: formatação de números pelo idioma ativo
Trocar os `Intl.NumberFormat('pt-BR')` de módulo por um formatador derivado de `i18n.language` (via `useTranslation().i18n`), com o mapa `pt → pt-BR`, `en → en-US`, `es → es-ES`. Um helper pequeno em `thinkzap/_lib/` (ex.: `useNumberFormatter()`) evita repetir o mapa nos três componentes. `useMemo` sobre o idioma basta. Como o componente re-renderiza na troca de idioma, o formato acompanha.

### D3. LP: copy como dicionários TypeScript tipados, um por idioma
Separar `content.ts` em:
- `content/types.ts`: os tipos atuais (`TutorialStep`, `Tutorial`, `FeatureIcon`…), `TUTORIAL_SLUGS`, os tipos `*Screen` e `tutorialTracks()`, mais um tipo `LpContent` que descreve o dicionário inteiro (`nav`, `hero`, `chatPreview`, `features`, `tutorialsSection`, `player`, `tutorials`, `faq`, `finalCta`, `ctaButtons`, `footer`, `whatsappMessage`, `metadata`, `languageSwitch`).
- `content/pt.ts` e `content/en.ts`: `export const PT = {…} satisfies LpContent`, com a copy atual movida sem alteração para `pt.ts`.
- `content/index.ts`: `LpLocale = 'pt' | 'en'`, `resolveLpLocale(raw: unknown): LpLocale` (`'en'` vira `en`, qualquer outro valor vira `pt`) e `getLpContent(locale)`.

Os `Tutorial<Screen>` continuam tipados por tela (`Tutorial<InstalacaoScreen>` etc.), então `en.ts` não compila se referenciar uma tela que não existe. Um teste novo compara as duas versões: mesmos slugs na mesma ordem, mesmas chaves de variante e mesma sequência de `screen` em cada trilha.

*Por que não i18next/JSON:* a LP é server-rendered e está de propósito fora dos providers do app. O `I18nProvider` do root é client e escolhe o idioma pelo cookie, o que brigaria com `?lang`. O i18next carrega namespaces de forma assíncrona, o que complica o SSR. Além disso, JSON perderia a verificação de tipo que casa passos com telas. Dicionários TS mantêm a convenção "toda a copy num lugar só" (agora um arquivo por idioma) e funcionam igual em server e client components.

### D4. LP: idioma chega aos componentes por props (server) e por contexto (telas dos tutoriais)
- `page.tsx` passa a receber `searchParams` (Promise, Next 16), resolve `locale = resolveLpLocale(lang)` e `content = getLpContent(locale)`, e entrega a fatia certa a cada seção como prop (`<Hero content={content.hero} …/>`, `<Faq items={content.faq} …/>`). As seções deixam de importar constantes globais.
- `TutorialTabs` (client) recebe `locale` como prop serializável e busca o dicionário com `getLpContent(locale)` do lado do client. Passar só a string evita serializar o dicionário inteiro no payload do RSC. O import fica no bundle do client, mas os dois dicionários somam poucos KB.
- As telas simuladas ficam várias camadas abaixo do player e são funções `Screen` sem props de idioma. Em vez de mudar `ScreenProps` e todas as assinaturas, um `LpLocaleContext` (client, criado em `content/locale-context.tsx`) envolve o player, e cada tela lê `useLpCopy()`. A copy das telas mora num bloco `screens` dentro de cada tutorial no dicionário (ex.: `content.tutorials.instalacao.screens.market.searchPlaceholder`), com tipo próprio por tutorial em `types.ts`. Os arrays de texto de módulo (ex.: `TERMS` em `instalacao.tsx`) passam para esse bloco.
- Menus simulados (`BITRIX_MENU`, `APP_MENU` em `shared/frame.tsx`): os itens hoje servem ao mesmo tempo de id e de rótulo. Eles passam a ser ids estáveis (o texto PT atual pode ser mantido como id para diminuir a mudança), e o rótulo vem de `content.frame.bitrixMenu[id]` / `content.frame.appMenu[id]`.
- `tutorial-hash.ts` usa `TUTORIALS` só para slugs e chaves de variante, que são iguais nos dois idiomas. Ele passa a ler do dicionário PT (ou de uma lista estrutural em `types.ts`), sem depender do idioma.
- `resolveThinkzapCtas` ganha o parâmetro `whatsappMessage` (ou `locale`) para montar o `wa.me` no idioma certo.

### D5. Seletor EN/PT: links simples, com o hash preservado no client
Criar o componente `LanguageSwitch` no `LpHeader`, fora do `<nav>` que tem `hidden md:flex`, para aparecer também no celular. São dois itens, "PT" e "EN". O idioma atual é um `<span aria-current="true">` destacado, e o outro é um `<a href="?lang=en">` (ou `href="/lp/thinkzap"` para PT, a URL canônica sem parâmetro). O grupo tem `aria-label` ("Idioma" / "Language").

Sem JS, o link funciona e cai no topo da página. Com JS, um client component pequeno (`'use client'`) acrescenta `window.location.hash` ao `href` no clique, para manter aberto o tutorial ou a seção. É navegação completa, não `router.push`: o conteúdo é server-rendered e a troca é rara, então basta um recarregamento simples. Ficam de fora estado client e hidratação de dois idiomas.

### D6. `lang` e metadados
- Tirar `lang="pt-BR"` do `(marketing)/layout.tsx`, que é compartilhado e não conhece `searchParams`, e colocar `lang={locale === 'en' ? 'en' : 'pt-BR'}` num wrapper em `page.tsx`. O `<html lang>` do root continua vindo do cookie. O `lang` do wrapper é o que vale para o conteúdo, e é suficiente para leitores de tela e tradutores automáticos.
- `generateMetadata({ searchParams })` resolve o idioma e usa `content.metadata` para `title`/`description`, `openGraph.locale` (`pt_BR` / `en_US`) e `alternates.languages` (`{ 'pt-BR': '/lp/thinkzap', en: '/lp/thinkzap?lang=en' }`), com `alternates.canonical` apontando para a URL do idioma atual.

## Risks / Trade-offs

- **Volume de texto nas telas simuladas** (cerca de 3.000 linhas de JSX) → extrair tutorial por tutorial, um arquivo por vez, e conferir cada um renderizando a LP com `?lang=en`. Um teste de renderização em inglês procura palavras PT características nas telas (ex.: "Próximo", "Passo", "Conexões") e falha se sobrar texto sem extrair.
- **Tradução de marketing feita por dev** → o texto em inglês sai numa primeira versão. `en.ts` fica isolado para o comercial revisar, e isso vai registrado no PR.
- **Diferença entre os idiomas nos tutoriais** (um passo adicionado só em PT) → tipos por tela e o teste de paridade da D3.
- **`searchParams` torna a página dinâmica** → ela já é dinâmica por usar `headers()` em `generateMetadata`, então não há perda de cache.
- **Mudança de import nos testes existentes** (`tutorials.test.ts`, `cta-buttons.test.ts`, `tutorial-hash.test.ts`) → atualizar para `getLpContent('pt')` e rodar a suíte da LP. Os textos esperados continuam os mesmos em PT.
- **Home: namespace carregado sob demanda** → no primeiro render em `en`, o i18next pode mostrar as chaves por um instante até o JSON carregar. As outras telas já convivem com isso. Se incomodar, o `useTranslation` com Suspense (padrão do react-i18next) resolve, mas fica fora do escopo.

## Migration Plan

Mudança só de front, sem dados. Deploy normal. A URL atual da LP (`/lp/thinkzap`) continua em português, e as âncoras (`#tutorial-*`, `#como-funciona`, `#funcionalidades`, `#tutoriais`, `#duvidas`) não mudam. Rollback é reverter o commit.

## Open Questions

- Revisão da copy em inglês pelo comercial antes de divulgar `?lang=en`. Não bloqueia o merge.
