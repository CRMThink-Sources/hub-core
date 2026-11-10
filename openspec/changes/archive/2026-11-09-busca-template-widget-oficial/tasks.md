# Tasks

## 1. Filtro de templates

- [x] 1.1 Criar `front/app/(widgets)/layouts/template-search.ts` com `normalizeSearchText` (minúsculas, sem acento, espaços colapsados) e `filterTemplates(templates, query)` (todas as palavras em nome+idioma+corpo; busca vazia devolve tudo). Verificar com `template-search.test.ts` cobrindo nome, corpo, acento/maiúscula, várias palavras em campos diferentes, idioma, busca vazia/só espaços e sem resultado (`yarn vitest run template-search` em `front`).
- [x] 1.2 No mesmo arquivo, criar `templateSnippet(body, max)` (uma linha, trunca com reticências, corpo vazio devolve vazio). Verificar com teste unitário de truncamento e de quebra de linha.

## 2. Seletor com busca no widget

- [x] 2.1 Em `template-composer.tsx`, trocar o `<select>` por `Combobox`/`ComboboxTrigger`/`ComboboxContent` de `@/components/ui/combobox`, com itens `value=templateKey`, `label="nome - idioma"` e `description=templateSnippet(body)`; manter `disabled`, os placeholders ("Carregando templates..." / "Selecione um template") e `onSelectTemplate(key)`. Verificar no widget de uma linha oficial que escolher um template mostra preview e campos como antes.
- [x] 2.2 Ligar `filterTemplates` à busca do combobox (filtro customizado ou `inputValue` controlado, conforme o base-ui permitir; ajustar `components/ui/combobox.tsx` só se necessário, sem quebrar os outros usos) e usar "Nenhum template encontrado" como texto de vazio. Verificar que digitar "promo" mostra só templates com "promo" e que texto inexistente mostra o estado vazio (teste de componente se o front tiver ambiente para isso; senão roteiro manual descrito no PR).
- [x] 2.3 Remontar o combobox quando a lista de templates muda (`key` por tamanho + primeiro item) e garantir que trocar de linha com template selecionado não deixa valor órfão. Verificar trocando de linha no widget.
- [x] 2.4 Confirmar que trocar de template pela lista ainda zera variáveis e valores de botão e reavalia a imagem de cabeçalho (contrato de `conversation-view.tsx` inalterado). Verificar com `template-variables.test.ts` e roteiro manual: preencher variáveis, trocar de template, ver os campos limpos.

## 3. Verificação final

- [x] 3.1 Rodar `yarn lint`, `yarn tsc --noEmit` e `yarn vitest run` em `front` e verificar que passam.
- [x] 3.2 Teste manual no widget do CRM (painel lateral do Bitrix) com um portal de muitos templates: popup não é cortado, teclado (abrir, digitar, setas, Enter, Esc) funciona, tela estreita ok, e o envio de um template encontrado pela busca chega ao cliente.
