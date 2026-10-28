import {defineMessages} from '@stellar-enclosure/stellar-enclosure-web-shared/permissions'

export const messages = defineMessages([
  {pageCode: 'tianji.web.permissions', key: 'app.console', defaultLocale: 'zh-CN', defaults: {'zh-CN': '天机控制台', 'en-US': 'Tianji console'}},
  {pageCode: 'tianji.web.permissions', key: 'page.runs', defaultLocale: 'zh-CN', defaults: {'zh-CN': '运行记录', 'en-US': 'Agent runs'}},
  {pageCode: 'tianji.web.permissions', key: 'page.runDetail', defaultLocale: 'zh-CN', defaults: {'zh-CN': '运行详情', 'en-US': 'Run details'}},
  {pageCode: 'tianji.web.permissions', key: 'menu.runs', defaultLocale: 'zh-CN', defaults: {'zh-CN': '运行记录', 'en-US': 'Agent runs'}},
  {pageCode: 'tianji.web.permissions', key: 'button.start', defaultLocale: 'zh-CN', defaults: {'zh-CN': '启动运行', 'en-US': 'Start a run'}},
  {pageCode: 'tianji.web.permissions', key: 'button.cancel', defaultLocale: 'zh-CN', defaults: {'zh-CN': '取消运行', 'en-US': 'Cancel a run'}},
] as const)
