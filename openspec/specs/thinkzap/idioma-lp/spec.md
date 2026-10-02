# thinkzap/idioma-lp Specification

## Purpose

Permite que a landing page pública do ThinkZap (`/lp/thinkzap`) seja exibida em português ou inglês. O visitante escolhe o idioma num seletor EN/PT, e o idioma fica na URL para poder ser compartilhado.

## Requirements

### Requirement: Idioma definido pela URL
A LP SHALL ser renderizada em inglês quando a URL tiver o parâmetro `lang=en`. Nos demais casos (parâmetro ausente, `lang=pt` ou qualquer outro valor), a LP SHALL ser renderizada em português. O conteúdo SHALL sair do servidor já no idioma escolhido, sem depender de JavaScript no navegador e sem piscar o outro idioma.

O idioma da LP NÃO SHALL depender nem alterar a preferência de idioma do app ThinkZap dentro do Bitrix24.

#### Scenario: Visitante abre a LP sem parâmetro
- **WHEN** o visitante acessa `/lp/thinkzap`
- **THEN** a página aparece em português

#### Scenario: Visitante abre a LP em inglês
- **WHEN** o visitante acessa `/lp/thinkzap?lang=en`
- **THEN** o HTML devolvido pelo servidor já vem em inglês

#### Scenario: Valor de idioma inválido
- **WHEN** o visitante acessa `/lp/thinkzap?lang=fr`
- **THEN** a página aparece em português

#### Scenario: Preferência do app não interfere
- **WHEN** o visitante tem o idioma do app ThinkZap salvo como `en` e acessa `/lp/thinkzap` sem parâmetro
- **THEN** a LP aparece em português

### Requirement: Seletor EN/PT no header
O header da LP SHALL ter um seletor com as opções "PT" e "EN", visível em todas as larguras de tela, inclusive no celular. A opção do idioma atual SHALL aparecer marcada, visualmente e para leitores de tela. Escolher a outra opção SHALL abrir a LP no outro idioma, mudando o parâmetro `lang` da URL. A âncora da seção ou do tutorial aberto SHALL ser mantida quando o navegador tiver JavaScript.

#### Scenario: Trocar de PT para EN
- **WHEN** o visitante, na LP em português, clica em "EN"
- **THEN** a LP passa a aparecer em inglês e a URL fica com `lang=en`

#### Scenario: Trocar de EN para PT
- **WHEN** o visitante, na LP em inglês, clica em "PT"
- **THEN** a LP passa a aparecer em português

#### Scenario: Seletor no celular
- **WHEN** o visitante abre a LP numa tela estreita, em que os links de navegação do header ficam escondidos
- **THEN** o seletor EN/PT continua visível

#### Scenario: Idioma atual marcado
- **WHEN** a LP está em inglês
- **THEN** a opção "EN" aparece marcada como atual e "PT" aparece como link para trocar

#### Scenario: Troca mantém o tutorial aberto
- **WHEN** o visitante está com o tutorial `#tutorial-thinkbot` aberto em português e clica em "EN"
- **THEN** a LP abre em inglês com o mesmo tutorial selecionado

### Requirement: LP inteira traduzida
Em inglês, todo texto visível da LP SHALL estar em inglês: links de navegação e botão do header, hero, ilustração da conversa, funcionalidades, título e subtítulo da seção de tutoriais, abas e submenus, título/descrição/ação de cada passo, contador de passos, botões de navegação, tela de conclusão, textos dentro das telas simuladas dos tutoriais, FAQ (perguntas, respostas e links), CTA final (inclusive o texto usado quando não há CTA configurado), botões de CTA e rodapé. Os rótulos acessíveis (ex.: `aria-label`, texto alternativo e o anúncio de mudança de passo) SHALL acompanhar o idioma.

Os tutoriais em inglês SHALL ter as mesmas abas, variantes, âncoras e quantidade de passos da versão em português. Os nomes próprios de produto ("ThinkZap", "ThinkBot", "Bitrix24", "WhatsApp") NÃO SHALL ser traduzidos.

#### Scenario: Seções principais em inglês
- **WHEN** a LP é renderizada com `lang=en`
- **THEN** header, hero, funcionalidades, FAQ, CTA final e rodapé aparecem em inglês

#### Scenario: Tutorial em inglês do começo ao fim
- **WHEN** o visitante, na LP em inglês, percorre qualquer tutorial até a tela de conclusão
- **THEN** o contador de passos, os títulos e descrições dos passos, os textos das telas simuladas, os botões e a tela de conclusão aparecem em inglês

#### Scenario: Mesma estrutura de tutoriais nos dois idiomas
- **WHEN** a LP é renderizada em português e em inglês
- **THEN** as duas versões têm as mesmas abas, na mesma ordem, com as mesmas âncoras `#tutorial-<slug>` e a mesma quantidade de passos em cada trilha

### Requirement: Mensagem do WhatsApp no idioma da LP
O botão "Falar no WhatsApp" SHALL abrir a conversa com a mensagem pré-preenchida no idioma em que a LP está.

#### Scenario: CTA de WhatsApp na LP em inglês
- **WHEN** o visitante, na LP em inglês, clica no botão de falar no WhatsApp
- **THEN** o link aberto traz a mensagem pré-preenchida em inglês

### Requirement: Metadados e idioma do documento
O título, a descrição e o `og:locale` da LP SHALL estar no idioma renderizado (`pt_BR` para português, `en_US` para inglês). O conteúdo da LP SHALL declarar o atributo `lang` do idioma renderizado (`pt-BR` ou `en`). A página SHALL anunciar as duas versões como alternativas de idioma uma da outra.

#### Scenario: Metadados em inglês
- **WHEN** a LP é renderizada com `lang=en`
- **THEN** o `<title>`, a meta description e o `og:locale` (`en_US`) estão em inglês e o conteúdo declara `lang="en"`

#### Scenario: Alternativas de idioma anunciadas
- **WHEN** a LP é renderizada em qualquer idioma
- **THEN** os metadados listam a versão em português e a versão em inglês como alternativas de idioma
