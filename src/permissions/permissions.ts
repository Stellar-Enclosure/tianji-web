import {definePermissionReferences} from '@stellar-enclosure/stellar-enclosure-web-shared/permissions'

export const READ = 'TIANJI_AGENT_READ' as const
export const START = 'TIANJI_AGENT_START' as const
export const CANCEL = 'TIANJI_AGENT_CANCEL' as const
export const permissions = definePermissionReferences([READ, START, CANCEL] as const)
