# Sistema de Chat Distribuído

Plataforma de chat em tempo real com arquitetura de **microsserviços**, comunicação
**assíncrona via WebSockets**, **escalabilidade horizontal** e **alta disponibilidade**.
Trabalho Final de Sistemas Distribuídos — CEFET-MG (2026/1).

## Tecnologias

| Camada | Tecnologia | Por quê |
|---|---|---|
| Linguagem | **TypeScript** (Node.js) | Tipagem estática em todo o stack |
| Auth Service | Express + PostgreSQL + JWT + bcrypt | Dados de usuário são relacionais; JWT permite autenticação **stateless** (escalável) |
| Chat Service | Express + **Socket.IO** + MongoDB | Mensagens são semi-estruturadas e de alta escrita → NoSQL; WebSockets para tempo real |
| Escala do chat | **Redis** (Socket.IO adapter) | Pub/Sub entre instâncias → broadcast funciona com N réplicas |
| Front-end | React + Vite | SPA responsiva |
| Gateway / LB | **NGINX** | Ponto único de entrada + balanceamento de carga |
| Orquestração | Docker Compose | Sobe todo o sistema com um comando |

A arquitetura completa (contrato de APIs, eventos WebSocket e modelos de dados)
está em [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

```
Navegador ─► NGINX :8080 ─┬─► auth-service :4000 ─► PostgreSQL
                          ├─► chat-service-1 :5000 ─┬─► MongoDB
                          ├─► chat-service-2 :5000 ─┤
                          │        (Redis Pub/Sub) ─┘─► Redis
                          └─► frontend (SPA)
```

## Como executar (tudo de uma vez)

Pré-requisito: **Docker** e **Docker Compose**.

```bash
git clone <https://github.com/MatheusMnz/ChatDistribuido>
cd chat-distribuido
cp .env.example .env          # (opcional) ajuste o JWT_SECRET
docker compose up --build
```

Acesse a aplicação em **http://localhost:8080**.

Registre dois usuários (em abas/janelas anônimas diferentes), inicie uma conversa
e veja as mensagens chegando em tempo real. Crie um grupo selecionando vários
usuários para testar o envio 1:N.

### Escalabilidade horizontal

O `docker-compose.yml` já sobe **duas instâncias** do chat (`chat-service-1` e
`chat-service-2`) atrás do NGINX. Graças ao **Redis adapter**, uma mensagem enviada
por um usuário conectado na instância 1 é entregue a um usuário conectado na
instância 2. Para adicionar mais réplicas, basta duplicar o serviço no compose e
incluí-lo no `upstream` do [nginx/nginx.conf](nginx/nginx.conf).

### Alta disponibilidade

Derrube uma instância e o chat continua funcionando:

```bash
docker compose stop chat-service-1
# a aplicação segue operante pela chat-service-2
```

## Como testar

### Testes unitários e de integração (por serviço, sem dependências externas)

```bash
cd services/auth-service && npm install && npm test     # 20 testes
cd services/chat-service && npm install && npm test     # 25 testes (inclui socket em tempo real)
```

Os testes do chat usam `mongodb-memory-server` e os do auth mockam o repositório —
nenhum banco real é necessário.

### Testes ponta-a-ponta e de carga (com a stack no ar)

Com `docker compose up` rodando, em outro terminal:

```bash
cd load-tests && npm install
npm run e2e      # integração auth ⇄ chat (autentica e envia mensagem)
npm run load     # 12 usuários simultâneos trocando mensagens (PDF exige ≥10)
npm run lb       # evidência de balanceamento entre as 2 instâncias
```

Veja [load-tests/README.md](load-tests/README.md) para parâmetros.

## Estrutura

```
chat-distribuido/
├── docker-compose.yml          # orquestra todos os componentes
├── nginx/nginx.conf            # gateway + balanceamento de carga
├── docs/ARCHITECTURE.md        # contrato técnico do sistema
├── services/
│   ├── auth-service/           # microsserviço de autenticação/usuário
│   └── chat-service/           # microsserviço de mensagens/chat (WebSocket)
├── frontend/                   # SPA React (interface do usuário)
└── load-tests/                 # testes de integração, carga e balanceamento
```

## Funcionalidades

- [x] Cadastro e login com senha (hash bcrypt) e autenticação JWT
- [x] Conversas diretas **1:1** (privadas)
- [x] Conversas em grupo **1:N**
- [x] Entrega de mensagens em **tempo real** (WebSockets)
- [x] **Histórico** persistido (MongoDB)
- [x] Indicador de digitação e presença online
- [x] Interface **responsiva** (desktop e mobile)
- [x] **Escalabilidade horizontal** (múltiplas instâncias + Redis)
- [x] **Balanceamento de carga** (NGINX)
- [x] Testes unitários, de integração e de carga (≥10 usuários)
