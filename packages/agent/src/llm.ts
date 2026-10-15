import { createVertex } from '@ai-sdk/google-vertex';
import { generateText, NoObjectGeneratedError, Output } from 'ai';
import type { z } from 'zod';

/**
 * Provider adapter (decision #2): Gemini on Vertex today, swappable later.
 * `fast` = analysis steps (Flash), `pro` = brief writer + critic (Pro).
 */
export interface LlmAdapter {
  readonly name: string;
  object<S extends z.ZodType>(opts: {
    schema: S;
    prompt: string;
    system?: string;
    tier: 'fast' | 'pro';
    temperature?: number;
  }): Promise<z.infer<S>>;
  text(opts: {
    prompt: string;
    system?: string;
    tier: 'fast' | 'pro';
    temperature?: number;
  }): Promise<string>;
}

/**
 * Our LLM steps rewrite structured facts; they don't need long reasoning, and
 * default thinking made Flash take 60 s+ per call. Gemini 3.x takes a thinking
 * level, 2.5 a token budget (2.5 Pro can't go below 128).
 */
export function thinkingConfig(modelId: string, tier: 'fast' | 'pro') {
  const v3 = /^gemini-[3-9]/.test(modelId);
  // 'minimal' is rejected by gemini-3.8-flash (400); 'low' halves latency vs the default.
  if (tier === 'fast') return v3 ? { thinkingLevel: 'low' as const } : { thinkingBudget: 0 };
  return v3 ? { thinkingLevel: 'low' as const } : { thinkingBudget: 1024 };
}

/** Returns undefined when Vertex isn't configured; the agent then uses deterministic fallbacks. */
export function createVertexLlm(env: NodeJS.ProcessEnv = process.env): LlmAdapter | undefined {
  const project = env.GOOGLE_VERTEX_PROJECT;
  const fast = env.GEMINI_MODEL_FAST;
  const pro = env.GEMINI_MODEL_PRO || fast;
  if (!project || !fast || !pro) return undefined;
  const vertex = createVertex({ project, location: env.GOOGLE_VERTEX_LOCATION || 'us-east4' });
  return {
    name: `vertex:${fast}/${pro}`,
    async object({ schema, prompt, system, tier, temperature }) {
      const modelId = tier === 'pro' ? pro : fast;
      // Structured output occasionally misses the schema; one retry fixes most of those.
      for (let attempt = 1; ; attempt++) {
        try {
          return await once();
        } catch (e) {
          if (attempt >= 2 || !NoObjectGeneratedError.isInstance(e)) throw e;
        }
      }
      async function once() {
        const { output } = await generateText({
          model: vertex(modelId),
          providerOptions: { vertex: { thinkingConfig: thinkingConfig(modelId, tier) } },
          output: Output.object({ schema }),
          system,
          prompt,
          temperature: temperature ?? (tier === 'pro' ? 0.7 : 0.2),
        });
        return output as z.infer<typeof schema>;
      }
    },
    async text({ prompt, system, tier, temperature }) {
      const modelId = tier === 'pro' ? pro : fast;
      const { text } = await generateText({
        model: vertex(modelId),
        providerOptions: { vertex: { thinkingConfig: thinkingConfig(modelId, tier) } },
        system,
        prompt,
        temperature: temperature ?? 0.7,
      });
      return text;
    },
  };
}
