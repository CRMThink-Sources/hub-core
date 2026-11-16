# Spec Delta

## MODIFIED Requirements

### Requirement: Enfileiramento sem recusa e ordem de envio
Toda mensagem de saída da linha não oficial SHALL ser persistida e enviada pela fila de saída, com a cadência ativada ou desativada. Isso vale para todas as origens: resposta do operador, widget (inclusive envio com anexo), robô "Enviar mensagem", robô de botões, Campanha de SMS e falas do bot.

A mensagem que não tem vaga, seja porque a janela atingiu o limite ou porque está em pausa, SHALL NOT ser recusada pela cadência. Ela SHALL aguardar na fila e ser enviada automaticamente quando houver vaga numa janela.

- **Ordem com a cadência ativada:** a ordem de saída SHALL ser FIFO por linha, pela ordem de entrada na fila, sem prioridade entre origens. A resposta do operador SHALL NOT passar na frente de mensagens de robô ou de Campanha de SMS que entraram antes. O mesmo vale enquanto uma janela ou pausa ainda estiver em andamento depois de a cadência ser desativada (ver "Mudança de configuração vale na próxima janela").
- **Ordem com a cadência desativada:** com a cadência desativada e sem janela nem pausa em andamento, a ordem de saída SHALL ser FIFO **por destinatário**, pela ordem de entrada na fila e sem prioridade entre origens. Mensagens de destinatários diferentes SHALL poder sair ao mesmo tempo, sem ordem entre elas, e uma mensagem SHALL NOT esperar por mensagens de outros destinatários que entraram antes.
- **Por destinatário:** mensagens para o mesmo destinatário SHALL sair na ordem em que foram criadas, com a cadência ativada ou desativada, inclusive atravessando janelas e entre origens diferentes.
- **Abertura da janela:** quando a janela abre, no máximo N mensagens da fila SHALL sair nela. As demais aguardam a janela seguinte.
- **Sem tempo máximo:** não há tempo máximo de espera. A mensagem SHALL aguardar o quanto for preciso.
- **Tentativas:** a espera por cadência SHALL NOT consumir as tentativas de envio da mensagem.
- **Linha que não pode enviar:** se a linha deixar de poder enviar com mensagens na fila (linha desconectada, sem assinatura ativa ou removida), as mensagens SHALL seguir a regra de falha já existente da sua origem, em vez de ficar presas.

O limite diário SHALL continuar valendo, verificado no momento do envio real. A mensagem que estava na fila e encontra o limite diário atingido SHALL falhar pela regra do limite diário (`thinkzap.line.daily_limit_reached`). A mensagem enfileirada que sai depois da meia-noite em `America/Sao_Paulo` SHALL contar no dia em que foi enviada.

#### Scenario: Excesso aguarda e sai sozinho
- **WHEN** com N = 20 e D = 1, o widget envia a 21ª mensagem dentro da mesma janela
- **THEN** a mensagem não é recusada
- **AND** ela sai automaticamente quando abre a próxima janela

#### Scenario: FIFO sem prioridade para o operador
- **WHEN** com a cadência ativada, um robô enfileira 40 mensagens com N = 20 e, em seguida, o operador responde um cliente
- **THEN** a resposta do operador sai depois das 40 mensagens do robô

#### Scenario: Ordem por destinatário entre origens
- **WHEN** durante uma pausa o bot fala com um contato e, em seguida, o operador responde o mesmo contato
- **THEN** a fala do bot sai antes da resposta do operador

#### Scenario: Espera longa não expira
- **WHEN** uma mensagem fica 3 horas na fila de cadência
- **THEN** ela é enviada normalmente quando chega a vez dela

#### Scenario: Espera não consome tentativas
- **WHEN** uma mensagem é adiada por cadência três vezes e depois o provider responde com erro
- **THEN** a mensagem ainda tem todas as tentativas de envio disponíveis para esse erro

#### Scenario: Limite diário atingido durante a espera
- **WHEN** uma mensagem aguarda na fila de cadência e o limite diário da linha é atingido antes de ela sair
- **THEN** ela falha com o código `thinkzap.line.daily_limit_reached`
- **AND** a origem informa a falha conforme a capability `thinkzap/limite-diario-mensagens`

#### Scenario: Operador sem cadência
- **WHEN** a linha está com a cadência desativada e o operador responde um cliente
- **THEN** a resposta é persistida, enfileirada e enviada assim que processada, sem espera por janela

#### Scenario: Sem cadência, destinatários diferentes não esperam uns pelos outros
- **WHEN** a linha está com a cadência desativada, sem janela nem pausa em andamento, e dez operadores respondem dez contatos diferentes ao mesmo tempo
- **THEN** as respostas podem sair ao mesmo tempo, e nenhuma delas espera as respostas dos outros contatos que entraram antes

#### Scenario: Sem cadência, o mesmo destinatário mantém a ordem
- **WHEN** a linha está com a cadência desativada e o operador envia um texto e, em seguida, dois anexos para o mesmo contato
- **THEN** o texto sai antes dos anexos, e os anexos saem na ordem em que foram enviados
- **AND** mensagens de outros contatos que entraram na fila entre elas não alteram essa ordem

#### Scenario: Sem cadência, a ordem vale entre origens
- **WHEN** a linha está com a cadência desativada e o bot fala com um contato e, em seguida, o operador responde o mesmo contato
- **THEN** a fala do bot sai antes da resposta do operador

#### Scenario: Desativar durante a janela mantém a ordem da linha até o fim dela
- **WHEN** a linha está numa janela em andamento com mensagens aguardando e o usuário desativa a cadência
- **THEN** até o fim da janela as mensagens continuam saindo na ordem FIFO da linha, respeitando o limite da janela
- **AND** depois do fim da janela as mensagens passam a sair em ordem por destinatário, sem espera por janela

#### Scenario: Ativar a cadência volta à ordem da linha
- **WHEN** a linha estava com a cadência desativada, com mensagens aguardando de vários destinatários, e o usuário ativa a cadência
- **THEN** as mensagens que ainda não saíram passam a sair na ordem FIFO da linha, pela ordem de entrada na fila, respeitando as janelas
