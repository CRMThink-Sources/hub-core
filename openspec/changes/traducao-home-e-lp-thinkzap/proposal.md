# Proposal

## Why

A página inicial do ThinkZap (`/thinkzap`) não muda de idioma quando o usuário troca a bandeira no menu lateral. Todo o texto da home está fixo em português no JSX e os números usam `pt-BR` fixo, então o resto do app vai para EN/ES e a home fica em PT. A LP pública (`/lp/thinkzap`) também é só em português, sem como mostrar a página a prospects de fora do Brasil.

## What Changes

- **Home do ThinkZap traduzível**: todos os textos da home (saudação, subtítulo, estado vazio, título da seção de mensagens, seletor de período, cards de estatística, resumo total, barra Web vs Business, badge "novo", atalhos, estados de carregamento e erro) passam a vir de um namespace de tradução novo (`thinkzap/home`) em `pt`, `en` e `es`, e a home reage à troca de idioma do menu lateral sem recarregar.
- **Números no idioma ativo**: a formatação de números da home segue o idioma ativo em vez de `pt-BR` fixo.
- **LP em inglês**: a LP inteira passa a ter versão em inglês — header, hero, ilustração do chat, funcionalidades, tutoriais (abas, passos, conclusão e os textos das telas simuladas), FAQ, CTA final, rodapé, mensagem pré-preenchida do WhatsApp e metadata (title, description, `og:locale`).
- **Botão EN/PT na LP**: um seletor EN/PT no header da LP, visível também no celular. O idioma vem do parâmetro de URL `?lang=en`; sem parâmetro (ou com valor inválido) a LP fica em português. A URL é compartilhável e renderizada já no idioma certo no servidor.
- **`lang` da LP**: o atributo `lang` do conteúdo da LP passa a acompanhar o idioma renderizado, em vez do `pt-BR` fixo no layout de marketing.

Fora do escopo: espanhol na LP, traduzir outras telas do ThinkZap que já usam i18n, mudar o mecanismo global de idioma do app (cookie `hub_locale`).

## Capabilities

### New Capabilities
- `thinkzap/idioma-home`: a home do ThinkZap é exibida no idioma ativo do app (pt/en/es) e reage à troca de idioma.
- `thinkzap/idioma-lp`: a LP pública do ThinkZap existe em português e inglês, com seletor EN/PT e idioma definido pela URL.

### Modified Capabilities
<!-- nenhuma -->

## Impact

- Front: `front/app/(thinkzap)/thinkzap/_layout/home-layout.tsx` e `front/app/(thinkzap)/thinkzap/_components/home/*`.
- Front: novos arquivos `front/messages/{pt,en,es}/thinkzap/home.json`.
- Front: `front/app/(marketing)/layout.tsx`, `front/app/(marketing)/lp/thinkzap/page.tsx` e todo `lp/thinkzap/_components/` (copy em `content.ts` passa a ter versões pt/en; telas dos tutoriais passam a ler copy por idioma). Os testes da LP (`tutorials.test.ts`, `cta-buttons.test.ts`, `tutorial-hash.test.ts`) precisam acompanhar.
- Sem mudança de API, banco ou dependências.
