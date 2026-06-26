/**
 * Teste de Concorrência/Carga — Sistema de Chat Distribuído.
 *
 * Simula N usuários simultâneos (padrão 12, mínimo exigido pelo PDF = 10) que:
 *   1. Registram/logam no auth-service (através do gateway / balanceador);
 *   2. Abrem conexões WebSocket simultâneas no chat-service (balanceado);
 *   3. Entram num grupo único 1:N e trocam mensagens em paralelo;
 *   4. Medimos a latência de entrega ponta-a-ponta e a taxa de entrega.
 *
 * Objetivo (PDF): provar a Escalabilidade Horizontal e o funcionamento do
 * balanceamento de carga entre as instâncias chat-service-1 e chat-service-2.
 *
 * Uso:  npm run load            (12 usuários, 5 mensagens cada)
 *       USERS=20 MSGS=10 npm run load
 *
 * Requer a stack no ar:  docker compose up --build
 */
import { Socket } from "socket.io-client";
import {
  ensureUser,
  connectSocket,
  percentile,
  randomSuffix,
  sleep,
  SessionUser,
} from "./helpers";

const USERS = Number(process.env.USERS ?? 12);
const MSGS_PER_USER = Number(process.env.MSGS ?? 5);

interface Pending {
  sentAt: number;
}

async function main() {
  console.log(`\n=== Teste de Carga: ${USERS} usuários simultâneos, ${MSGS_PER_USER} msgs/usuário ===\n`);
  if (USERS < 10) console.warn("⚠️  O PDF exige no mínimo 10 usuários simultâneos.\n");

  const run = randomSuffix();

  // 1) Login simultâneo de todos os usuários ----------------------------------
  console.log("→ Autenticando usuários (em paralelo)...");
  const tLogin = Date.now();
  const users: SessionUser[] = await Promise.all(
    Array.from({ length: USERS }, (_, i) => ensureUser(`load_${run}_u${i}`)),
  );
  console.log(`  ✓ ${users.length} usuários autenticados em ${Date.now() - tLogin} ms`);

  // 2) Conexões WebSocket simultâneas -----------------------------------------
  console.log("→ Abrindo conexões WebSocket simultâneas...");
  const tConn = Date.now();
  const sockets: Socket[] = await Promise.all(users.map((u) => connectSocket(u)));
  console.log(`  ✓ ${sockets.length} sockets conectados em ${Date.now() - tConn} ms`);

  // 3) Criação do grupo 1:N (todos os participantes) --------------------------
  const creator = users[0];
  const { data: group } = await creator.http.post("/conversations", {
    type: "group",
    name: `Carga ${run}`,
    participantIds: users.map((u) => u.id),
  });
  console.log(`→ Grupo 1:N criado (id=${group.id}) com ${users.length} participantes`);

  // Todos entram na sala da conversa
  await Promise.all(
    sockets.map(
      (s) =>
        new Promise<void>((resolve) => {
          s.emit("conversation:join", { conversationId: group.id });
          resolve();
        }),
    ),
  );
  await sleep(500);

  // 4) Instrumentação de recebimento ------------------------------------------
  const expectedTotal = USERS * MSGS_PER_USER * USERS; // cada msg deve chegar a todos
  let received = 0;
  const latencies: number[] = [];
  const pending = new Map<string, Pending>();

  for (const s of sockets) {
    s.on("message:new", (msg: { content: string; conversationId: string }) => {
      if (msg.conversationId !== group.id) return;
      received++;
      const p = pending.get(msg.content);
      if (p) latencies.push(Date.now() - p.sentAt);
    });
  }

  // 5) Envio simultâneo de mensagens ------------------------------------------
  console.log(`→ Enviando ${USERS * MSGS_PER_USER} mensagens em rajada...\n`);
  const tSend = Date.now();
  for (let m = 0; m < MSGS_PER_USER; m++) {
    await Promise.all(
      users.map((u, i) => {
        const content = `msg-${run}-u${i}-n${m}`;
        pending.set(content, { sentAt: Date.now() });
        u.socket!.emit("message:send", { conversationId: group.id, content });
        return Promise.resolve();
      }),
    );
    await sleep(50); // pequeno espaçamento entre rajadas
  }

  // 6) Aguarda a propagação ----------------------------------------------------
  const deadline = Date.now() + 15000;
  while (received < expectedTotal && Date.now() < deadline) {
    await sleep(200);
  }
  const elapsed = Date.now() - tSend;

  // 7) Relatório ---------------------------------------------------------------
  const deliveryRate = (received / expectedTotal) * 100;
  const sentMsgs = USERS * MSGS_PER_USER;
  console.log("================ RESULTADO ================");
  console.log(`Usuários simultâneos......: ${USERS}`);
  console.log(`Mensagens enviadas........: ${sentMsgs}`);
  console.log(`Entregas esperadas (fan-out): ${expectedTotal}`);
  console.log(`Entregas recebidas........: ${received}`);
  console.log(`Taxa de entrega...........: ${deliveryRate.toFixed(2)}%`);
  console.log(`Vazão (entregas/s)........: ${(received / (elapsed / 1000)).toFixed(0)}`);
  console.log(`Latência p50/p95/p99 (ms).: ${percentile(latencies, 50)} / ${percentile(latencies, 95)} / ${percentile(latencies, 99)}`);
  console.log(`Latência máx (ms).........: ${Math.max(0, ...latencies)}`);
  console.log("===========================================\n");

  sockets.forEach((s) => s.close());

  if (deliveryRate < 99) {
    console.error("❌ FALHA: taxa de entrega abaixo de 99%.");
    process.exit(1);
  }
  console.log("✅ SUCESSO: todas as mensagens entregues a todos os participantes em tempo real.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Erro no teste de carga:", err?.message ?? err);
  process.exit(1);
});
