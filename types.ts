
export interface SEORequest {
  keyword: string;
  topic: string;
  language: string;
  targetLength: number;
  originalSlug?: string;
  rowData?: Record<string, any>;
  customPrompt?: string; // New field for user-edited instructions
}

export interface SEOResult {
  keyword: string;
  slug: string;
  name: string;
  title: string;
  description: string;
  keywords: string;
  h1: string;
  excerpt: string;
  text: string;
  faq: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  error?: string;
  sources?: string[];
  rowData?: Record<string, any>;
}

export type TopicType = 'General' | 'Furniture' | 'FurnitureProduct' | 'Medicine' | 'Tech' | 'Finance' | 'Gambling' | 'Real Estate' | 'Travel' | 'Logistics';

export const TOPIC_IDENTITIES: Record<TopicType, string> = {
  General: "expert SEO copywriter and content strategist",
  Furniture: "Senior Luxury Interior Designer and Elite Italian Furniture Specialist",
  FurnitureProduct: "Elite E-commerce Product Manager for Italian Luxury Furniture Brands",
  Medicine: "highly qualified medical professional",
  Tech: "senior software engineer and technology reviewer",
  Finance: "certified financial analyst",
  Gambling: "veteran iGaming SEO specialist",
  'Real Estate': "professional real estate consultant",
  Travel: "seasoned travel journalist",
  Logistics: "Senior Supply Chain Strategist and International Freight Forwarding Specialist"
};

export const DEFAULT_PROMPTS: Record<TopicType, string> = {
  Logistics: `LOGISTICS EXPERT PROTOCOL v4.0 (AUTHORITY MODE):
1. ПЕРСОНА: Директор по логистике. Сухой, технический стиль.
2. СТИЛЬ ТЕКСТА: Markdown. Заголовки #, ##, ###.
3. ТЕРМИНЫ: Инкотермс 2020, КТС, ТН ВЭД, LCL/FCL, дроп-офф, демередж.
4. ТАБЛИЦЫ: 5+ профессиональных Markdown-таблиц с тех. данными.`,
  
  Furniture: `ELITE ITALIAN FURNITURE ARTICLE PROTOCOL v6.0:
1. ПЕРСОНА: Эксперт по итальянской мебели (Baxter, Minotti).
2. СТИЛЬ ТЕКСТА: СТРОГО HTML (<h2>, <h3>, <p>, <ul>, <li>, <strong>).
3. ТАБЛИЦЫ: HTML таблицы с опциями отделки и размерами.
4. SEO: Оптимизация под элитный сегмент, ручная работа, массив ореха.`,

  FurnitureProduct: `ELITE PRODUCT CARD PROTOCOL v7.0 (ITALIAN FURNITURE):
1. ПЕРСОНА: Product Manager элитного мебельного салона.
2. ФОРМАТ: СТРОГО HTML для поля "text". 
3. МИКРОРАЗМЕТКА: Обязательно JSON-LD "Product" в конце текста.
4. КОНТЕНТ: Описание конкретной модели, материалов (нубук, мрамор), фабрики.
5. ТАБЛИЦЫ: HTML таблицы с характеристиками (Размеры, Отделка).`,

  General: `General expert SEO content protocol. Professional language, high quality, clear structure.`,
  Medicine: `Medical expert protocol. Accurate data, professional terms, trustworthy tone.`,
  Tech: `Tech specialist protocol. Deep analysis, specifications, latest trends.`,
  Finance: `Financial analyst protocol. Data-driven, professional, risk-aware.`,
  Gambling: `iGaming SEO protocol. High energy, conversion-focused, compliance-aware.`,
  'Real Estate': `Real estate consultant protocol. Market analysis, location insights, investment value.`,
  Travel: `Travel writer protocol. Evocative descriptions, practical tips, logistics info.`
};
