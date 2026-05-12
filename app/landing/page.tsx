import React from "react";
import Link from "next/link";
import { 
  ShieldCheck, 
  Zap, 
  BarChart3, 
  Search, 
  ArrowRight,
  Sparkles,
  Target,
  Globe
} from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white selection:bg-indigo-500/30">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0a0a0a]/80 backdrop-blur-md border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center">
              <Sparkles className="text-white" size={18} />
            </div>
            <span className="text-lg font-bold tracking-tight">PEEC AI</span>
          </div>
          
          <div className="hidden md:flex items-center gap-8">
            <Link href="#features" className="text-sm text-slate-400 hover:text-white transition-colors">Features</Link>
            <Link href="#how-it-works" className="text-sm text-slate-400 hover:text-white transition-colors">How it works</Link>
            <Link href="#pricing" className="text-sm text-slate-400 hover:text-white transition-colors">Pricing</Link>
          </div>

          <div className="flex items-center gap-4">
            <Link href="/login" className="text-sm text-slate-400 hover:text-white transition-colors">Login</Link>
            <Link href="/" className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 rounded-full text-sm font-semibold transition-all">
              Go to App
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-40 pb-20 px-6 overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-indigo-500/10 blur-[120px] rounded-full -z-10" />
        
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-medium text-indigo-400 mb-8 animate-fade-in">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
            </span>
            New: Generative Engine Optimization (GEO) actions are now in beta
          </div>
          
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-8 bg-clip-text text-transparent bg-gradient-to-b from-white to-white/50">
            Win the heart of <br /> AI Search Engines.
          </h1>
          
          <p className="text-xl text-slate-400 mb-12 max-w-2xl mx-auto leading-relaxed">
            PEEC helps brands track and improve their visibility inside ChatGPT, Gemini, Claude, and Perplexity. Stop guessing, start optimizing.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/" className="group px-8 py-4 bg-white text-black rounded-full font-bold text-lg hover:bg-white/90 transition-all flex items-center gap-2">
              Start tracking for free
              <ArrowRight className="group-hover:translate-x-1 transition-transform" size={20} />
            </Link>
            <Link href="#pricing" className="px-8 py-4 bg-white/5 border border-white/10 rounded-full font-bold text-lg hover:bg-white/10 transition-all">
              View demo
            </Link>
          </div>
        </div>

        {/* Dashboard Preview */}
        <div className="mt-24 max-w-6xl mx-auto rounded-3xl border border-white/10 bg-[#141418] shadow-2xl overflow-hidden relative group">
          <div className="absolute inset-0 bg-gradient-to-b from-indigo-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
          <img 
            src="https://images.unsplash.com/photo-1611162617474-5b21e879e113?q=80&w=2574&auto=format&fit=crop" 
            alt="Dashboard Preview" 
            className="w-full grayscale opacity-80 group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-700"
          />
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-[2px] opacity-100 group-hover:opacity-0 transition-opacity">
             <div className="bg-white/10 border border-white/20 px-6 py-3 rounded-2xl text-lg font-semibold backdrop-blur-xl">
               Peek inside the dashboard
             </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-32 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-20">
            <h2 className="text-3xl md:text-5xl font-bold mb-4">Enterprise AI Visibility Intelligence</h2>
            <p className="text-slate-400">Everything you need to master GenAI Search.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <FeatureCard 
              icon={<Target className="text-indigo-400" />}
              title="Visibility Tracking"
              description="Track how often your brand is mentioned across all major LLMs and AI search engines."
            />
            <FeatureCard 
              icon={<Zap className="text-emerald-400" />}
              title="Actionable Insights"
              description="Daily recommendations to improve your off-page and on-page AI search presence."
            />
            <FeatureCard 
              icon={<Search className="text-blue-400" />}
              title="Competitor Overlap"
              description="See where your competitors are winning in AI answers and how to leapfrog them."
            />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-20 border-t border-white/5 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center">
              <Sparkles className="text-white" size={18} />
            </div>
            <span className="text-lg font-bold tracking-tight">PEEC AI</span>
          </div>
          
          <div className="text-sm text-slate-500">
            © 2026 PEEC AI Tracker. Built for the future of search.
          </div>

          <div className="flex gap-6 text-sm text-slate-400">
             <Link href="#">Privacy</Link>
             <Link href="#">Terms</Link>
             <Link href="#">Twitter</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, description }: any) {
  return (
    <div className="p-8 rounded-3xl bg-white/5 border border-white/10 hover:border-indigo-500/50 transition-all group">
      <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
        {icon}
      </div>
      <h3 className="text-xl font-bold mb-3">{title}</h3>
      <p className="text-slate-400 leading-relaxed">{description}</p>
    </div>
  );
}
