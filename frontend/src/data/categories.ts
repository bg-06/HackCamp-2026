import {
  Construction,
  Droplets,
  Lightbulb,
  Megaphone,
  Paintbrush,
  SprayCan,
  Sprout,
  Trash2,
  TreePine,
  Users,
  type LucideIcon,
} from 'lucide-react'
import type { EventCategory, IssueCategory } from '../types'

export interface CategoryStyle {
  label: string
  icon: LucideIcon
  bg: string // cover background
  fg: string // icon and tag colour
}

// Blue and green tints, inspired by Vancouver's blue-green palette.
export const ISSUE_CATEGORIES: Record<IssueCategory, CategoryStyle> = {
  roads: { label: 'Roads', icon: Construction, bg: '#E3EFFA', fg: '#0B5592' },
  graffiti: { label: 'Graffiti', icon: SprayCan, bg: '#E4F3F1', fg: '#0E6B5C' },
  garbage: { label: 'Garbage', icon: Trash2, bg: '#EAF5E4', fg: '#3B7A27' },
  lighting: { label: 'Lighting', icon: Lightbulb, bg: '#E8F0F8', fg: '#1D5C8C' },
  trees: { label: 'Trees', icon: TreePine, bg: '#E6F4E1', fg: '#2F7A2A' },
  water: { label: 'Water', icon: Droplets, bg: '#DFF0F8', fg: '#0A6C93' },
}

export const EVENT_CATEGORIES: Record<EventCategory, CategoryStyle> = {
  cleanup: { label: 'Cleanup', icon: Paintbrush, bg: '#E6F4E1', fg: '#2F7A2A' },
  meetup: { label: 'Meetup', icon: Users, bg: '#E3EFFA', fg: '#0B5592' },
  garden: { label: 'Gardening', icon: Sprout, bg: '#EAF5E4', fg: '#3B7A27' },
  city: { label: 'City meeting', icon: Megaphone, bg: '#E4F3F1', fg: '#0E6B5C' },
}
