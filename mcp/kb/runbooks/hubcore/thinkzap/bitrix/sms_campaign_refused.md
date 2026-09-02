---
category: config
audience: suporte
summary: "Um destinatário da campanha de SMS foi recusado antes do envio: linha sem habilitação, canal desconectado, corpo fora do formato exigido ou telefone inválido."
---
# thinkzap.bitrix.sms_campaign_refused

## O que significa
O app thinkzap é o canal de envio das campanhas de SMS do Bitrix24 do parceiro. O Bitrix chama o app uma vez **por destinatário** da campanha; este erro indica que um desses destinatários foi recusado **antes** de qualquer envio. Nenhuma mensagem saiu para ele e nada foi cobrado. Os demais destinatários seguem normalmente — a recusa é por contato.

O destinatário recusado aparece como **failed** na tela de campanha do Bitrix.

## Causa provável
- **Linha sem habilitação**: a assinatura que paga a linha venceu ou foi cancelada. É a primeira checagem, antes do conteúdo.
- **Corpo sem o prefixo de template numa linha do WhatsApp Oficial**: campanha é envio frio, fora da janela de 24 horas, e o WhatsApp Oficial só permite isso com template aprovado. A primeira linha do corpo precisa ser `[[template:<nome>:<idioma>]]`, com os valores das variáveis nas linhas seguintes.
- **Template inexistente ou contagem de variáveis errada**: o template declarado não está no catálogo daquela linha, ou o corpo trouxe menos (ou mais) valores do que o template espera.
- **Canal do WhatsApp Oficial desconectado**: o número ainda não concluiu a conexão, então não há catálogo de template.
- **Prefixo de template numa linha Z-API**: linha não oficial envia texto livre. Se o corpo vier com o prefixo, o envio é recusado — mandar `[[template:...]]` literal ao contato seria pior.
- **Telefone inválido**: o número do destinatário não é válido depois da normalização.

## Como verificar
1. Na tela de Logs do app thinkzap, filtre pelo `traceKey` do ticket.
2. Confirme `código de erro: thinkzap.bitrix.sms_campaign_refused` e leia o campo `reason` — ele nomeia qual das causas acima ocorreu.
3. Confira na tela de campanha do Bitrix se a falha atingiu **um** destinatário ou **todos**: todos indica problema no corpo ou na linha, um indica problema no contato.

## Como resolver
1. **Linha sem habilitação**: regularize a assinatura da linha e peça para o parceiro redisparar a campanha.
2. **Corpo sem prefixo, ou template errado**: peça ao parceiro que edite o corpo da campanha no Bitrix e comece pela linha `[[template:<nome>:<idioma>]]`, seguida de um valor por linha, na ordem das variáveis. O nome e o idioma têm de ser exatamente os do template aprovado daquela linha.
3. **Canal desconectado**: conclua a conexão do número do WhatsApp Oficial antes de redisparar.
4. **Prefixo em linha Z-API**: remova o prefixo — linha não oficial envia texto livre.
5. **Telefone inválido**: corrija o telefone do contato no CRM e redispare para ele.

## Quando escalar
Se a linha estiver ativa e conectada, o corpo estiver no formato acima com o template correto e a contagem de variáveis certa, e a recusa continuar, acione a equipe de desenvolvimento. Anexe: `traceKey`, `código de erro: thinkzap.bitrix.sms_campaign_refused`, o `reason` do log, domínio/portal do parceiro, horário do evento, e-mail da conta, o id da linha e o corpo da campanha.
