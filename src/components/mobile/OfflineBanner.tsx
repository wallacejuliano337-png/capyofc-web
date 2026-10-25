import React, { useState, useEffect } from 'react';
import { WifiOff, Wifi } from 'lucide-react';

export const OfflineBanner: React.FC = () => {
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    if (typeof navigator === 'undefined') return true;
    return navigator.onLine;
  });
  const [justReconnected, setJustReconnected] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setJustReconnected(true);
      const timer = setTimeout(() => setJustReconnected(false), 3000);
      return () => clearTimeout(timer);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setJustReconnected(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline && !justReconnected) return null;

  if (justReconnected) {
    return (
      <aside
        aria-live="polite"
        className="w-full bg-[#23a55a] text-white text-xs font-semibold px-3 py-1.5 flex items-center justify-center gap-2 z-[99999] transition-all animate-in fade-in duration-200"
      >
        <Wifi className="w-3.5 h-3.5 flex-shrink-0" />
        <span>Conexão restabelecida! Você está online no CapyChat.</span>
      </aside>
    );
  }

  return (
    <aside
      aria-live="assertive"
      className="w-full bg-[#f23f43] text-white text-xs font-semibold px-3 py-1.5 flex items-center justify-center gap-2 z-[99999] transition-all animate-in fade-in duration-200"
    >
      <WifiOff className="w-3.5 h-3.5 flex-shrink-0" />
      <span>Sem conexão com a internet. Tentando reconectar ao CapyChat...</span>
    </aside>
  );
};
