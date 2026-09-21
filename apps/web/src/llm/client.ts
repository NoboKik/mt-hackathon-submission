// The one LLM call: an OpenAI-compatible /chat/completions POST. Plain fetch, no SDK — switching
// provider (opencode go → OpenRouter → DeepSeek) is an edit to apps/web/.env, not to code.
// Server only (like db/index.ts, `server-only` isn't installed): never import this from a client
// component — the key must not reach a bundle the browser loads.

export type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string }

export class LlmConfigError extends Error {}

/** Read at call time, not import time: the app boots without a key and only auto mode needs one. */
export function llmConfig() {
  const { LLM_BASE_URL: baseUrl, LLM_API_KEY: apiKey, LLM_MODEL: model } = process.env
  if (!baseUrl || !apiKey || !model)
    throw new LlmConfigError('LLM_BASE_URL, LLM_API_KEY and LLM_MODEL must be set in apps/web/.env')
  return { baseUrl: baseUrl.replace(/\/+$/, ''), apiKey, model }
}

export async function complete(
  messages: ChatMessage[],
  opts: { timeoutMs?: number; session?: string } = {},
): Promise<string> {
  const { baseUrl, apiKey, model } = llmConfig()
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
      // opencode go refuses requests without both; every other provider ignores them.
      'user-agent': 'provodnik400/0.1',
      ...(opts.session ? { 'x-opencode-session': opts.session } : {}),
    },
    body: JSON.stringify({
      model,
      messages,
      // DeepSeek's JSON mode needs the word "json" in the prompt; the system prompt has it.
      response_format: { type: 'json_object' },
      temperature: 0.9,
      // Optional: `low` is ~3× faster than the default on DeepSeek flash, and the validator plus
      // retries catch what the shorter think misses. Unset, it isn't sent — some models 400 on it.
      ...(process.env.LLM_REASONING_EFFORT
        ? { reasoning_effort: process.env.LLM_REASONING_EFFORT }
        : {}),
    }),
    signal: AbortSignal.timeout(opts.timeoutMs ?? 120_000),
  })
  if (!res.ok) throw new Error(`LLM ${res.status}: ${(await res.text()).slice(0, 300)}`)
  const data = (await res.json()) as { choices?: { message?: { content?: unknown } }[] }
  // content only: reasoning_content is the model thinking aloud, and it is not JSON.
  const content = data.choices?.[0]?.message?.content
  if (typeof content !== 'string' || !content) throw new Error('LLM: empty message.content')
  return content
}
