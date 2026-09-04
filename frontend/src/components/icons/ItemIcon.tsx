/**
 * Icones dos itens do Marketing.
 *
 * Cinco icones proprios (tenda, mesa, cadeira, bancada, carrinho) desenhados no
 * mesmo peso do monograma: traco continuo de 1.25, pontas arredondadas, sem
 * preenchimento. Nenhum icone do lucide tinha esse peso para esses objetos.
 * O restante do catalogo vem de um subconjunto curado do lucide, usado pelo
 * seletor de icones do painel admin.
 */
import {
  Armchair,
  Award,
  Book,
  Box,
  Boxes,
  Briefcase,
  Brush,
  Building2,
  Cable,
  Calendar,
  Camera,
  Car,
  Clipboard,
  Coffee,
  DoorOpen,
  Fan,
  Flag,
  Frame,
  Gift,
  Heart,
  Home,
  Image,
  Layers,
  Lamp,
  Lightbulb,
  Luggage,
  MapPin,
  Megaphone,
  Mic,
  Monitor,
  Music,
  Package,
  PackageOpen,
  Palette,
  Plug,
  Printer,
  Projector,
  Radio,
  Ruler,
  Scissors,
  Shirt,
  ShoppingBag,
  ShoppingBasket,
  ShoppingCart,
  Sofa,
  Sparkles,
  Speaker,
  Star,
  Store,
  Tag,
  Ticket,
  Trophy,
  Truck,
  Tv,
  Umbrella,
  Users,
  Utensils,
  Video,
  Warehouse,
  Wifi,
  Wine,
  Wrench,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/cn';

// ---------------------------------------------------------------------------
// Icones proprios — traco fino, no estilo da logo
// ---------------------------------------------------------------------------

type SvgProps = React.SVGProps<SVGSVGElement>;

const strokeProps = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.25,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

/** Tenda 3x3: cobertura de duas aguas sobre quatro pes. */
function TentIcon(props: SvgProps) {
  return (
    <svg viewBox="0 0 24 24" {...strokeProps} {...props}>
      <path d="M2.4 10.6 12 4.2l9.6 6.4" />
      <path d="M2.4 10.6h19.2" />
      <path d="M4.6 10.6v9.2M19.4 10.6v9.2" />
      <path d="M8.6 10.6v3.1M15.4 10.6v3.1" />
      <path d="M2.4 10.6c1.6 1.5 3.2 1.5 4.8 0s3.2-1.5 4.8 0 3.2 1.5 4.8 0 3.2-1.5 4.8 0" />
    </svg>
  );
}

/** Mesa dobravel: tampo reto com pes abertos. */
function TableIcon(props: SvgProps) {
  return (
    <svg viewBox="0 0 24 24" {...strokeProps} {...props}>
      <path d="M2.2 8.4h19.6" />
      <path d="M4 11.2h16" />
      <path d="M6.2 11.2 3.6 19.8M17.8 11.2l2.6 8.6" />
      <path d="M8.4 15.4h7.2" />
    </svg>
  );
}

/** Cadeira empilhavel, de perfil. */
function ChairIcon(props: SvgProps) {
  return (
    <svg viewBox="0 0 24 24" {...strokeProps} {...props}>
      <path d="M6.6 13.2h10.8" />
      <path d="M7.6 13.2 6.2 20M16.4 13.2 17.8 20" />
      <path d="M16.4 13.2V5.6a2 2 0 0 0-2-2H11" />
      <path d="M11 3.6v9.6" />
      <path d="M7.4 16.6h9.2" />
    </svg>
  );
}

/** Bancada / balcao de degustacao, com prateleira interna. */
function CounterIcon(props: SvgProps) {
  return (
    <svg viewBox="0 0 24 24" {...strokeProps} {...props}>
      <path d="M2.2 7.6h19.6" />
      <path d="M4.2 7.6v12.2h15.6V7.6" />
      <path d="M4.2 13.4h15.6" />
      <path d="M2.6 19.8h18.8" />
      <path d="M11.2 10.4h1.6" />
    </svg>
  );
}

/** Carrinho do marketing: duas prateleiras, alca e rodinhas. */
function CartIcon(props: SvgProps) {
  return (
    <svg viewBox="0 0 24 24" {...strokeProps} {...props}>
      <path d="M3.4 8.4h17.2" />
      <path d="M5.2 8.4v9.2M18.8 8.4v9.2" />
      <path d="M5.2 13.4h13.6" />
      <path d="M5.2 17.6h13.6" />
      <path d="M3.4 8.4V6.6a1.8 1.8 0 0 1 1.8-1.8h2.4" />
      <circle cx="7.8" cy="20" r="1.35" />
      <circle cx="16.2" cy="20" r="1.35" />
    </svg>
  );
}

const CUSTOM_ICONS: Record<string, (props: SvgProps) => JSX.Element> = {
  tent: TentIcon,
  table: TableIcon,
  chair: ChairIcon,
  counter: CounterIcon,
  cart: CartIcon,
};

// ---------------------------------------------------------------------------
// Subconjunto do lucide disponivel no seletor do painel admin
// ---------------------------------------------------------------------------

const LUCIDE_ICONS: Record<string, LucideIcon> = {
  package: Package,
  'package-open': PackageOpen,
  box: Box,
  boxes: Boxes,
  layers: Layers,
  'shopping-bag': ShoppingBag,
  'shopping-cart': ShoppingCart,
  'shopping-basket': ShoppingBasket,
  umbrella: Umbrella,
  flag: Flag,
  megaphone: Megaphone,
  speaker: Speaker,
  music: Music,
  mic: Mic,
  radio: Radio,
  monitor: Monitor,
  tv: Tv,
  projector: Projector,
  wifi: Wifi,
  cable: Cable,
  plug: Plug,
  zap: Zap,
  lightbulb: Lightbulb,
  lamp: Lamp,
  sparkles: Sparkles,
  gift: Gift,
  shirt: Shirt,
  palette: Palette,
  brush: Brush,
  printer: Printer,
  camera: Camera,
  video: Video,
  image: Image,
  frame: Frame,
  fan: Fan,
  coffee: Coffee,
  utensils: Utensils,
  wine: Wine,
  truck: Truck,
  car: Car,
  luggage: Luggage,
  briefcase: Briefcase,
  clipboard: Clipboard,
  book: Book,
  scissors: Scissors,
  ruler: Ruler,
  wrench: Wrench,
  armchair: Armchair,
  sofa: Sofa,
  'door-open': DoorOpen,
  warehouse: Warehouse,
  store: Store,
  building: Building2,
  home: Home,
  'map-pin': MapPin,
  calendar: Calendar,
  users: Users,
  star: Star,
  heart: Heart,
  award: Award,
  trophy: Trophy,
  ticket: Ticket,
  tag: Tag,
};

/** Chaves de icone proprio, na ordem em que aparecem no seletor. */
export const CUSTOM_ICON_KEYS = Object.keys(CUSTOM_ICONS);

/** Todas as chaves disponiveis: os proprios primeiro, depois o lucide. */
export const ALL_ICON_KEYS = [...CUSTOM_ICON_KEYS, ...Object.keys(LUCIDE_ICONS)];

export function isCustomIcon(key: string): boolean {
  return key in CUSTOM_ICONS;
}

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

export interface ItemIconProps {
  /** Chave do icone: um dos proprios (`tent`, `cart`...) ou um nome do lucide. */
  name: string;
  className?: string;
  /** Mostrado no lugar do icone quando o item tem emoji definido. */
  emoji?: string;
  strokeWidth?: number;
  'aria-hidden'?: boolean;
}

/**
 * Resolve a chave para o icone certo. Um item sempre tem representacao visual:
 * emoji > icone proprio > icone lucide > `Package` como ultimo recurso.
 */
export function ItemIcon({ name, className, emoji, strokeWidth }: ItemIconProps) {
  if (emoji) {
    return (
      <span className={cn('inline-flex items-center justify-center leading-none', className)} aria-hidden>
        {emoji}
      </span>
    );
  }

  const Custom = CUSTOM_ICONS[name];
  if (Custom) {
    return (
      <Custom
        className={cn('h-6 w-6', className)}
        strokeWidth={strokeWidth ?? 1.25}
        aria-hidden
        focusable="false"
      />
    );
  }

  const Lucide = LUCIDE_ICONS[name] ?? Package;
  return (
    <Lucide className={cn('h-6 w-6', className)} strokeWidth={strokeWidth ?? 1.4} aria-hidden focusable="false" />
  );
}
