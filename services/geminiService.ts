
import { GoogleGenAI, Type } from "@google/genai";
import { SEORequest, SEOResult, TOPIC_IDENTITIES } from "../types";

export class GeminiSEOService {
  async generateSEOContent(request: SEORequest): Promise<Partial<SEOResult>> {
    const { keyword, topic, language, targetLength, originalSlug, rowData } = request;
    const identity = TOPIC_IDENTITIES[topic as keyof typeof TOPIC_IDENTITIES] || TOPIC_IDENTITIES.General;

    const contextString = rowData ? JSON.stringify(rowData) : "No specific row data provided";

    let nicheInstruction = "";
    if (topic === 'Logistics') {
      nicheInstruction = `
      LOGISTICS MASTER PROTOCOL (STRICT EXPERT MODE):
      1. STYLE: Пиши как высококлассный эксперт по ВЭД и международной логистике. Только профессиональная лексика.
      2. TONE: Ты — носитель русского языка. Стиль строго деловой, экспертный. Полное отсутствие "воды" и вводных фраз.
      3. H1 LIMIT: Заголовок H1 — СТРОГО ДО 190 символов.
      4. EXCERPT LIMIT: Поле "excerpt" (Отрывок) — СТРОГО ДО 250 символов. Концентрированный смысл без воды.
      5. FAQ MARKDOWN: Поле "faq" — объем СТРОГО ~1500 символов, формат Markdown. Используй ### для вопросов.
      6. TEXT FORMAT: Поле "text" — лонгрид (3000+ слов) СТРОГО В ФОРМАТЕ MARKDOWN. Используй #, ##, ###.
      7. TABLES: В поле "text" ОБЯЗАТЕЛЬНО 5+ сложных таблиц В ФОРМАТЕ MARKDOWN.
      8. NO LSI: Не генерируй поле lsi_keywords.
      9. SLUG RULE: ${originalSlug ? `STRICTLY use "${originalSlug}" as the "slug" value.` : 'Generate a unique SEO-friendly URL slug.'}
      `;
    }

    const systemInstruction = `You are a ${identity} and a Native ${language} speaker. 
    Your goal is to provide ultra-premium, "water-free" content in Markdown format.
    
    CRITICAL OUTPUT STRUCTURE (JSON):
    {
      "slug": "SEO-friendly-slug",
      "name": "Service/Brand Name",
      "title": "Meta Title (max 70 chars)",
      "description": "Meta Description (max 160 chars)",
      "keywords": "10 specific high-freq keywords",
      "h1": "Main Landing Header (Strictly up to 190 characters)",
      "excerpt": "Marketing lead paragraph (Strictly up to 250 characters)",
      "text": "MASSIVE Markdown article. 3000+ words. Include 5+ professional Markdown tables.",
      "faq": "Markdown formatted FAQ section (Target ~1500 characters, use ### for questions)"
    }

    Formatting Rules:
    - Language: Perfect Native Russian.
    - No filler: Zero fluff.
    - Both "text" and "faq" fields must be in Markdown.
    - DO NOT include lsi_keywords in the response.
    ${nicheInstruction}`;

    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Generate massive expert SEO data for: "${keyword}". 
        H1: max 190 chars. 
        Excerpt: max 250 chars. 
        Text: Markdown, 3000+ words.
        FAQ: Markdown strictly ~1500 chars. 
        Context: ${contextString}. 
        Professional Russian, no water.`,
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
      if (!textOutput) throw new Error("Empty response from model");
      
      const parsed = JSON.parse(textOutput);
      
      if (originalSlug) {
        parsed.slug = originalSlug;
      }

      const sources = response.candidates?.[0]?.groundingMetadata?.groundingChunks
        ?.map((chunk: any) => chunk.web?.uri)
        .filter(Boolean) || [];

      return {
        ...parsed,
        sources,
        rowData,
        status: 'completed'
      };
    } catch (error) {
      console.error("Gemini Service Exception:", error);
      throw error;
    }
  }
}
