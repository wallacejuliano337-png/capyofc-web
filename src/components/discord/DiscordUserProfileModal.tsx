import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useDiscord } from '../../store/discordStore';
import { resolveServerTagBadge, resolveServerTagColor, resolveServerTagBadgeIcon } from '../../types/discord';
import { getAvatarUrl, handleAvatarError } from '../../utils/avatar';
import { getAssetUrl } from '../../utils/assets';
import { DiscordBadgesGroup } from './DiscordBadgesGroup';
import { getStyledNameCSS, getFontClassName, NameEffect } from '../../utils/nameStyle';
import {
  X,
  MessageSquare,
  Gift,
  MoreHorizontal,
  Lock,
  Plus,
  Link2,
  Gamepad2,
  ChevronDown,
  ChevronsRight,
  Flame,
  Check,
  Calendar,
  ExternalLink,
  Shield,
  Music,
  Tv,
  Headphones,
  Radio,
  Pencil,
  Copy,
  FolderHeart,
  Palette,
  Wand2,
  Dices,
  RotateCw,
  RotateCcw,
  Sun,
  Moon,
  Pipette,
  ArrowLeft,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';

// Font options for "Estilo do nome exibido" (12 variants matching Discord)
interface FontOption {
  id: string;
  name: string;
  className: string;
}

const FONT_OPTIONS: FontOption[] = [
  { id: 'sans', name: 'Padrão', className: 'font-sans' },
  { id: 'serif', name: 'Serif', className: 'font-serif' },
  { id: 'mono', name: 'Mono', className: 'font-mono tracking-wider' },
  { id: 'gothic', name: 'Gótico', className: 'font-serif italic font-black tracking-wider' },
  { id: 'cyber', name: 'Cyber', className: 'font-mono uppercase font-black tracking-widest' },
  { id: 'bubble', name: 'Bubble', className: 'font-sans font-black tracking-wide' },
  { id: 'display', name: 'Display', className: 'font-sans uppercase font-extrabold tracking-tight' },
  { id: 'retro', name: 'Retro', className: 'font-mono font-bold' },
  { id: 'comic', name: 'Comic', className: 'font-sans font-black italic' },
  { id: 'script', name: 'Script', className: 'font-serif italic font-bold' },
  { id: 'pixel', name: 'Pixel', className: 'font-mono font-bold tracking-tighter' },
  { id: 'heavy', name: 'Heavy', className: 'font-sans uppercase font-black' },
];

const EFFECT_OPTIONS: { id: NameEffect; label: string }[] = [
  { id: 'solid', label: 'Sólido' },
  { id: 'gradient', label: 'Gradiente' },
  { id: 'neon', label: 'Neon' },
  { id: 'cartoon', label: 'Desenho' },
  { id: 'pop', label: 'Pop' },
  { id: 'gummy', label: 'Gummy' },
  { id: 'prism', label: 'Prism' },
];

// Color presets
const PRESET_COLORS = [
  '#f47fff', // Pink
  '#23a55a', // Mint Green
  '#00a8fc', // Cyan
  '#9b59b6', // Purple
  '#f23f43', // Red
  '#ff7a00', // Orange
  '#f1c40f', // Yellow
];

// Connected platforms logos for "Atividade" tab (SVG icons matching Discord)
const PLATFORMS: { name: string; icon?: string; svg: React.ReactNode }[] = [
  {
    name: 'Steam',
    svg: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
        <path d="M12 2a10 10 0 0 0-10 9.8c0 4.7 3.3 8.6 7.8 9.7l2.8-4a3.3 3.3 0 0 1-.3-1.4 3.4 3.4 0 0 1 1-2.4l-3-2.1a3 3 0 1 1 3-3v.1l3 2.1a3.4 3.4 0 0 1 2.4-1 3.4 3.4 0 1 1-3.4 3.4v-.2l-2.8 4A10 10 0 0 0 22 12 10 10 0 0 0 12 2z" />
      </svg>
    ),
  },
  {
    name: 'PlayStation',
    svg: (
      <svg viewBox="0 0 24 24" fill="#003791" className="w-5 h-5">
        <path d="M8.5 3.5v12.2l4.8-1.7V5.2c0-1.2-.6-1.7-1.7-1.7zm6 3.8v7.5l2.4-.8V8.7c0-.9-.5-1.4-1.4-1.4zm-11 9.9c-.8.3-1.1.7-.8 1.1.4.5 1.7.7 3.3.4l8.3-3-2.6-.9-8.2 2.4zm10.5-1.5l5.2-1.9c1.6-.6 2.1-.4 2 .3-.2.7-1.4 1.4-3.1 1.9l-4.1 1.4z" />
      </svg>
    ),
  },
  {
    name: 'Xbox',
    svg: (
      <svg viewBox="0 0 24 24" fill="#107C10" className="w-5 h-5">
        <path d="M4.9 3.5C6.9 2 9.4 1 12 1s5.1 1 7.1 2.5c-2.3 2.5-5 5.5-6.5 8.7-1-2.4-2.8-5.3-5.7-7.7zm-2.4 3.8c1.8 1.8 4 4.3 5.4 6.9-3.2 4-5.6 7.7-6.5 7.8-.3-2-.4-4-.4-6 0-3.3.9-6.3 2.5-8.7zm19 0C23.1 9.7 24 12.7 24 16c0 2-.1 4-.4 6-.9-.1-3.3-3.8-6.5-7.8 1.4-2.6 3.6-5.1 5.4-6.9zm-13.8 8.4c2.8 3.5 5.7 6.7 8.3 8.3-1.2.6-2.6 1-4 1s-2.8-.4-4-1c2.6-1.6 5.5-4.8 8.3-8.3-1.4-1.8-3.1-3.4-4.3-3.4s-2.9 1.6-4.3 3.4z" />
      </svg>
    ),
  },
  {
    name: 'Twitch',
    svg: (
      <svg viewBox="0 0 24 24" fill="#9146FF" className="w-5 h-5">
        <path d="M2.5 2L1 6v14h5v4h4l3.5-4h4.5L23 15V2H2.5zm18.5 12l-3.5 3.5H12l-3 3V17.5H4V4h17v10zm-4-7h-2.5v5.5H17V7zm-5.5 0H9v5.5h2.5V7z" />
      </svg>
    ),
  },
  {
    name: 'Battle.net',
    svg: (
      <svg viewBox="0 0 24 24" fill="#00AEFF" className="w-5 h-5">
        <path d="M12 2L2 7v10l10 5 10-5V7L12 2zm0 2.8l7.5 3.8L12 12.3 4.5 8.6 12 4.8zm-7.5 5.5l6.5 3.3v7.3L4.5 17.5v-7.2zm8.5 10.6v-7.3l6.5-3.3v7.2L13 20.9z" />
      </svg>
    ),
  },
  {
    name: 'League of Legends',
    svg: (
      <svg viewBox="0 0 24 24" fill="#C89B3C" className="w-5 h-5">
        <path d="M6 3v15h12v-3.5H10.5V3H6zm10.5 7.5l-4-4v2.5H9v3h3.5v2.5l4-4z" />
      </svg>
    ),
  },
  {
    name: 'Epic Games',
    svg: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
        <path d="M12 2L3 5v10c0 4 4.5 6.5 9 7 4.5-.5 9-3 9-7V5l-9-3zm4.5 13.5h-9V8.5h9v7z" />
      </svg>
    ),
  },
  {
    name: 'Riot Games',
    svg: (
      <svg viewBox="0 0 24 24" fill="#D32936" className="w-5 h-5">
        <path d="M13.5 2L3 6.8v10.4L13.5 22 21 16.5V7.5L13.5 2zm-1.5 3.5l5.5 2.5v7l-5.5 4-5.5-4v-7l5.5-2.5z" />
      </svg>
    ),
  },
  {
    name: 'Roblox',
    svg: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
        <path d="M5.2 2L2 18.8l16.8 3.2L22 5.2 5.2 2zm7.6 11.2l-3.2-.6.6-3.2 3.2.6-.6 3.2z" />
      </svg>
    ),
  },
  {
    name: 'Spotify',
    svg: (
      <svg viewBox="0 0 24 24" fill="#1DB954" className="w-5 h-5">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.58 14.42c-.18.3-.56.4-.86.22-2.36-1.44-5.32-1.76-8.82-.96-.34.08-.68-.14-.76-.48-.08-.34.14-.68.48-.76 3.82-.88 7.12-.5 9.74 1.12.3.18.4.56.22.86zm1.22-2.72c-.24.38-.72.5-1.1.26-2.7-1.66-6.82-2.14-10.02-1.18-.42.12-.88-.12-1-.54-.12-.42.12-.88.54-1 3.66-1.1 8.2-.58 11.32 1.34.38.24.5.72.26 1.12zm.1-2.84C14.66 9.08 9.32 8.9 6.24 9.84c-.5.14-1.02-.14-1.16-.64-.14-.5.14-1.02.64-1.16 3.54-1.08 9.42-.86 13.2 1.38.46.26.6.84.34 1.3-.26.44-.84.6-1.36.14z" />
      </svg>
    ),
  },
  {
    name: 'YouTube',
    svg: (
      <svg viewBox="0 0 24 24" fill="#FF0000" className="w-5 h-5">
        <path d="M23.5 6.2c-.3-1.1-1.1-1.9-2.2-2.2C19.3 3.5 12 3.5 12 3.5s-7.3 0-9.3.5c-1.1.3-1.9 1.1-2.2 2.2C0 8.2 0 12 0 12s0 3.8.5 5.8c.3 1.1 1.1 1.9 2.2 2.2 2 .5 9.3.5 9.3.5s7.3 0 9.3-.5c1.1-.3 1.9-1.1 2.2-2.2.5-2 .5-5.8.5-5.8s0-3.8-.5-5.8zM9.6 15.6V8.4l6.3 3.6-6.3 3.6z" />
      </svg>
    ),
  },
  {
    name: 'Crunchyroll',
    svg: (
      <svg viewBox="0 0 24 24" fill="#F47521" className="w-5 h-5">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1.6 14.5c-2.5 0-4.5-2-4.5-4.5s2-4.5 4.5-4.5c1.2 0 2.3.5 3.1 1.3l-1.3 1.3c-.5-.5-1.1-.8-1.8-.8-1.5 0-2.7 1.2-2.7 2.7s1.2 2.7 2.7 2.7c.7 0 1.3-.3 1.8-.8l1.3 1.3c-.8.8-1.9 1.3-3.1 1.3z" />
      </svg>
    ),
  },
];

// Calculate color perceived relative luminance (ITU-R BT.709)
function getLuminance(hex: string): number {
  if (!hex || !hex.startsWith('#')) return 0.2;
  let c = hex.replace('#', '').trim();
  if (c.length === 3) c = c.split('').map((x) => x + x).join('');
  if (c.length !== 6) return 0.2;
  const r = parseInt(c.substring(0, 2), 16) / 255;
  const g = parseInt(c.substring(2, 4), 16) / 255;
  const b = parseInt(c.substring(4, 6), 16) / 255;
  if (isNaN(r) || isNaN(g) || isNaN(b)) return 0.2;
  const a = [r, g, b].map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
  return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
}

// Helper functions for HSV <-> HEX conversion
function hsvToHex(h: number, s: number, v: number): string {
  s = Math.max(0, Math.min(100, s)) / 100;
  v = Math.max(0, Math.min(100, v)) / 100;
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r = 0, g = 0, b = 0;
  if (h >= 0 && h < 60) { r = c; g = x; b = 0; }
  else if (h >= 60 && h < 120) { r = x; g = c; b = 0; }
  else if (h >= 120 && h < 180) { r = 0; g = c; b = x; }
  else if (h >= 180 && h < 240) { r = 0; g = x; b = c; }
  else if (h >= 240 && h < 300) { r = x; g = 0; b = c; }
  else { r = c; g = 0; b = x; }

  const toHex = (n: number) => Math.round((n + m) * 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function hexToHsv(hex: string): { h: number; s: number; v: number } {
  let c = hex.replace('#', '').trim();
  if (c.length === 3) c = c.split('').map((x) => x + x).join('');
  if (c.length !== 6) return { h: 280, s: 75, v: 35 };

  const r = parseInt(c.substring(0, 2), 16) / 255;
  const g = parseInt(c.substring(2, 4), 16) / 255;
  const b = parseInt(c.substring(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  const s = max === 0 ? 0 : d / max;
  const v = max;

  if (max !== min) {
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return { h: Math.round(h * 360), s: Math.round(s * 100), v: Math.round(v * 100) };
}

export const DiscordUserProfileModal: React.FC = () => {
  const {
    isUserProfileModalOpen,
    userProfileModalTarget,
    closeUserProfileModal,
    currentUser,
    updateCurrentUser,
    servers,
    activeServerId,
    setActiveChannel,
    setActiveView,
    setActiveHomeTab,
    getServerRoles,
    serverRolesMap,
    roles,
    userRoleMap,
    setUserRoles,
    canUserModerate,
    fetchCommunityMembers,
  } = useDiscord();

  const targetUser = userProfileModalTarget || currentUser;
  const isMe = targetUser.id === currentUser.id || targetUser.id === 'user-me';

  // Tab & navigation
  const [activeTab, setActiveTab] = useState<'mural' | 'activity' | 'wishlist'>('mural');
  const [isModePreview, setIsModePreview] = useState(false);

  // Styled Name customization
  const [nameFont, setNameFont] = useState<string>(targetUser.nameFont || currentUser.nameFont || 'gothic');
  const [nameEffect, setNameEffect] = useState<NameEffect>(
    (targetUser.nameEffect as NameEffect) || (currentUser.nameEffect as NameEffect) || 'neon'
  );
  const [nameColor, setNameColor] = useState<string>(targetUser.nameColor || currentUser.nameColor || '#23a55a');
  const [isNameStyleModalOpen, setIsNameStyleModalOpen] = useState(false);
  const [previewLightMode, setPreviewLightMode] = useState(false);

  // Profile Theme (Gradients)
  const [themePrimaryColor, setThemePrimaryColor] = useState<string>(
    targetUser.themePrimaryColor || currentUser.themePrimaryColor || '#3a1352'
  );
  const [themeSecondaryColor, setThemeSecondaryColor] = useState<string>(
    targetUser.themeSecondaryColor || currentUser.themeSecondaryColor || '#133644'
  );
  const [colorPickerTarget, setColorPickerTarget] = useState<'primary' | 'secondary' | null>(null);
  const [colorPickerPos, setColorPickerPos] = useState<{ top: number; left: number }>({ top: 220, left: 320 });

  // Color picker HSV state
  const [pickerHue, setPickerHue] = useState<number>(280);
  const [pickerSat, setPickerSat] = useState<number>(75);
  const [pickerVal, setPickerVal] = useState<number>(35);
  const isDragging2DRef = useRef<boolean>(false);
  const gradientBoxRef = useRef<HTMLDivElement>(null);

  // Floating color picker popover state for Name Style Modal (Image 5)
  const [isNameColorPickerOpen, setIsNameColorPickerOpen] = useState(false);
  const [namePickerHue, setNamePickerHue] = useState<number>(250);
  const [namePickerSat, setNamePickerSat] = useState<number>(80);
  const [namePickerVal, setNamePickerVal] = useState<number>(80);
  const [isDraggingNamePicker, setIsDraggingNamePicker] = useState<boolean>(false);
  const namePickerPlaneRef = useRef<HTMLDivElement>(null);
  const nameColorPopoverRef = useRef<HTMLDivElement>(null);
  const nameCustomColorBtnRef = useRef<HTMLButtonElement>(null);

  // Refs for eyedroppers and swatches
  const primarySwatchRef = useRef<HTMLButtonElement>(null);
  const secondarySwatchRef = useRef<HTMLButtonElement>(null);
  const nameColorInputRef = useRef<HTMLInputElement>(null);
  const themeColorInputRef = useRef<HTMLInputElement>(null);

  // Banner Editor Modal
  const [isBannerModalOpen, setIsBannerModalOpen] = useState(false);
  const [customBannerUrl, setCustomBannerUrl] = useState<string | null>(null);
  const [bannerZoom, setBannerZoom] = useState(50);
  const [bannerRotation, setBannerRotation] = useState(0);

  // Notes & roles
  const [noteText, setNoteText] = useState('');
  const [isEditingNote, setIsEditingNote] = useState(false);
  const [isAddRoleOpen, setIsAddRoleOpen] = useState(false);
  const [roleSearch, setRoleSearch] = useState('');
  const [roleError, setRoleError] = useState<string | null>(null);
  const [isUpdatingRole, setIsUpdatingRole] = useState(false);

  const modalRef = useRef<HTMLDivElement>(null);
  const addRoleBtnRef = useRef<HTMLButtonElement>(null);
  const rolePopoverRef = useRef<HTMLDivElement>(null);
  const colorPickerRef = useRef<HTMLDivElement>(null);

  const currentServer =
    activeServerId !== '@me'
      ? servers.find((s) => s.id === activeServerId) || servers[0]
      : servers[0];

  const tagColor = currentServer?.serverTag ? resolveServerTagColor(currentServer.serverTagColor) : null;
  const tagBadgeIcon = currentServer?.serverTag
    ? resolveServerTagBadgeIcon(currentServer.serverTagBadge, currentServer.serverTagBadgeImage)
    : null;
  const tagBadgeChar = currentServer?.serverTag
    ? resolveServerTagBadge(currentServer.serverTagBadge)
    : '🐺';

  // Synchronize targetUser props when opened
  useEffect(() => {
    if (targetUser) {
      if (targetUser.nameFont) setNameFont(targetUser.nameFont);
      if (targetUser.nameEffect) setNameEffect(targetUser.nameEffect as NameEffect);
      if (targetUser.nameColor) setNameColor(targetUser.nameColor);
      if (targetUser.themePrimaryColor) setThemePrimaryColor(targetUser.themePrimaryColor);
      if (targetUser.themeSecondaryColor) setThemeSecondaryColor(targetUser.themeSecondaryColor);
    }
  }, [targetUser]);

  // When color picker target opens, sync HSV from active color
  useEffect(() => {
    if (!colorPickerTarget) return;
    const activeHex = colorPickerTarget === 'primary' ? themePrimaryColor : themeSecondaryColor;
    const hsv = hexToHsv(activeHex);
    setPickerHue(hsv.h);
    setPickerSat(hsv.s);
    setPickerVal(hsv.v);
  }, [colorPickerTarget]);

  // Handle 2D saturation/brightness drag & click
  const handle2DMove = (clientX: number, clientY: number) => {
    if (!gradientBoxRef.current) return;
    const rect = gradientBoxRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    const y = Math.max(0, Math.min(clientY - rect.top, rect.height));
    const s = Math.round((x / rect.width) * 100);
    const v = Math.round((1 - y / rect.height) * 100);
    setPickerSat(s);
    setPickerVal(v);

    const newHex = hsvToHex(pickerHue, s, v);
    if (colorPickerTarget === 'primary') {
      setThemePrimaryColor(newHex);
      updateCurrentUser({ themePrimaryColor: newHex });
    } else if (colorPickerTarget === 'secondary') {
      setThemeSecondaryColor(newHex);
      updateCurrentUser({ themeSecondaryColor: newHex });
    }
  };

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (isDragging2DRef.current) {
        handle2DMove(e.clientX, e.clientY);
      }
    };
    const onMouseUp = () => {
      isDragging2DRef.current = false;
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [colorPickerTarget, pickerHue]);

  // Name Style Color Picker Handlers (Image 5)
  const updateNamePickerCoords = (clientX: number, clientY: number) => {
    if (!namePickerPlaneRef.current) return;
    const rect = namePickerPlaneRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, clientX - rect.left));
    const y = Math.max(0, Math.min(rect.height, clientY - rect.top));
    const s = Math.round((x / rect.width) * 100);
    const v = Math.round((1 - y / rect.height) * 100);
    setNamePickerSat(s);
    setNamePickerVal(v);
    const newHex = hsvToHex(namePickerHue, s, v);
    setNameColor(newHex);
  };

  useEffect(() => {
    if (!isDraggingNamePicker) return;
    const onMove = (e: MouseEvent) => updateNamePickerCoords(e.clientX, e.clientY);
    const onUp = () => setIsDraggingNamePicker(false);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [isDraggingNamePicker, namePickerHue]);

  useEffect(() => {
    if (!isNameColorPickerOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (
        nameColorPopoverRef.current &&
        !nameColorPopoverRef.current.contains(e.target as Node) &&
        !nameCustomColorBtnRef.current?.contains(e.target as Node)
      ) {
        setIsNameColorPickerOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [isNameColorPickerOpen]);

  // Keyboard navigation: Close on Escape
  useEffect(() => {
    if (!isUserProfileModalOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isNameStyleModalOpen) {
          setIsNameStyleModalOpen(false);
          e.stopPropagation();
        } else if (isBannerModalOpen) {
          setIsBannerModalOpen(false);
          e.stopPropagation();
        } else if (colorPickerTarget) {
          setColorPickerTarget(null);
          e.stopPropagation();
        } else if (isAddRoleOpen) {
          setIsAddRoleOpen(false);
          e.stopPropagation();
        } else {
          closeUserProfileModal();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    isUserProfileModalOpen,
    isNameStyleModalOpen,
    isBannerModalOpen,
    colorPickerTarget,
    isAddRoleOpen,
    closeUserProfileModal,
  ]);

  // Click outside color picker
  useEffect(() => {
    if (!colorPickerTarget) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        colorPickerRef.current &&
        !colorPickerRef.current.contains(e.target as Node) &&
        primarySwatchRef.current &&
        !primarySwatchRef.current.contains(e.target as Node) &&
        secondarySwatchRef.current &&
        !secondarySwatchRef.current.contains(e.target as Node)
      ) {
        setColorPickerTarget(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [colorPickerTarget]);

  // Click outside role selector popover
  useEffect(() => {
    if (!isAddRoleOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        rolePopoverRef.current &&
        !rolePopoverRef.current.contains(e.target as Node) &&
        addRoleBtnRef.current &&
        !addRoleBtnRef.current.contains(e.target as Node)
      ) {
        setIsAddRoleOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isAddRoleOpen]);

  // Fetch community members if needed
  useEffect(() => {
    if (isUserProfileModalOpen && currentServer?.communityId) {
      void fetchCommunityMembers(currentServer.communityId);
    }
  }, [isUserProfileModalOpen, currentServer?.communityId, fetchCommunityMembers]);

  // Roles calculation
  const availableRoles = useMemo(() => {
    if (!currentServer) return [];
    const serverRoles =
      getServerRoles(currentServer.id).length > 0
        ? getServerRoles(currentServer.id)
        : serverRolesMap[currentServer.id] || serverRolesMap[currentServer.communityId || ''] || roles;
    return serverRoles.filter(
      (r) => r.id !== 'role-everyone' && r.name !== '@everyone' && r.name !== '@todos'
    );
  }, [currentServer, getServerRoles, serverRolesMap, roles]);

  const targetRoleIds = useMemo(() => {
    if (!targetUser) return [];
    return (
      userRoleMap[targetUser.id] ||
      (targetUser.id === currentUser?.id ? userRoleMap['user-me'] || userRoleMap[currentUser?.id] || [] : [])
    );
  }, [userRoleMap, targetUser, currentUser]);

  const assignedRoles = useMemo(() => {
    return availableRoles.filter((r) => {
      if (targetRoleIds.includes(r.id)) return true;
      if (r.base_role === 'ADMIN' && targetRoleIds.includes('role-admin')) return true;
      if (r.base_role === 'MODERATOR' && targetRoleIds.includes('role-mod')) return true;
      return false;
    });
  }, [availableRoles, targetRoleIds]);

  const filteredAvailableRoles = useMemo(() => {
    const query = roleSearch.toLowerCase().trim();
    if (!query) return availableRoles;
    return availableRoles.filter((r) => r.name.toLowerCase().includes(query));
  }, [availableRoles, roleSearch]);

  const canManageRoles = useMemo(() => {
    if (!currentServer) return false;
    if (currentServer.ownerId === currentUser.id) return true;
    return canUserModerate(currentServer.id);
  }, [currentServer, currentUser.id, canUserModerate]);

  const handleToggleRole = async (roleId: string) => {
    if (!canManageRoles || !targetUser || isUpdatingRole) return;
    setIsUpdatingRole(true);
    setRoleError(null);
    try {
      const isAssigned = targetRoleIds.includes(roleId);
      const newRoleIds = isAssigned
        ? targetRoleIds.filter((id) => id !== roleId)
        : [...targetRoleIds, roleId];
      await setUserRoles(targetUser.id, newRoleIds, currentServer?.communityId);
    } catch {
      setRoleError('Não foi possível alterar o cargo.');
    } finally {
      setIsUpdatingRole(false);
    }
  };

  if (!isUserProfileModalOpen) return null;

  const handleOpenDM = () => {
    closeUserProfileModal();
    setActiveView('chat');
    setActiveChannel(`dm-${targetUser.id}`);
  };

  const handleOpenNitro = () => {
    closeUserProfileModal();
    setActiveHomeTab('ultra-pass');
  };

  // "Surpreenda-me!" randomizer function
  const handleSurpriseMe = () => {
    const randomFont = FONT_OPTIONS[Math.floor(Math.random() * FONT_OPTIONS.length)].id;
    const randomEffect = EFFECT_OPTIONS[Math.floor(Math.random() * EFFECT_OPTIONS.length)].id;
    const randomColor = PRESET_COLORS[Math.floor(Math.random() * PRESET_COLORS.length)];
    setNameFont(randomFont);
    setNameEffect(randomEffect);
    setNameColor(randomColor);

    const coolPrimaries = ['#4a154b', '#1a365d', '#285e61', '#521b41', '#44337a', '#702459'];
    const coolSecondaries = ['#0f3460', '#162447', '#1f4068', '#1b2a47', '#00587a', '#222831'];
    const pColor = coolPrimaries[Math.floor(Math.random() * coolPrimaries.length)];
    const sColor = coolSecondaries[Math.floor(Math.random() * coolSecondaries.length)];
    setThemePrimaryColor(pColor);
    setThemeSecondaryColor(sColor);

    updateCurrentUser({
      nameFont: randomFont,
      nameEffect: randomEffect,
      nameColor: randomColor,
      themePrimaryColor: pColor,
      themeSecondaryColor: sColor,
    });
  };

  const handleApplyNameStyle = () => {
    updateCurrentUser({
      nameFont,
      nameEffect,
      nameColor,
      themePrimaryColor,
      themeSecondaryColor,
    });
    setIsNameStyleModalOpen(false);
  };

  const effectiveBanner =
    customBannerUrl ||
    targetUser.bannerImage ||
    getAssetUrl('assets/ultra-pass/perfil-personalizado.png');

  const selectedFontClass = getFontClassName(nameFont);
  const primaryLum = getLuminance(themePrimaryColor);
  const secondaryLum = getLuminance(themeSecondaryColor);
  const avgLum = (primaryLum + secondaryLum) / 2;
  const isThemeLight = avgLum > 0.42;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 animate-in fade-in duration-150 select-none">
      {/* Backdrop Click */}
      <div className="absolute inset-0" onClick={closeUserProfileModal} />

      {/* Hidden Native Color Pickers for Eyedropper Fallback */}
      <input
        ref={nameColorInputRef}
        type="color"
        value={nameColor}
        onChange={(e) => {
          setNameColor(e.target.value);
          updateCurrentUser({ nameColor: e.target.value });
        }}
        className="sr-only pointer-events-none"
      />
      <input
        ref={themeColorInputRef}
        type="color"
        value={colorPickerTarget === 'primary' ? themePrimaryColor : themeSecondaryColor}
        onChange={(e) => {
          const hex = e.target.value;
          if (colorPickerTarget === 'primary') {
            setThemePrimaryColor(hex);
            updateCurrentUser({ themePrimaryColor: hex });
          } else {
            setThemeSecondaryColor(hex);
            updateCurrentUser({ themeSecondaryColor: hex });
          }
          const hsv = hexToHsv(hex);
          setPickerHue(hsv.h);
          setPickerSat(hsv.s);
          setPickerVal(hsv.v);
        }}
        className="sr-only pointer-events-none"
      />

      {/* Main Modal Window */}
      <div
        ref={modalRef}
        className="relative z-10 w-full max-w-[1080px] bg-[#111214] border border-[#232428] rounded-2xl shadow-2xl flex flex-col lg:flex-row overflow-hidden max-h-[92vh] text-left animate-in zoom-in-95 duration-150"
      >

        {/* ======================================================== */}
        {/* 1. LEFT SIDEBAR: Personalização / Prévia do ULTRAPASS    */}
        {/* ======================================================== */}
        <div className="w-full lg:w-[260px] bg-[#1e1f22] border-r border-[#28292d] flex flex-col flex-shrink-0 p-3.5 overflow-y-auto scrollbar-thin scrollbar-thumb-[#2b2d31]">
          {isModePreview ? (
            /* Mode: Prévia do ULTRAPASS Header */
            <div className="pb-3 mb-3 border-b border-[#2b2d31]">
              <div className="flex items-center gap-2 mb-2">
                <button
                  onClick={() => setIsModePreview(false)}
                  className="p-1 -ml-1 text-[#949ba4] hover:text-white rounded hover:bg-[#35373c] transition-colors cursor-pointer"
                  title="Voltar ao perfil de servidor"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <div className="flex items-center gap-1.5 font-bold text-white text-xs">
                  <img src={getAssetUrl('icon_ultrapass.svg')} alt="ULTRAPASS" className="w-4 h-4 object-contain" />
                  <span>Prévia do ULTRAPASS</span>
                </div>
              </div>
              <p className="text-[11px] text-[#949ba4] leading-relaxed mb-2.5">
                Você está visualizando uma prévia de como seu perfil poderia ficar com o ULTRAPASS.
              </p>
              <button
                onClick={handleSurpriseMe}
                className="w-full py-1.5 px-3 bg-[#2b2d31] hover:bg-[#35373c] text-white rounded-md text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer border border-[#3f4147]"
              >
                <Dices className="w-3.5 h-3.5 text-[#f47fff]" />
                <span>Surpreenda-me!</span>
              </button>
            </div>
          ) : (
            /* Normal Server Selector Header */
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#2b2d31]">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-6 h-6 rounded-md bg-[#2b2d31] flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
                  {tagBadgeChar || '🐺'}
                </div>
                <span className="text-xs font-bold text-white tracking-wide truncate uppercase">
                  {currentServer?.name || 'LOJA LYCAON'}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-[#949ba4] flex-shrink-0" />
              </div>
              <button
                onClick={() => setIsModePreview(true)}
                className="text-[#949ba4] hover:text-white cursor-pointer flex-shrink-0 transition-colors p-0.5 rounded hover:bg-[#35373c]"
                title="Abrir prévia do ULTRAPASS"
              >
                <ChevronsRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* ULTRAPASS Upsell Card (Only visible when not in preview mode) */}
          {!isModePreview && (
            <div className="bg-gradient-to-b from-[#3a1d5a] via-[#241a3e] to-[#1e172a] border border-[#7a38ff]/40 rounded-xl p-3.5 shadow-lg relative overflow-hidden mb-4">
              <div className="flex items-center gap-2 text-white font-bold text-xs tracking-tight">
                <img src={getAssetUrl('icon_ultrapass.svg')} alt="ULTRAPASS" className="w-4 h-4 object-contain" />
                <span>Personalize ainda mais com o ULTRAPASS</span>
              </div>
              <p className="text-[11px] text-[#dbdee1] mt-1.5 leading-relaxed font-normal">
                Vá além do nome e dos pronomes. Dê vida a cada servidor com faixas, temas, decorações
                exclusivos e muito mais com o ULTRAPASS.
              </p>
              <button
                onClick={() => setIsModePreview(true)}
                className="mt-3 w-full py-1.5 px-3 rounded-full bg-white text-[#111214] font-bold text-xs flex items-center justify-center gap-2 hover:bg-[#e3e5e8] shadow-[0_0_15px_rgba(255,255,255,0.4)] transition-all cursor-pointer group"
              >
                <img src={getAssetUrl('icon_ultrapass.svg')} alt="ULTRAPASS" className="w-4 h-4 object-contain" />
                <span>Desbloquear com ULTRAPASS</span>
              </button>
            </div>
          )}

          {/* Section Header */}
          <div className="flex items-center justify-between text-[#949ba4] text-[11px] font-bold uppercase tracking-wider mb-2">
            <span>{isModePreview ? 'Recursos Personalizados' : 'Recursos de Servidor'}</span>
            {!isModePreview && <Lock className="w-3.5 h-3.5" />}
          </div>

          <div className="space-y-3.5 text-xs text-[#dbdee1]">
            {/* 1. Estilo do nome exibido */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-semibold text-[#b5bac1]">
                  Estilo do nome exibido
                </span>
                <Pencil
                  onClick={() => setIsNameStyleModalOpen(true)}
                  className="w-3 h-3 text-[#949ba4] hover:text-white cursor-pointer"
                />
              </div>
              <div
                onClick={() => setIsNameStyleModalOpen(true)}
                className="flex items-center justify-between p-2 rounded-lg bg-[#111214]/60 border border-[#2b2d31] hover:border-[#5865f2] cursor-pointer transition-colors group"
                title="Alterar estilo do nome exibido"
              >
                <span
                  className={`text-xs truncate font-bold ${selectedFontClass}`}
                  style={getStyledNameCSS(nameFont, nameEffect, nameColor)}
                >
                  {targetUser.displayName || targetUser.name}
                </span>
                <button className="w-5 h-5 rounded-full bg-[#2b2d31] group-hover:bg-[#35373c] text-[#dbdee1] flex items-center justify-center">
                  <Plus className="w-3 h-3" />
                </button>
              </div>
            </div>

            {/* 2. Tema de perfil (Dual color gradient box with top & bottom handles - Matches Discord Images 1 & 3) */}
            <div className="relative">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-semibold text-[#b5bac1]">Tema de perfil</span>
                <Palette className="w-3 h-3 text-[#b5bac1]" />
              </div>
              <div
                className="w-full h-18 rounded-lg relative overflow-hidden border border-[#2b2d31] flex flex-col justify-between items-center py-2 shadow-inner"
                style={{
                  background: `linear-gradient(180deg, ${themePrimaryColor} 0%, ${themeSecondaryColor} 100%)`,
                }}
              >
                {/* Primary color handle (top) */}
                <button
                  ref={primarySwatchRef}
                  onClick={(e) => {
                    e.stopPropagation();
                    const rect = e.currentTarget.getBoundingClientRect();
                    setColorPickerPos({
                      top: Math.max(20, Math.min(rect.top - 20, window.innerHeight - 380)),
                      left: rect.right + 12,
                    });
                    setColorPickerTarget((prev) => (prev === 'primary' ? null : 'primary'));
                  }}
                  className={`w-6 h-6 rounded-md border-2 transition-all cursor-pointer shadow-md ${
                    colorPickerTarget === 'primary'
                      ? 'border-white scale-110 shadow-[0_0_8px_rgba(255,255,255,0.8)]'
                      : 'border-white/80 hover:scale-105'
                  }`}
                  style={{ backgroundColor: themePrimaryColor }}
                  title="Cor primária (topo)"
                />

                {/* Secondary color handle (bottom) */}
                <button
                  ref={secondarySwatchRef}
                  onClick={(e) => {
                    e.stopPropagation();
                    const rect = e.currentTarget.getBoundingClientRect();
                    setColorPickerPos({
                      top: Math.max(20, Math.min(rect.top - 20, window.innerHeight - 380)),
                      left: rect.right + 12,
                    });
                    setColorPickerTarget((prev) => (prev === 'secondary' ? null : 'secondary'));
                  }}
                  className={`w-6 h-6 rounded-md border-2 transition-all cursor-pointer shadow-md ${
                    colorPickerTarget === 'secondary'
                      ? 'border-white scale-110 shadow-[0_0_8px_rgba(255,255,255,0.8)]'
                      : 'border-white/80 hover:scale-105'
                  }`}
                  style={{ backgroundColor: themeSecondaryColor }}
                  title="Cor secundária (base)"
                />
              </div>

              {/* Color Picker Popover (Matches Image 1) */}
              {colorPickerTarget && (
                <div
                  ref={colorPickerRef}
                  style={{ top: `${colorPickerPos.top}px`, left: `${colorPickerPos.left}px` }}
                  className="fixed w-64 bg-[#111214] border border-[#232428] rounded-xl p-3 shadow-2xl z-[9999] text-left animate-in fade-in zoom-in-95 duration-100 select-none"
                >
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#232428]">
                    <span className="text-[11px] font-bold text-white uppercase tracking-wider">
                      {colorPickerTarget === 'primary' ? 'Cor Primária' : 'Cor Secundária'}
                    </span>
                    <button
                      onClick={() => setColorPickerTarget(null)}
                      className="text-[#949ba4] hover:text-white p-0.5 rounded cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* 2D Gradient saturation/brightness box with fully interactive drag */}
                  <div
                    ref={gradientBoxRef}
                    onMouseDown={(e) => {
                      isDragging2DRef.current = true;
                      handle2DMove(e.clientX, e.clientY);
                    }}
                    className="w-full h-28 rounded-lg mb-2.5 relative cursor-crosshair shadow-inner overflow-hidden select-none"
                    style={{
                      background: `linear-gradient(to top, #000000, transparent), linear-gradient(to right, #ffffff, hsl(${pickerHue}, 100%, 50%))`,
                    }}
                  >
                    <div
                      className="absolute w-3.5 h-3.5 rounded-full border-2 border-white shadow-[0_0_3px_rgba(0,0,0,0.8)] pointer-events-none -ml-1.5 -mt-1.5 transition-transform"
                      style={{
                        left: `${pickerSat}%`,
                        top: `${100 - pickerVal}%`,
                        backgroundColor: colorPickerTarget === 'primary' ? themePrimaryColor : themeSecondaryColor,
                      }}
                    />
                  </div>

                  {/* Rainbow Hue Slider */}
                  <input
                    type="range"
                    min="0"
                    max="360"
                    value={pickerHue}
                    onChange={(e) => {
                      const h = Number(e.target.value);
                      setPickerHue(h);
                      const newHex = hsvToHex(h, pickerSat, pickerVal);
                      if (colorPickerTarget === 'primary') {
                        setThemePrimaryColor(newHex);
                        updateCurrentUser({ themePrimaryColor: newHex });
                      } else {
                        setThemeSecondaryColor(newHex);
                        updateCurrentUser({ themeSecondaryColor: newHex });
                      }
                    }}
                    className="w-full h-3 rounded-full appearance-none cursor-pointer mb-3"
                    style={{
                      background:
                        'linear-gradient(to right, #ff0000 0%, #ffff00 17%, #00ff00 33%, #00ffff 50%, #0000ff 67%, #ff00ff 83%, #ff0000 100%)',
                    }}
                  />

                  {/* Hex input & Eyedropper */}
                  <div className="flex items-center gap-2 mb-3 bg-[#1e1f22] border border-[#2b2d31] rounded-lg px-2.5 py-1.5">
                    <span className="text-xs text-[#949ba4] font-mono">#</span>
                    <input
                      type="text"
                      value={(colorPickerTarget === 'primary' ? themePrimaryColor : themeSecondaryColor).replace(
                        '#',
                        ''
                      )}
                      onChange={(e) => {
                        const val = e.target.value.startsWith('#') ? e.target.value : `#${e.target.value}`;
                        if (colorPickerTarget === 'primary') setThemePrimaryColor(val);
                        else setThemeSecondaryColor(val);

                        if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
                          const hsv = hexToHsv(val);
                          setPickerHue(hsv.h);
                          setPickerSat(hsv.s);
                          setPickerVal(hsv.v);
                          if (colorPickerTarget === 'primary') updateCurrentUser({ themePrimaryColor: val });
                          else updateCurrentUser({ themeSecondaryColor: val });
                        }
                      }}
                      className="w-full bg-transparent text-xs text-white font-mono focus:outline-none"
                    />
                    <button
                      onClick={async () => {
                        if ((window as any).EyeDropper) {
                          try {
                            const eyeDropper = new (window as any).EyeDropper();
                            const res = await eyeDropper.open();
                            if (res?.sRGBHex) {
                              if (colorPickerTarget === 'primary') {
                                setThemePrimaryColor(res.sRGBHex);
                                updateCurrentUser({ themePrimaryColor: res.sRGBHex });
                              } else {
                                setThemeSecondaryColor(res.sRGBHex);
                                updateCurrentUser({ themeSecondaryColor: res.sRGBHex });
                              }
                              const hsv = hexToHsv(res.sRGBHex);
                              setPickerHue(hsv.h);
                              setPickerSat(hsv.s);
                              setPickerVal(hsv.v);
                              return;
                            }
                          } catch {}
                        }
                        themeColorInputRef.current?.click();
                      }}
                      className="text-[#949ba4] hover:text-white cursor-pointer p-0.5 rounded"
                      title="Conta-gotas / Seletor de cores"
                    >
                      <Pipette className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Quick Preset Swatches */}
                  <div className="flex items-center justify-between gap-1.5">
                    {['#18191c', '#ffffff', '#1a4d3e', '#556b2f', '#722f37'].map((hex) => (
                      <button
                        key={hex}
                        onClick={() => {
                          if (colorPickerTarget === 'primary') {
                            setThemePrimaryColor(hex);
                            updateCurrentUser({ themePrimaryColor: hex });
                          } else {
                            setThemeSecondaryColor(hex);
                            updateCurrentUser({ themeSecondaryColor: hex });
                          }
                          const hsv = hexToHsv(hex);
                          setPickerHue(hsv.h);
                          setPickerSat(hsv.s);
                          setPickerVal(hsv.v);
                        }}
                        className="w-7 h-7 rounded-md border border-[#35373c] hover:scale-110 transition-transform cursor-pointer shadow-sm"
                        style={{ backgroundColor: hex }}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 3. Faixa do perfil (Banner thumbnail - opens "Editar imagem") */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-semibold text-[#b5bac1]">Faixa do perfil</span>
                <Pencil
                  onClick={() => setIsBannerModalOpen(true)}
                  className="w-3 h-3 text-[#949ba4] hover:text-white cursor-pointer"
                />
              </div>
              <div
                onClick={() => setIsBannerModalOpen(true)}
                className="h-14 w-full rounded-lg border border-[#2b2d31] hover:border-[#5865f2] overflow-hidden cursor-pointer transition-colors relative group bg-[#111214]"
                title="Editar faixa do perfil"
              >
                <img
                  src={effectiveBanner}
                  alt="Banner"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                  <span className="text-[10px] font-bold text-white bg-black/70 px-2 py-0.5 rounded">
                    Alterar
                  </span>
                </div>
              </div>
            </div>

            {/* 4. Avatar e decorações */}
            <div>
              <span className="text-[11px] font-semibold text-[#b5bac1] block mb-1">
                Avatar animado & decorações
              </span>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full border border-[#2b2d31] overflow-hidden bg-[#111214] flex-shrink-0">
                  <img
                    src={getAvatarUrl(targetUser.avatar)}
                    alt="Preview"
                    className="w-full h-full object-cover"
                  />
                </div>
                <button
                  onClick={handleOpenNitro}
                  className="w-12 h-12 rounded-full border-2 border-dashed border-[#4e5058] hover:border-white text-[#949ba4] hover:text-white flex items-center justify-center transition-colors cursor-pointer group"
                  title="Alterar avatar animado"
                >
                  <Plus className="w-4 h-4 group-hover:scale-110 transition-transform" />
                </button>
              </div>
            </div>

            {/* 5. Efeitos de perfil e molduras */}
            <div>
              <span className="text-[11px] font-semibold text-[#b5bac1] block mb-1">
                Efeitos de perfil e molduras
              </span>
              <div
                onClick={handleOpenNitro}
                className="p-2.5 rounded-lg bg-[#111214]/60 border border-[#2b2d31] hover:border-[#5865f2] cursor-pointer transition-colors flex items-center gap-2.5"
              >
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#5865f2] to-[#eb459f] flex items-center justify-center text-white shadow-sm flex-shrink-0">
                  <Wand2 className="w-3.5 h-3.5" />
                </div>
                <span className="text-xs text-[#949ba4] font-medium leading-tight">
                  Molduras anime & efeitos de partículas
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ======================================================== */}
        {/* 2. UNIFIED PREVIEW CANVAS (Ambient Gradient + Banner)    */}
        {/* ======================================================== */}
        <div
          className="flex-1 relative overflow-hidden flex flex-col lg:flex-row min-w-0 transition-colors duration-300"
          style={{
            background: `linear-gradient(135deg, ${themePrimaryColor} 0%, ${themeSecondaryColor} 100%)`,
          }}
        >
          {/* Ambient Banner Layer (spans across the entire background like Discord Images 1 & 3) */}
          {effectiveBanner && (
            <div className="absolute inset-0 pointer-events-none overflow-hidden select-none" style={{ zIndex: 0 }}>
              <img
                src={effectiveBanner}
                alt="Banner ambient"
                className="absolute -top-10 -right-10 w-[80%] h-[120%] object-cover object-top opacity-20 filter contrast-125"
                style={{
                  maskImage: 'radial-gradient(ellipse 95% 85% at 75% 25%, black 25%, transparent 80%)',
                  WebkitMaskImage: 'radial-gradient(ellipse 95% 85% at 75% 25%, black 25%, transparent 80%)',
                  mixBlendMode: isThemeLight ? 'multiply' : 'screen',
                }}
              />
            </div>
          )}

          {/* Close Button Top Right (Styled to theme) */}
          <button
            onClick={closeUserProfileModal}
            className={`absolute top-3.5 right-3.5 p-1.5 rounded-md transition-all z-40 cursor-pointer shadow-sm ${
              isThemeLight
                ? 'bg-white/70 hover:bg-white text-[#2e3338] border border-black/10'
                : 'bg-black/50 hover:bg-black/70 text-white border border-white/10'
            }`}
            title="Fechar (Esc)"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Floating Profile Card Container (Left side of preview) */}
          <div className="p-5 lg:p-7 flex-shrink-0 z-10 flex flex-col items-center lg:items-start overflow-y-auto scrollbar-thin">
            <div
              className={`w-full max-w-[340px] rounded-[16px] overflow-hidden shadow-2xl flex flex-col flex-shrink-0 transition-colors ${
                isThemeLight
                  ? 'bg-white text-[#2e3338] border border-black/10'
                  : 'bg-[#232428] text-[#f2f3f5] border border-white/10'
              }`}
            >
              {/* Header Banner */}
              <div
                className="h-28 w-full relative overflow-hidden flex items-center justify-center flex-shrink-0 cursor-pointer group"
                onClick={() => setIsBannerModalOpen(true)}
                style={{
                  backgroundColor: targetUser.bannerColor || '#232428',
                  backgroundImage: `url(${effectiveBanner})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }}
                title="Clique para editar faixa do perfil"
              >
                <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                  <span className="text-xs font-semibold text-white bg-black/60 px-2.5 py-1 rounded-md flex items-center gap-1.5 backdrop-blur-xs">
                    <Pencil className="w-3 h-3" />
                    Editar Faixa
                  </span>
                </div>
                {isMe && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsBannerModalOpen(true);
                    }}
                    className="absolute top-2.5 right-2.5 bg-black/60 hover:bg-black/80 text-white p-1.5 rounded-full transition-all cursor-pointer backdrop-blur-xs shadow z-10"
                    title="Editar tema do banner"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Profile Card Body (SOLID, CLEAN, READABLE CONTAINER) */}
              <div className="px-4 relative pb-4 flex-1">
                {/* Avatar & Clan Tag Row */}
                <div className="relative -top-12 mb-[-40px] flex justify-between items-end">
                  {/* Avatar with Status Dot */}
                  <div className="relative">
                    <img
                      src={getAvatarUrl(targetUser.avatar)}
                      alt={targetUser.name}
                      onError={handleAvatarError}
                      className={`w-22 h-22 rounded-full border-[6px] object-cover shadow-2xl ${
                        isThemeLight ? 'border-white bg-[#f2f3f5]' : 'border-[#232428] bg-[#111214]'
                      }`}
                    />
                    {targetUser.status === 'idle' ? (
                      <img
                        src={getAssetUrl('brand/04_Recortes_PNG_Alta_Resolucao/Mascotes_Expressoes/06_Dormindo.png')}
                        alt="Ausente"
                        title="Ausente (Dormindo)"
                        className={`absolute bottom-0 right-0 w-6 h-6 rounded-full border-[2.5px] bg-[#1F1F26] object-cover shadow ${
                          isThemeLight ? 'border-white' : 'border-[#232428]'
                        }`}
                      />
                    ) : (
                      <span
                        className={`absolute bottom-0 right-0 w-6 h-6 rounded-full border-[3px] ${
                          isThemeLight ? 'border-white' : 'border-[#232428]'
                        } ${
                          targetUser.status === 'online'
                            ? 'bg-[#23a55a]'
                            : targetUser.status === 'dnd'
                            ? 'bg-[#f23f43]'
                            : 'bg-[#80848e]'
                        }`}
                      />
                    )}
                  </div>

                  {/* Server Clan Tag Pill */}
                  {currentServer?.serverTag && tagColor && (
                    <div className="mb-2">
                      <span
                        className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full shadow-sm select-none leading-none border backdrop-blur-xs"
                        style={{
                          backgroundColor: isThemeLight ? `${tagColor.hex}18` : `${tagColor.hex}25`,
                          color: tagColor.hex,
                          borderColor: `${tagColor.hex}50`,
                        }}
                      >
                        {tagBadgeIcon ? (
                          <img
                            src={tagBadgeIcon}
                            alt="Tag"
                            className="w-3.5 h-3.5 object-contain rounded-xs"
                          />
                        ) : (
                          <span>{tagBadgeChar}</span>
                        )}
                        <span>{currentServer.serverTag}</span>
                      </span>
                    </div>
                  )}
                </div>

                {/* Names & Styled Display Name */}
                <div className="mt-2">
                  <h2
                    onClick={() => setIsNameStyleModalOpen(true)}
                    className={`text-xl font-bold leading-tight truncate cursor-pointer hover:opacity-90 transition-opacity ${selectedFontClass}`}
                    style={getStyledNameCSS(nameFont, nameEffect, nameColor) || { color: isThemeLight ? '#060607' : '#ffffff' }}
                    title="Clique para alterar estilo do nome exibido"
                  >
                    {targetUser.displayName || targetUser.name}
                  </h2>
                  <div className={`flex items-center gap-1.5 text-xs mt-0.5 font-medium ${
                    isThemeLight ? 'text-[#5c5f66]' : 'text-[#dbdee1]/80'
                  }`}>
                    <span>@{targetUser.name || 'usuario'}</span>
                    <span>•</span>
                    <span className="italic">Defina pronomes por servidor</span>
                  </div>
                </div>

                {/* Server Tag Dropdown & Badges */}
                <div className="flex items-center gap-2 mt-2.5 flex-wrap">
                  <button className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold transition-colors cursor-pointer border ${
                    isThemeLight
                      ? 'bg-[#f2f3f5] hover:bg-[#e3e5e8] text-[#2e3338] border-black/10'
                      : 'bg-black/40 hover:bg-black/60 text-[#dbdee1] border-white/10'
                  }`}>
                    <span>Tag do servidor</span>
                    <ChevronDown className={`w-3 h-3 ${isThemeLight ? 'text-[#5c5f66]' : 'text-[#949ba4]'}`} />
                  </button>

                  {/* Official Badges Group */}
                  <DiscordBadgesGroup user={targetUser} />
                </div>

                {/* Quick Action Buttons */}
                <div className="flex items-center gap-2 mt-3.5">
                  <button
                    onClick={handleOpenDM}
                    className="flex-1 bg-[#5865f2] hover:bg-[#4752c4] text-white py-1.5 px-3 rounded-[4px] font-medium text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-sm"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>Mensagem</span>
                  </button>
                  <button
                    onClick={handleOpenNitro}
                    className={`p-1.5 rounded-[4px] transition-colors cursor-pointer border ${
                      isThemeLight
                        ? 'bg-[#f2f3f5] hover:bg-[#e3e5e8] text-[#2e3338] border-black/10'
                        : 'bg-black/40 hover:bg-black/60 text-[#dbdee1] border-white/10'
                    }`}
                    title="Presentear com ULTRAPASS"
                  >
                    <Gift className="w-4 h-4 text-[#f47fff]" />
                  </button>
                  <button
                    className={`p-1.5 rounded-[4px] transition-colors cursor-pointer border ${
                      isThemeLight
                        ? 'bg-[#f2f3f5] hover:bg-[#e3e5e8] text-[#2e3338] border-black/10'
                        : 'bg-black/40 hover:bg-black/60 text-[#dbdee1] border-white/10'
                    }`}
                    title="Mais opções"
                  >
                    <MoreHorizontal className="w-4 h-4" />
                  </button>
                </div>

                {/* Divider */}
                <div className={`h-[1px] my-3.5 ${isThemeLight ? 'bg-black/8' : 'bg-white/10'}`} />

                {/* Bio / Sobre mim */}
                <div>
                  <span className={`text-[11px] font-bold uppercase tracking-wider block mb-1 ${
                    isThemeLight ? 'text-[#5c5f66]' : 'text-[#dbdee1]/80'
                  }`}>
                    Bio
                  </span>
                  <p className={`text-xs leading-relaxed whitespace-pre-wrap ${
                    isThemeLight ? 'text-[#2e3338]' : 'text-[#f2f3f5]'
                  }`}>
                    {targetUser.aboutMe || (
                      <>
                        Melhor discord de compras de canais de streamings
                        <br />
                        <span className="text-[#00a8fc] hover:underline cursor-pointer">
                          https://discord.gg/RvdAxddHPb
                        </span>
                      </>
                    )}
                  </p>
                </div>

                {/* Divider */}
                <div className={`h-[1px] my-3.5 ${isThemeLight ? 'bg-black/8' : 'bg-white/10'}`} />

                {/* Membro desde */}
                <div>
                  <span className={`text-[11px] font-bold uppercase tracking-wider block mb-1.5 ${
                    isThemeLight ? 'text-[#5c5f66]' : 'text-[#dbdee1]/80'
                  }`}>
                    Membro desde
                  </span>
                  <div className={`flex items-center gap-2 text-xs flex-wrap font-medium ${
                    isThemeLight ? 'text-[#2e3338]' : 'text-[#f2f3f5]'
                  }`}>
                    <div className="flex items-center gap-1.5">
                      <div className="w-4 h-4 rounded-full bg-[#5865f2] flex items-center justify-center text-[10px] text-white">
                        C
                      </div>
                      <span>21 de nov. de 2017</span>
                    </div>
                    <span className={isThemeLight ? 'text-[#5c5f66]' : 'text-[#949ba4]'}>•</span>
                    <div className="flex items-center gap-1.5">
                      <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${
                        isThemeLight ? 'bg-[#e3e5e8]' : 'bg-[#2b2d31]'
                      }`}>
                        🐺
                      </div>
                      <span>26 de ago. de 2025</span>
                    </div>
                  </div>
                </div>

                {/* Divider */}
                <div className={`h-[1px] my-3.5 ${isThemeLight ? 'bg-black/8' : 'bg-white/10'}`} />

                {/* Cargos (Roles Section) */}
                <div className="relative">
                  <span className={`text-[11px] font-bold uppercase tracking-wider block mb-1.5 ${
                    isThemeLight ? 'text-[#5c5f66]' : 'text-[#dbdee1]/80'
                  }`}>
                    Cargos
                  </span>

                  <div className="flex flex-wrap items-center gap-1.5">
                    {assignedRoles.map((role) => (
                      <span
                        key={role.id}
                        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[4px] text-xs font-medium border transition-all ${
                          isThemeLight
                            ? 'bg-[#f2f3f5] text-[#2e3338] border-black/10'
                            : 'bg-black/40 text-[#dbdee1] border-white/10'
                        }`}
                      >
                        <span
                          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: role.color || '#949ba4' }}
                        />
                        <span className="truncate max-w-[120px]">{role.name}</span>
                        {canManageRoles && (
                          <button
                            onClick={() => handleToggleRole(role.id)}
                            disabled={isUpdatingRole}
                            className="text-[#949ba4] hover:text-[#f23f43] p-0.5 rounded transition-colors cursor-pointer"
                            title="Remover cargo"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </span>
                    ))}

                    {canManageRoles && (
                      <button
                        ref={addRoleBtnRef}
                        onClick={() => setIsAddRoleOpen((prev) => !prev)}
                        className={`inline-flex items-center justify-center w-6 h-6 rounded-[4px] transition-colors cursor-pointer border ${
                          isThemeLight
                            ? 'bg-[#f2f3f5] hover:bg-[#e3e5e8] text-[#2e3338] border-black/10'
                            : 'bg-black/40 hover:bg-black/60 text-[#dbdee1] border-white/10'
                        }`}
                        title="Adicionar cargo"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Role Selection Popover */}
                  {isAddRoleOpen && (
                    <div
                      ref={rolePopoverRef}
                      className="absolute bottom-full left-0 mb-2 w-64 bg-[#111214] border border-[#232428] rounded-lg shadow-2xl p-2 z-50 text-left animate-in fade-in zoom-in-95 duration-100"
                    >
                      <div className="text-[11px] font-bold text-[#949ba4] uppercase tracking-wider px-1 pb-1.5">
                        Atribuir cargos
                      </div>
                      <input
                        type="text"
                        value={roleSearch}
                        onChange={(e) => setRoleSearch(e.target.value)}
                        placeholder="Pesquisar cargo..."
                        className="w-full bg-[#1e1f22] border border-[#28292d] rounded px-2.5 py-1 text-xs text-white placeholder-[#80848e] focus:outline-none focus:border-[#5865f2] mb-1.5"
                      />
                      <div className="max-h-36 overflow-y-auto space-y-0.5 scrollbar-thin scrollbar-thumb-[#28292d]">
                        {filteredAvailableRoles.map((role) => {
                          const isAssigned = targetRoleIds.includes(role.id);
                          return (
                            <button
                              key={role.id}
                              onClick={() => handleToggleRole(role.id)}
                              disabled={isUpdatingRole}
                              className="w-full flex items-center justify-between px-2 py-1.5 rounded hover:bg-[#2b2d31] text-xs text-left cursor-pointer transition-colors"
                            >
                              <div className="flex items-center gap-2 truncate">
                                <span
                                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                                  style={{ backgroundColor: role.color || '#949ba4' }}
                                />
                                <span className="text-[#dbdee1] truncate">{role.name}</span>
                              </div>
                              {isAssigned && <Check className="w-3.5 h-3.5 text-[#23a55a] flex-shrink-0" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Divider */}
                <div className={`h-[1px] my-3.5 ${isThemeLight ? 'bg-black/8' : 'bg-white/10'}`} />

                {/* Conexões */}
                <div>
                  <span className={`text-[11px] font-bold uppercase tracking-wider block mb-1 ${
                    isThemeLight ? 'text-[#5c5f66]' : 'text-[#dbdee1]/80'
                  }`}>
                    Conexões
                  </span>
                  <button
                    onClick={() => setActiveTab('activity')}
                    className="text-xs text-[#00a8fc] hover:underline flex items-center gap-1 font-medium cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Adicionar conexão</span>
                  </button>
                </div>

                {/* Divider */}
                <div className={`h-[1px] my-3.5 ${isThemeLight ? 'bg-black/8' : 'bg-white/10'}`} />

                {/* Nota (visível apenas para você) */}
                <div>
                  <span className={`text-[11px] font-bold uppercase tracking-wider block mb-1 ${
                    isThemeLight ? 'text-[#5c5f66]' : 'text-[#dbdee1]/80'
                  }`}>
                    Nota (visível apenas para você)
                  </span>
                  {isEditingNote ? (
                    <textarea
                      value={noteText}
                      onChange={(e) => setNoteText(e.target.value)}
                      onBlur={() => setIsEditingNote(false)}
                      autoFocus
                      placeholder="Clique para adicionar uma nota"
                      className={`w-full rounded p-2 text-xs resize-none focus:outline-none border ${
                        isThemeLight
                          ? 'bg-white border-[#5865f2] text-[#2e3338]'
                          : 'bg-[#111214] border-[#5865f2] text-white'
                      }`}
                      rows={2}
                    />
                  ) : (
                    <p
                      onClick={() => setIsEditingNote(true)}
                      className={`text-xs italic cursor-pointer transition-colors ${
                        isThemeLight
                          ? 'text-[#5c5f66] hover:text-[#2e3338]'
                          : 'text-[#dbdee1]/70 hover:text-white'
                      }`}
                    >
                      {noteText || 'Clique para adicionar uma nota'}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Right Panel: Tabs & Activity / Mural / Wishlist */}
          <div className="flex-1 flex flex-col min-w-0 p-5 lg:p-7 overflow-y-auto scrollbar-thin z-10">
            {/* Top Tab Navigation */}
            <div className={`flex items-center gap-6 border-b pb-3 mb-6 pr-10 ${
              isThemeLight ? 'border-black/10' : 'border-white/10'
            }`}>
              <button
                onClick={() => setActiveTab('activity')}
                className={`text-sm font-bold tracking-wide transition-all relative pb-1 cursor-pointer ${
                  activeTab === 'activity'
                    ? isThemeLight ? 'text-[#060607]' : 'text-white'
                    : isThemeLight ? 'text-[#5c5f66] hover:text-[#060607]' : 'text-[#949ba4] hover:text-white'
                }`}
              >
                Atividade
                {activeTab === 'activity' && (
                  <span className={`absolute bottom-[-13px] left-0 right-0 h-0.5 rounded-full ${
                    isThemeLight ? 'bg-[#060607]' : 'bg-white'
                  }`} />
                )}
              </button>
              <button
                onClick={() => setActiveTab('wishlist')}
                className={`text-sm font-bold tracking-wide transition-all relative pb-1 cursor-pointer ${
                  activeTab === 'wishlist'
                    ? isThemeLight ? 'text-[#060607]' : 'text-white'
                    : isThemeLight ? 'text-[#5c5f66] hover:text-[#060607]' : 'text-[#949ba4] hover:text-white'
                }`}
              >
                Lista de desejos
                {activeTab === 'wishlist' && (
                  <span className={`absolute bottom-[-13px] left-0 right-0 h-0.5 rounded-full ${
                    isThemeLight ? 'bg-[#060607]' : 'bg-white'
                  }`} />
                )}
              </button>
              <button
                onClick={() => setActiveTab('mural')}
                className={`text-sm font-bold tracking-wide transition-all relative pb-1 cursor-pointer ${
                  activeTab === 'mural'
                    ? isThemeLight ? 'text-[#060607]' : 'text-white'
                    : isThemeLight ? 'text-[#5c5f66] hover:text-[#060607]' : 'text-[#949ba4] hover:text-white'
                }`}
              >
                Mural
                {activeTab === 'mural' && (
                  <span className={`absolute bottom-[-13px] left-0 right-0 h-0.5 rounded-full ${
                    isThemeLight ? 'bg-[#060607]' : 'bg-white'
                  }`} />
                )}
              </button>
            </div>

            {/* TAB 1: ATIVIDADE & CONTAS CONECTADAS (Matches Images 1 & 3) */}
            {activeTab === 'activity' && (
              <div className="flex-1 flex flex-col items-center justify-center text-center max-w-md mx-auto my-auto py-8">
                <h4 className={`text-sm font-bold mb-2 ${isThemeLight ? 'text-[#060607]' : 'text-white'}`}>
                  Você não tem nenhuma atividade aqui
                </h4>
                <p className={`text-xs leading-relaxed mb-6 max-w-sm ${isThemeLight ? 'text-[#5c5f66]' : 'text-[#949ba4]'}`}>
                  Conecte suas contas para compartilhar seu status e atividade no jogo. Você está no controle do que compartilha.
                </p>

                {/* Platform Icons Row */}
                <div className="flex flex-wrap items-center justify-center gap-3.5 mb-7">
                  {PLATFORMS.map((platform) => (
                    <div
                      key={platform.name}
                      className={`w-7 h-7 flex items-center justify-center transition-all cursor-pointer hover:scale-125 ${
                        isThemeLight ? 'text-[#2e3338] opacity-85 hover:opacity-100' : 'text-white opacity-85 hover:opacity-100'
                      }`}
                      title={platform.name}
                    >
                      {platform.svg}
                    </div>
                  ))}
                </div>

                {/* Action buttons */}
                <div className="flex items-center justify-center gap-3">
                  <button
                    onClick={handleOpenNitro}
                    className={`py-2 px-4 rounded-md text-xs font-semibold transition-all cursor-pointer shadow-sm ${
                      isThemeLight
                        ? 'bg-white/90 hover:bg-white text-[#2e3338] border border-black/10'
                        : 'bg-[#2b2d31] hover:bg-[#35373c] text-white border border-[#3f4147]'
                    }`}
                  >
                    Conectar contas
                  </button>
                  <button
                    onClick={() => setActiveTab('mural')}
                    className={`py-2 px-4 rounded-md text-xs font-semibold transition-all cursor-pointer shadow-sm ${
                      isThemeLight
                        ? 'bg-white/90 hover:bg-white text-[#2e3338] border border-black/10'
                        : 'bg-[#2b2d31] hover:bg-[#35373c] text-white border border-[#3f4147]'
                    }`}
                  >
                    Adicionar jogo
                  </button>
                </div>
              </div>
            )}

            {/* TAB 2: MURAL & WIDGETS */}
            {activeTab === 'mural' && (
              <div className="space-y-4">
                {/* Mural Header */}
                <div>
                  <h3 className={`text-base font-bold tracking-tight ${isThemeLight ? 'text-[#060607]' : 'text-white'}`}>
                    Personalize seu perfil com widgets
                  </h3>
                  <p className={`text-xs mt-1 leading-relaxed ${isThemeLight ? 'text-[#5c5f66]' : 'text-[#949ba4]'}`}>
                    Explore nossa biblioteca de widgets para compartilhar mais sobre você e seus interesses.
                  </p>
                </div>

                {/* Widgets 2-Column Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                  {/* 1. Marvel Rivals */}
                  <div className={`group relative border rounded-xl p-3 flex items-center justify-between cursor-pointer transition-all shadow-sm ${
                    isThemeLight
                      ? 'bg-white/85 hover:bg-white border-black/10 hover:border-[#5865f2]/60'
                      : 'bg-[#18191c] hover:bg-[#1e1f22] border-[#28292d] hover:border-[#5865f2]/60'
                  }`}>
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#c82333] to-[#800000] flex items-center justify-center text-white flex-shrink-0 shadow">
                        <Gamepad2 className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <Link2 className="w-3.5 h-3.5 text-[#00a8fc]" />
                          <span className={`text-xs font-bold truncate ${isThemeLight ? 'text-[#060607]' : 'text-white'}`}>Marvel Rivals</span>
                        </div>
                        <span className={`text-[11px] truncate block ${isThemeLight ? 'text-[#5c5f66]' : 'text-[#949ba4]'}`}>
                          Ranqueado • Platina III
                        </span>
                      </div>
                    </div>
                    <div className="w-2.5 h-2.5 rounded-full bg-[#23a55a] shadow" title="Online no jogo" />
                  </div>

                  {/* 2. Wuthering Waves */}
                  <div className={`group relative border rounded-xl p-3 flex items-center justify-between cursor-pointer transition-all shadow-sm ${
                    isThemeLight
                      ? 'bg-white/85 hover:bg-white border-black/10 hover:border-[#5865f2]/60'
                      : 'bg-[#18191c] hover:bg-[#1e1f22] border-[#28292d] hover:border-[#5865f2]/60'
                  }`}>
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#1e3c72] to-[#2a5298] flex items-center justify-center text-white flex-shrink-0 shadow">
                        <Flame className="w-5 h-5 text-[#f47fff]" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <Link2 className="w-3.5 h-3.5 text-[#00a8fc]" />
                          <span className={`text-xs font-bold truncate ${isThemeLight ? 'text-[#060607]' : 'text-white'}`}>Wuthering Waves</span>
                        </div>
                        <span className={`text-[11px] truncate block ${isThemeLight ? 'text-[#5c5f66]' : 'text-[#949ba4]'}`}>
                          Nível 70 • Solaris-3
                        </span>
                      </div>
                    </div>
                    <div className="w-2.5 h-2.5 rounded-full bg-[#5865f2] shadow" />
                  </div>

                  {/* 3. Arknights Endfield */}
                  <div className={`group relative border rounded-xl p-3 flex items-center justify-between cursor-pointer transition-all shadow-sm ${
                    isThemeLight
                      ? 'bg-white/85 hover:bg-white border-black/10 hover:border-[#5865f2]/60'
                      : 'bg-[#18191c] hover:bg-[#1e1f22] border-[#28292d] hover:border-[#5865f2]/60'
                  }`}>
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#f39c12] to-[#d35400] flex items-center justify-center text-white flex-shrink-0 shadow">
                        <Shield className="w-5 h-5 text-white" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <Link2 className="w-3.5 h-3.5 text-[#00a8fc]" />
                          <span className={`text-xs font-bold truncate ${isThemeLight ? 'text-[#060607]' : 'text-white'}`}>
                            Arknights Endfield
                          </span>
                        </div>
                        <span className={`text-[11px] truncate block ${isThemeLight ? 'text-[#5c5f66]' : 'text-[#949ba4]'}`}>
                          Protocolo Ativo • Talos-II
                        </span>
                      </div>
                    </div>
                    <div className="w-2.5 h-2.5 rounded-full bg-[#f0b232] shadow" />
                  </div>

                  {/* 4. Neverness to Everness */}
                  <div className={`group relative border rounded-xl p-3 flex items-center justify-between cursor-pointer transition-all shadow-sm ${
                    isThemeLight
                      ? 'bg-white/85 hover:bg-white border-black/10 hover:border-[#5865f2]/60'
                      : 'bg-[#18191c] hover:bg-[#1e1f22] border-[#28292d] hover:border-[#5865f2]/60'
                  }`}>
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#8e44ad] to-[#2c3e50] flex items-center justify-center text-white flex-shrink-0 shadow">
                        <Flame className="w-5 h-5 text-[#f47fff]" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <Link2 className="w-3.5 h-3.5 text-[#00a8fc]" />
                          <span className={`text-xs font-bold truncate ${isThemeLight ? 'text-[#060607]' : 'text-white'}`}>
                            Neverness to Everness
                          </span>
                        </div>
                        <span className={`text-[11px] truncate block ${isThemeLight ? 'text-[#5c5f66]' : 'text-[#949ba4]'}`}>
                          Hesperia District
                        </span>
                      </div>
                    </div>
                    <div className="w-2.5 h-2.5 rounded-full bg-[#eb459f] shadow" />
                  </div>

                  {/* 5. Jogo favorito */}
                  <div className={`group relative border rounded-xl p-3 flex items-center gap-3 cursor-pointer transition-all ${
                    isThemeLight
                      ? 'bg-white/85 hover:bg-white border-black/10'
                      : 'bg-[#18191c] hover:bg-[#1e1f22] border-[#28292d]'
                  }`}>
                    <div className="w-12 h-12 rounded-lg bg-[#2b2d31] border border-[#35373c] flex items-center justify-center text-white flex-shrink-0 group-hover:border-[#5865f2] transition-colors">
                      <Plus className="w-5 h-5 text-[#949ba4] group-hover:text-white" />
                    </div>
                    <div>
                      <span className={`text-xs font-bold block ${isThemeLight ? 'text-[#060607]' : 'text-white'}`}>Jogo favorito</span>
                      <span className={`text-[11px] ${isThemeLight ? 'text-[#5c5f66]' : 'text-[#949ba4]'}`}>League of Legends</span>
                    </div>
                  </div>

                  {/* 6. Jogos que eu gosto */}
                  <div className={`group relative border rounded-xl p-3 flex items-center gap-3 cursor-pointer transition-all ${
                    isThemeLight
                      ? 'bg-white/85 hover:bg-white border-black/10'
                      : 'bg-[#18191c] hover:bg-[#1e1f22] border-[#28292d]'
                  }`}>
                    <div className="w-12 h-12 rounded-lg bg-[#2b2d31] border border-[#35373c] flex items-center justify-center text-white flex-shrink-0 group-hover:border-[#5865f2] transition-colors">
                      <Plus className="w-5 h-5 text-[#949ba4] group-hover:text-white" />
                    </div>
                    <div>
                      <span className={`text-xs font-bold block ${isThemeLight ? 'text-[#060607]' : 'text-white'}`}>Jogos que eu gosto</span>
                      <span className={`text-[11px] ${isThemeLight ? 'text-[#5c5f66]' : 'text-[#949ba4]'}`}>PEAK, Lethal, R.E.P.O.</span>
                    </div>
                  </div>

                  {/* 7. Jogos em rotação */}
                  <div className={`group relative border rounded-xl p-3 flex items-center gap-3 cursor-pointer transition-all ${
                    isThemeLight
                      ? 'bg-white/85 hover:bg-white border-black/10'
                      : 'bg-[#18191c] hover:bg-[#1e1f22] border-[#28292d]'
                  }`}>
                    <div className="w-12 h-12 rounded-lg bg-[#2b2d31] border border-[#35373c] flex items-center justify-center text-white flex-shrink-0 group-hover:border-[#5865f2] transition-colors">
                      <Plus className="w-5 h-5 text-[#949ba4] group-hover:text-white" />
                    </div>
                    <div>
                      <span className={`text-xs font-bold block ${isThemeLight ? 'text-[#060607]' : 'text-white'}`}>Jogos em rotação</span>
                      <span className={`text-[11px] ${isThemeLight ? 'text-[#5c5f66]' : 'text-[#949ba4]'}`}>VALORANT • Competitivo</span>
                    </div>
                  </div>

                  {/* 8. Quero jogar */}
                  <div className={`group relative border rounded-xl p-3 flex items-center gap-3 cursor-pointer transition-all ${
                    isThemeLight
                      ? 'bg-white/85 hover:bg-white border-black/10'
                      : 'bg-[#18191c] hover:bg-[#1e1f22] border-[#28292d]'
                  }`}>
                    <div className="w-12 h-12 rounded-lg bg-[#2b2d31] border border-[#35373c] flex items-center justify-center text-white flex-shrink-0 group-hover:border-[#5865f2] transition-colors">
                      <Plus className="w-5 h-5 text-[#949ba4] group-hover:text-white" />
                    </div>
                    <div>
                      <span className={`text-xs font-bold block ${isThemeLight ? 'text-[#060607]' : 'text-white'}`}>Quero jogar</span>
                      <span className={`text-[11px] ${isThemeLight ? 'text-[#5c5f66]' : 'text-[#949ba4]'}`}>Avengers, Rust, Dune</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: LISTA DE DESEJOS */}
            {activeTab === 'wishlist' && (
              <div className="space-y-4">
                <div className={`border rounded-xl p-6 text-center ${
                  isThemeLight ? 'bg-white/85 border-black/10' : 'bg-[#18191c] border-[#28292d]'
                }`}>
                  <div className="w-12 h-12 rounded-full bg-[#5865f2]/20 text-[#5865f2] flex items-center justify-center mx-auto mb-2">
                    <FolderHeart className="w-6 h-6" />
                  </div>
                  <h4 className={`text-sm font-bold ${isThemeLight ? 'text-[#060607]' : 'text-white'}`}>
                    Lista de Desejos de Itens e ULTRAPASS
                  </h4>
                  <p className={`text-xs mt-1 max-w-sm mx-auto ${isThemeLight ? 'text-[#5c5f66]' : 'text-[#949ba4]'}`}>
                    Itens exclusivos da Capy Shop, temas galácticos e molduras de perfil que este membro deseja receber de presente.
                  </p>
                  <button
                    onClick={handleOpenNitro}
                    className="mt-3.5 py-1.5 px-4 rounded-[4px] bg-[#5865f2] hover:bg-[#4752c4] text-white font-semibold text-xs transition-colors cursor-pointer"
                  >
                    Ver Itens na Loja Capy
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 4. MODAL: Alterar estilo do nome exibido (Image 5)       */}
      {/* ======================================================== */}
      {isNameStyleModalOpen && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div
            className={`relative w-full max-w-[840px] rounded-2xl shadow-2xl border overflow-hidden flex flex-col transition-colors ${
              previewLightMode ? 'bg-[#f2f3f5] border-[#e3e5e8] text-[#2e3338]' : 'bg-[#18191c] border-[#2b2d31] text-white'
            }`}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-black/10 dark:border-white/10">
              <h3 className="text-lg font-bold">Alterar estilo do nome exibido</h3>
              <button
                onClick={() => setIsNameStyleModalOpen(false)}
                className="text-[#949ba4] hover:text-white p-1 rounded-full hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body: Left Controls & Right Live Preview */}
            <div className="flex flex-col md:flex-row min-h-[440px]">
              {/* Left Column: Fonts, Effects, Colors */}
              <div className="w-full md:w-[420px] p-5 border-r border-black/10 dark:border-white/10 overflow-y-auto max-h-[500px] scrollbar-thin">
                {/* 1. Escolha fonte */}
                <div className="mb-5">
                  <div className="flex items-center justify-between mb-2.5">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#949ba4]">
                      Escolha fonte
                    </span>
                    <button
                      onClick={() => setNameFont('sans')}
                      className="text-[#949ba4] hover:text-white p-1 rounded hover:bg-white/5 transition-colors cursor-pointer"
                      title="Restaurar fonte padrão"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {FONT_OPTIONS.map((f, idx) => {
                      const isSelected = nameFont === f.id;
                      return (
                        <button
                          key={f.id}
                          onClick={() => setNameFont(f.id)}
                          className={`h-14 rounded-xl flex items-center justify-center text-lg font-bold transition-all cursor-pointer border relative ${
                            isSelected
                              ? 'border-[#5865f2] bg-[#5865f2]/20 text-white shadow-md'
                              : 'border-[#2b2d31] bg-[#111214] hover:bg-[#2b2d31] text-[#dbdee1]'
                          } ${f.className}`}
                        >
                          <span>Gg</span>
                          {(idx === 8 || idx === 9) && (
                            <span className="w-1.5 h-1.5 rounded-full bg-[#5865f2] absolute top-1.5 right-1.5" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 2. Escolha efeito */}
                <div className="mb-5">
                  <span className="text-xs font-bold uppercase tracking-wider block mb-2.5 text-[#949ba4]">
                    Escolha efeito
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {EFFECT_OPTIONS.map((eff) => {
                      const isSelected = nameEffect === eff.id;
                      return (
                        <button
                          key={eff.id}
                          onClick={() => setNameEffect(eff.id)}
                          className={`py-1.5 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer border ${
                            isSelected
                              ? 'border-[#5865f2] bg-[#5865f2]/25 text-white shadow-sm'
                              : 'border-[#2b2d31] bg-[#111214] hover:bg-[#2b2d31] text-[#dbdee1]'
                          }`}
                        >
                          <span style={getStyledNameCSS(nameFont, eff.id, nameColor)}>
                            {eff.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 3. Escolha cor (Floating 2D Picker + 7 Presets, Image 5) */}
                <div className="relative">
                  <span className="text-xs font-bold uppercase tracking-wider block mb-2.5 text-[#949ba4]">
                    Escolha cor
                  </span>

                  {/* Floating Popover directly above the custom color button */}
                  {isNameColorPickerOpen && (
                    <div
                      ref={nameColorPopoverRef}
                      className="absolute bottom-full mb-3 left-0 z-[10010] w-[240px] bg-[#111214] border border-[#28292d] rounded-2xl p-3 shadow-2xl animate-in fade-in zoom-in-95 duration-150"
                    >
                      {/* 2D Saturation / Value Gradient Plane */}
                      <div
                        ref={namePickerPlaneRef}
                        onMouseDown={(e) => {
                          setIsDraggingNamePicker(true);
                          updateNamePickerCoords(e.clientX, e.clientY);
                        }}
                        className="w-full h-32 rounded-lg relative cursor-crosshair overflow-hidden mb-3 select-none"
                        style={{
                          backgroundColor: `hsl(${namePickerHue}, 100%, 50%)`,
                        }}
                      >
                        <div className="absolute inset-0 bg-gradient-to-r from-white to-transparent pointer-events-none" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black to-transparent pointer-events-none" />
                        <div
                          className="w-4 h-4 rounded-full border-2 border-white shadow-md absolute pointer-events-none -translate-x-1/2 -translate-y-1/2"
                          style={{
                            left: `${namePickerSat}%`,
                            top: `${100 - namePickerVal}%`,
                          }}
                        />
                      </div>

                      {/* Rainbow Hue Range Slider */}
                      <input
                        type="range"
                        min="0"
                        max="360"
                        value={namePickerHue}
                        onChange={(e) => {
                          const h = Number(e.target.value);
                          setNamePickerHue(h);
                          const newHex = hsvToHex(h, namePickerSat, namePickerVal);
                          setNameColor(newHex);
                        }}
                        className="w-full h-3 rounded-full appearance-none cursor-pointer mb-3"
                        style={{
                          background:
                            'linear-gradient(to right, #ff0000 0%, #ffff00 17%, #00ff00 33%, #00ffff 50%, #0000ff 67%, #ff00ff 83%, #ff0000 100%)',
                        }}
                      />

                      {/* Hex input */}
                      <div className="flex items-center gap-1.5 bg-[#1e1f22] border border-[#2b2d31] rounded-lg px-2.5 py-1.5">
                        <span className="text-xs text-[#949ba4] font-mono">#</span>
                        <input
                          type="text"
                          value={nameColor.replace('#', '')}
                          onChange={(e) => {
                            const val = e.target.value.startsWith('#') ? e.target.value : `#${e.target.value}`;
                            setNameColor(val);
                            if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
                              const hsv = hexToHsv(val);
                              setNamePickerHue(hsv.h);
                              setNamePickerSat(hsv.s);
                              setNamePickerVal(hsv.v);
                            }
                          }}
                          className="w-full bg-transparent text-xs text-white font-mono focus:outline-none"
                        />
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Eyedropper / Custom Picker button (Button 1 in Image 5) */}
                    <button
                      ref={nameCustomColorBtnRef}
                      onClick={() => {
                        const hsv = hexToHsv(nameColor);
                        setNamePickerHue(hsv.h);
                        setNamePickerSat(hsv.s);
                        setNamePickerVal(hsv.v);
                        setIsNameColorPickerOpen((prev) => !prev);
                      }}
                      className={`w-8 h-8 rounded-full border border-[#2b2d31] flex items-center justify-center cursor-pointer transition-all ${
                        !PRESET_COLORS.includes(nameColor) || isNameColorPickerOpen
                          ? 'ring-2 ring-white scale-105'
                          : 'hover:border-[#5865f2]'
                      }`}
                      style={{
                        backgroundColor: !PRESET_COLORS.includes(nameColor) ? nameColor : '#111214',
                        color: !PRESET_COLORS.includes(nameColor) ? '#ffffff' : '#949ba4',
                      }}
                      title="Cor personalizada (abrir seletor de cores)"
                    >
                      <Pipette className="w-4 h-4" />
                    </button>

                    {/* 7 Preset color swatches */}
                    {PRESET_COLORS.map((color) => {
                      const isSelected = nameColor.toLowerCase() === color.toLowerCase();
                      return (
                        <button
                          key={color}
                          onClick={() => {
                            setNameColor(color);
                            setIsNameColorPickerOpen(false);
                          }}
                          className="w-8 h-8 rounded-full flex items-center justify-center transition-transform hover:scale-110 cursor-pointer shadow-sm relative"
                          style={{ backgroundColor: color }}
                        >
                          {isSelected && <Check className="w-4 h-4 text-white drop-shadow" />}
                        </button>
                      );
                    })}
                  </div>

                  {/* Disclaimer (Image 5) */}
                  <p className="text-[11px] text-[#949ba4] mt-4 leading-relaxed">
                    Aviso: Cores e efeitos de nome exibido não aparecerão nos servidores. Os estilos também podem variar no Discord e nos modos claro e escuro.{' '}
                    <span className="text-[#00A8FC] cursor-pointer hover:underline">Saiba mais</span>
                  </p>
                </div>
              </div>

              {/* Right Column: 3 Live Context Previews */}
              <div className="flex-1 p-5 flex flex-col justify-between bg-black/20">
                <div className="space-y-4">
                  {/* Context 1: Mini profile card preview */}
                  <div className="bg-[#111214] border border-[#2b2d31] rounded-xl overflow-hidden shadow-xl max-w-sm mx-auto">
                    <div
                      className="h-16 w-full"
                      style={{
                        backgroundImage: `url(${effectiveBanner})`,
                        backgroundSize: 'cover',
                      }}
                    />
                    <div
                      className="px-4 pb-3 relative"
                      style={{
                        background: `linear-gradient(180deg, ${themePrimaryColor} 0%, ${themeSecondaryColor} 100%)`,
                      }}
                    >
                      <div className="w-12 h-12 rounded-full border-[3px] border-[#111214] overflow-hidden -mt-6 mb-1 shadow-md">
                        <img
                          src={getAvatarUrl(targetUser.avatar)}
                          alt="Avatar"
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <h4
                        className={`text-base font-bold ${selectedFontClass}`}
                        style={getStyledNameCSS(nameFont, nameEffect, nameColor)}
                      >
                        {targetUser.displayName || targetUser.name}
                      </h4>
                      <p className="text-[11px] text-[#dbdee1]/70">@{targetUser.name || 'usuario'}</p>
                    </div>
                  </div>

                  {/* Context 2: Chat message preview */}
                  <div className="bg-[#111214] border border-[#2b2d31] rounded-xl p-3 flex items-start gap-3 max-w-sm mx-auto shadow-md">
                    <div className="w-9 h-9 rounded-full overflow-hidden bg-[#2b2d31] flex-shrink-0">
                      <img
                        src={getAvatarUrl(targetUser.avatar)}
                        alt="Avatar"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        <span
                          className={`text-xs font-bold ${selectedFontClass}`}
                          style={getStyledNameCSS(nameFont, nameEffect, nameColor)}
                        >
                          {targetUser.displayName || targetUser.name}
                        </span>
                        <span className="text-[10px] text-[#949ba4]">22:42</span>
                      </div>
                      <p className="text-xs text-[#dbdee1] mt-0.5">será que alguém lê isso?</p>
                    </div>
                  </div>

                  {/* Context 3: Member list item preview */}
                  <div className="bg-[#111214] border border-[#2b2d31] rounded-xl p-2.5 flex items-center gap-2.5 max-w-sm mx-auto shadow-md">
                    <div className="w-7 h-7 rounded-full overflow-hidden bg-[#2b2d31] flex-shrink-0">
                      <img
                        src={getAvatarUrl(targetUser.avatar)}
                        alt="Avatar"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <span
                      className={`text-xs font-bold truncate ${selectedFontClass}`}
                      style={getStyledNameCSS(nameFont, nameEffect, nameColor)}
                    >
                      {targetUser.displayName || targetUser.name}
                    </span>
                  </div>
                </div>

                {/* Disclaimer & Mode Toggle */}
                <div className="mt-4 pt-3 border-t border-black/10 dark:border-white/10 flex items-center justify-between text-[11px] text-[#949ba4]">
                  <span className="leading-tight max-w-[280px]">
                    Cores e efeitos de nome são renderizados em tempo real nos modos claro e escuro.
                  </span>
                  <div className="flex items-center gap-1 bg-[#111214] p-1 rounded-lg border border-[#2b2d31]">
                    <button
                      onClick={() => setPreviewLightMode(false)}
                      className={`p-1 rounded cursor-pointer ${!previewLightMode ? 'bg-[#2b2d31] text-white' : 'text-[#949ba4]'}`}
                      title="Modo Escuro"
                    >
                      <Moon className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setPreviewLightMode(true)}
                      className={`p-1 rounded cursor-pointer ${previewLightMode ? 'bg-[#5865f2] text-white' : 'text-[#949ba4]'}`}
                      title="Modo Claro"
                    >
                      <Sun className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-[#111214] border-t border-[#2b2d31] flex items-center justify-between">
              <button
                onClick={handleSurpriseMe}
                className="py-2 px-4 rounded-md bg-[#2b2d31] hover:bg-[#35373c] text-white text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer"
              >
                <Dices className="w-4 h-4 text-[#f47fff]" />
                <span>Surpreenda-me</span>
              </button>
              <button
                onClick={handleApplyNameStyle}
                className="py-2 px-6 rounded-md bg-[#5865f2] hover:bg-[#4752c4] text-white text-xs font-bold transition-colors cursor-pointer shadow-md"
              >
                Aplicar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 5. MODAL: Editar imagem (Faixa do perfil - Images 2 & 3) */}
      {/* ======================================================== */}
      {isBannerModalOpen && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="relative w-full max-w-[560px] bg-[#313338] rounded-2xl shadow-2xl border border-[#232428] overflow-hidden flex flex-col text-white">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-[#232428]">
              <h3 className="text-base font-bold">Editar imagem</h3>
              <button
                onClick={() => setIsBannerModalOpen(false)}
                className="text-[#949ba4] hover:text-white p-1 rounded-full hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 flex flex-col items-center">
              {/* Crop / Preview Area */}
              <div className="w-full h-44 rounded-lg bg-[#111214] border border-[#232428] overflow-hidden relative flex items-center justify-center shadow-inner">
                <img
                  src={effectiveBanner}
                  alt="Banner Crop"
                  className="w-full h-full object-cover transition-all"
                  style={{
                    transform: `scale(${1 + bannerZoom / 100}) rotate(${bannerRotation}deg)`,
                  }}
                />
              </div>

              {/* Zoom & Rotate Controls */}
              <div className="w-full flex items-center justify-between gap-3 mt-4 px-2">
                <ZoomOut className="w-4 h-4 text-[#949ba4]" />
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={bannerZoom}
                  onChange={(e) => setBannerZoom(Number(e.target.value))}
                  className="flex-1 h-1.5 bg-[#4e5058] rounded-lg appearance-none cursor-pointer accent-[#5865f2]"
                />
                <ZoomIn className="w-4 h-4 text-[#949ba4]" />
                <button
                  onClick={() => setBannerRotation((prev) => (prev + 90) % 360)}
                  className="p-1.5 rounded-md hover:bg-[#35373c] text-[#949ba4] hover:text-white transition-colors cursor-pointer"
                  title="Girar 90°"
                >
                  <RotateCw className="w-4 h-4" />
                </button>
              </div>

              {/* ULTRAPASS Promo Bar inside modal */}
              <div className="w-full mt-5 p-3 rounded-xl bg-[#2b2d31] border border-[#3f4147] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <img src={getAssetUrl('icon_ultrapass.svg')} alt="ULTRAPASS" className="w-4 h-4 object-contain" />
                  <span className="text-xs text-[#dbdee1] font-medium">
                    Personalize sua faixa com ULTRAPASS
                  </span>
                </div>
                <button
                  onClick={handleOpenNitro}
                  className="py-1 px-3 rounded-full bg-white text-[#111214] font-bold text-xs hover:bg-[#e3e5e8] transition-all cursor-pointer shadow-sm"
                >
                  Obter o ULTRAPASS
                </button>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 bg-[#2b2d31] flex items-center justify-between">
              <button
                onClick={() => {
                  setBannerZoom(50);
                  setBannerRotation(0);
                }}
                className="text-xs text-[#00a8fc] hover:underline font-semibold cursor-pointer"
              >
                Redefinir
              </button>
              <div className="flex items-center gap-2.5">
                <button
                  onClick={() => setIsBannerModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-white hover:underline transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => {
                    updateCurrentUser({ bannerImage: effectiveBanner });
                    setIsBannerModalOpen(false);
                  }}
                  className="px-5 py-2 bg-[#5865f2] hover:bg-[#4752c4] text-white text-xs font-bold rounded-[3px] transition-colors cursor-pointer shadow"
                >
                  Aplicar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
