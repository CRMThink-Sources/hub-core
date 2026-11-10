# Design

## Context

O modo template do widget (`front/app/(widgets)/layouts/template-composer.tsx`) escolhe o template num `<select>` nativo alimentado por `useWidgetTemplates`, que já traz todos os templates aprovados da linha (`name`, `language`, `body`, `buttons`, `header`) numa única chamada. A seleção é um `selectedKey` (`name|language`, via `templateKey`) controlado por `conversation-view.tsx`, que no `onSelectTemplate` zera valores e reavalia a imagem do cabeçalho. Veja `proposal.md` para a motivação.

Já existe `front/components/ui/combobox.tsx` (base-ui), usado em outras telas do front, com campo de busca, estado vazio e item com descrição. O texto da tela do widget é fixo em pt-BR no próprio componente (não usa i18n), então a nova interface segue isso.

## Goals / Non-Goals

**Goals:**
- Filtrar a lista de templates por texto, no cliente, com resposta imediata.
- Manter o contrato do `TemplateComposer` (`selectedKey`, `onSelectTemplate(key)`) para não mexer no `conversation-view.tsx`.

**Non-Goals:**
- Busca no servidor, paginação ou lista virtualizada.
- Ordenação por relevância, favoritos ou "usados recentemente".
- Mudar a aba de templates da tela de conexões (já tem busca própria).

## Decisions

1. **Reusar o `Combobox` de `components/ui` em vez de um input + lista própria.** Já entrega busca, teclado, acessibilidade, estado vazio e portal. Alternativa: `<input>` + `<datalist>` — descartada por estilizar mal e não mostrar descrição do item. Alternativa: construir do zero — retrabalho sem ganho.

2. **Filtro por função pura própria (`filterTemplates`).** O filtro padrão do base-ui compara só o `label`; precisamos de nome + idioma + corpo, sem acento e com várias palavras (AND). A função normaliza (`NFD`, remove diacríticos, minúsculas), divide a busca em termos e exige que todos apareçam no texto `nome idioma corpo`. Fica em `template-search.ts`, ao lado de `template-variables.ts`, para testar sem renderizar. Como o item do combobox só carrega `label`/`description`, o filtro é ligado ao Root por filtro customizado (se o base-ui aceitar) ou controlando `inputValue` e entregando ao combobox os itens já filtrados.

3. **Valor do item = `templateKey(template)`; label = `nome - idioma`; description = trecho do corpo.** Assim o gatilho fechado mostra o mesmo texto de hoje e a chave continua a mesma do `conversation-view`. O trecho (primeiros ~80 caracteres, uma linha, placeholders intactos) vai na `description`, que o `ComboboxItem` já sabe exibir.

4. **Remontar o combobox quando a lista de templates muda** (padrão de `key` de `option-select.tsx`), porque o componente não reflete troca de `items` na mesma instância — os templates chegam depois do carregamento e ao trocar de linha.

5. **Estados mantidos fora do combobox.** `disabled` (`disabled || loading || templates.length === 0`), o aviso de erro e o aviso "nenhum template aprovado" continuam como estão; o placeholder do gatilho continua "Carregando templates..." / "Selecione um template".

## Risks / Trade-offs

- [Popup do combobox (portal) cortado ou atrás de algo no iframe estreito do Bitrix] → conferir no widget real; se preciso, ajustar container do portal ou largura mínima.
- [Corpo muito longo deixa o item pesado] → `description` truncada; o filtro usa o corpo completo.
- [Busca no corpo traz falsos positivos (ex.: "olá" casa em quase tudo)] → aceito: é o pedido (achar pelo conteúdo); nome e idioma ficam visíveis no item para o operador conferir.
- [Teclado virtual em dispositivo móvel] → manter altura máxima do popup (`max-h` do combobox).
- [Mudança visual do campo, de select nativo para popup] → mesmo valor e rótulo fechado; sem mudança de contrato nem de dados.

## Migration Plan

Só front-end, sem migração de dados nem de API. Deploy normal do front; rollback é reverter o commit.
