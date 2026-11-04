import {definePermissionReferences} from '@stellar-enclosure/stellar-enclosure-web-shared/permissions'

export const READ = 'TIANJI_AGENT_READ' as const
export const START = 'TIANJI_AGENT_START' as const
export const CANCEL = 'TIANJI_AGENT_CANCEL' as const
export const MEMORY_READ = 'TIANJI_MEMORY_READ' as const
export const MEMORY_WRITE = 'TIANJI_MEMORY_WRITE' as const
export const MEMORY_FORGET = 'TIANJI_MEMORY_FORGET' as const
export const TASK_READ = 'TIANJI_TASK_READ' as const
export const TASK_CLAIM = 'TIANJI_TASK_CLAIM' as const
export const TASK_COMPLETE = 'TIANJI_TASK_COMPLETE' as const
export const TASK_TRANSFER = 'TIANJI_TASK_TRANSFER' as const
export const permissions = definePermissionReferences([READ, START, CANCEL, MEMORY_READ, MEMORY_WRITE, MEMORY_FORGET,
  TASK_READ, TASK_CLAIM, TASK_COMPLETE, TASK_TRANSFER] as const)
