
import { GoogleGenAI, Type, Modality, GenerateContentResponse } from "@google/genai";

// Access process.env.API_KEY directly in the client factory to ensure freshness
export const getGeminiClient = () => {
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

/**
 * Decodes a base64 string into a Uint8Array.
 * Required for processing raw PCM audio data from Gemini.
 */
export function decodeBase64(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Decodes raw PCM audio bytes into an AudioBuffer for playback.
 * Gemini TTS returns raw PCM data without a file header.
 */
export async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

/**
 * Generates a full course structure based on a topic
 */
export async function generateCourseStructure(topic: string) {
  const ai = getGeminiClient();
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Create a professional structured educational course outline for: "${topic}". 
    Return a list of modules, where each module has multiple lessons. 
    Focus on high-value, comprehensive learning paths.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          description: { type: Type.STRING },
          modules: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                title: { type: Type.STRING },
                lessons: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      id: { type: Type.STRING },
                      title: { type: Type.STRING },
                      type: { type: Type.STRING, enum: ['text', 'video', 'quiz', 'interactive'] }
                    },
                    required: ['id', 'title', 'type']
                  }
                }
              },
              required: ['id', 'title', 'lessons']
            }
          }
        },
        required: ['title', 'description', 'modules']
      }
    }
  });

  return JSON.parse(response.text);
}

/**
 * Generates a step-by-step interactive lesson sequence
 */
export async function generateInteractiveLessonStructure(topic: string) {
  const ai = getGeminiClient();
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Break down the topic "${topic}" into a 3-5 step instructional sequence for an interactive lesson. 
    Each step should have a title, a clear explanation, 3 bullet key points, and a specific illustration prompt for an AI image generator.
    Also include a 3-question quiz at the end. Note that quiz questions can have one or more correct answers (multiple-select).`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          topic: { type: Type.STRING },
          steps: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                title: { type: Type.STRING },
                explanation: { type: Type.STRING },
                keyPoints: { type: Type.ARRAY, items: { type: Type.STRING } },
                imagePrompt: { type: Type.STRING }
              },
              required: ['id', 'title', 'explanation', 'keyPoints', 'imagePrompt']
            }
          },
          quiz: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                question: { type: Type.STRING },
                options: { type: Type.ARRAY, items: { type: Type.STRING } },
                correctAnswers: { type: Type.ARRAY, items: { type: Type.NUMBER } }
              },
              required: ['question', 'options', 'correctAnswers']
            }
          }
        },
        required: ['topic', 'steps', 'quiz']
      }
    }
  });

  return JSON.parse(response.text);
}

/**
 * Generates detailed lesson content or quiz questions
 */
export async function generateLessonContent(title: string, type: 'text' | 'quiz') {
  const ai = getGeminiClient();
  
  const prompt = type === 'text' 
    ? `Act as an expert educator. Write a deep-dive educational article about "${title}". 
       Use HTML tags for formatting: 
       - <h3> for section headers
       - <p> for paragraphs
       - <strong> for bold key terms
       - <em> for italics
       - <ul> and <li> for bullet points.
       Return ONLY the raw HTML string.`
    : `Create a 5-question quiz for "${title}". 
       Important: Questions can have one OR more correct answers (multiple-select). 
       Return an array of objects with question, options, and correctAnswers (array of indices).`;

  const config = type === 'text' 
    ? {} 
    : {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              question: { type: Type.STRING },
              options: { type: Type.ARRAY, items: { type: Type.STRING } },
              correctAnswers: { type: Type.ARRAY, items: { type: Type.NUMBER } }
            },
            required: ['question', 'options', 'correctAnswers']
          }
        }
      };

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: config
  });

  return type === 'text' ? response.text.trim() : JSON.parse(response.text);
}

/**
 * Generates a narration audio for a lesson or step
 */
export async function generateNarration(text: string): Promise<string> {
  const ai = getGeminiClient();
  const cleanText = text.replace(/<[^>]*>?/gm, '');
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: [{ parts: [{ text: `Explain this clearly and educationally: ${cleanText.substring(0, 800)}` }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: 'Kore' },
        },
      },
    },
  });

  const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!base64Audio) throw new Error("Audio generation failed");
  return base64Audio;
}

/**
 * Generates an illustration for a lesson step
 */
export async function generateIllustration(prompt: string): Promise<string> {
  const ai = getGeminiClient();
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: {
      parts: [
        { text: `A clean, professional educational illustration: ${prompt}. Minimalist vector style, soft pastel colors, suitable for an online course.` },
      ],
    },
    config: {
      imageConfig: { aspectRatio: "16:9" }
    },
  });

  for (const part of response.candidates[0].content.parts) {
    if (part.inlineData) {
      return `data:image/png;base64,${part.inlineData.data}`;
    }
  }
  throw new Error("No image generated");
}

/**
 * Generates a video teaser using Veo
 */
export async function generateCourseTeaser(prompt: string): Promise<string> {
  const ai = getGeminiClient();
  let operation = await ai.models.generateVideos({
    model: 'veo-3.1-fast-generate-preview',
    prompt: `Cinematic educational teaser for a course about: ${prompt}. High quality, professional lighting.`,
    config: {
      numberOfVideos: 1,
      resolution: '720p',
      aspectRatio: '16:9'
    }
  });

  while (!operation.done) {
    await new Promise(resolve => setTimeout(resolve, 5000));
    operation = await ai.operations.getVideosOperation({ operation: operation });
  }

  const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
  // Always append the API key from environment when fetching external video resources
  const videoResponse = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
  const blob = await videoResponse.blob();
  return URL.createObjectURL(blob);
}

/**
 * Generates a cover image for the course
 */
export async function generateThumbnail(prompt: string): Promise<string> {
  const ai = getGeminiClient();
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: {
      parts: [
        { text: `A professional, modern educational thumbnail for a course about ${prompt}. High-end vector style.` },
      ],
    },
    config: {
      imageConfig: { aspectRatio: "16:9" }
    },
  });

  for (const part of response.candidates[0].content.parts) {
    if (part.inlineData) {
      return `data:image/png;base64,${part.inlineData.data}`;
    }
  }
  throw new Error("No image generated");
}
