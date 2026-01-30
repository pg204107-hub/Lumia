
import { GoogleGenAI, Modality } from "@google/genai";
import { MemoryData } from "../types";

// We initialize a helper to get the AI instance
function getAI() {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API Key is missing. Please set the API_KEY environment variable.");
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
  The letter should feel like a message from across time, focusing on small sensory memories, the things left unsaid, and the enduring nature of love despite loss. 
  Keep it under 300 words. Do not use generic phrases. Make it feel authentic, raw, and devastatingly beautiful. 
  
  IMPORTANT: Use Google Search to look up "${data.name}" or "${data.detail}". 
  If they refer to a real historical figure, a specific event, or a famous location, use that factual context to ground the letter in reality. 
  Focus on the 'why' they are missed. No conversational filler at start/end.`;

  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: prompt,
    config: {
      temperature: 0.8,
      tools: [{ googleSearch: {} }],
    },
  });

  const text = response.text || "I couldn't find the words just yet...";
  const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
  
  const citations = groundingChunks
    .map((chunk: any) => chunk.web)
    .filter((web: any) => web && web.uri && web.title)
    .map((web: any) => ({ title: web.title, uri: web.uri }));

  return { text, citations };
}

export async function generateMemoryPortrait(data: MemoryData, letterContent: string): Promise<string> {
  const ai = getAI();
  const prompt = `A cinematic, moody, and ethereal photograph representing a fleeting memory. 
  Context: ${data.relationship} - ${data.detail}. 
  Style: Soft focus, golden hour lighting, slightly grainy like an old film photo, minimalist composition. 
  The image should evoke a feeling of ${data.mood} and longing. 
  No text in image. Focus on symbolic elements like a shadow, an empty chair, or a specific object mentioned in: ${letterContent.substring(0, 100)}`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: [{ text: prompt }],
    config: {
      imageConfig: {
        aspectRatio: "4:3"
      }
    }
  });

  let imageUrl = '';
  for (const part of response.candidates[0].content.parts) {
    if (part.inlineData) {
      imageUrl = `data:image/png;base64,${part.inlineData.data}`;
    }
  }
  return imageUrl;
}

export async function generateLetterVoice(letter: string): Promise<string> {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: [{ parts: [{ text: `Read this letter with a gentle, slow, and deeply emotional tone, pausing for breath and reflecting the weight of the words: ${letter}` }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: 'Kore' },
        },
      },
    },
  });

  return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || '';
}

export async function decodeAudio(base64: string, ctx: AudioContext): Promise<AudioBuffer> {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  
  const dataInt16 = new Int16Array(bytes.buffer);
  const frameCount = dataInt16.length;
  const buffer = ctx.createBuffer(1, frameCount, 24000);
  const channelData = buffer.getChannelData(0);
  for (let i = 0; i < frameCount; i++) {
    channelData[i] = dataInt16[i] / 32768.0;
  }
  return buffer;
}
