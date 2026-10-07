import {
  ArrowDownToLine,
  Ban,
  Bed,
  Brain,
  CircleHelp,
  EarOff,
  Eye,
  EyeOff,
  Gem,
  Ghost,
  Hand,
  Heart,
  Link,
  Pause,
  Skull,
  Zap,
  type LucideIcon,
} from "lucide-react";

export const DEFAULT_CONDITIONS = [
  "Blinded",
  "Charmed",
  "Deafened",
  "Exhaustion",
  "Frightened",
  "Grappled",
  "Incapacitated",
  "Invisible",
  "Paralyzed",
  "Petrified",
  "Poisoned",
  "Prone",
  "Restrained",
  "Stunned",
  "Unconscious",
  "Concentrating",
] as const;

const CONDITION_ICONS: Record<string, LucideIcon> = {
  blinded: EyeOff,
  charmed: Heart,
  deafened: EarOff,
  frightened: Ghost,
  grappled: Hand,
  incapacitated: Ban,
  invisible: Eye,
  paralyzed: Pause,
  petrified: Gem,
  poisoned: Skull,
  prone: ArrowDownToLine,
  restrained: Link,
  stunned: Zap,
  unconscious: Bed,
  concentrating: Brain,
};

export function ConditionIcon({
  name,
  size = 14,
  className = "",
}: {
  name: string;
  size?: number;
  className?: string;
}) {
  const Icon = CONDITION_ICONS[name.trim().toLowerCase()] ?? CircleHelp;
  return <Icon size={size} className={className} aria-hidden="true" />;
}
