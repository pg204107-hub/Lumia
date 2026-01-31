
import { GoogleGenAI, Modality, Type } from "@google/genai";
import { MemoryData } from "../types";

// Enhanced retry with longer starting delay for free tier
async function callWithRetry<T>(fn: () => Promise<T>, retries = 3, delay = 4000): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    const isRateLimit = error?.message?.includes("429") || error?.message?.toLowerCase().includes("exhausted");
    if (retries > 0 && isRateLimit) {
      console.warn(`Quota hit. Retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return callWithRetry(fn, retries - 1, delay * 2);
    }
    throw error;
  }
}

function getAI() {
  const apiKey = process.env.API_KEY;
  if (!apiKey) throw new Error("API Key is missing.");
  return new GoogleGenAI({ apiKey });
}

export interface UnifiedResponse {
  letter: string;
  imagePrompt: string;
}

export async function generateUnifiedContent(data: MemoryData): Promise<UnifiedResponse> {
  const ai = getAI();
  const prompt = `Write a deeply intimate, poetic letter from ${data.name} (${data.relationship}) to the reader. 
  Mood: ${data.mood}. Incorporate this sensory detail: "${data.detail}".
  Then, provide a cinematic photography prompt that captures the essence of this memory.
  Output the result as a JSON object with keys 'letter' and 'imagePrompt'.`;

  return callWithRetry(async () => {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            letter: { type: Type.STRING },
            imagePrompt: { type: Type.STRING }
          },
          required: ["letter", "imagePrompt"]
        }
      },
    });

    return JSON.parse(response.text);
  });
}

export async function generateMemoryPortrait(prompt: string): Promise<string> {
  const ai = getAI();
  const enhancedPrompt = `${prompt}. Nostalgic, moody, film grain, soft lighting, 4k, cinematic. No text.`;

  return callWithRetry(async () => {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: [{ text: enhancedPrompt }],
      config: { imageConfig: { aspectRatio: "4:3" } }
    });

    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
    }
    throw new Error("No image data");
  }, 2, 5000); // Fewer retries for heavy image calls
}

export async function generateLetterVoice(letter: string): Promise<string> {
  const ai = getAI();
  return callWithRetry(async () => {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: `Read with profound, gentle emotion: ${letter}` }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
        },
      },
    });
    return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || '';
  }, 1, 6000); // TTS often has stricter quotas, fail gracefully
}

export async function decodeAudio(base64: string, ctx: AudioContext): Promise<AudioBuffer> {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
  const dataInt16 = new Int16Array(bytes.buffer);
  const buffer = ctx.createBuffer(1, dataInt16.length, 24000);
  const channelData = buffer.getChannelData(0);
  for (let i = 0; i < dataInt16.length; i++) channelData[i] = dataInt16[i] / 32768.0;
  return buffer;
}
