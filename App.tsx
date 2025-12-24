
import React, { useState, useEffect, useRef } from 'react';
import Header from './components/Header';
import ConfigPanel from './components/ConfigPanel';
import { SEOResult, TopicType, DEFAULT_PROMPTS } from './types';
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
  
  // Custom Prompts State
  const [customPrompts, setCustomPrompts] = useState<Record<TopicType, string>>(DEFAULT_PROMPTS);

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
            rowData: currentItem.rowData,
            customPrompt: customPrompts[topic] // Pass the edited prompt
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

  const formatContentToHtml = (content: string, isMarkdown: boolean) => {
    if (!content) return "";
    
    // If it's already HTML (from Furniture niches) we return as is
    if (!isMarkdown || content.trim().startsWith('<')) {
        return content;
    }

    let html = content
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

  const handlePromptUpdate = (newPrompt: string) => {
    setCustomPrompts(prev => ({
      ...prev,
      [topic]: newPrompt === "" ? DEFAULT_PROMPTS[topic] : newPrompt
    }));
  };

  if (hasKey === false) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-6 font-['Inter']">
        <div className="bg-neutral-900 p-12 rounded-[2rem] border-4 border-neutral-800 text-center max-w-lg shadow-2xl">
          <h1 className="text-white text-3xl font-black mb-6 uppercase tracking-tighter text-indigo-500">SEO Automator Pro</h1>
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
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-gray-900 text-white p-8 rounded-[2rem] shadow-2xl border-b-8 border-indigo-600">
               <h4 className="text-[10px] font-black uppercase tracking-[0.3em] mb-6 text-indigo-400">Мониторинг ресурсов</h4>
               <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white/5 p-5 rounded-3xl border border-white/10">
                    <div className="text-2xl font-black tracking-tighter">{stats.completed}</div>
                    <div className="text-[9px] uppercase font-bold text-gray-500 tracking-widest">Обработано</div>
                  </div>
                  <div className="bg-white/5 p-5 rounded-3xl border border-white/10">
                    <div className="text-2xl font-black tracking-tighter">{stats.pending}</div>
                    <div className="text-[9px] uppercase font-bold text-gray-500 tracking-widest">Очередь</div>
                  </div>
                  <div className="bg-white/5 p-5 rounded-3xl border border-white/10">
                    <div className="text-2xl font-black tracking-tighter text-indigo-400">{stats.processing}</div>
                    <div className="text-[9px] uppercase font-bold text-gray-500 tracking-widest">Активно</div>
                  </div>
                  <div className="bg-white/5 p-5 rounded-3xl border border-white/10">
                    <div className="text-2xl font-black tracking-tighter text-red-400">{stats.error}</div>
                    <div className="text-[9px] uppercase font-bold text-gray-500 tracking-widest">Ошибки</div>
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
              currentPrompt={customPrompts[topic]}
              onPromptChange={handlePromptUpdate}
            />

            <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-gray-100 group transition-all">
              <h3 className="text-lg font-black uppercase tracking-tight text-gray-900 mb-6 flex items-center gap-3">
                <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                Загрузка данных
              </h3>
              <div className="relative">
                 <input type="file" onChange={handleFileUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                 <div className="border-2 border-dashed border-gray-200 rounded-3xl p-10 text-center group-hover:border-indigo-500 transition-all bg-gray-50/50">
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Нажмите для выбора XLSX</span>
                 </div>
              </div>
              
              {results.length > 0 && (
                <button onClick={processBatch} disabled={isProcessing} className="w-full mt-6 py-6 bg-indigo-600 text-white font-black rounded-3xl shadow-xl uppercase tracking-widest hover:bg-indigo-700 active:scale-95 transition-all flex items-center justify-center gap-3">
                  {isProcessing ? (
                    <>
                      <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                      {progress}% Обработано
                    </>
                  ) : `Запустить (${stats.pending} строк)`}
                </button>
              )}
            </div>
          </div>

          {/* Right Column: Results Table */}
          <div className="lg:col-span-8 space-y-6">
            <div className="bg-white rounded-[3rem] border border-gray-100 shadow-2xl overflow-hidden flex flex-col h-[calc(100vh-140px)]">
              <div className="p-10 border-b border-gray-50 flex justify-between items-center bg-white sticky top-0 z-20 backdrop-blur-xl">
                <div>
                  <h2 className="text-3xl font-black uppercase tracking-tighter mb-1">Реестр генерации</h2>
                  <div className="flex gap-3">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Total: {results.length}</span>
                    <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Mode: {topic}</span>
                  </div>
                </div>
                <div className="flex gap-4">
                  {results.some(r => r.status === 'completed') && (
                    <button onClick={() => exportResultsToExcel(results)} className="bg-indigo-600 text-white px-10 py-4 rounded-2xl font-black text-[11px] uppercase hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 active:scale-95">Экспорт XLSX</button>
                  )}
                  {results.length > 0 && (
                    <button onClick={() => setResults([])} className="bg-red-50 text-red-600 px-8 py-4 rounded-2xl font-black text-[11px] uppercase hover:bg-red-600 hover:text-white transition-all active:scale-95">Очистить</button>
                  )}
                </div>
              </div>

              <div className="flex-1 overflow-auto px-4 pb-4">
                <table className="w-full text-left">
                  <thead className="bg-white border-b border-gray-100 sticky top-0 z-10">
                    <tr>
                      <th className="p-8 font-black uppercase text-[10px] text-gray-400 tracking-widest">Ключ</th>
                      <th className="p-8 font-black uppercase text-[10px] text-gray-400 tracking-widest">Контекст</th>
                      <th className="p-8 font-black uppercase text-[10px] text-gray-400 tracking-widest">Статус</th>
                      <th className="p-8 font-black uppercase text-[10px] text-gray-400 tracking-widest text-right">Управление</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {results.map((res, i) => (
                      <tr key={i} className={`group transition-all ${res.status === 'processing' ? 'bg-indigo-50/30' : 'hover:bg-slate-50/50'}`}>
                        <td className="p-8">
                          <div className="font-black text-slate-900 text-lg mb-1 tracking-tight">{res.keyword}</div>
                          {res.slug && <span className="text-[9px] bg-slate-100 text-slate-500 px-3 py-1 rounded-lg font-mono font-bold uppercase tracking-widest">{res.slug}</span>}
                        </td>
                        <td className="p-8">
                           <div className="flex flex-wrap gap-2 max-w-sm">
                              {res.rowData ? Object.entries(res.rowData).slice(0, 3).map(([k, v], idx) => (
                                <span key={idx} className="text-[9px] bg-white border border-gray-200 text-gray-400 px-3 py-1 rounded-xl shadow-sm">
                                  <span className="font-black uppercase opacity-40">{k}:</span> {String(v)}
                                </span>
                              )) : <span className="text-[10px] italic text-gray-300">Default</span>}
                           </div>
                        </td>
                        <td className="p-8">
                           <div className="flex items-center gap-4">
                              <div className={`w-3 h-3 rounded-full shadow-lg ${res.status === 'completed' ? 'bg-emerald-400 shadow-emerald-100' : res.status === 'error' ? 'bg-rose-400 shadow-rose-100' : res.status === 'processing' ? 'bg-indigo-500 animate-pulse shadow-indigo-100' : 'bg-slate-200'}`}></div>
                              <span className={`font-black uppercase text-[10px] tracking-widest ${res.status === 'completed' ? 'text-emerald-600' : res.status === 'error' ? 'text-rose-600' : 'text-slate-400'}`}>{res.status}</span>
                           </div>
                        </td>
                        <td className="p-8 text-right">
                          {res.status === 'completed' && (
                            <button onClick={() => setPreviewItem(res)} className="bg-white border-2 border-indigo-50 px-8 py-3 rounded-2xl text-[10px] font-black uppercase text-indigo-600 hover:bg-indigo-600 hover:text-white transition-all shadow-sm active:scale-95">Просмотр</button>
                          )}
                          {res.status === 'error' && (
                            <div className="text-[9px] font-black text-rose-500 bg-rose-50 px-4 py-2 rounded-xl border border-rose-100 max-w-[200px] truncate">{res.error}</div>
                          )}
                        </td>
                      </tr>
                    ))}
                    {results.length === 0 && (
                      <tr>
                        <td colSpan={4} className="p-40 text-center">
                          <div className="flex flex-col items-center gap-6 opacity-30">
                             <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center">
                                <svg className="w-12 h-12 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                             </div>
                             <div className="font-black uppercase tracking-[0.4em] text-xs text-slate-500">Загрузите файл для начала</div>
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/95 backdrop-blur-2xl animate-fade-in">
          <div className="bg-white rounded-[4rem] w-full max-w-[98vw] h-[95vh] overflow-hidden flex shadow-2xl border border-white/20">
            {/* Sidebar Navigation */}
            <div className="w-96 bg-slate-50 border-r border-slate-100 p-12 flex flex-col">
               <div className="mb-16">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-8 border-b border-slate-200 pb-4">Секция действий</h4>
                  <div className="space-y-4">
                    <button onClick={() => copyToClipboard(previewItem.slug, "Slug")} className="w-full text-left bg-white p-5 rounded-3xl border border-slate-200 text-[11px] font-black uppercase hover:border-indigo-500 transition-all flex justify-between items-center group shadow-sm active:scale-95">
                      <span>Copy Slug</span>
                      <svg className="w-4 h-4 text-slate-300 group-hover:text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V7M8 7h8" /></svg>
                    </button>
                    <button onClick={() => copyToClipboard(previewItem.title, "Meta Title")} className="w-full text-left bg-white p-5 rounded-3xl border border-slate-200 text-[11px] font-black uppercase hover:border-indigo-500 transition-all flex justify-between items-center group shadow-sm active:scale-95">
                      <span>Copy Meta Title</span>
                      <svg className="w-4 h-4 text-slate-300 group-hover:text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V7M8 7h8" /></svg>
                    </button>
                    <button onClick={() => copyToClipboard(previewItem.text, "Full Content")} className="w-full text-left bg-indigo-600 text-white p-6 rounded-3xl text-[11px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-2xl shadow-indigo-200 mt-10 active:scale-95">
                      Copy Expert Content
                    </button>
                  </div>
               </div>

               {previewItem.sources && previewItem.sources.length > 0 && (
                 <div className="flex-1 overflow-auto">
                   <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-8 border-b border-slate-200 pb-4">Grounding Sources</h4>
                   <div className="space-y-4">
                     {previewItem.sources.map((url, i) => (
                       <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="block bg-white p-5 rounded-2xl border border-slate-100 text-[10px] font-bold text-slate-600 truncate hover:text-indigo-600 transition-all shadow-sm">
                         {url}
                       </a>
                     ))}
                   </div>
                 </div>
               )}
            </div>

            {/* Content Area */}
            <div className="flex-1 flex flex-col">
              <div className="p-16 border-b border-slate-50 flex justify-between items-center sticky top-0 bg-white/90 backdrop-blur-2xl z-10">
                <div className="max-w-5xl">
                   <div className="flex items-center gap-6 mb-6">
                      <span className="bg-indigo-600 text-white text-[10px] font-black px-6 py-2 rounded-full uppercase tracking-widest shadow-lg shadow-indigo-100">{topic.toUpperCase()} ELITE</span>
                      <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest border-l border-slate-200 pl-6">ID: {previewItem.slug || 'AUTO'}</span>
                   </div>
                   <h2 className="text-6xl font-black text-slate-900 tracking-tighter leading-[1.1] uppercase">{previewItem.h1}</h2>
                </div>
                <button onClick={() => setPreviewItem(null)} className="h-24 w-24 bg-slate-50 rounded-[2.5rem] flex items-center justify-center hover:bg-rose-500 hover:text-white transition-all shadow-inner active:scale-90">
                  <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>

              <div className="flex-1 overflow-auto p-20 scroll-smooth custom-preview">
                 {/* Meta Info Dashboard */}
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-12 mb-24">
                    <div className="bg-indigo-50/50 p-12 rounded-[4rem] border border-indigo-100 shadow-inner">
                        <div className="mb-12">
                          <span className="text-[11px] font-black uppercase text-indigo-600 block mb-6 tracking-[0.3em]">Meta Title</span>
                          <p className="font-black text-slate-900 text-2xl leading-tight">{previewItem.title}</p>
                        </div>
                        <div>
                          <span className="text-[11px] font-black uppercase text-indigo-400 block mb-6 tracking-[0.3em]">Meta Description</span>
                          <p className="text-slate-600 text-base leading-relaxed font-medium italic">"{previewItem.description}"</p>
                        </div>
                    </div>
                    <div className="bg-amber-50/50 p-12 rounded-[4rem] border border-amber-100 shadow-inner">
                       <div className="mb-12">
                        <span className="text-[11px] font-black uppercase text-amber-600 block mb-6 tracking-[0.3em]">SEO Tags</span>
                        <div className="flex flex-wrap gap-3">
                          {previewItem.keywords.split(',').map((k, idx) => (
                            <span key={idx} className="bg-white border border-amber-200 text-amber-700 px-5 py-2 rounded-2xl font-black text-[10px] uppercase tracking-wider shadow-sm">{k.trim()}</span>
                          ))}
                        </div>
                      </div>
                      <div className="bg-white p-10 rounded-[3rem] border border-amber-50 shadow-sm">
                        <span className="text-[11px] font-black uppercase text-amber-400 block mb-6 tracking-[0.3em]">Excerpt</span>
                        <p className="text-slate-700 text-lg leading-relaxed font-bold italic">{previewItem.excerpt}</p>
                      </div>
                    </div>
                 </div>

                 {/* Article Content */}
                 <div className="generated-content prose prose-2xl max-w-none mb-40">
                    <div dangerouslySetInnerHTML={{ __html: formatContentToHtml(previewItem.text, !topic.includes('Furniture')) }} />
                 </div>

                 {/* FAQ Section */}
                 {previewItem.faq && (
                   <div className="pt-32 border-t-8 border-slate-50 mb-20">
                     <h3 className="text-6xl font-black uppercase mb-20 text-slate-900 tracking-tighter flex items-center gap-10">
                       <span className="w-32 h-3 bg-indigo-600 rounded-full shadow-lg shadow-indigo-100"></span>
                       Expert FAQ
                     </h3>
                     <div className="bg-slate-900 p-20 rounded-[5rem] shadow-3xl border border-indigo-900/30">
                       <div 
                         className="preview-faq-content prose-invert prose-2xl max-w-none"
                         dangerouslySetInnerHTML={{ __html: formatContentToHtml(previewItem.faq, true) }} 
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
