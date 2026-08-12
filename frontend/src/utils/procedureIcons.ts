import {
  Bolt,
  Braces,
  CircleDot,
  Crown,
  Frown,
  HeartPulse,
  Moon,
  Puzzle,
  Shield,
  ShieldCheck,
  Sparkles,
  Sun,
  Syringe,
} from 'lucide-react';
import type { ComponentType } from 'react';

import type { ProcedureId } from '@/types/domain';

export type IconComponent = ComponentType<{ size?: number; color?: string }>;

// Every export below was confirmed to exist in node_modules/lucide-react-native (v1.27.0) before use —
// see the export list in dist/esm/lucide-react-native.mjs. lucide has no tooth/dental-specific glyph at
// all (checked all icon filenames for "tooth"/"dental"/"molar"), so 사랑니 borrows Frown (pained
// expression) as the closest stand-in, same choice explore.tsx made previously.
export const PROCEDURE_ICONS: Record<ProcedureId, IconComponent> = {
  // "나사/볼트" hardware feel — Bolt renders as a hex-head bolt with a center circle (not a lightning
  // bolt; that's the separate `Zap` icon), which reads as an implant screw.
  implant: Bolt,
  // Literal braces glyph — already used this way in explore.tsx, doubles as "정렬" (alignment) intent.
  orthodontics: Braces,
  laminate: Sparkles,
  inlay: Puzzle,
  crown: Crown,
  // Sun instead of Sparkle/Sparkles so it reads clearly distinct from laminate's Sparkles at a glance
  // (a starburst vs. a sun disc), rather than two very similar multi-point-star glyphs.
  whitening: Sun,
  'wisdom-tooth': Frown,
  // ShieldCheck (shield + checkmark) exists in lucide and reads as "protected/treated", preferred over
  // the previous ShieldAlert since 충치치료 is the resolution of the problem, not the warning.
  cavity: ShieldCheck,
  'gum-disease': HeartPulse,
  splint: Shield,
  'snoring-device': Moon,
  // "원형 연결/조인트" feel — CircleDot (a ring around a center point) reads as a ball-and-socket joint
  // cross-section, closer to "턱관절" than Link (a chain link) or Orbit (an orbiting satellite path).
  tmj: CircleDot,
  botox: Syringe,
};
