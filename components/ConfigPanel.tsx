
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
}

const LANGUAGES = [
  'Russian', 'English', 'German', 'Italian', 'French'
];

const TOPIC_LABELS: Record<TopicType, string> = {
  'Furniture': 'Мебель (MyArredo Elite)',
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
  processAll, setProcessAll, concurrency, setConcurrency, totalAvailable, isProcessing 
}) => {
  return (
    <div className="bg-white p-6 rounded-xl shadow-xl border-2 border-indigo-50 mb-6 transition-all">
      <h3 className="text-xl font-black text-gray-900 mb-6 flex items-center uppercase tracking-tight">
        <div className="bg-indigo-600 p-1.5 rounded-lg mr-3">
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
          </svg>
        </div>
        Настройки генерации
      </h3>
      
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[10px] font-black text-gray-900 mb-2 uppercase tracking-wider">Язык</label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              disabled={isProcessing}
              className="w-full bg-white border-2 border-gray-900 text-gray-900 font-black text-xs rounded-xl p-3 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] outline-none"
            >
              {LANGUAGES.map(lang => (
                <option key={lang} value={lang}>{lang === 'Russian' ? 'Русский' : lang}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-black text-gray-900 mb-2 uppercase tracking-wider">Ниша</label>
            <select
              value={topic}
              onChange={(e) => setTopic(e.target.value as TopicType)}
              disabled={isProcessing}
              className="w-full bg-white border-2 border-gray-900 text-gray-900 font-black text-xs rounded-xl p-3 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] outline-none"
            >
              {TOPICS.map(t => (
                <option key={t} value={t}>{TOPIC_LABELS[t]}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <div className="flex justify-between items-end mb-2">
            <label className="block text-[10px] font-black text-gray-900 uppercase">Многопоточность (Threads)</label>
            <span className="text-xs font-black text-white bg-orange-600 px-2 py-0.5 rounded border-2 border-gray-900 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
              {concurrency}x
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
            className="w-full h-3 bg-gray-200 rounded-xl appearance-none cursor-pointer accent-orange-600 border-2 border-gray-900"
          />
        </div>

        <div>
          <div className="flex justify-between items-end mb-2">
            <label className="block text-[10px] font-black text-gray-900 uppercase">Объем (x3 итого)</label>
            <span className="text-xs font-black text-white bg-indigo-600 px-2 py-0.5 rounded border-2 border-gray-900 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
              ~{targetLength * 3} слов
            </span>
          </div>
          <input
            type="range"
            min="300"
            max="5000"
            step="100"
            value={targetLength}
            onChange={(e) => setTargetLength(parseInt(e.target.value))}
            disabled={isProcessing}
            className="w-full h-3 bg-gray-200 rounded-xl appearance-none cursor-pointer accent-indigo-600 border-2 border-gray-900"
          />
        </div>

        <div className="pt-4 border-t-2 border-gray-100">
          <div className="flex items-center justify-between mb-4 bg-indigo-50 p-3 rounded-xl border-2 border-indigo-100">
            <span className="text-[10px] font-black text-indigo-900 uppercase">Обработать все строки</span>
            <label className="flex items-center cursor-pointer group">
              <div className="relative">
                <input 
                  type="checkbox" 
                  className="sr-only" 
                  checked={processAll}
                  onChange={(e) => setProcessAll(e.target.checked)}
                  disabled={isProcessing}
                />
                <div className={`block w-10 h-6 rounded-full transition-colors border-2 border-gray-900 ${processAll ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                <div className={`absolute left-0.5 top-0.5 bg-white border-2 border-gray-900 w-4.5 h-4.5 rounded-full transition-transform ${processAll ? 'transform translate-x-4' : ''}`}></div>
              </div>
            </label>
          </div>
          
          <div className={`transition-all duration-300 ${processAll ? 'opacity-30 grayscale' : 'opacity-100'}`}>
            <label className="block text-[10px] font-black text-gray-900 mb-2 uppercase tracking-wider">Лимит строк</label>
            <input
              type="number"
              min="1"
              max={totalAvailable > 0 ? totalAvailable : 99999}
              value={maxRows}
              onChange={(e) => {
                const val = parseInt(e.target.value);
                if (!isNaN(val)) setMaxRows(val);
              }}
              disabled={isProcessing || processAll}
              className="w-full bg-white border-2 border-gray-900 text-gray-900 font-black text-base rounded-xl p-3 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] outline-none"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConfigPanel;
