import {defineResources} from '@stellar-enclosure/stellar-enclosure-web-shared/permissions'
import {CANCEL, READ, START, MEMORY_READ, MEMORY_WRITE, MEMORY_FORGET} from './permissions'

export const resources = defineResources([
  {key: 'tianji.app.console', type: 'APP', target: {applicationCode: 'tianji'},
    requirement: {mode: 'ANY', codes: [READ, MEMORY_READ]}, i18n: {pageCode: 'tianji.web.permissions', labelKey: 'app.console'}},
  {key: 'tianji.page.runs', type: 'PAGE', target: {route: '/runs'},
    requirement: {mode: 'ALL', codes: [READ]}, i18n: {pageCode: 'tianji.web.permissions', labelKey: 'page.runs'}},
  {key: 'tianji.page.runDetail', type: 'PAGE', target: {route: '/runs/:runId'},
    requirement: {mode: 'ALL', codes: [READ]}, i18n: {pageCode: 'tianji.web.permissions', labelKey: 'page.runDetail'}},
  {key: 'tianji.menu.runs', type: 'MENU', target: {route: '/runs', parentKey: 'tianji.app.console'},
    requirement: {mode: 'ALL', codes: [READ]}, i18n: {pageCode: 'tianji.web.permissions', labelKey: 'menu.runs'}},
  {key: 'tianji.button.runs.start', type: 'BUTTON', target: {component: 'src/pages/AgentRunsPage.tsx', action: 'start'},
    requirement: {mode: 'ALL', codes: [READ, START]}, i18n: {pageCode: 'tianji.web.permissions', labelKey: 'button.start'}},
  {key: 'tianji.button.runDetail.cancel', type: 'BUTTON', target: {component: 'src/pages/AgentRunDetailPage.tsx', action: 'cancel'},
    requirement: {mode: 'ALL', codes: [READ, CANCEL]}, i18n: {pageCode: 'tianji.web.permissions', labelKey: 'button.cancel'}},
  {key: 'tianji.page.memoryCandidates', type: 'PAGE', target: {route: '/memory'},
    requirement: {mode: 'ALL', codes: [MEMORY_READ]}, i18n: {pageCode: 'tianji.web.permissions', labelKey: 'page.memoryCandidates'}},
  {key: 'tianji.menu.memoryCandidates', type: 'MENU', target: {route: '/memory', parentKey: 'tianji.app.console'},
    requirement: {mode: 'ALL', codes: [MEMORY_READ]}, i18n: {pageCode: 'tianji.web.permissions', labelKey: 'menu.memoryCandidates'}},
  {key: 'tianji.button.memoryCandidates.confirm', type: 'BUTTON', target: {component: 'src/pages/MemoryCandidatesPage.tsx', action: 'confirm'},
    requirement: {mode: 'ALL', codes: [MEMORY_READ, MEMORY_WRITE]}, i18n: {pageCode: 'tianji.web.permissions', labelKey: 'button.memoryConfirm'}},
  {key: 'tianji.button.memoryCandidates.reject', type: 'BUTTON', target: {component: 'src/pages/MemoryCandidatesPage.tsx', action: 'reject'},
    requirement: {mode: 'ALL', codes: [MEMORY_READ, MEMORY_FORGET]}, i18n: {pageCode: 'tianji.web.permissions', labelKey: 'button.memoryReject'}},
  {key: 'tianji.button.memoryCandidates.compare', type: 'BUTTON', target: {component: 'src/pages/MemoryCandidatesPage.tsx', action: 'compare'},
    requirement: {mode: 'ALL', codes: [MEMORY_READ]}, i18n: {pageCode: 'tianji.web.permissions', labelKey: 'button.memoryCompare'}},
  {key: 'tianji.button.runDetail.extractPreferences', type: 'BUTTON', target: {component: 'src/pages/MemoryPreferenceAction.tsx', action: 'extractPreferences'},
    requirement: {mode: 'ALL', codes: [READ, MEMORY_READ, MEMORY_WRITE]}, i18n: {pageCode: 'tianji.web.permissions', labelKey: 'button.extractPreferences'}},
] as const)
