import DashboardLayout from "../../components/DashboardLayout";

export default function ReportsPage() {
  return (
    <DashboardLayout currentPath="/reports">
      <div>
        <h1 className="text-3xl font-bold text-white tracking-tight mb-2">Reports</h1>
        <p className="text-slate-400 text-sm">Detailed analytics on sentiment and brand visibility.</p>
      </div>

      <div className="bg-[#141418] border border-slate-800 rounded-xl p-8 text-center mt-8">
        <h2 className="text-xl text-white font-medium mb-2">Advanced Analytics</h2>
        <p className="text-slate-500 max-w-lg mx-auto">
          Chart visualizations and historical data exports will appear here.
        </p>
      </div>
    </DashboardLayout>
  );
}
