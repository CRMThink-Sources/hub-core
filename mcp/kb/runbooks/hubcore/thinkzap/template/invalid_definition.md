---
category: validation
audience: suporte
summary: Os dados do template estão inválidos.
---
# thinkzap.template.invalid_definition

## O que significa
O app thinkzap tentou criar ou usar um template, mas os dados que definem esse template estão inconsistentes — por exemplo, nome, idioma, categoria ou os componentes (corpo, botões, variáveis) fora do formato aceito. A operação não seguiu porque a definição do template não é válida. Não é instabilidade: é um problema no conteúdo/estrutura do template.

## Causa provável
- **Campos obrigatórios ausentes ou fora do formato**: nome, idioma ou categoria inválidos.
- **Componentes malformados**: corpo, cabeçalho, botões ou variáveis do template inconsistentes.
- **Variáveis sem correspondência**: número de variáveis declaradas diferente do preenchido.

## Como verificar
1. Na tela de Logs do app thinkzap, filtre pelo `traceKey` do ticket.
2. Confirme `código de erro: thinkzap.template.invalid_definition`.
3. Na linha do log, veja qual parte da definição foi apontada como inválida (nome, idioma, categoria ou componentes).

## Como resolver
1. Reveja com o parceiro a definição do template: nome, idioma, categoria e os componentes.
2. Corrija o item apontado no log (por exemplo, ajustar as variáveis do corpo ou o formato de um botão).
3. Peça para salvar/reenviar o template já corrigido e confirme na tela de Logs que o erro não aparece mais.

## Quando escalar
Se a definição parecer correta e o erro continuar, acione a equipe de desenvolvimento. Anexe: `traceKey`, `código de erro: thinkzap.template.invalid_definition`, domínio do parceiro, o horário do evento e os dados do template usados na tentativa.
