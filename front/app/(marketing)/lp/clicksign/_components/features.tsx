import {
  ArrowLeftRight,
  Ban,
  Bot,
  Building2,
  FileCheck2,
  History,
  ShieldCheck,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { Features as LpFeatures } from '../../_shared/features'
import type { FeatureIcon, LpContent } from './content'

const ICONS: Record<FeatureIcon, LucideIcon> = {
  robot: Bot,
  mapping: ArrowLeftRight,
  groups: Users,
  auth: ShieldCheck,
  timeline: History,
  signedFile: FileCheck2,
  companies: Building2,
  cancel: Ban,
}

export function Features({ copy }: { copy: LpContent['features'] }) {
  return <LpFeatures copy={copy} icons={ICONS} />
}
