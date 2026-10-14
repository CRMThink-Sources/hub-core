import {
  BadgeCheck,
  ChartColumn,
  FileText,
  Image as ImageIcon,
  Layers,
  MousePointerClick,
  ShieldCheck,
  Workflow,
  type LucideIcon,
} from 'lucide-react'
import { Features as LpFeatures } from '../../_shared/features'
import type { FeatureIcon, LpContent } from './content'

const ICONS: Record<FeatureIcon, LucideIcon> = {
  channels: BadgeCheck,
  lines: Layers,
  buttons: MousePointerClick,
  templates: FileText,
  automation: Workflow,
  stats: ChartColumn,
  permissions: ShieldCheck,
  media: ImageIcon,
}

export function Features({ copy }: { copy: LpContent['features'] }) {
  return <LpFeatures copy={copy} icons={ICONS} />
}
