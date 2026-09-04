import React from 'react';
import { useBattery } from '../../context/BatteryContext';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export const NotificationToast = () => {
  const { toasts, removeToast } = useBattery();

  if (!toasts || toasts.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col space-y-3 max-w-sm w-full pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="pointer-events-auto flex items-start space-x-3 p-4 rounded-2xl bg-white border border-yellow-400 shadow-2xl backdrop-blur-md text-slate-900 animate-in slide-in-from-bottom-5 fade-in duration-300"
        >
          <div className="flex-shrink-0 mt-0.5">
            {toast.type === 'success' && (
              <CheckCircle2 className="w-5 h-5 text-yellow-600" />
            )}
            {toast.type === 'warning' && (
              <AlertCircle className="w-5 h-5 text-amber-600" />
            )}
            {toast.type === 'info' && (
              <Info className="w-5 h-5 text-slate-700" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <h5 className="text-sm font-bold text-slate-900">{toast.title}</h5>
            <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">{toast.message}</p>
          </div>

          <button
            onClick={() => removeToast(toast.id)}
            className="flex-shrink-0 p-1 text-slate-400 hover:text-slate-800 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
};
