import {
  ArrowLeftRight,
  BellRing,
  CalendarClock,
  FileSpreadsheet,
  Fingerprint,
  Layers,
  ListPlus,
  RotateCw,
  type LucideIcon,
} from 'lucide-react'
import { Features as LpFeatures } from '../../_shared/features'
import type { FeatureIcon, LpContent } from './content'

const ICONS: Record<FeatureIcon, LucideIcon> = {
  sheets: FileSpreadsheet,
  entities: Layers,
  mapping: ArrowLeftRight,
  dedup: Fingerprint,
  schedule: CalendarClock,
  incremental: ListPlus,
  errors: RotateCw,
  notify: BellRing,
}

export function Features({ copy }: { copy: LpContent['features'] }) {
  return <LpFeatures copy={copy} icons={ICONS} />
}
