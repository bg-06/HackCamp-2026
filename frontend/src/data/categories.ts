import {
  Car,
  CircleHelp,
  Construction,
  Droplets,
  HandHeart,
  House,
  Lightbulb,
  PawPrint,
  SprayCan,
  Trash2,
  TreePine,
  Volume2,
  FileText,
  type LucideIcon,
} from 'lucide-react'
import type { EventKind } from '../types'

export interface CategoryStyle {
  label: string
  icon: LucideIcon
  bg: string // tint behind the icon
  fg: string // icon and tag colour (at least 4.5:1 on white and on bg)
}

// Category names are the ones ai_classify gives in databricks/sql/gold_views.sql, so 311 data,
// hotspots and events all use the same words.
// TODO(team): data/seed/volunteer_events.sample.json still uses older names
// ("Litter and Dumping", "Drains and Flooding"). ALIASES maps them until the seed is updated.
export const CATEGORIES: Record<string, CategoryStyle> = {
  'Garbage and Dumping': { label: 'Garbage and Dumping', icon: Trash2, bg: '#EAF5E4', fg: '#2F6B1F' },
  Graffiti: { label: 'Graffiti', icon: SprayCan, bg: '#E4F3F1', fg: '#0E6B5C' },
  'Parks and Trees': { label: 'Parks and Trees', icon: TreePine, bg: '#E6F4E1', fg: '#2F7A2A' },
  'Water and Sewer': { label: 'Water and Sewer', icon: Droplets, bg: '#DFF0F8', fg: '#0A6187' },
  'Roads and Sidewalks': { label: 'Roads and Sidewalks', icon: Construction, bg: '#E3EFFA', fg: '#0B5592' },
  'Lighting and Signals': { label: 'Lighting and Signals', icon: Lightbulb, bg: '#E8F0F8', fg: '#1D5C8C' },
  Noise: { label: 'Noise', icon: Volume2, bg: '#EDF1F4', fg: '#3E4F5F' },
  Parking: { label: 'Parking', icon: Car, bg: '#EDF1F4', fg: '#3E4F5F' },
  Animals: { label: 'Animals', icon: PawPrint, bg: '#EDF1F4', fg: '#3E4F5F' },
  'Permits and Licences': { label: 'Permits and Licences', icon: FileText, bg: '#EDF1F4', fg: '#3E4F5F' },
  'Housing and Property': { label: 'Housing and Property', icon: House, bg: '#EDF1F4', fg: '#3E4F5F' },
  // Not a 311 category, but some volunteer events are about food and community.
  'Food and Community': { label: 'Food and Community', icon: HandHeart, bg: '#EAF5E4', fg: '#2F6B1F' },
}

const ALIASES: Record<string, string> = {
  'Litter and Dumping': 'Garbage and Dumping',
  'Drains and Flooding': 'Water and Sewer',
}

const OTHER: CategoryStyle = { label: 'Other', icon: CircleHelp, bg: '#EDF1F4', fg: '#3E4F5F' }

export function categoryStyle(name: string): CategoryStyle {
  return CATEGORIES[ALIASES[name] ?? name] ?? { ...OTHER, label: name || OTHER.label }
}

// Who runs the event. Each has its own colour, and the label always says it in words.
export const KIND_LABELS: Record<EventKind, { label: string; className: string }> = {
  city: { label: 'City program', className: 'kind-city' },
  org: { label: 'Local group', className: 'kind-org' },
  hotspot: { label: 'Started from a hotspot', className: 'kind-hotspot' },
}
