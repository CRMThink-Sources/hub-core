# Spec Delta

## MODIFIED Requirements

### Requirement: Avisos na timeline do CRM
Os comentários que o servidor publica na timeline do CRM SHALL seguir o idioma da instalação:

- falha e entrega incerta do envio pelo widget;
- confirmação de envio pelo widget, pela fila e no envio síncrono com anexo, incluindo os rótulos de remetente, destinatário, mensagem e template;
- resultado do robô "Enviar mensagem" e o aviso de nenhum destinatário;
- todos os comentários do robô de botões e do robô de template: configuração incompleta, linha que não pode enviar, linha de provider diferente do robô, nenhum destinatário, nenhum destinatário válido, destino vazio ou não resolvido (campo vazio e token do Bitrix não resolvido) e enfileirado para.

O conteúdo da mensagem, o nome do template, os telefones, o valor de destino recebido e mensagens de erro vindas da validação SHALL aparecer como vieram.

#### Scenario: Falha no envio pelo widget em inglês
- **WHEN** a instalação está em `en` e uma mensagem do widget falha de forma definitiva
- **THEN** o comentário na timeline sai em inglês, com destinatário e mensagem como foram enviados

#### Scenario: Robô de template em espanhol
- **WHEN** a instalação está em `es` e o robô de template enfileira um template para dois contatos
- **THEN** o comentário na timeline sai em espanhol, com o nome do template e os telefones como estão

#### Scenario: Destino não resolvido em inglês
- **WHEN** a instalação está em `en` e o robô de template recebe o destino `{{{Contato: Celular}}}` sem resolver
- **THEN** o comentário na timeline sai em inglês, explica que o campo não foi resolvido e cita o valor recebido como chegou
