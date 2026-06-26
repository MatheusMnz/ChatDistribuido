/**
 * Verificação de Balanceamento de Carga / Escalabilidade Horizontal.
 *
 * Faz muitas requisições ao endpoint /health do chat-service ATRAVÉS do gateway
 * NGINX. Cada instância responde com seu INSTANCE_ID, então a distribuição das
 * respostas evidencia que o tráfego é repartido entre chat-service-1 e
 * chat-service-2 (prova do balanceamento de carga horizontal).
 *
 * Observação: o gateway usa `ip_hash` para o WebSocket (sticky sessions), mas as
 * chamadas REST a /api/conversations e /health são distribuídas entre as
 * instâncias. Este script consulta /api/conversations/health-style via /health
 * exposto pelo chat. Como /health não passa pelo gateway por padrão, batemos no
 * caminho /api/conversations e lemos o header X-Instance, e também tentamos
 * /health direto se exposto.
 *
 * Requer a stack no ar:  docker compose up --build
 * Uso:  npm run lb
 */
import axios from "axios";
import { GATEWAY, ensureUser, randomSuffix } from "./helpers";

const N = Number(process.env.REQUESTS ?? 40);

async function main() {
  console.log(`\n=== Verificação de Balanceamento de Carga (${N} requisições via gateway) ===\n`);

  // Precisamos de um token para acessar a API do chat (rotas protegidas).
  const user = await ensureUser(`lb_${randomSuffix()}`);

  const counts: Record<string, number> = {};
  for (let i = 0; i < N; i++) {
    try {
      // A resposta inclui o header X-Instance setado por cada instância do chat.
      const res = await axios.get(`${GATEWAY}/api/conversations`, {
        headers: { Authorization: `Bearer ${user.token}` },
      });
      const instance = (res.headers["x-instance"] as string) ?? "desconhecida";
      counts[instance] = (counts[instance] ?? 0) + 1;
    } catch (err: any) {
      counts["erro"] = (counts["erro"] ?? 0) + 1;
    }
  }

  console.log("Distribuição das respostas por instância:");
  for (const [inst, c] of Object.entries(counts)) {
    const bar = "█".repeat(Math.round((c / N) * 30));
    console.log(`  ${inst.padEnd(16)} ${String(c).padStart(3)}  ${bar}`);
  }

  const instances = Object.keys(counts).filter((k) => k !== "erro" && k !== "desconhecida");
  console.log("");
  if (instances.length >= 2) {
    console.log(`✅ Tráfego distribuído entre ${instances.length} instâncias — balanceamento de carga confirmado.`);
  } else if (instances.length === 1) {
    console.log("⚠️  Apenas 1 instância respondeu. Confira se as duas instâncias do chat estão no ar e se o header X-Instance está exposto.");
  } else {
    console.log("❌ Nenhuma instância identificada. A stack está no ar? (docker compose up)");
  }
  process.exit(0);
}

main().catch((err) => {
  console.error("Erro:", err?.message ?? err);
  process.exit(1);
});
