// src/app/page.tsx
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { toolsConfig } from "../config/tools";
import RecentBar from "../components/RecentBar";

export default function Home() {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out pb-12">
      <header className="mb-8 md:mb-12">
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 mb-3 md:mb-4">
          欢迎回来 👋
        </h1>
      </header>

      <RecentBar />

      <div className="space-y-8 md:space-y-12">
        {toolsConfig.map((category, index) => (
          <section key={index}>
            <div className="flex items-center mb-4 md:mb-6">
              <div className="w-1.5 h-5 md:h-6 bg-indigo-500 rounded-full mr-3"></div>
              <h2 className="text-lg md:text-xl font-bold text-slate-800">
                {category.category}
              </h2>
            </div>
            
            {/* 网格：列数随视口自动计算，卡片宽度保持稳定 */}
            <div className="ui-card-grid">
              {category.tools.map((tool) => (
                <Link 
                  key={tool.href} 
                  href={tool.href} 
                  className="group block p-5 md:p-6 bg-white rounded-2xl border border-slate-200/60 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 relative overflow-hidden"
                >
                  <div className="absolute top-0 right-0 p-4 md:p-6 opacity-0 group-hover:opacity-100 transition-opacity">
                    <ArrowRight className="text-slate-300 group-hover:text-indigo-500 transition-colors w-4 h-4 md:w-5 md:h-5" />
                  </div>
                  <div className="w-12 h-12 md:w-14 md:h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mb-4 md:mb-6 shadow-inner">
                    <tool.icon size={24} strokeWidth={1.5} />
                  </div>
                  <h3 className="text-base md:text-lg font-bold mb-1 md:mb-2 text-slate-800 break-words">
                    {tool.name}
                  </h3>
                  <p className="text-slate-500 leading-relaxed text-sm line-clamp-2 break-words">
                    {tool.desc}
                  </p>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}