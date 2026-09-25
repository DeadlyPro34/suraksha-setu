"use client";

export default function ApprovalsPage() {
  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 text-white flex-shrink-0 flex flex-col min-h-screen">
        <div className="p-5 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🛡️</span>
            <div>
              <h1 className="font-bold text-sm">Suraksha Setu</h1>
              <p className="text-[10px] text-slate-400">Official Dashboard</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {[
            { icon: "📊", label: "Dashboard", href: "/dashboard" },
            { icon: "🚨", label: "Incidents", href: "/incidents" },
            { icon: "✅", label: "Approvals", active: true },
          ].map((item) => (
            <a
              key={item.label}
              href={"href" in item ? item.href : "#"}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
                "active" in item && item.active
                  ? "bg-blue-600 text-white font-medium"
                  : "text-slate-400 hover:text-white hover:bg-slate-800"
              }`}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </a>
          ))}
        </nav>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto">
        <header className="bg-white border-b border-slate-200 px-6 py-4 sticky top-0 z-40">
          <h2 className="text-xl font-bold text-slate-900">Approvals</h2>
          <p className="text-xs text-slate-500">AI plan approval records are not connected to this page yet.</p>
        </header>

        <div className="p-6">
          <div className="card p-12 text-center text-slate-500 max-w-2xl mx-auto mt-10">
            <div className="text-5xl mb-4">🔌</div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">Approval workflow unavailable</h3>
            <p className="text-sm">This page does not yet load response plans from the database. No approval status is being reported here.</p>
          </div>
        </div>
      </main>
    </div>
  );
}
