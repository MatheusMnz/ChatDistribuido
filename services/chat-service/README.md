# chat-service

Serviço de mensagens/chat em tempo real do sistema de chat distribuído.

Stack: **Node.js + TypeScript + Express + Socket.IO + MongoDB (mongoose) + Redis adapter**.

## Responsabilidades

- Criar/listar conversas (`direct` e `group`) e buscar histórico de mensagens.
- Entregar mensagens em tempo real via Socket.IO.
- Escalar horizontalmente: N instâncias atrás do NGINX usando o **Redis adapter**
  do Socket.IO para broadcast entre instâncias (alta disponibilidade).

## Endpoints REST

Todos (exceto `/health`) exigem `Authorization: Bearer <token>`.

| Método | Rota | Descrição |
|---|---|---|
| `POST` | `/api/conversations` | Cria conversa (`direct` reusa a existente entre os 2). |
| `GET` | `/api/conversations` | Lista conversas do usuário (ordenadas por `updatedAt` desc). |
| `GET` | `/api/conversations/:id/messages?limit=50&before=<iso>` | Histórico asc; 403 se não participante. |
| `GET` | `/health` | `{ status: "ok", instance: INSTANCE_ID }` |

## WebSocket (Socket.IO)

Handshake: `io(url, { auth: { token } })` — JWT validado com `JWT_SECRET`.

Cliente → servidor: `conversation:join`, `message:send`, `typing`.
Servidor → cliente: `message:new`, `conversation:updated`, `typing`, `presence`.

## Variáveis de ambiente

Veja `.env.example`. Principais: `PORT`, `MONGO_URL`, `REDIS_URL`, `JWT_SECRET`,
`AUTH_SERVICE_URL`, `INSTANCE_ID`. Sem `REDIS_URL` o serviço roda single-instance.

## Scripts

```bash
npm run dev            # desenvolvimento (ts-node-dev)
npm run build          # compila TypeScript -> dist/
npm start              # roda dist/index.js
npm test               # Jest (usa mongodb-memory-server, sem serviços externos)
npm run test:coverage  # cobertura
```

## Testes

Os testes usam `mongodb-memory-server` (Mongo em memória) e pulam o Redis adapter,
então `npm test` roda **sem nenhum serviço externo**. Incluem unit tests de
persistência/conversas, testes de rota (supertest) e um teste de integração
WebSocket real (dois clientes `socket.io-client`).

## Docker

```bash
docker build -t chat-service .
docker run -p 5000:5000 --env-file .env chat-service
```
