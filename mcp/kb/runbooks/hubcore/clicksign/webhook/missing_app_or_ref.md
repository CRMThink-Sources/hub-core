---
category: validation
audience: suporte
summary: O aviso da Clicksign chegou sem dizer de qual parceiro é — e por isso não pôde ser tratado.
---
# clicksign.webhook.missing_app_or_ref

## O que significa
Toda vez que algo acontece com um documento (assinado, recusado, cancelado), a Clicksign manda um aviso automático pro CRMThink — isso é o *webhook*. O endereço onde esse aviso é entregue carrega, embutidos nele, dois dados de identificação: qual app é e de qual conta de parceiro veio. É assim que o CRMThink descobre a quem o aviso pertence.

Esse erro quer dizer que o aviso chegou, mas o endereço veio sem esses dois identificadores. Sem eles, o CRMThink não consegue ligar o aviso a nenhum parceiro, então não sabe o que fazer e recusa o evento — o documento não avança no Bitrix24.

## Causa provável
- **Endereço de aviso cadastrado errado ou incompleto na Clicksign**: se o endereço registrado na conta da Clicksign estiver cortado ou torto, ele chega sem os identificadores.
- **Configuração do aviso não terminou de ser feita**: ao configurar a integração, a etapa que registra o endereço correto na Clicksign não foi concluída, e sobrou um endereço genérico ou incompleto.

## Como verificar
1. Na tela de Logs do app clicksign, filtre pelo `traceKey` do ticket.
2. Confirme `código de erro: clicksign.webhook.missing_app_or_ref`.
3. Peça ao parceiro pra abrir a conta da Clicksign dele e mostrar o endereço de aviso (webhook) que está cadastrado — assim dá pra ver se ele está completo ou cortado.

## Como resolver
1. Oriente o parceiro a abrir as Configurações da integração Clicksign no CRMThink e salvar de novo. Salvar novamente faz o CRMThink registrar sozinho o endereço correto e completo na Clicksign, com os identificadores no lugar.
2. Se aparecer uma opção de reparar ou refazer o registro do webhook, peça ao parceiro pra usá-la — ela força a recriação do endereço certo.
3. Peça ao parceiro pra conferir na conta da Clicksign que o endereço de aviso ficou completo, e depois faça uma ação de teste pra validar que o próximo aviso é aceito.

## Quando escalar
Se, mesmo depois de salvar de novo e refazer o registro, o endereço continua incompleto ou o erro persiste, o problema não é de configuração — acione a equipe de desenvolvimento. Anexe: `traceKey`, `código de erro: clicksign.webhook.missing_app_or_ref`, domínio do parceiro, o horário do evento e o endereço de aviso (webhook) cadastrado na Clicksign.
