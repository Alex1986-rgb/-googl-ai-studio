
export interface SEORequest {
  keyword: string;
  topic: string;
  language: string;
  targetLength: number;
  originalSlug?: string;
  rowData?: Record<string, any>;
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

export type TopicType = 'General' | 'Furniture' | 'Medicine' | 'Tech' | 'Finance' | 'Gambling' | 'Real Estate' | 'Travel' | 'Logistics';

export const TOPIC_IDENTITIES: Record<TopicType, string> = {
  General: "expert SEO copywriter and content strategist",
  Furniture: "Senior Luxury Interior Designer and Elite Italian Furniture Specialist",
  Medicine: "highly qualified medical professional",
  Tech: "senior software engineer and technology reviewer",
  Finance: "certified financial analyst",
  Gambling: "veteran iGaming SEO specialist",
  'Real Estate': "professional real estate consultant",
  Travel: "seasoned travel journalist",
  Logistics: "Senior Supply Chain Strategist and International Freight Forwarding Specialist with expertise in VED (Foreign Economic Activity) and logistics optimization"
};
