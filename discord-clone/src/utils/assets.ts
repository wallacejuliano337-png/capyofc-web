import React from 'react';

/**
 * Utilitário central para resolução de caminhos de assets locais da aplicação.
 * Garante que caminhos estáticos funcionem de forma idêntica e consistente tanto no Vite dev server (http://)
 * quanto no Electron empacotado sob o protocolo file:// (app.asar/dist/index.html).
 */
export function getAssetUrl(path: string | null | undefined): string {
  if (!path || typeof path !== 'string') return '';
  const trimmed = path.trim();
  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('data:') ||
    trimmed.startsWith('blob:')
  ) {
    return trimmed;
  }

  // Remove barras e pontos no início (/ ou ./ ou ../)
  const cleanPath = trimmed.replace(/^(\.?\/)+/, '');

  // Sob protocolo file:/// (Electron empacotado), caminhos com barra inicial '/'
  // apontam para a raiz do disco (ex: file:///D:/assets/...), quebrando imagens.
  // Caminhos relativos './' resolvem em relação ao dist/index.html.
  return `./${cleanPath}`;
}

/**
 * Fallback seguro para erro de carregamento de avatar (evita loops infinitos).
 */
export function handleAvatarError(
  e: React.SyntheticEvent<HTMLImageElement, Event>,
  fallbackPath: string = 'assets/avatar-padrao-capychat.png'
) {
  const target = e.currentTarget;
  if (target.dataset.hasFailed) return;
  target.dataset.hasFailed = 'true';
  target.src = getAssetUrl(fallbackPath);
}

/**
 * Fallback seguro para erro de carregamento de ícone de servidor / comunidade.
 * Se falhar, esconde o elemento img para que as iniciais do servidor apareçam sem ícone quebrado.
 */
export function handleServerIconError(
  e: React.SyntheticEvent<HTMLImageElement, Event>,
  fallbackPath?: string
) {
  const target = e.currentTarget;
  if (!target.dataset.hasFailed && fallbackPath) {
    target.dataset.hasFailed = 'true';
    target.src = getAssetUrl(fallbackPath);
    return;
  }
  // Esconde o ícone quebrado para preservar o layout e mostrar as iniciais
  target.style.display = 'none';
}

/**
 * Fallback genérico para imagens locais e remotas.
 */
export function handleGenericImageError(
  e: React.SyntheticEvent<HTMLImageElement, Event>,
  fallbackPath?: string
) {
  const target = e.currentTarget;
  if (!target.dataset.hasFailed && fallbackPath) {
    target.dataset.hasFailed = 'true';
    target.src = getAssetUrl(fallbackPath);
    return;
  }
  target.style.visibility = 'hidden';
}
