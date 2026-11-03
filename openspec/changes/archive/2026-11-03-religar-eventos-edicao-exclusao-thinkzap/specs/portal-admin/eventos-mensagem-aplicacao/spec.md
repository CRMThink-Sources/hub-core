# Spec Delta

## Purpose

Permite ao time de suporte corrigir, pelo backoffice, os portais cuja instalação do ThinkZap ficou sem os eventos de edição e exclusão de mensagem registrados, sem reinstalar o app.

## ADDED Requirements

### Requirement: Ação de religar eventos na tela da aplicação
A tela de aplicação do cliente no backoffice, quando a aplicação for o ThinkZap, SHALL oferecer uma ação para religar os eventos de edição e exclusão de mensagem daquela instalação. A ação SHALL operar só sobre a instalação aberta, nunca sobre outras.

A ação SHALL deixar o portal com os eventos de edição e exclusão registrados no webhook atual, sem duplicar registros que já existam, e SHALL reaplicar o registro do conector para que a edição de mensagem do operador fique habilitada.

#### Scenario: Portal sem os eventos
- **WHEN** o administrador executa a ação numa instalação cujo portal não tem os eventos de edição e exclusão
- **THEN** o portal passa a ter os dois registrados e a tela mostra mensagem de sucesso

#### Scenario: Portal que já tem os eventos
- **WHEN** o administrador executa a ação numa instalação cujo portal já tem os dois eventos no webhook atual
- **THEN** nenhum registro é duplicado e a tela mostra mensagem de sucesso

#### Scenario: Executar duas vezes seguidas
- **WHEN** o administrador executa a ação duas vezes na mesma instalação
- **THEN** a segunda execução termina com sucesso sem alterar o portal

### Requirement: Falhas da ação são explicadas ao administrador
Quando a ação não puder ser concluída, a tela SHALL mostrar o motivo em linguagem do suporte e SHALL NOT mostrar sucesso. A ação SHALL recusar com erro de pré-condição quando a aplicação não for uma instalação do ThinkZap ou quando a instalação não tiver credencial válida, e SHALL responder não encontrado quando a aplicação não existir.

#### Scenario: Aplicação inexistente
- **WHEN** a ação é chamada para uma aplicação que não existe
- **THEN** a resposta é de não encontrado e nada é chamado no portal

#### Scenario: Instalação sem credencial
- **WHEN** o administrador executa a ação numa instalação sem credencial utilizável
- **THEN** a tela mostra o motivo da recusa e nenhum registro é feito

#### Scenario: Aplicação que não é o ThinkZap
- **WHEN** a ação é chamada para uma aplicação que não é o ThinkZap
- **THEN** a resposta é de pré-condição não atendida e nada é chamado no portal

### Requirement: Ação disponível só para administrador autenticado
A ação SHALL exigir a mesma autenticação das demais ações do backoffice sobre aplicações.

#### Scenario: Sem sessão
- **WHEN** a ação é chamada sem sessão de administrador
- **THEN** a resposta é de não autorizado e nada é chamado no portal
