---
category: config
audience: suporte
summary: Falta a senha de segurança do webhook — sem ela o CRMThink não confia no aviso da Clicksign.
---
# clicksign.webhook.secret_missing

## O que significa
Toda vez que algo acontece com um documento (assinado, recusado, cancelado), a Clicksign manda um aviso automático pro CRMThink — isso é o *webhook*. Junto do aviso vem um código de segurança, gerado a partir de uma senha combinada entre os dois lados, que serve pra provar que o aviso veio mesmo da Clicksign.

Esse erro quer dizer que essa senha nunca foi cadastrada no CRMThink. Sem ela, não tem como conferir o código de segurança e provar que o aviso é legítimo. Por precaução, o CRMThink recusa o aviso, e o documento fica parado — não avança pro próximo passo no Bitrix24.

## Causa provável
- **Integração instalada, mas configuração de webhook nunca preenchida**: o parceiro instalou a Clicksign no portal, porém pulou a etapa de colar a senha de segurança. É o caso mais comum.
- **Senha apagada ao reconfigurar**: se a integração foi refeita ou mexida, o campo da senha pode ter ficado vazio no processo.

## Como verificar
1. Na tela de Logs do app clicksign, filtre pelo `traceKey` do ticket.
2. Confirme `código de erro: clicksign.webhook.secret_missing`.
3. Peça ao parceiro pra abrir as Configurações da integração Clicksign no CRMThink e olhar o campo da senha de segurança do webhook — a expectativa é que ele esteja vazio, o que confirma a causa.

## Como resolver
1. Oriente o parceiro a abrir o painel da Clicksign e copiar (ou gerar, se ainda não existir) a senha de segurança do webhook. É essa senha que faltava pro CRMThink conseguir conferir os avisos.
2. Peça que ele cole essa senha nas Configurações da integração Clicksign no CRMThink, **sem espaços nas pontas**, e salve. Um espaço ou quebra de linha a mais já quebra a conferência.
3. Peça ao parceiro pra fazer uma ação de teste (por exemplo, mover um documento) e confirme na tela de Logs que o aviso passou a ser aceito. Isso prova que os dois lados agora têm a senha certa.

## Quando escalar
Se o campo da senha de segurança nem aparece na tela de configuração (não é só estar vazio, é não existir mesmo), pode ser um problema no próprio sistema — acione a equipe de desenvolvimento. Anexe: `traceKey`, `código de erro: clicksign.webhook.secret_missing`, domínio do parceiro e o horário do evento.
