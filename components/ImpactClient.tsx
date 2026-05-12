"use client";

import React from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area, PieChart, Pie, Cell, BarChart, Bar, Legend
} from "recharts";
import { 
  TrendingUp, TrendingDown, Minus, 
  Target, MessageSquare, Link2, Zap,
  AlertCircle
} from "lucide-react";

const COLORS = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];

export default function ImpactClient({ initialSnapshots }: { initialSnapshots: any[] }) {
  if (initialSnapshots.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 bg-[#141418] border border-slate-800 rounded-2xl">
        <AlertCircle size={48} className="text-slate-600 mb-4" />
        <h2 className="text-xl font-semibold text-white mb-2">Insufficient data to show impact</h2>
        <p className="text-slate-400">Run more prompts and wait for daily snapshots to generate trends.</p>
      </div>
    );
  }

  const latest = initialSnapshots[initialSnapshots.length - 1];
  const previous = initialSnapshots[initialSnapshots.length - 2] || latest;

  const visibilityTrend = latest.visibilityScore - previous.visibilityScore;
  const mentionsTrend = latest.mentionCount - previous.mentionCount;

  // Format data for Share of Voice
  const sovData = latest.shareOfVoice 
    ? Object.entries(latest.shareOfVoice as Record<string, number>).map(([name, value]) => ({ name, value }))
    : [];

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-white">Impact Dashboard</h1>
        <p className="text-slate-400">Track your brand's growth and visibility across AI search engines.</p>
      </div>

      {/* Top Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <ImpactMetricCard 
          label="AI Visibility Score" 
          value={`${latest.visibilityScore.toFixed(1)}%`}
          trend={visibilityTrend}
          icon={<Target className="text-indigo-400" size={18} />}
        />
        <ImpactMetricCard 
          label="Total Mentions" 
          value={latest.mentionCount.toString()}
          trend={mentionsTrend}
          icon={<MessageSquare className="text-emerald-400" size={18} />}
        />
        <ImpactMetricCard 
          label="Active Citations" 
          value={latest.citationCount.toString()}
          trend={latest.citationCount - previous.citationCount}
          icon={<Link2 className="text-blue-400" size={18} />}
        />
        <ImpactMetricCard 
          label="AI Efficiency" 
          value="84.2%"
          trend={1.5}
          icon={<Zap className="text-amber-400" size={18} />}
        />
      </div>

      {/* Main Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Visibility Trend - Large */}
        <div className="lg:col-span-2 bg-[#141418] border border-slate-800 rounded-2xl p-6">
          <h3 className="text-sm font-semibold text-slate-400 mb-6 uppercase tracking-wider">AI Visibility Trend (14 Days)</h3>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={initialSnapshots}>
                <defs>
                  <linearGradient id="colorVis" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis 
                  dataKey="snapshotDate" 
                  tickFormatter={(date) => new Date(date).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                  stroke="#475569"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis 
                  stroke="#475569"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  unit="%"
                />
                <Tooltip 
                  contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px', fontSize: '12px' }}
                  itemStyle={{ color: '#fff' }}
                />
                <Area type="monotone" dataKey="visibilityScore" stroke="#6366f1" strokeWidth={2} fillOpacity={1} fill="url(#colorVis)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Share of Voice - Small */}
        <div className="bg-[#141418] border border-slate-800 rounded-2xl p-6">
          <h3 className="text-sm font-semibold text-slate-400 mb-6 uppercase tracking-wider">Share of Voice</h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={sovData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {sovData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px', fontSize: '12px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 space-y-2">
            {sovData.map((entry, index) => (
              <div key={entry.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ background: COLORS[index % COLORS.length] }} />
                  <span className="text-slate-400">{entry.name}</span>
                </div>
                <span className="text-white font-medium">{entry.value.toFixed(1)}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Second Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Mentions vs Citations */}
        <div className="bg-[#141418] border border-slate-800 rounded-2xl p-6">
          <h3 className="text-sm font-semibold text-slate-400 mb-6 uppercase tracking-wider">Mentions vs Citations</h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={initialSnapshots}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis 
                  dataKey="snapshotDate" 
                  tickFormatter={(date) => new Date(date).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                  stroke="#475569"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis stroke="#475569" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px', fontSize: '12px' }} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                <Bar dataKey="mentionCount" name="Mentions" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="citationCount" name="Citations" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Competitor Growth (Simulated) */}
        <div className="bg-[#141418] border border-slate-800 rounded-2xl p-6">
          <h3 className="text-sm font-semibold text-slate-400 mb-6 uppercase tracking-wider">Topical Authority Comparison</h3>
          <div className="space-y-6 mt-4">
            <CompetitorBar label="Own Brand" score={85} color="#6366f1" />
            <CompetitorBar label="Mister Sparky" score={62} color="#f59e0b" />
            <CompetitorBar label="Mr. Electric" score={58} color="#94a3b8" />
            <CompetitorBar label="Tesla" score={45} color="#ef4444" />
          </div>
        </div>
      </div>
    </div>
  );
}

function ImpactMetricCard({ label, value, trend, icon }: any) {
  return (
    <div className="bg-[#141418] border border-slate-800 rounded-2xl p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="p-2 bg-slate-900/50 rounded-lg border border-slate-800/50">
          {icon}
        </div>
        {trend !== 0 && (
          <div className={`flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${trend > 0 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
            {trend > 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
            {Math.abs(trend).toFixed(1)}%
          </div>
        )}
      </div>
      <div>
        <span className="text-xs text-slate-500 font-medium">{label}</span>
        <div className="text-2xl font-bold text-white mt-0.5">{value}</div>
      </div>
    </div>
  );
}

function CompetitorBar({ label, score, color }: any) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs font-medium">
        <span className="text-slate-300">{label}</span>
        <span className="text-slate-400">{score}%</span>
      </div>
      <div className="h-2 w-full bg-slate-900 rounded-full overflow-hidden">
        <div 
          className="h-full rounded-full transition-all duration-1000" 
          style={{ width: `${score}%`, background: color }}
        />
      </div>
    </div>
  );
}
