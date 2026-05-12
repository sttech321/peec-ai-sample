import DashboardLayout from "../../components/DashboardLayout";

export default function OutreachPage() {
  return (
    <DashboardLayout currentPath="/outreach">
      <div>
        <h1 className="text-3xl font-bold text-white tracking-tight mb-2">Outreach Hub</h1>
        <p className="text-slate-400 text-sm">Actionable insights from AI engines for SEO improvements.</p>
      </div>

      <div className="bg-[#141418] border border-slate-800 rounded-xl p-8 text-center mt-8">
        <h2 className="text-xl text-white font-medium mb-2">Content Opportunities</h2>
        <p className="text-slate-500 max-w-lg mx-auto">
          See which competitor domains are outranking you and discover gaps in your content.
        </p>
      </div>
    </DashboardLayout>
  );
}
