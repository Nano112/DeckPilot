import { apiUrl } from "./api";
import type { LucideIcon } from "lucide-react";
import {
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Volume2,
  VolumeX,
  Volume1,
  Globe,
  Terminal,
  Folder,
  FolderOpen,
  MessageSquare,
  Clipboard,
  Settings,
  Music,
  Mic,
  MicOff,
  Headphones,
  Monitor,
  Cpu,
  HardDrive,
  Battery,
  BatteryCharging,
  Wifi,
  Bluetooth,
  Sun,
  Moon,
  Power,
  RefreshCw,
  Download,
  Upload,
  Search,
  Plus,
  Minus,
  X,
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  ArrowLeft,
  ArrowRight,
  Home,
  Star,
  Heart,
  Bell,
  Camera,
  Image,
  Gamepad2,
  Zap,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Mail,
  Send,
  Clock,
  Calendar,
  Trash2,
  Edit3,
  Save,
  Copy,
  Scissors,
  ExternalLink,
  Link,
  Layout,
  Grid3X3,
  Tv,
  Radio,
  Film,
} from "lucide-react";

const ICON_MAP: Record<string, LucideIcon> = {
  play: Play,
  pause: Pause,
  "skip-forward": SkipForward,
  "skip-back": SkipBack,
  "volume-2": Volume2,
  volume: Volume2,
  "volume-mute": VolumeX,
  "volume-x": VolumeX,
  "volume-1": Volume1,
  globe: Globe,
  terminal: Terminal,
  folder: Folder,
  "folder-open": FolderOpen,
  message: MessageSquare,
  "message-square": MessageSquare,
  clipboard: Clipboard,
  settings: Settings,
  music: Music,
  mic: Mic,
  "mic-off": MicOff,
  headphones: Headphones,
  monitor: Monitor,
  cpu: Cpu,
  "hard-drive": HardDrive,
  battery: Battery,
  "battery-charging": BatteryCharging,
  wifi: Wifi,
  bluetooth: Bluetooth,
  sun: Sun,
  moon: Moon,
  power: Power,
  refresh: RefreshCw,
  download: Download,
  upload: Upload,
  search: Search,
  plus: Plus,
  minus: Minus,
  x: X,
  close: X,
  check: Check,
  "chevron-left": ChevronLeft,
  "chevron-right": ChevronRight,
  "chevron-up": ChevronUp,
  "chevron-down": ChevronDown,
  "arrow-left": ArrowLeft,
  "arrow-right": ArrowRight,
  home: Home,
  star: Star,
  heart: Heart,
  bell: Bell,
  camera: Camera,
  image: Image,
  gamepad: Gamepad2,
  zap: Zap,
  eye: Eye,
  "eye-off": EyeOff,
  lock: Lock,
  unlock: Unlock,
  mail: Mail,
  send: Send,
  clock: Clock,
  calendar: Calendar,
  trash: Trash2,
  edit: Edit3,
  save: Save,
  copy: Copy,
  scissors: Scissors,
  "external-link": ExternalLink,
  link: Link,
  layout: Layout,
  grid: Grid3X3,
  tv: Tv,
  radio: Radio,
  film: Film,
};

// Emoji detection: codepoint in common emoji ranges
const EMOJI_RE = /^[\p{Emoji_Presentation}\p{Extended_Pictographic}]/u;

export function renderIcon(
  icon: string | undefined,
  size = 20
): React.ReactNode | null {
  if (!icon) return null;

  // Custom uploaded image
  if (icon.startsWith("custom:")) {
    const filename = icon.slice(7);
    return (
      <img
        src={apiUrl(`/api/icons/${filename}`)}
        alt=""
        width={size}
        height={size}
        style={{ objectFit: "contain" }}
      />
    );
  }

  // Emoji
  if (EMOJI_RE.test(icon)) {
    return (
      <span style={{ fontSize: size * 0.9, lineHeight: 1 }}>{icon}</span>
    );
  }

  // Lucide icon lookup
  const LucideComponent = ICON_MAP[icon.toLowerCase()];
  if (LucideComponent) {
    return <LucideComponent size={size} />;
  }

  // Fallback: render as text (might be a single character or unknown name)
  return (
    <span style={{ fontSize: size * 0.8, lineHeight: 1 }}>{icon}</span>
  );
}

/** Get all available Lucide icon names for the icon picker */
export function getAvailableIcons(): string[] {
  return Object.keys(ICON_MAP);
}
