# Proposal

## Why

No widget do ThinkZap dentro do CRM, quando a linha é do WhatsApp Oficial, o operador escolhe o template num `<select>` nativo. Em portais com muitos templates aprovados, essa lista vira uma rolagem longa sem como filtrar, e achar o template certo fica lento e propenso a erro (nomes parecidos como `promo_natal` / `promo_natal_v2`, e o mesmo nome em vários idiomas).

## What Changes

- O seletor de template do modo template do widget passa a ter uma **caixa de pesquisa**: o operador abre a lista, digita, e a lista é filtrada na hora.
- A busca é feita no cliente, sobre os templates já carregados (`useWidgetTemplates`), sem nova chamada à API. Casa por **nome**, **idioma** e **texto do corpo** do template, ignorando maiúsculas/minúsculas e acentos, e aceita várias palavras (todas precisam casar).
- Cada item da lista mostra o nome e o idioma, com um trecho do corpo como descrição, para o operador distinguir templates de nome parecido.
- Estado "nenhum resultado" quando a busca não encontra nada; a lista completa volta ao limpar o texto.
- Funciona por teclado (setas, Enter, Esc) e em tela estreita (o widget roda num painel lateral do Bitrix).
- Sem mudança na API, no envio, na chave de seleção (`name|language`), nas variáveis, nos botões, nem na imagem de cabeçalho. Seleção de template continua resetando valores como hoje.

## Capabilities

### New Capabilities
- `thinkzap/busca-template-widget`: seleção de template no widget do CRM com busca por nome, idioma e corpo, e o comportamento de lista vazia, sem resultado e seleção.

### Modified Capabilities
<!-- Nenhuma: os requisitos existentes de widget (botões, imagem, entidade) não mudam. -->

## Impact

- `front/app/(widgets)/layouts/template-composer.tsx`: troca o `<select>` pelo combobox com busca.
- `front/components/ui/combobox.tsx`: reaproveitado (já tem campo de busca, estado vazio e item com descrição). Pode ganhar uma prop de filtro customizado.
- Novo helper puro de filtro/normalização (ao lado de `template-variables.ts`) com testes.
- `front/app/(widgets)/layouts/conversation-view.tsx`: sem mudança de contrato (`onSelectTemplate(key)` permanece).
- API, banco, Bitrix e fluxo de envio: sem impacto.
