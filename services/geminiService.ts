
import { GoogleGenAI, Type } from "@google/genai";
import { SEORequest, SEOResult, TOPIC_IDENTITIES } from "../types";

export class GeminiSEOService {
  async generateSEOContent(request: SEORequest): Promise<Partial<SEOResult>> {
    const { keyword, topic, language, targetLength, originalSlug, rowData, customPrompt } = request;
    const identity = TOPIC_IDENTITIES[topic as keyof typeof TOPIC_IDENTITIES] || TOPIC_IDENTITIES.General;

    const contextString = rowData ? JSON.stringify(rowData) : "Нет дополнительных данных";

    // Use the prompt from the UI if available, otherwise use identity defaults
    const systemInstruction = `You are a ${identity} and a Native ${language} speaker. 
    Your goal is to provide ultra-premium, expert-level content.
    
    CRITICAL OUTPUT STRUCTURE (JSON):
    {
      "slug": "SEO-friendly-slug",
      "name": "Brand/Product Name",
      "title": "Meta Title (max 70 chars)",
      "description": "Meta Description (max 160 chars)",
      "keywords": "10 high-freq technical keywords",
      "h1": "Main Header (max 190 characters)",
      "excerpt": "Expert lead paragraph (max 250 characters)",
      "text": "Expert content. Technical terminology is a must.",
      "faq": "Technical FAQ. Format: ### Question?\\nAnswer text immediately after."
    }

    Niche Specific Instructions:
    ${customPrompt || 'Follow default expert guidelines for ' + topic}
    
    Current Data Context: ${contextString}
    Language: ${language}`;

    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    try {
      const isHtmlNiche = topic.includes('Furniture');
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Generate exhaustive expert SEO content for: "${keyword}".
        ${isHtmlNiche ? 'Target: HTML description for website.' : 'Target: Markdown article.'}
        Context: ${contextString}.`,
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              slug: { type: Type.STRING },
              name: { type: Type.STRING },
              title: { type: Type.STRING },
              description: { type: Type.STRING },
              keywords: { type: Type.STRING },
              h1: { type: Type.STRING },
              excerpt: { type: Type.STRING },
              text: { type: Type.STRING },
              faq: { type: Type.STRING }
            },
            required: ["slug", "name", "title", "description", "keywords", "h1", "excerpt", "text", "faq"]
          },
          tools: [{ googleSearch: {} }]
        }
      });

      const textOutput = response.text;
      if (!textOutput) throw new Error("Empty response from Gemini");
      
      const parsed = JSON.parse(textOutput);
      if (originalSlug) parsed.slug = originalSlug;

      const sources = response.candidates?.[0]?.groundingMetadata?.groundingChunks
        ?.map((chunk: any) => chunk.web?.uri)
        .filter(Boolean) || [];

      return { ...parsed, sources, rowData, status: 'completed' };
    } catch (error) {
      console.error("Gemini Service Exception:", error);
      throw error;
    }
  }
}
