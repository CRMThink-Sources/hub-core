---
category: integration
audience: suporte
summary: A Clicksign recebeu o pedido de envio, mas recusou criar o documento.
---
# clicksign.envelope.create_failed

## O que significa
O sistema montou tudo e mandou o pedido de criação do documento para a Clicksign, mas foi a própria Clicksign que recusou. Ou seja, o problema não está em faltar arquivo ou assinante — chegou até lá, mas a Clicksign disse "não" por algum motivo. O envio não é concluído. A boa notícia é que a Clicksign quase sempre devolve uma mensagem explicando o porquê.

## Causa provável
- **Dado inválido**: algum dado enviado (por exemplo, um CPF ou e-mail em formato errado) não foi aceito pela Clicksign.
- **Limite da conta atingido**: a conta Clicksign do parceiro chegou ao teto de documentos do plano, então novos envios são barrados.
- **Problema na credencial**: o token da empresa está errado ou vencido, e por isso a Clicksign não autoriza a criação.

## Como verificar
1. Na tela de Logs do app clicksign, filtre pelo `traceKey` do ticket.
2. Confirme `código de erro: clicksign.envelope.create_failed`.
3. Leia, na linha do log, a mensagem que a Clicksign devolveu — ela costuma dizer exatamente qual dado ou qual problema causou a recusa. É o seu ponto de partida.

## Como resolver
1. Leia a mensagem da Clicksign no log e identifique o que ela aponta — ela é quem diz o que corrigir.
2. Peça ao parceiro para conferir o token da empresa em Configurações e o status da conta Clicksign (se está ativa e sem limite atingido), pois isso descarta problema de credencial ou de plano.
3. Se a mensagem apontou um dado (como um campo do negócio inválido), oriente o parceiro a corrigir esse dado na origem.
4. Peça que ele reenvie o documento após a correção.

## Quando escalar
Se a mensagem da Clicksign não for clara, ou se o erro continuar mesmo depois de corrigir o dado apontado, acione a equipe de desenvolvimento. Anexe: `traceKey`, `código de erro: clicksign.envelope.create_failed`, domínio do parceiro, o horário do evento, o ID do negócio e a mensagem que a Clicksign retornou.
