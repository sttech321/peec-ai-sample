import DashboardLayout from "./DashboardLayout";

export default function PlaceholderPage({ title, description }: { title: string, description: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
      <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center mb-6">
        <span className="text-2xl">🚧</span>
      </div>
      <h1 className="text-2xl font-bold text-white mb-2">{title}</h1>
      <p className="text-slate-400 max-w-md">{description}</p>
      <button className="mt-8 px-6 py-2 bg-indigo-500 text-white rounded-lg font-medium hover:bg-indigo-600 transition-colors">
        Coming Soon
      </button>
    </div>
  );
}
