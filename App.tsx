
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

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    alert(`${label} скопирован!`);
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
      .replace(/^### (.*$)/gim, '<h3 class="text-xl font-bold mt-8 mb-4">$1</h3>')
      .replace(/^## (.*$)/gim, '<h2 class="text-2xl font-black mt-12 mb-6 border-l-8 border-indigo-600 pl-6">$1</h2>')
      .replace(/^# (.*$)/gim, '<h1 class="text-4xl font-black mt-14 mb-8 text-gray-900">$1</h1>')
      .replace(/\*\*(.*)\*\*/gim, '<strong class="text-gray-900 font-extrabold">$1</strong>')
      .replace(/^\* (.*$)/gim, '<li class="ml-6 list-disc mb-2 text-gray-700">$1</li>')
      .replace(/^- (.*$)/gim, '<li class="ml-6 list-disc mb-2 text-gray-700">$1</li>')
      .replace(/\n\n/g, '<p class="mb-6"></p>');

    if (html.includes('|')) {
      const parts = html.split('<p class="mb-6"></p>');
      html = parts.map(part => {
        if (part.includes('|')) {
          const lines = part.trim().split('\n').filter(l => l.trim().length > 0);
          if (lines.length > 2) {
            let tableHtml = '<div class="table-container my-10 shadow-2xl overflow-hidden border-2 border-indigo-50"><table><thead>';
            const headers = lines[0].split('|').map(h => h.trim()).filter(h => h !== "");
            tableHtml += '<tr>' + headers.map(h => `<th>${h}</th>`).join('') + '</tr></thead><tbody>';
            
            for (let i = 2; i < lines.length; i++) {
              const cells = lines[i].split('|').map(c => c.trim()).filter(c => c !== "");
              if (cells.length > 0) {
                tableHtml += '<tr>' + cells.map(c => `<td>${c}</td>`).join('') + '</tr>';
              }
            }
            tableHtml += '</tbody></table></div>';
            return tableHtml;
          }
        }
        return part;
      }).join('<p class="mb-6"></p>');
    }

    return html;
  };

  const stats = {
    total: results.length,
    completed: results.filter(r => r.status === 'completed').length,
    pending: results.filter(r => r.status === 'pending').length,
    processing: results.filter(r => r.status === 'processing').length,
    error: results.filter(r => r.status === 'error').length
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
    <div className="min-h-screen pb-32 bg-[#f8fafc]">
      <Header />
      <main className="max-w-[1600px] mx-auto px-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column: Config & Control */}
          <div className="lg:col-span-3 space-y-6">
            <div className="bg-gray-900 text-white p-6 rounded-3xl shadow-2xl border-b-4 border-indigo-500">
               <h4 className="text-[10px] font-black uppercase tracking-[0.2em] mb-4 text-indigo-400">Статистика очереди</h4>
               <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white/5 p-3 rounded-2xl">
                    <div className="text-xl font-black">{stats.completed}</div>
                    <div className="text-[9px] uppercase font-bold text-gray-500">Готово</div>
                  </div>
                  <div className="bg-white/5 p-3 rounded-2xl">
                    <div className="text-xl font-black">{stats.pending}</div>
                    <div className="text-[9px] uppercase font-bold text-gray-500">Ожидает</div>
                  </div>
                  <div className="bg-white/5 p-3 rounded-2xl">
                    <div className="text-xl font-black text-indigo-400">{stats.processing}</div>
                    <div className="text-[9px] uppercase font-bold text-gray-500">В работе</div>
                  </div>
                  <div className="bg-white/5 p-3 rounded-2xl">
                    <div className="text-xl font-black text-red-400">{stats.error}</div>
                    <div className="text-[9px] uppercase font-bold text-gray-500">Ошибки</div>
                  </div>
               </div>
            </div>

            <ConfigPanel 
              language={language} setLanguage={setLanguage} 
              topic={topic} setTopic={setTopic}
              targetLength={targetLength} setTargetLength={setTargetLength}
              maxRows={maxRows} setMaxRows={setMaxRows}
              processAll={processAll} setProcessAll={setProcessAll}
              concurrency={concurrency} setConcurrency={setConcurrency}
              totalAvailable={results.length} isProcessing={isProcessing}
            />

            <div className="bg-white p-8 rounded-3xl shadow-xl border border-gray-100">
              <h3 className="text-lg font-black uppercase tracking-tight text-gray-900 mb-6">Импорт ключей</h3>
              <input type="file" onChange={handleFileUpload} className="block w-full text-sm text-gray-500 file:mr-4 file:py-3 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-black file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100" />
              
              {results.length > 0 && (
                <button onClick={processBatch} disabled={isProcessing} className="w-full mt-6 py-5 bg-indigo-600 text-white font-black rounded-2xl shadow-xl uppercase tracking-widest hover:bg-indigo-700 transition-all flex items-center justify-center gap-3">
                  {isProcessing ? (
                    <>
                      <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                      {progress}%
                    </>
                  ) : `Запустить (${stats.pending})`}
                </button>
              )}
            </div>
          </div>

          {/* Right Column: Results Table */}
          <div className="lg:col-span-9 space-y-6">
            <div className="bg-white rounded-[2rem] border border-gray-100 shadow-2xl overflow-hidden flex flex-col h-[calc(100vh-180px)]">
              <div className="p-8 border-b border-gray-100 flex justify-between items-center bg-white sticky top-0 z-20">
                <div className="flex items-center gap-6">
                  <h2 className="text-2xl font-black uppercase tracking-tighter">Реестр контента</h2>
                  <div className="h-8 w-px bg-gray-100"></div>
                  <div className="flex gap-2">
                    <span className="bg-gray-100 text-gray-500 px-4 py-1.5 rounded-full text-[10px] font-black uppercase">Всего: {results.length}</span>
                    {isProcessing && <span className="bg-indigo-50 text-indigo-600 px-4 py-1.5 rounded-full text-[10px] font-black uppercase animate-pulse">Обработка...</span>}
                  </div>
                </div>
                <div className="flex gap-4">
                  {results.some(r => r.status === 'completed') && (
                    <>
                      <button onClick={() => exportResultsToJSON(results)} className="bg-gray-50 text-gray-900 border border-gray-200 px-6 py-3 rounded-2xl font-black text-[11px] uppercase hover:bg-gray-100 transition-all">JSON</button>
                      <button onClick={() => exportResultsToExcel(results)} className="bg-indigo-600 text-white px-8 py-3 rounded-2xl font-black text-[11px] uppercase hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100">Экспорт XLSX</button>
                    </>
                  )}
                  {results.length > 0 && (
                    <button onClick={() => setResults([])} className="bg-red-50 text-red-600 px-6 py-3 rounded-2xl font-black text-[11px] uppercase hover:bg-red-600 hover:text-white transition-all">Сброс</button>
                  )}
                </div>
              </div>

              <div className="flex-1 overflow-auto">
                <table className="w-full text-left">
                  <thead className="bg-gray-50/50 border-b border-gray-100 sticky top-0 z-10 backdrop-blur-md">
                    <tr>
                      <th className="p-6 font-black uppercase text-[10px] text-gray-400 tracking-widest">Ключ / Slug</th>
                      <th className="p-6 font-black uppercase text-[10px] text-gray-400 tracking-widest">Контекст (Excel)</th>
                      <th className="p-6 font-black uppercase text-[10px] text-gray-400 tracking-widest">Статус</th>
                      <th className="p-6 font-black uppercase text-[10px] text-gray-400 tracking-widest text-right">Действия</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {results.map((res, i) => (
                      <tr key={i} className={`group transition-all ${res.status === 'processing' ? 'bg-indigo-50/20' : 'hover:bg-gray-50/50'}`}>
                        <td className="p-6">
                          <div className="font-black text-gray-900 text-base mb-1">{res.keyword}</div>
                          {res.slug && <span className="text-[10px] bg-indigo-50 text-indigo-500 px-2 py-0.5 rounded font-mono font-bold">{res.slug}</span>}
                        </td>
                        <td className="p-6">
                           <div className="flex flex-wrap gap-1 max-w-md">
                              {res.rowData ? Object.entries(res.rowData).slice(0, 4).map(([k, v], idx) => (
                                <span key={idx} className="text-[9px] bg-gray-100 text-gray-400 px-2 py-0.5 rounded border border-gray-200">
                                  <span className="font-bold uppercase opacity-50">{k}:</span> {String(v)}
                                </span>
                              )) : <span className="text-[10px] italic text-gray-300">Нет данных</span>}
                           </div>
                        </td>
                        <td className="p-6">
                           <div className="flex items-center gap-3">
                              <div className={`w-2 h-2 rounded-full ${res.status === 'completed' ? 'bg-emerald-500' : res.status === 'error' ? 'bg-red-500' : res.status === 'processing' ? 'bg-indigo-500 animate-ping' : 'bg-gray-300'}`}></div>
                              <span className={`font-black uppercase text-[10px] ${res.status === 'completed' ? 'text-emerald-600' : res.status === 'error' ? 'text-red-600' : 'text-gray-400'}`}>{res.status}</span>
                           </div>
                        </td>
                        <td className="p-6 text-right">
                          {res.status === 'completed' && (
                            <button onClick={() => setPreviewItem(res)} className="bg-white border-2 border-gray-100 px-6 py-2.5 rounded-2xl text-[10px] font-black uppercase text-gray-900 hover:border-indigo-600 hover:text-indigo-600 transition-all shadow-sm">Открыть превью</button>
                          )}
                          {res.status === 'error' && (
                            <span className="text-[10px] font-bold text-red-500 bg-red-50 px-3 py-1 rounded-lg border border-red-100">{res.error}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {results.length === 0 && (
                      <tr>
                        <td colSpan={4} className="p-32 text-center">
                          <div className="flex flex-col items-center gap-4 opacity-20">
                             <svg className="w-24 h-24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                             <div className="font-black uppercase tracking-[0.3em] text-sm">Файл не загружен</div>
                          </div>
                        </td>
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/90 backdrop-blur-2xl">
          <div className="bg-white rounded-[3rem] w-full max-w-[95vw] h-[92vh] overflow-hidden flex shadow-2xl border-2 border-white/20">
            {/* Sidebar Navigation */}
            <div className="w-80 bg-slate-50 border-r border-slate-100 p-10 flex flex-col">
               <div className="mb-12">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-6">Панель управления</h4>
                  <div className="space-y-3">
                    <button onClick={() => copyToClipboard(previewItem.slug, "Slug")} className="w-full text-left bg-white p-4 rounded-2xl border border-slate-200 text-[11px] font-bold hover:border-indigo-500 transition-all flex justify-between items-center group">
                      <span>Копировать Slug</span>
                      <svg className="w-4 h-4 text-slate-300 group-hover:text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V7M8 7h8" /></svg>
                    </button>
                    <button onClick={() => copyToClipboard(previewItem.title, "Meta Title")} className="w-full text-left bg-white p-4 rounded-2xl border border-slate-200 text-[11px] font-bold hover:border-indigo-500 transition-all flex justify-between items-center group">
                      <span>Копировать Title</span>
                      <svg className="w-4 h-4 text-slate-300 group-hover:text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V7M8 7h8" /></svg>
                    </button>
                    <button onClick={() => copyToClipboard(previewItem.text, "Статью")} className="w-full text-left bg-indigo-600 text-white p-5 rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 mt-6">
                      Копировать лонгрид
                    </button>
                  </div>
               </div>

               {previewItem.sources && previewItem.sources.length > 0 && (
                 <div className="flex-1 overflow-auto">
                   <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-6">Источники (Grounding)</h4>
                   <div className="space-y-3">
                     {previewItem.sources.map((url, i) => (
                       <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="block bg-white p-3 rounded-xl border border-slate-100 text-[9px] font-medium text-slate-500 truncate hover:text-indigo-600 transition-all">
                         {url}
                       </a>
                     ))}
                   </div>
                 </div>
               )}
            </div>

            {/* Content Area */}
            <div className="flex-1 flex flex-col">
              <div className="p-12 border-b border-slate-50 flex justify-between items-center sticky top-0 bg-white/80 backdrop-blur-md z-10">
                <div className="max-w-4xl">
                   <div className="flex items-center gap-4 mb-4">
                      <span className="bg-indigo-600 text-white text-[10px] font-black px-4 py-1.5 rounded-full uppercase tracking-widest">LOGISTICS PRO EDITION</span>
                      <span className="text-[10px] font-bold text-slate-400">SLUG: {previewItem.slug}</span>
                   </div>
                   <h2 className="text-4xl font-black text-slate-900 tracking-tighter leading-none uppercase">{previewItem.h1}</h2>
                </div>
                <button onClick={() => setPreviewItem(null)} className="h-16 w-16 bg-slate-100 rounded-3xl flex items-center justify-center hover:bg-red-500 hover:text-white transition-all shadow-inner">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>

              <div className="flex-1 overflow-auto p-16 scroll-smooth">
                 {/* Meta Dashboard */}
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-10 bg-slate-50 p-12 rounded-[3rem] border border-slate-100 mb-20 shadow-inner">
                    <div className="space-y-10">
                      <div>
                        <span className="text-[11px] font-black uppercase text-indigo-500 block mb-4 tracking-[0.2em]">Meta Title</span>
                        <p className="font-black text-slate-900 text-xl leading-tight">{previewItem.title}</p>
                      </div>
                      <div>
                        <span className="text-[11px] font-black uppercase text-slate-400 block mb-4 tracking-[0.2em]">Meta Description</span>
                        <p className="text-slate-600 text-sm leading-relaxed font-medium italic">"{previewItem.description}"</p>
                      </div>
                    </div>
                    <div className="space-y-10">
                       <div>
                        <span className="text-[11px] font-black uppercase text-orange-500 block mb-4 tracking-[0.2em]">Keywords</span>
                        <div className="flex flex-wrap gap-2">
                          {previewItem.keywords.split(',').map((k, idx) => (
                            <span key={idx} className="bg-white border border-orange-100 text-orange-600 px-4 py-1.5 rounded-xl font-black text-[10px] uppercase">{k.trim()}</span>
                          ))}
                        </div>
                      </div>
                      <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
                        <span className="text-[11px] font-black uppercase text-slate-400 block mb-4 tracking-[0.2em]">Excerpt (Лид)</span>
                        <p className="text-slate-700 text-base leading-relaxed font-bold italic">{previewItem.excerpt}</p>
                      </div>
                    </div>
                 </div>

                 {/* Article Content */}
                 <div className="generated-content prose prose-xl max-w-none">
                    <div dangerouslySetInnerHTML={{ __html: formatMarkdownToHtml(previewItem.text) }} />
                 </div>

                 {/* FAQ Section */}
                 {previewItem.faq && (
                   <div className="mt-32 pt-20 border-t-8 border-slate-50">
                     <h3 className="text-5xl font-black uppercase mb-16 text-slate-900 tracking-tighter flex items-center gap-8">
                       <span className="w-24 h-2 bg-indigo-600 rounded-full"></span>
                       Экспертный FAQ
                     </h3>
                     <div className="bg-slate-900 p-16 rounded-[4rem] shadow-2xl">
                       <div 
                         className="preview-faq-content prose-invert prose-lg max-w-none"
                         dangerouslySetInnerHTML={{ __html: formatMarkdownToHtml(previewItem.faq) }} 
                       />
                     </div>
                   </div>
                 )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
