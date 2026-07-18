import { useState, useEffect } from "react";
import { Sparkles, Check } from "lucide-react";

export function SyncingScreen({ email }: { email: string }) {
  const steps = ["Connecting to Gmail…", "Fetching your inbox…", "Running AI analysis…", "Almost ready…"];
  const [step, setStep] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setStep((s) => Math.min(s + 1, steps.length - 1)), 1500);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#0D0F1A] flex items-center justify-center">
      <div className="text-center max-w-sm">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-xl shadow-indigo-500/30 mx-auto mb-6">
          <Sparkles className="w-8 h-8 text-white animate-pulse" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1" style={{ fontFamily: "'Plus Jakarta Sans',sans-serif" }}>
          Setting up your inbox
        </h2>
        <p className="text-sm text-gray-500 dark:text-slate-400 mb-8">{email}</p>
        <div className="space-y-2">
          {steps.map((s, i) => (
            <div key={s} className={`flex items-center gap-3 text-sm transition-all ${i <= step ? "opacity-100" : "opacity-20"}`}>
              <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${i < step ? "bg-emerald-500" : i === step ? "bg-indigo-500 animate-pulse" : "bg-gray-200 dark:bg-slate-700"}`}>
                {i < step ? <Check className="w-3 h-3 text-white" /> : <span className="w-1.5 h-1.5 bg-white rounded-full" />}
              </div>
              <span className={i <= step ? "text-gray-700 dark:text-slate-300" : "text-gray-400 dark:text-slate-600"}>{s}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

