import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { toolsConfig } from "../config/tools"; // 引入配置表

export default function Home() {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out pb-12">
      <header className="mb-12">
        <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 mb-4">欢迎回来 👋</h1>
        <p className="text-lg text-slate-500">选择一个工具开始今天的高效工作。</p>
      </header>
      
      <div className="space-y-12">
        {/* 自动循环渲染整个配置表 */}
        {toolsConfig.map((category, index) => (
          <section key={index}>
            <div className="flex items-center mb-6">
              <div className="w-1.5 h-6 bg-indigo-500 rounded-full mr-3"></div>
              <h2 className="text-xl font-bold text-slate-800">{category.category}</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {category.tools.map((tool) => (
                <Link key={tool.href} href={tool.href} className="group block p-6 bg-white rounded-2xl border border-slate-200/60 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-6 opacity-0 group-hover:opacity-100 transition-opacity">
                    <ArrowRight className="text-slate-300 group-hover:text-indigo-500 transition-colors" />
                  </div>
                  <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mb-6 shadow-inner">
                    <tool.icon size={28} strokeWidth={1.5} />
                  </div>
                  <h3 className="text-lg font-bold mb-2 text-slate-800">{tool.name}</h3>
                  <p className="text-slate-500 leading-relaxed text-sm line-clamp-2">
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