# thinkzap/envio-botoes Specification

## Purpose

Define como o ThinkZap deixa o operador montar mensagens com botões (resposta rápida, link e ligação) — no widget de conversa, no widget de botões do Canal Aberto e nos robôs de automação — e quantos botões cada envio aceita.

## Requirements

### Requirement: Adicionar botões do mesmo tipo acumula na lista
Nas telas de composição de botões, adicionar um botão de um tipo compatível com os botões já presentes SHALL acrescentar um novo botão vazio ao final da lista, preservando os botões existentes e o que já foi digitado neles. Isso SHALL valer para resposta rápida (`REPLY`) da mesma forma que para link e ligação.

Como resposta rápida não convive com link/ligação no mesmo envio, a lista SHALL ser reiniciada somente quando o operador adicionar um botão de tipo incompatível com os já presentes (resposta rápida numa lista de link/ligação, ou link/ligação numa lista de resposta rápida), nas telas que permitem essa troca.

#### Scenario: Segunda resposta rápida é acrescentada
- **WHEN** o operador, no widget de conversa com uma linha Z-API, já tem um botão de resposta rápida com o texto "Sim" e clica em "+ Resposta rápida"
- **THEN** a lista passa a ter dois botões de resposta rápida, o primeiro ainda com o texto "Sim" e o segundo vazio

#### Scenario: Primeira resposta rápida em lista vazia
- **WHEN** o operador, sem nenhum botão adicionado, clica em "+ Resposta rápida"
- **THEN** a lista passa a ter um botão de resposta rápida vazio

#### Scenario: Link e ligação continuam se acumulando
- **WHEN** o operador já tem um botão de link preenchido e clica em "+ Ligação" numa linha Z-API
- **THEN** a lista passa a ter o botão de link preservado e um botão de ligação vazio

### Requirement: Limite de 5 botões por envio
Todo envio de mensagem com botões SHALL ter no máximo 5 botões, em qualquer provider. Limites mais restritos do provider SHALL continuar prevalecendo: a linha oficial (HubMessage) aceita no máximo 3 botões de resposta rápida ou 1 botão de link.

Nas telas de composição (widget de conversa, widget de botões do Canal Aberto e robôs de automação oficial e não oficial), ao atingir o limite aplicável o sistema SHALL impedir a adição de novos botões, e uma lista acima do limite SHALL bloquear o envio/salvamento exibindo a mensagem "Esta linha aceita no máximo N botão(ões) por envio.", com N igual ao limite aplicável.

A API SHALL recusar, sem enviar nenhuma mensagem, qualquer pedido de envio de botões (widget, Canal Aberto ou disparo de robô) com mais botões do que o limite aplicável, respondendo com o erro de quantidade de botões excedida.

#### Scenario: Botões de adicionar desabilitam no quinto botão
- **WHEN** o operador, numa linha Z-API, já tem 5 botões na lista
- **THEN** os botões "+ Resposta rápida", "+ Link" e "+ Ligação" ficam desabilitados

#### Scenario: Até 5 botões podem ser enviados
- **WHEN** o operador monta, numa linha Z-API, 5 botões de resposta rápida preenchidos e um corpo de mensagem
- **THEN** o envio fica habilitado e a mensagem é enviada com os 5 botões

#### Scenario: Robô salvo com mais de 5 botões
- **WHEN** a tela de configuração do robô de botões não oficial abre uma configuração gravada com 6 botões
- **THEN** a tela exibe "Esta linha aceita no máximo 5 botão(ões) por envio." e não permite adicionar mais botões

#### Scenario: API recusa mais de 5 botões na Z-API
- **WHEN** um pedido de envio de botões para uma linha Z-API chega à API com 6 botões
- **THEN** a API recusa o pedido com erro de quantidade de botões excedida e nenhuma mensagem é enfileirada ou enviada

#### Scenario: Limite da linha oficial continua menor
- **WHEN** um pedido de envio para uma linha HubMessage chega com 4 botões de resposta rápida
- **THEN** a API recusa o pedido informando o máximo de 3 botões
