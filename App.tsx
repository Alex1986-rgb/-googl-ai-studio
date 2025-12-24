
import React, { useState, useEffect, useRef } from 'react';
import Header from './components/Header';
import ConfigPanel from './components/ConfigPanel';
import { SEOResult, TopicType } from './types';
import { parseKeywordsFromExcel, exportResultsToExcel, exportResultsToJSON } from './utils/excelUtils';
import { GeminiSEOService } from './services/geminiService';

declare global {
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }
  interface Window {
    aistudio?: AIStudio;
  }
}

const App: React.FC = () => {
  const [hasKey, setHasKey] = useState<boolean | null>(null);
  const [language, setLanguage] = useState('Russian');
  const [topic, setTopic] = useState<TopicType>('Logistics');
  const [targetLength, setTargetLength] = useState(3000);
  const [maxRows, setMaxRows] = useState(10);
  const [concurrency, setConcurrency] = useState(3);
  const [processAll, setProcessAll] = useState(false);
  const [results, setResults] = useState<SEOResult[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [previewItem, setPreviewItem] = useState<SEOResult | null>(null);

  const resultsRef = useRef<SEOResult[]>([]);

  useEffect(() => {
    checkKey();
  }, []);

  useEffect(() => {
    resultsRef.current = results;
  }, [results]);

  const checkKey = async () => {
    try {
      const selected = await window.aistudio?.hasSelectedApiKey();
      setHasKey(!!selected);
    } catch (e) {
      setHasKey(false);
    }
  };

  const handleActivateKey = async () => {
    await window.aistudio?.openSelectKey();
    setHasKey(true);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setError(null);
      const data = await parseKeywordsFromExcel(file);
      if (data.length === 0) {
        setError("В файле Excel не найдено данных.");
        return;
      }

      const initialResults: SEOResult[] = data.map(item => {
        const foundSlug = Object.entries(item.rowData || {}).find(([k]) => 
          k.toLowerCase() === 'slug' || k.toLowerCase() === 'url'
        )?.[1] as string;

        return {
          keyword: item.keyword,
          slug: foundSlug || '',
          name: '',
          title: '',
          description: '',
          keywords: '',
          h1: '',
          excerpt: '',
          text: '',
          faq: '',
          status: 'pending',
          rowData: item.rowData
        };
      });
      
      setResults(prev => [...prev, ...initialResults]);
      event.target.value = '';
    } catch (err) {
      setError("Ошибка чтения файла.");
    }
  };

  const processBatch = async () => {
    if (results.length === 0 || isProcessing) return;

    setIsProcessing(true);
    setProgress(0);
    const service = new GeminiSEOService();
    
    const currentResults = [...resultsRef.current];
    const pendingIndices = currentResults
      .map((r, i) => r.status === 'pending' || r.status === 'error' ? i : -1)
      .filter(i => i !== -1);

    const limit = processAll ? pendingIndices.length : Math.min(maxRows, pendingIndices.length);
    const indicesToProcess = pendingIndices.slice(0, limit);

    if (indicesToProcess.length === 0) {
      setIsProcessing(false);
      return;
    }

    let completedCount = 0;
    const totalToProcess = indicesToProcess.length;

    const worker = async (queue: number[]) => {
      while (queue.length > 0) {
        const index = queue.shift();
        if (index === undefined) break;

        try {
          setResults(prev => {
            const next = [...prev];
            next[index] = { ...next[index], status: 'processing' };
            return next;
          });

          const currentItem = resultsRef.current[index];
          const content = await service.generateSEOContent({
            keyword: currentItem.keyword,
            topic,
            language,
            targetLength,
            originalSlug: currentItem.slug,
            rowData: currentItem.rowData
          });

          setResults(prev => {
            const next = [...prev];
            next[index] = {
              ...next[index],
              ...content as any,
              status: 'completed'
            };
            return next;
          });
        } catch (err: any) {
          console.error(`Error row ${index}:`, err);
          if (err.message?.includes("Requested entity was not found")) setHasKey(false);
          
          setResults(prev => {
            const next = [...prev];
            next[index] = {
              ...next[index],
              status: 'error',
              error: err.message || "API Error"
            };
            return next;
          });
        } finally {
          completedCount++;
          setProgress(Math.round((completedCount / totalToProcess) * 100));
        }
      }
    };

    const queue = [...indicesToProcess];
    const workers = Array.from({ length: Math.min(concurrency, queue.length) }, () => worker(queue));
    await Promise.all(workers);
    setIsProcessing(false);
  };

  const formatMarkdownToHtml = (md: string) => {
    if (!md) return "";
    
    let html = md
      // Headers
      .replace(/^### (.*$)/gim, '<h3 class="text-xl font-bold mt-6 mb-3">$1</h3>')
      .replace(/^## (.*$)/gim, '<h2 class="text-2xl font-black mt-8 mb-4 border-l-4 border-indigo-600 pl-4">$1</h2>')
      .replace(/^# (.*$)/gim, '<h1 class="text-3xl font-black mt-10 mb-6">$1</h1>')
      // Bold
      .replace(/\*\*(.*)\*\*/gim, '<strong>$1</strong>')
      // Lists
      .replace(/^\* (.*$)/gim, '<li class="ml-4 list-disc">$1</li>')
      .replace(/^- (.*$)/gim, '<li class="ml-4 list-disc">$1</li>')
      // Paragraphs
      .replace(/\n\n/g, '<br/><br/>');

    // Simple Markdown Table Support
    if (html.includes('|')) {
      const lines = html.split('<br/><br/>');
      html = lines.map(line => {
        if (line.includes('|')) {
          const rows = line.trim().split('\n');
          if (rows.length > 1) {
            let tableHtml = '<div class="table-container"><table><thead>';
            const headers = rows[0].split('|').filter(c => c.trim() !== "");
            tableHtml += '<tr>' + headers.map(h => `<th>${h.trim()}</th>`).join('') + '</tr></thead><tbody>';
            
            // Skip header and separator row
            for (let i = 2; i < rows.length; i++) {
              const cells = rows[i].split('|').filter(c => c.trim() !== "");
              if (cells.length > 0) {
                tableHtml += '<tr>' + cells.map(c => `<td>${c.trim()}</td>`).join('') + '</tr>';
              }
            }
            tableHtml += '</tbody></table></div>';
            return tableHtml;
          }
        }
        return line;
      }).join('<br/><br/>');
    }

    return html;
  };

  const clearResults = () => {
    if (window.confirm("Очистить всю рабочую область?")) {
      setResults([]);
    }
  };

  if (hasKey === false) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-6 font-['Inter']">
        <div className="bg-neutral-900 p-12 rounded-[2rem] border-4 border-neutral-800 text-center max-w-lg shadow-2xl">
          <h1 className="text-white text-3xl font-black mb-6 uppercase tracking-tighter text-indigo-500">Logistics Automator</h1>
          <p className="text-gray-400 mb-8 text-sm leading-relaxed font-medium">Для начала работы необходимо выбрать платный API-ключ Google Cloud Project.</p>
          <button onClick={handleActivateKey} className="bg-indigo-600 text-white px-10 py-4 rounded-xl font-black uppercase tracking-widest hover:bg-indigo-500 transition-all shadow-lg shadow-indigo-500/20">Выбрать ключ</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-32 bg-[#f0f4f8]">
      <Header />
      <main className="max-w-7xl mx-auto px-4">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1 space-y-6">
            <ConfigPanel 
              language={language} setLanguage={setLanguage} 
              topic={topic} setTopic={setTopic}
              targetLength={targetLength} setTargetLength={setTargetLength}
              maxRows={maxRows} setMaxRows={setMaxRows}
              processAll={processAll} setProcessAll={setProcessAll}
              concurrency={concurrency} setConcurrency={setConcurrency}
              totalAvailable={results.length} isProcessing={isProcessing}
            />

            <div className="bg-white p-8 rounded-3xl shadow-xl border-2 border-gray-100">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-black uppercase tracking-tight text-gray-900">Загрузка данных</h3>
                {results.length > 0 && (
                  <button onClick={clearResults} className="text-[10px] font-black text-red-500 uppercase hover:underline">Очистить</button>
                )}
              </div>
              <input type="file" onChange={handleFileUpload} className="block w-full text-sm text-gray-500 file:mr-4 file:py-3 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-black file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100" />
              {results.length > 0 && (
                <button onClick={processBatch} disabled={isProcessing} className="w-full mt-6 py-5 bg-gray-900 text-white font-black rounded-2xl shadow-xl uppercase tracking-widest hover:bg-indigo-600 transition-all flex items-center justify-center gap-3">
                  {isProcessing ? (
                    <>
                      <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                      {progress}%
                    </>
                  ) : `Обработать новые (${results.filter(r => r.status === 'pending').length})`}
                </button>
              )}
              {error && <p className="mt-4 text-red-500 text-xs font-bold uppercase">{error}</p>}
            </div>
          </div>

          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-3xl border-2 border-gray-100 shadow-2xl overflow-hidden">
              <div className="p-6 border-b-2 border-gray-100 flex justify-between items-center bg-white">
                <div className="flex items-center gap-4">
                  <span className="font-black uppercase tracking-widest text-[10px] text-gray-400">Рабочая область</span>
                  <span className="bg-indigo-50 text-indigo-600 px-3 py-1 rounded-lg text-[10px] font-black">{results.length} строк</span>
                </div>
                <div className="flex gap-3">
                  {results.some(r => r.status === 'completed') && (
                    <>
                      <button onClick={() => exportResultsToJSON(results)} className="bg-gray-100 text-gray-900 px-5 py-2.5 rounded-xl font-black text-[10px] uppercase hover:bg-indigo-600 hover:text-white transition-all shadow-sm">JSON</button>
                      <button onClick={() => exportResultsToExcel(results)} className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-black text-[10px] uppercase hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100">XLSX Export</button>
                    </>
                  )}
                </div>
              </div>
              <div className="overflow-auto max-h-[650px]">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50 border-b-2 border-gray-100 sticky top-0 z-10">
                    <tr>
                      <th className="p-5 font-black uppercase text-gray-500 tracking-wider">Ключевой запрос / Slug</th>
                      <th className="p-5 font-black uppercase text-gray-500 tracking-wider">Статус</th>
                      <th className="p-5 font-black uppercase text-gray-500 tracking-wider text-right">Управление</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {results.map((res, i) => (
                      <tr key={i} className={`group transition-all ${res.status === 'processing' ? 'bg-indigo-50/30' : 'hover:bg-gray-50'}`}>
                        <td className="p-5">
                          <div className="font-bold text-gray-900 text-sm mb-1">{res.keyword}</div>
                          <div className="flex gap-2 items-center">
                            {res.slug && <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded font-mono font-bold uppercase">{res.slug}</span>}
                            <div className="text-[10px] text-gray-400 font-medium truncate max-w-[200px] uppercase italic">
                              {res.rowData ? Object.values(res.rowData).slice(0, 3).join(' • ') : "Нет контекста"}
                            </div>
                          </div>
                        </td>
                        <td className="p-5">
                           <span className={`font-black uppercase text-[9px] px-3 py-1 rounded-full border-2 ${res.status === 'completed' ? 'text-emerald-600 bg-emerald-50 border-emerald-200' : res.status === 'error' ? 'text-red-600 bg-red-50 border-red-200' : res.status === 'processing' ? 'text-indigo-600 bg-indigo-50 border-indigo-200 animate-pulse' : 'text-gray-400 bg-gray-100 border-gray-200'}`}>{res.status}</span>
                        </td>
                        <td className="p-5 text-right">
                          {res.status === 'completed' && <button onClick={() => setPreviewItem(res)} className="bg-white border-2 border-gray-200 px-4 py-2 rounded-xl text-[10px] font-black uppercase text-gray-900 hover:border-indigo-600 hover:text-indigo-600 transition-all shadow-sm">Смотреть</button>}
                        </td>
                      </tr>
                    ))}
                    {results.length === 0 && (
                      <tr>
                        <td colSpan={3} className="p-24 text-center text-gray-300 font-black uppercase tracking-[0.2em] text-sm">Ожидание загрузки файла...</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Modal Preview */}
      {previewItem && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-gray-900/90 backdrop-blur-xl">
          <div className="bg-white rounded-[2.5rem] w-full max-w-7xl max-h-[92vh] overflow-hidden flex flex-col shadow-2xl border-4 border-indigo-600">
            <div className="p-10 border-b border-gray-100 flex justify-between items-center bg-white sticky top-0 z-10 shadow-sm">
              <div>
                <div className="flex items-center gap-3 mb-2">
                   <span className="bg-indigo-600 text-white text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest">{previewItem.name || "LOGISTICS PRO"}</span>
                   <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">SLUG: {previewItem.slug}</span>
                </div>
                <h2 className="text-3xl font-black text-gray-900 tracking-tight leading-none uppercase max-w-4xl">{previewItem.h1}</h2>
              </div>
              <button onClick={() => setPreviewItem(null)} className="bg-gray-100 text-gray-900 h-14 w-14 rounded-2xl flex items-center justify-center hover:bg-red-500 hover:text-white transition-all group">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="flex-1 overflow-auto p-12 bg-white scroll-smooth">
               {/* Metadata Dashboard */}
               <div className="grid grid-cols-1 md:grid-cols-2 gap-10 bg-indigo-50/50 p-10 rounded-[2rem] border-2 border-indigo-100 mb-16 shadow-inner">
                  <div className="space-y-8">
                    <div>
                      <span className="text-[10px] font-black uppercase text-indigo-400 block mb-3 tracking-widest">Meta Title</span>
                      <p className="font-extrabold text-gray-900 text-lg leading-snug">{previewItem.title}</p>
                    </div>
                    <div>
                      <span className="text-[10px] font-black uppercase text-orange-500 block mb-3 tracking-widest">Ключевые слова</span>
                      <div className="flex flex-wrap gap-2">
                        {previewItem.keywords.split(',').map((k, idx) => (
                          <span key={idx} className="bg-white border border-orange-200 text-orange-700 px-3 py-1 rounded-lg font-bold text-[11px]">{k.trim()}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="space-y-8">
                    <div>
                      <span className="text-[10px] font-black uppercase text-gray-400 block mb-3 tracking-widest">Excerpt / Отрывок</span>
                      <p className="text-gray-700 text-sm leading-relaxed font-medium bg-white p-5 rounded-2xl border border-gray-100 italic shadow-sm">"{previewItem.excerpt}"</p>
                    </div>
                  </div>
               </div>

               {/* Main Article Content */}
               <div className="generated-content prose prose-lg prose-indigo mb-16 max-w-none">
                  <div dangerouslySetInnerHTML={{ __html: formatMarkdownToHtml(previewItem.text) }} />
               </div>

               {/* FAQ Section */}
               {previewItem.faq && (
                 <div className="mt-24 pt-16 border-t-4 border-indigo-100">
                   <h3 className="text-4xl font-black uppercase mb-12 text-gray-900 tracking-tighter flex items-center gap-6">
                     <span className="w-16 h-1 bg-indigo-600 rounded-full"></span>
                     FAQ: Экспертные ответы
                   </h3>
                   <div className="bg-gray-50 p-10 rounded-[2.5rem] border-2 border-gray-100 shadow-inner">
                     <div 
                       className="preview-faq-content prose prose-indigo max-w-none"
                       dangerouslySetInnerHTML={{ __html: formatMarkdownToHtml(previewItem.faq) }} 
                     />
                   </div>
                 </div>
               )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
