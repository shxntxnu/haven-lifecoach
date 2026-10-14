import { CreateMLCEngine, MLCEngine, InitProgressReport } from '@mlc-ai/web-llm';

export interface WebLLMProgress {
  progress: number; // 0 to 1
  text: string;
  isLoaded: boolean;
  isLoading: boolean;
  error?: string;
}

export function isWebGPUSupported(): boolean {
  return typeof navigator !== 'undefined' && 'gpu' in navigator && (navigator as any).gpu !== undefined;
}

export const MLC_MODEL_MAP: Record<string, string> = {
  'llama-3.2-3b-128k': 'Llama-3.2-3B-Instruct-q4f16_1-MLC',
  'llama-3.2-1b-128k': 'Llama-3.2-1B-Instruct-q4f16_1-MLC',
  'phi-3.5-mini-128k': 'Phi-3.5-mini-instruct-q4f16_1-MLC',
};

class WebLLMService {
  private engine: MLCEngine | null = null;
  private currentModelId: string | null = null;

  public async loadModel(
    modelId: string,
    onProgress: (p: WebLLMProgress) => void
  ): Promise<boolean> {
    if (!isWebGPUSupported()) {
      onProgress({
        progress: 0,
        text: 'WebGPU not detected in this browser runtime. Falling back to Instant Simulation.',
        isLoaded: false,
        isLoading: false,
        error: 'WebGPU unavailable',
      });
      return false;
    }

    const mlcModel = MLC_MODEL_MAP[modelId];
    if (!mlcModel) {
      return false;
    }

    if (this.engine && this.currentModelId === mlcModel) {
      onProgress({
        progress: 1.0,
        text: 'Model already cached and primed in WebGPU VRAM.',
        isLoaded: true,
        isLoading: false,
      });
      return true;
    }

    try {
      onProgress({
        progress: 0.05,
        text: 'Initializing WebGPU shader pipeline & cache storage...',
        isLoaded: false,
        isLoading: true,
      });

      this.engine = await CreateMLCEngine(mlcModel, {
        initProgressCallback: (report: InitProgressReport) => {
          onProgress({
            progress: report.progress,
            text: report.text,
            isLoaded: report.progress >= 1.0,
            isLoading: report.progress < 1.0,
          });
        },
      });

      this.currentModelId = mlcModel;
      onProgress({
        progress: 1.0,
        text: 'Weights unsealed & compiled into WebGPU VRAM.',
        isLoaded: true,
        isLoading: false,
      });
      return true;
    } catch (err: any) {
      onProgress({
        progress: 0,
        text: `WebGPU Initialization Error: ${err?.message || err}`,
        isLoaded: false,
        isLoading: false,
        error: err?.message || 'Failed to initialize WebGPU engine',
      });
      return false;
    }
  }

  public isReady(modelId: string): boolean {
    const mlcModel = MLC_MODEL_MAP[modelId];
    return this.engine !== null && this.currentModelId === mlcModel;
  }

  public async generateChat(
    messages: { role: 'system' | 'user' | 'assistant'; content: string }[],
    onTokenChunk?: (token: string) => void
  ): Promise<string> {
    if (!this.engine) {
      throw new Error('WebLLM Engine not initialized');
    }

    const response = await this.engine.chat.completions.create({
      messages,
      temperature: 0.6,
      max_tokens: 300,
      stream: true,
    });

    let fullText = '';
    for await (const chunk of response) {
      const delta = chunk.choices[0]?.delta?.content || '';
      if (delta) {
        fullText += delta;
        if (onTokenChunk) {
          onTokenChunk(delta);
        }
      }
    }

    return fullText;
  }

  public async generateCoachingTurn(
    systemPrompt: string,
    userMessage: string,
    onTokenChunk?: (token: string) => void
  ): Promise<{ reflection: string; inquiry: string; rawText: string }> {
    if (!this.engine) {
      throw new Error('WebLLM Engine not initialized');
    }

    const response = await this.engine.chat.completions.create({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      temperature: 0.6,
      max_tokens: 300,
      stream: true,
    });

    let fullText = '';
    for await (const chunk of response) {
      const delta = chunk.choices[0]?.delta?.content || '';
      if (delta) {
        fullText += delta;
        if (onTokenChunk) {
          onTokenChunk(delta);
        }
      }
    }

    // Parse structured JSON or fallback to structured extraction
    return parseModelTurn(fullText);
  }
}

function parseModelTurn(text: string): { reflection: string; inquiry: string; rawText: string } {
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed.reflection && parsed.inquiry) {
        return {
          reflection: parsed.reflection,
          inquiry: parsed.inquiry,
          rawText: text,
        };
      }
      if (parsed.reflection && parsed.response) {
        return {
          reflection: parsed.reflection,
          inquiry: parsed.response,
          rawText: text,
        };
      }
    }
  } catch {
    // If not strict JSON, parse heuristically
  }

  // Heuristic split: first paragraph reflection, second paragraph inquiry
  const paragraphs = text.split('\n\n').filter((p) => p.trim() !== '');
  if (paragraphs.length >= 2) {
    return {
      reflection: paragraphs[0].replace(/^(Reflection:?|"|')/i, '').replace(/("|')$/, '').trim(),
      inquiry: paragraphs.slice(1).join('\n\n').replace(/^(Inquiry:?|Question:?)/i, '').trim(),
      rawText: text,
    };
  }

  return {
    reflection: text.slice(0, Math.min(120, text.length)),
    inquiry: text.length > 120 ? text.slice(120) : 'How does this feel as a stepping stone forward?',
    rawText: text,
  };
}

export const webllm = new WebLLMService();
