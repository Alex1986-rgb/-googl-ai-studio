
import * as XLSX from 'xlsx';
import { SEOResult } from '../types';

export const parseKeywordsFromExcel = (file: File): Promise<{keyword: string, rowData: any}[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet);
        
        if (jsonData.length === 0) {
            resolve([]);
            return;
        }

        const results = jsonData.map(row => {
          const keyEntry = Object.entries(row).find(([k]) => 
            k.toLowerCase().includes('keyword') || 
            k.toLowerCase().includes('ключ')
          );
          
          return {
            keyword: keyEntry ? String(keyEntry[1]) : String(Object.values(row)[0]),
            rowData: row
          };
        });

        resolve(results);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = (err) => reject(err);
    reader.readAsArrayBuffer(file);
  });
};

/**
 * Преобразует FAQ из Markdown (### Вопрос\nОтвет) 
 * в требуемый заказчиком формат экспорта:
 * * Какова разница между MAWB и HAWB?
 * MAWB оформляется авиакомпанией...
 * 
 * (пустая строка между блоками)
 */
const formatFaqForExport = (faq: string): string => {
  if (!faq) return "";
  
  // Удаляем возможные дубликаты звездочек, если модель вдруг их сгенерировала
  const cleanFaq = faq.replace(/^\*\s+/gm, '### ');
  
  // Разбиваем по заголовкам ###
  const blocks = cleanFaq.split(/^###\s+/m).filter(b => b.trim().length > 0);
  
  return blocks.map(block => {
    const lines = block.trim().split('\n');
    const question = lines[0].trim();
    // Собираем ответ из оставшихся строк, очищая от лишних пробелов
    const answer = lines.slice(1).join('\n').trim();
    
    // Возвращаем в формате * Вопрос\nОтвет
    return `* ${question}\n${answer}`;
  }).join('\n\n'); 
};

export const exportResultsToExcel = (results: SEOResult[]) => {
  const data = results.map(r => ({
    'Slug': r.slug,
    'Name': r.name,
    'SEO Title': r.title,
    'SEO Description': r.description,
    'Keywords': r.keywords,
    'H1 Header': r.h1,
    'Excerpt (Отрывок)': r.excerpt,
    'Article (Markdown)': r.text, // Статья остается в чистом Markdown
    'FAQ (Export Format)': formatFaqForExport(r.faq),
    'Sources': (r.sources || []).join(', ')
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Logistics SEO');
  XLSX.writeFile(workbook, `logistics_seo_${new Date().toISOString().slice(0,10)}.xlsx`);
};

export const exportResultsToJSON = (results: SEOResult[]) => {
  const dataToExport = results.map(r => {
    return {
      slug: r.slug,
      name: r.name,
      title: r.title,
      description: r.description,
      keywords: r.keywords,
      h1: r.h1,
      excerpt: r.excerpt,
      text: r.text, // Статья в Markdown
      faq: formatFaqForExport(r.faq), // FAQ в формате * Вопрос\nОтвет
      sources: r.sources
    };
  });

  const blob = new Blob([JSON.stringify(dataToExport, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `logistics_export_${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
};
