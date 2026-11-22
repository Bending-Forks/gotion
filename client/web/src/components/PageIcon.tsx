import {
  BookOpen,
  Briefcase,
  Bug,
  Calendar,
  Camera,
  Code,
  Coffee,
  Compass,
  Database,
  Feather,
  FileText,
  Flag,
  FlaskConical,
  Globe,
  GraduationCap,
  Heart,
  House,
  Leaf,
  Lightbulb,
  Palette,
  Rocket,
  SquareCheckBig,
  Star,
  Target,
  Zap,
} from 'lucide-react'

// The icons a page can have, from the Lucide set in the bundle, saved by name (US-05, BR-01)
export const pageIcons = {
  FileText,
  BookOpen,
  Lightbulb,
  FlaskConical,
  Rocket,
  Star,
  Heart,
  Flag,
  Calendar,
  SquareCheckBig,
  Code,
  Database,
  Globe,
  House,
  Compass,
  Camera,
  Briefcase,
  GraduationCap,
  Target,
  Bug,
  Coffee,
  Leaf,
  Zap,
  Palette,
  Feather,
}

export type IconName = keyof typeof pageIcons

// The icon of a page, or a sheet of paper for a page without one
export function PageIcon({ icon, size = 18 }: { icon?: IconName; size?: number }) {
  const Icon = pageIcons[icon ?? 'FileText']
  return <Icon aria-hidden size={size} className="page-icon" />
}
