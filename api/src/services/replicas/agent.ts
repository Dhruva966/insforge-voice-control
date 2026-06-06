// ⚠️ STRETCH GOAL — only implement if hours 5–6 are free
// Core demo works without this. run_sql + add_index + get_logs = compelling demo.
//
// ⚠️ VERIFY endpoint at hackathon: check https://docs.tryreplicas.com for exact paths
//   Spawn: POST /v1/replica OR /v1/replicas (singular vs plural uncertain)
//   Poll:  GET  /v1/replicas/{id} — verify

export async function spawnCodingAgent(
  task: string,
  repoContext: string
): Promise<{
  agentId: string;
  pollForResult: () => Promise<{ diff: string; filesChanged: string[] }>;
}> {
  const apiKey = process.env.REPLICAS_API_KEY;
  if (!apiKey) throw new Error("REPLICAS_API_KEY not set");

  const res = await fetch("https://api.tryreplicas.com/v1/replica", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message: task,
      coding_agent: "claude",
      repository: repoContext,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Replicas API error ${res.status}: ${text}`);
  }

  const { id: agentId } = (await res.json()) as { id: string };

  return {
    agentId,
    pollForResult: async () => {
      // Poll until status = "completed" — add retry loop in implementation
      const poll = await fetch(`https://api.tryreplicas.com/v1/replicas/${agentId}`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (!poll.ok) throw new Error(`Replicas poll error ${poll.status}`);
      return poll.json() as Promise<{ diff: string; filesChanged: string[] }>;
    },
  };
}
