# Proposal

## Why

Hoje, ao enviar um template com variáveis (`{{1}}`, `{{nome}}`) pelo widget, o operador digita cada valor na mão, mesmo quando ele já está no CRM (nome do contato, valor do negócio, data de vencimento). É lento e sujeito a erro. Já existe, na lista de templates, a ação "imagem padrão do envio"; falta o equivalente para as variáveis: dizer uma vez qual campo do Bitrix alimenta cada uma.

## What Changes

- Nova ação na lista de templates da linha oficial, ao lado de "Imagem padrão": **"Variáveis padrão"** (só em template cujo corpo tem variáveis). Abre um diálogo em que o operador escolhe o tipo de entidade (Lead, Negócio, Contato, Empresa ou SPA) e liga cada variável a um campo do Bitrix daquele tipo.
- O seletor de campo lista os campos da própria entidade e, quando a entidade tem vínculo, os do **Contato** e da **Empresa** vinculados (ex.: no Negócio, "Contato › Nome").
- O ThinkZap guarda o mapeamento por linha + nome + idioma do template + tipo de entidade (mesma chave da imagem padrão, que não muda numa edição do template).
- Ao escolher o template no widget aberto numa entidade, o widget pede ao servidor os valores dos campos mapeados e **preenche as variáveis**. O operador continua podendo editar qualquer valor antes de enviar; o que ele já digitou não é sobrescrito.
- Falha ao ler o CRM não bloqueia o envio: as variáveis ficam vazias, como hoje.
- Novos endpoints na API: catálogo de campos do CRM, ler/gravar o mapeamento e resolver os valores para uma entidade.

## Capabilities

### New Capabilities
- `thinkzap/variaveis-template-oficial`: mapeamento de variável de template para campo do Bitrix (por tipo de entidade), a ação na lista de templates e o preenchimento automático das variáveis no widget.

### Modified Capabilities
<!-- Nenhuma: a imagem padrão, a busca e a edição de template não mudam de comportamento. -->

## Impact

- **API** (`api/src/modules/thinkzap`): nova tabela Prisma + migration (`core_thinkerszap_template_variable_mappings`); port/repositório, casos de uso (catálogo de campos, gravar/ler mapeamento, resolver valores), controllers e rotas em `routes.ts`; leituras no Bitrix via `BitrixClient` (`crm.item.get`, `crm.item.fields`), sujeitas a `bitrix-limits`.
- **Front** (`front/app/(thinkzap)/.../oficial`): item no `template-actions-menu`, novo diálogo, hook em `use-connector-templates`, textos em `messages/{pt,en,es}/thinkzap/configuracoes/templates.json`.
- **Widget** (`front/app/(widgets)/layouts`): pré-preenchimento em `conversation-view` / `template-composer`.
- Sem mudança em envio, fila ou provider: o que muda é só o valor inicial dos campos que o widget já envia.
- Fora de escopo: robô de Bizproc (já tem seu próprio mapeamento de campos), variáveis de botão dinâmico, campanha SMS.
