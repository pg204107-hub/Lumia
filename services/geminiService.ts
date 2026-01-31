
import { GoogleGenAI, Modality } from "@google/genai";
import { MemoryData } from "../types";

// Helper for retrying API calls with exponential backoff
async function callWithRetry<T>(fn: () => Promise<T>, retries = 3, delay = 2000): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    const isRateLimit = error?.message?.includes("429") || error?.message?.toLowerCase().includes("exhausted");
    if (retries > 0 && isRateLimit) {
      await new Promise(resolve => setTimeout(resolve, delay));
      return callWithRetry(fn, retries - 1, delay * 2);
    }
    throw error;
  }
}

function getAI() {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API Key is missing.");
  }
  return new GoogleGenAI({ apiKey });
}

export interface LetterGenerationResponse {
  text: string;
  citations: { title: string; uri: string }[];
}

export async function generateEmotionalLetter(data: MemoryData): Promise<LetterGenerationResponse> {
  const ai = getAI();
  const prompt = `Write a deeply moving, poetic, and heart-wrenching letter from the perspective of ${data.name} (${data.relationship}) to the person reading this. 
  The mood should be ${data.mood}. 
  Incorporate this specific detail: "${data.detail}". 
  Focus on small sensory memories and the enduring nature of love. Keep it under 200 words. 
  IMPORTANT: Use factual context for "${data.name}" if they are a real person. No conversational filler.`;

  return callWithRetry(async () => {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        temperature: 0.8,
        tools: [{ googleSearch: {} }],
      },
    });

    const text = response.text || "The words were lost in the mist...";
    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    const citations = groundingChunks
      .map((chunk: any) => chunk.web)
      .filter((web: any) => web && web.uri && web.title)
      .map((web: any) => ({ title: web.title, uri: web.uri }));

    return { text, citations };
  });
}

export async function generateMemoryPortrait(data: MemoryData, letterContent: string): Promise<string> {
  const ai = getAI();
  const prompt = `A cinematic, moody photograph representing a fleeting memory of ${data.name} (${data.relationship}). 
  Detail: ${data.detail}. 
  Style: Soft focus, film grain, nostalgic lighting. No text.`;

  return callWithRetry(async () => {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: [{ text: prompt }],
      config: { imageConfig: { aspectRatio: "4:3" } }
    });

    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
    }
    throw new Error("No image data found");
  });
}

export async function generateLetterVoice(letter: string): Promise<string> {
  const ai = getAI();
  return callWithRetry(async () => {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: `Read with gentle emotion: ${letter}` }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
        },
      },
    });
    return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || '';
  });
}

export async function decodeAudio(base64: string, ctx: AudioContext): Promise<AudioBuffer> {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  const dataInt16 = new Int16Array(bytes.buffer);
  const buffer = ctx.createBuffer(1, dataInt16.length, 24000);
  const channelData = buffer.getChannelData(0);
  for (let i = 0; i < dataInt16.length; i++) {
    channelData[i] = dataInt16[i] / 32768.0;
  }
  return buffer;
}
