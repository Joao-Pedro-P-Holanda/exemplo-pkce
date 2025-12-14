# Implementação de OAuth 2.0 com PKCE em uma SPA Segura

## Objetivo do Projeto
Este projeto tem como objetivo desenvolver uma **Single Page Application (SPA)** segura utilizando o fluxo **OAuth 2.0 Authorization Code com PKCE**, demonstrando conceitos fundamentais de segurança em aplicações web, tais como autenticação segura para clientes públicos, controle de autorização por escopos e boas práticas no gerenciamento de tokens.

## Cenário Escolhido

- **Provedor de Autenticação:** GitLab OAuth 2.0  
- **API Externa:** GitLab API  

O GitLab atua simultaneamente como **Authorization Server** e **Resource Server**, permitindo autenticação de usuários e acesso controlado a recursos relacionados a repositórios.

## Perfis de Usuário e Escopos

Foram implementados dois perfis de usuário, diferenciados por escopos OAuth:

### Usuário (Viewer)
- **Escopo:** `read_user`  
- **Permissão:** acesso somente a informações de leitura do perfil.

### Manager
- **Escopos:** `read_user`, `write_repository`  
- **Permissões:** leitura do perfil e criação/gerenciamento de repositórios.

Essa separação permite demonstrar, de forma objetiva, o controle de autorização baseado em escopos.

## Funcionalidades

- Autenticação via GitLab OAuth 2.0  
- Obtenção de token de acesso com **Authorization Code Flow + PKCE**  
- Listagem de informações do usuário autenticado  
- Criação de repositórios (restrita ao perfil Manager)  
- Interface adaptada dinamicamente conforme os escopos concedidos  

## Fluxo OAuth 2.0 com PKCE

A implementação do fluxo segue as boas práticas recomendadas para SPAs:

- **Geração do PKCE:** criação de `code_verifier`, geração do `code_challenge` (SHA-256) e armazenamento temporário no `sessionStorage`.  
- **Redirecionamento:** envio do usuário ao endpoint de autorização do GitLab com `code_challenge` e `state`.  
- **Proteção contra CSRF:** geração e validação do parâmetro `state`.  
- **Troca de Token:** envio do `code` e do `code_verifier` ao endpoint `/token` para obtenção do `access_token`, sem uso de `client_secret`.

## Controle de Autorização

Após a autenticação, os escopos concedidos são analisados e utilizados para renderização condicional da interface:

- Funcionalidades de leitura são exibidas apenas para usuários com `read_user`.  
- Funcionalidades de escrita e gerenciamento são exibidas apenas para usuários com `write_repository`.

## Conclusão

O projeto atende aos requisitos da disciplina de **Segurança**, evidenciando:

- Implementação correta do OAuth 2.0 com PKCE em uma SPA;  
- Uso do parâmetro `state` como proteção contra CSRF;  
- Controle de acesso baseado em escopos OAuth;  
- Aplicação de boas práticas de segurança para clientes públicos.  

A solução demonstra a importância do uso adequado de mecanismos modernos de autenticação e autorização em aplicações web sem backend próprio.

