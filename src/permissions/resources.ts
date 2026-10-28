import {defineResources} from '@stellar-enclosure/stellar-enclosure-web-shared/permissions'
import {CANCEL, READ, START} from './permissions'

export const resources = defineResources([
  {key: 'tianji.app.console', type: 'APP', target: {applicationCode: 'tianji'},
    requirement: {mode: 'ALL', codes: [READ]}, i18n: {pageCode: 'tianji.web.permissions', labelKey: 'app.console'}},
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
] as const)
