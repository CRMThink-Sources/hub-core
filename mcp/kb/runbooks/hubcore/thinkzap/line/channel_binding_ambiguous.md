---
category: validation
audience: suporte
summary: Este canal aberto está vinculado a mais de uma linha, e não há como saber qual deve responder.
---
# thinkzap.line.channel_binding_ambiguous

## O que significa
O operador escreveu no canal aberto do CRM e a mensagem **não** foi enviada: duas ou mais linhas ativas da instalação estão vinculadas ao mesmo canal, e o evento do Bitrix identifica apenas o canal, não a linha. Sem saber por qual número responder, o envio é recusado.

A recusa é deliberada. Antes desta verificação o sistema escolhia a primeira linha da listagem: a mensagem saía por um número arbitrário, o provider aceitava, o job terminava com sucesso, e o contato do atendimento não recebia nada — falha invisível, que só aparecia como "o cliente diz que não recebeu".

Este estado só existe em instalação configurada **antes** da guarda de vínculo único: hoje o vínculo duplicado é recusado na hora (`thinkzap.line.channel_already_linked`).

## Causa provável
- **Vínculo duplicado antigo**: as duas linhas foram apontadas para o mesmo canal quando isso ainda era aceito.
- **Edição manual na SPA**: o campo de canal do item foi preenchido direto no CRM interno, sem passar pela tela.

## Como verificar
1. Na tela de Logs do app thinkzap, filtre pelo `traceKey` do ticket.
2. Confirme `código de erro: thinkzap.line.channel_binding_ambiguous`.
3. O log e a aba Logs do job trazem `line` (o canal) e os ids das linhas em disputa.
4. Na SPA de itens de assinatura (1146), filtre pelo campo de canal (`ufCrm93Conector`) com o número do canal para ver os itens envolvidos.

## Como resolver
1. Confirme com o parceiro qual linha deve atender aquele canal.
2. Desvincule o canal da(s) outra(s) linha(s) — pela aba Configurações da linha, que é o caminho que valida, ou limpando `ufCrm93Conector` no item.
3. Peça ao operador para reenviar a mensagem. Não há reprocessamento automático: o job falhou e a retentativa cai no mesmo lugar enquanto o vínculo estiver duplicado.
4. Se as duas linhas devem atender, oriente a criar um canal aberto novo para a segunda.

## Quando escalar
Se após deixar um único vínculo o erro continuar, acione a equipe de desenvolvimento — pode haver cache de contexto ainda quente ou item duplicado. Anexe: `traceKey`, `código de erro: thinkzap.line.channel_binding_ambiguous`, domínio do parceiro, o canal e os ids das linhas.
