import { useState, useEffect } from 'react';

/**
 * Hook para detectar modo mobile (iPhone, Safari iOS, telas < 768px).
 * No Electron desktop, prioriza o layout desktop completo.
 */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    // Se estiver rodando dentro do Electron desktop, não força modo mobile por padrão
    if (window.arena) return false;
    return window.innerWidth < 768;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const checkMobile = () => {
      // Se for Electron desktop com tela normal, mantém desktop
      if (window.arena && window.innerWidth >= 600) {
        setIsMobile(false);
        return;
      }
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return isMobile;
}
