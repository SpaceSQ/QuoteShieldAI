/** Public list prices in USD per 1M tokens. Estimates for the budget ledger, not invoices. */
const RATES: Record<string, { input: number; output: number }> = {
  "gpt-4o-mini": { input: 0.15, output: 0.6 },
  "gpt-4o": { input: 2.5, output: 10 },
  "gpt-4.1-mini": { input: 0.4, output: 1.6 },
  "gpt-4.1": { input: 2, output: 8 },
  "grok-2-vision-1212": { input: 2, output: 10 },
  "grok-2-vision": { input: 2, output: 10 },
  "grok-4": { input: 3, output: 15 },
};

const FALLBACK_RATE = { input: 2.5, output: 10 };

export function estimateCostUsd(model: string, promptTokens: number, completionTokens: number): number {
  const rate = RATES[model] ?? FALLBACK_RATE;
  const cost = (promptTokens * rate.input + completionTokens * rate.output) / 1_000_000;
  return Math.round(cost * 1_000_000) / 1_000_000;
}

export class ProviderCallError extends Error {
  constructor(readonly status: number) {
    super(
      status === 401 || status === 403
        ? "The vision provider rejected the API key."
        : "The vision provider request failed.",
    );
    this.name = "ProviderCallError";
  }
}

export interface ModelCallResult {
  content: string;
  model: string;
  provider: "openai" | "xai";
  promptTokens: number;
  completionTokens: number;
  estimatedCostUsd: number;
}

function providerName(): "openai" | "xai" {
  return (Deno.env.get("LLM_PROVIDER") ?? "openai").toLowerCase() === "xai" ? "xai" : "openai";
}

function models(provider: "openai" | "xai"): { cheap: string; strong: string } {
  const cheap = Deno.env.get("LLM_CHEAP_MODEL");
  const strong = Deno.env.get("LLM_STRONG_MODEL");
  if (provider === "xai") {
    return {
      cheap: cheap || "grok-2-vision-1212",
      strong: strong || "grok-2-vision-1212",
    };
  }
  return {
    cheap: cheap || "gpt-4o-mini",
    strong: strong || "gpt-4o",
  };
}

function endpoint(provider: "openai" | "xai"): string {
  return provider === "xai" ? "https://api.x.ai/v1/chat/completions" : "https://api.openai.com/v1/chat/completions";
}

function apiKey(provider: "openai" | "xai"): string {
  const key = provider === "xai" ? Deno.env.get("XAI_API_KEY") : Deno.env.get("OPENAI_API_KEY");
  if (!key) {
    throw new ProviderCallError(401);
  }
  return key;
}

export async function callVisionModel(input: {
  tier: 1 | 2;
  system: string;
  userText: string;
  imageBase64: string;
  mimeType: string;
  schemaName: string;
  schema: Record<string, unknown>;
}): Promise<ModelCallResult> {
  const provider = providerName();
  const model = input.tier === 1 ? models(provider).cheap : models(provider).strong;
  const key = apiKey(provider);
  const responseFormat =
    provider === "openai"
      ? { type: "json_schema", json_schema: { name: input.schemaName, strict: true, schema: input.schema } }
      : { type: "json_object" };

  const body = {
    model,
    temperature: 0.2,
    // Tier 2 is the One-Shot Merge: line items, trap flags, and the negotiation email in one JSON object.
    max_tokens: input.tier === 1 ? 500 : 4096,
    response_format: responseFormat,
    messages: [
      { role: "system", content: input.system },
      {
        role: "user",
        content: [
          { type: "text", text: input.userText },
          {
            type: "image_url",
            image_url: {
              url: `data:${input.mimeType};base64,${input.imageBase64}`,
              detail: input.tier === 1 ? "low" : "high",
            },
          },
        ],
      },
    ],
  };

  let response: Response;
  try {
    response = await fetch(endpoint(provider), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(45_000),
    });
  } catch (error) {
    console.error("provider network failure", error instanceof Error ? error.name : "error");
    throw new ProviderCallError(599);
  }

  if (!response.ok) {
    await response.arrayBuffer().catch(() => null);
    throw new ProviderCallError(response.status);
  }

  const payload = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  const content = payload.choices?.[0]?.message?.content;
  if (!content) throw new ProviderCallError(502);
  const promptTokens = payload.usage?.prompt_tokens ?? Math.ceil(input.userText.length / 4) + (input.tier === 1 ? 4000 : 8000);
  const completionTokens = payload.usage?.completion_tokens ?? (input.tier === 1 ? 250 : 700);
  return {
    content,
    model,
    provider,
    promptTokens,
    completionTokens,
    estimatedCostUsd: estimateCostUsd(model, promptTokens, completionTokens),
  };
}
