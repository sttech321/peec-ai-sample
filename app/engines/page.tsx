import DashboardLayout from "../../components/DashboardLayout";

export default function EnginesPage() {
  return (
    <DashboardLayout currentPath="/engines">
      <div>
        <h1 className="text-3xl font-bold text-white tracking-tight mb-2">AI Engines</h1>
        <p className="text-slate-400 text-sm">Manage and configure the LLMs and search engines being tracked.</p>
      </div>

      <div className="bg-[#141418] border border-slate-800 rounded-xl p-8 text-center mt-8">
        <h2 className="text-xl text-white font-medium mb-2">Engines Configuration</h2>
        <p className="text-slate-500 max-w-lg mx-auto">
          Currently tracking ChatGPT, Claude, Perplexity, Gemini, and AI Overviews. 
          Detailed configuration will be added in the next update.
        </p>
      </div>
    </DashboardLayout>
  );
}
