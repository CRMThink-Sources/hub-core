---
category: integration
audience: suporte
summary: As configurações salvaram, mas o CRMThink não conseguiu registrar na Clicksign o canal que traz os avisos automáticos.
---
# clicksign.settings.webhook_sync_failed

## O que significa
Pra que o CRMThink saiba o que acontece com cada documento (foi assinado, foi recusado, etc.), a Clicksign precisa mandar avisos automáticos toda vez que algo muda — esses avisos se chamam *webhook*. Esse canal de avisos não vem pronto: quando o parceiro salva as configurações, o CRMThink pede à Clicksign, de forma automática, pra ligar esse canal. Este erro quer dizer que as configurações foram salvas, mas esse pedido de ligar o canal de avisos falhou. Na prática, o cadastro pode ficar salvo enquanto o CRMThink deixa de receber as atualizações da Clicksign, e os documentos parecem "travar" sem mudar de status.

## Causa provável
- **Credencial da Clicksign inválida ou vencida** (mais comum): pra pedir o canal de avisos, o CRMThink usa uma senha de acesso da conta Clicksign do parceiro (a credencial). Se ela está errada, foi trocada ou venceu, a Clicksign recusa o pedido.
- **Clicksign fora do ar no momento**: se o sistema da Clicksign estava instável ou indisponível bem na hora em que o parceiro salvou, o pedido não foi concluído mesmo com a credencial certa.

## Como verificar
1. Na tela de Logs do app clicksign, filtre pelo `traceKey` do ticket.
2. Confirme `errorCode: clicksign.settings.webhook_sync_failed`.
3. Confira no log se o erro aconteceu exatamente no momento em que o parceiro salvou as configurações. Isso confirma que a falha foi no pedido automático de ligar o canal de avisos, e não em outra etapa.

## Como resolver
1. Oriente o parceiro a abrir as Configurações da integração Clicksign no portal dele.
2. Peça ao parceiro pra conferir se a credencial da conta Clicksign está preenchida e correta. É ela que autoriza o CRMThink a ligar o canal de avisos; se estiver errada, nada mais adianta.
3. Oriente o parceiro a salvar as configurações de novo. Salvar faz o CRMThink repetir o pedido de ligar o canal — se a credencial já estava certa ou a Clicksign só estava instável antes, agora costuma passar.
4. Se a tela tiver a opção de "reparar provisionamento", peça ao parceiro pra usá-la. Ela força um novo pedido de registro do canal, sem precisar mexer no resto do cadastro.

## Quando escalar
Se a credencial da Clicksign está confirmada como correta e o erro continua depois de salvar de novo e de tentar o reparo de provisionamento, acione a equipe de desenvolvimento. Anexe: `traceKey`, `errorCode: clicksign.settings.webhook_sync_failed`, domínio do parceiro, o horário do evento e a confirmação de que a credencial foi conferida.
