
import React from 'react';

const Header: React.FC = () => {
  return (
    <header className="bg-white border-b border-gray-200 py-6 px-8 mb-8">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="bg-indigo-600 p-2 rounded-lg shadow-lg shadow-indigo-200">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">SEO Автоматизатор Pro</h1>
            <p className="text-sm text-gray-500">Массовая генерация контента с Gemini 3 Flash</p>
          </div>
        </div>
        <div className="hidden md:flex items-center space-x-4">
          <span className="text-xs font-medium px-2.5 py-0.5 rounded bg-indigo-100 text-indigo-800">На базе Google Gemini</span>
        </div>
      </div>
    </header>
  );
};

export default Header;
