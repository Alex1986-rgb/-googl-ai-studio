
import React from 'react';
import { TopicType } from '../types';

interface ConfigPanelProps {
  language: string;
  setLanguage: (lang: string) => void;
  topic: TopicType;
  setTopic: (topic: TopicType) => void;
  targetLength: number;
  setTargetLength: (len: number) => void;
  maxRows: number;
  setMaxRows: (rows: number) => void;
  processAll: boolean;
  setProcessAll: (val: boolean) => void;
  concurrency: number;
  setConcurrency: (val: number) => void;
  totalAvailable: number;
  isProcessing: boolean;
  currentPrompt: string;
  onPromptChange: (newPrompt: string) => void;
}

const LANGUAGES = [
  'Russian', 'English', 'German', 'Italian', 'French'
];

const TOPIC_LABELS: Record<TopicType, string> = {
  'FurnitureProduct': 'Ит. мебель (Карточка)',
  'Furniture': 'Ит. мебель (Статья)',
  'Logistics': 'Логистика (Карго/ВЭД)',
  'General': 'Общая тема',
  'Medicine': 'Медицина',
  'Tech': 'Технологии',
  'Finance': 'Финансы',
  'Gambling': 'Гемблинг',
  'Real Estate': 'Недвижимость',
  'Travel': 'Путешествия'
};

const TOPICS: TopicType[] = Object.keys(TOPIC_LABELS) as TopicType[];

const ConfigPanel: React.FC<ConfigPanelProps> = ({ 
  language, setLanguage, topic, setTopic, targetLength, setTargetLength, maxRows, setMaxRows, 
  processAll, setProcessAll, concurrency, setConcurrency, totalAvailable, isProcessing,
  currentPrompt, onPromptChange
}) => {
  return (
    <div className="space-y-6">
      {/* Settings Card */}
      <div className="bg-white p-6 rounded-3xl shadow-xl border border-gray-100 transition-all">
        <h3 className="text-xl font-black text-gray-900 mb-6 flex items-center uppercase tracking-tight">
          <div className="bg-indigo-600 p-1.5 rounded-lg mr-3 shadow-lg shadow-indigo-100">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
            </svg>
          </div>
          Настройки
        </h3>
        
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-black text-gray-400 mb-2 uppercase tracking-widest">Язык</label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                disabled={isProcessing}
                className="w-full bg-gray-50 border border-gray-200 text-gray-900 font-bold text-xs rounded-2xl p-4 outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
              >
                {LANGUAGES.map(lang => (
                  <option key={lang} value={lang}>{lang === 'Russian' ? 'Русский' : lang}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-black text-gray-400 mb-2 uppercase tracking-widest">Ниша</label>
              <select
                value={topic}
                onChange={(e) => setTopic(e.target.value as TopicType)}
                disabled={isProcessing}
                className="w-full bg-gray-50 border border-gray-200 text-gray-900 font-bold text-xs rounded-2xl p-4 outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
              >
                {TOPICS.map(t => (
                  <option key={t} value={t}>{TOPIC_LABELS[t]}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <div className="flex justify-between items-end mb-3">
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest">Многопоточность</label>
              <span className="text-[10px] font-black text-orange-600 bg-orange-50 px-2 py-1 rounded-lg">
                {concurrency}x Threads
              </span>
            </div>
            <input
              type="range"
              min="1"
              max="10"
              step="1"
              value={concurrency}
              onChange={(e) => setConcurrency(parseInt(e.target.value))}
              disabled={isProcessing}
              className="w-full h-2 bg-gray-100 rounded-full appearance-none cursor-pointer accent-indigo-600"
            />
          </div>

          <div className="pt-4 border-t border-gray-50">
            <div className="flex items-center justify-between mb-4 bg-indigo-50/50 p-4 rounded-2xl">
              <span className="text-[10px] font-black text-indigo-900 uppercase tracking-widest">Весь файл</span>
              <label className="flex items-center cursor-pointer">
                <div className="relative">
                  <input 
                    type="checkbox" 
                    className="sr-only" 
                    checked={processAll}
                    onChange={(e) => setProcessAll(e.target.checked)}
                    disabled={isProcessing}
                  />
                  <div className={`block w-12 h-6 rounded-full transition-all ${processAll ? 'bg-indigo-600' : 'bg-gray-300'}`}></div>
                  <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-all ${processAll ? 'transform translate-x-6' : ''}`}></div>
                </div>
              </label>
            </div>
            
            {!processAll && (
              <div className="animate-fade-in">
                <label className="block text-[10px] font-black text-gray-400 mb-2 uppercase tracking-widest">Лимит строк</label>
                <input
                  type="number"
                  min="1"
                  max={99999}
                  value={maxRows}
                  onChange={(e) => setMaxRows(parseInt(e.target.value) || 0)}
                  disabled={isProcessing}
                  className="w-full bg-gray-50 border border-gray-200 text-gray-900 font-bold text-sm rounded-2xl p-4 outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Prompt Editor Card */}
      <div className="bg-white p-6 rounded-3xl shadow-xl border border-gray-100 transition-all">
        <h3 className="text-xl font-black text-gray-900 mb-6 flex items-center uppercase tracking-tight">
          <div className="bg-orange-600 p-1.5 rounded-lg mr-3 shadow-lg shadow-orange-100">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </div>
          Промпт ниши
        </h3>
        <p className="text-[10px] text-gray-400 uppercase font-black tracking-widest mb-4">Настройка протокола генерации</p>
        <textarea
          value={currentPrompt}
          onChange={(e) => onPromptChange(e.target.value)}
          disabled={isProcessing}
          placeholder="Введите инструкции для Gemini..."
          className="w-full h-64 bg-slate-900 text-indigo-300 font-['JetBrains_Mono'] text-[11px] p-6 rounded-2xl border-0 outline-none focus:ring-2 focus:ring-indigo-500 transition-all resize-none shadow-inner"
        />
        <div className="mt-3 flex justify-between items-center">
           <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest italic">Live Prompt Editor</span>
           <button 
             onClick={() => onPromptChange("")} 
             className="text-[9px] font-black text-indigo-500 uppercase hover:underline"
           >
             Сбросить изменения
           </button>
        </div>
      </div>
    </div>
  );
};

export default ConfigPanel;
