
import { GoogleGenAI, Type } from "@google/genai";
import { SEORequest, SEOResult, TOPIC_IDENTITIES } from "../types";

export class GeminiSEOService {
  async generateSEOContent(request: SEORequest): Promise<Partial<SEOResult>> {
    const { keyword, topic, language, targetLength, originalSlug, rowData } = request;
    const identity = TOPIC_IDENTITIES[topic as keyof typeof TOPIC_IDENTITIES] || TOPIC_IDENTITIES.General;

    const contextString = rowData ? JSON.stringify(rowData) : "Нет дополнительных данных";

    let nicheInstruction = "";
    if (topic === 'Logistics') {
      nicheInstruction = `
      LOGISTICS MASTER PROTOCOL v3.0 (ULTRA-EXPERT MODE):
      1. ПЕРСОНА: Вы — Senior Logistics Director с 20-летним стажем. Ваш текст — это экспертное руководство.
      2. КОНТЕКСТ: Используйте данные (${contextString}) для адаптации контента под конкретные маршруты/грузы.
      3. ТЕРМИНОЛОГИЯ: Используйте: "дроп-офф", "демередж", "детеншн", "карго-план", "кросс-докинг", "растаможка под ключ".
      4. СТРУКТУРА: Глубокий анализ цепочек поставок, расчет рисков, технические спецификации контейнеров и упаковки.
      5. ТАБЛИЦЫ: 5+ сложных таблиц с техническими данными (порты, тарифы, сроки, ТН ВЭД).
      6. НИКАКОЙ ВОДЫ: Сразу к делу, Инкотермс 2020, конкретные схемы ВЭД.
      7. FAQ: Экспертные ответы. Формат: ### Вопрос\nОтвет (строго без пустой строки между ними).
      `;
    }

    const systemInstruction = `You are a ${identity} and a Native ${language} speaker. 
    Your goal is to provide ultra-premium, "water-free" content in Russian.
    
    CRITICAL OUTPUT STRUCTURE (JSON):
    {
      "slug": "SEO-friendly-slug",
      "name": "Service/Brand Name",
      "title": "Meta Title (max 70 chars)",
      "description": "Meta Description (max 160 chars)",
      "keywords": "10 specific high-freq keywords",
      "h1": "Main Landing Header (Strictly up to 190 characters)",
      "excerpt": "Marketing lead paragraph (Strictly up to 250 characters)",
      "text": "MASSIVE expert article. 3000+ words. 5+ professional tables.",
      "faq": "Technical FAQ. Use ### for questions. The answer MUST follow immediately on the next line."
    }

    Rules:
    - Persona: Senior industry expert.
    - Context: Integration of row data: ${contextString}.
    ${nicheInstruction}`;

    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Generate exhaustive expert SEO content for: "${keyword}".
        Current Context: ${contextString}.
        Focus: International logistics and VED optimization.`,
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
