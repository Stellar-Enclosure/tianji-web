import type { AppPageDescriptor } from '@stellar-enclosure/stellar-enclosure-web-shared'

export interface TianjiWorkbenchRoute {
  readonly id: string
  readonly resourceKey?: string
  readonly pattern: string
  readonly title: string
  readonly groupKey?: string
  readonly groupLabel?: string
  readonly navVisible: boolean
  readonly legacyHandoff?: boolean
  readonly identityParams: readonly string[]
  readonly queryKeys: readonly string[]
}

export interface TianjiRouteMatch {
  readonly route: TianjiWorkbenchRoute
  readonly params: Record<string, string>
}

export interface TianjiPermissionChecker {
  readonly allows: (resourceKey: string) => boolean
}

export const tianjiWorkbenchRoutes: readonly TianjiWorkbenchRoute[] = [
  {
    id: 'tianji.page.processDefinitions',
    resourceKey: 'tianji.page.processDefinitions',
    pattern: '/process-definitions',
    title: '流程设计',
    groupKey: 'design',
    groupLabel: '编排设计',
    navVisible: true,
    identityParams: [],
    queryKeys: ['tab'],
  },
  {
    id: 'tianji.page.processDefinitions.new',
    resourceKey: 'tianji.page.processDefinitions',
    pattern: '/process-definitions/new',
    title: '新建流程草稿',
    groupKey: 'design',
    groupLabel: '编排设计',
    navVisible: false,
    identityParams: [],
    queryKeys: [],
  },
  {
    id: 'tianji.page.processDraftEditor',
    resourceKey: 'tianji.page.processDraftEditor',
    pattern: '/process-definitions/drafts/:draftId',
    title: '流程草稿编辑器',
    groupKey: 'design',
    groupLabel: '编排设计',
    navVisible: false,
    identityParams: ['draftId'],
    queryKeys: [],
  },
  {
    id: 'tianji.page.processInstances',
    resourceKey: 'tianji.page.processInstances',
    pattern: '/process-instances',
    title: '流程实例查找',
    groupKey: 'runtime',
    groupLabel: '运行监控',
    navVisible: true,
    identityParams: [],
    queryKeys: [],
  },
  {
    id: 'tianji.page.processInstance',
    resourceKey: 'tianji.page.processInstance',
    pattern: '/process-instances/:instanceId',
    title: '流程实例详情',
    groupKey: 'runtime',
    groupLabel: '运行监控',
    navVisible: false,
    identityParams: ['instanceId'],
    queryKeys: [],
  },
  {
    id: 'tianji.page.runs',
    resourceKey: 'tianji.page.runs',
    pattern: '/runs',
    title: '运行记录',
    groupKey: 'runtime',
    groupLabel: '运行监控',
    navVisible: true,
    identityParams: [],
    queryKeys: ['status'],
  },
  {
    id: 'tianji.page.runDetail',
    resourceKey: 'tianji.page.runDetail',
    pattern: '/runs/:runId',
    title: '运行详情',
    groupKey: 'runtime',
    groupLabel: '运行监控',
    navVisible: false,
    identityParams: ['runId'],
    queryKeys: [],
  },
  {
    id: 'tianji.page.cases',
    resourceKey: 'tianji.page.cases',
    pattern: '/cases',
    title: '案件查询',
    groupKey: 'runtime',
    groupLabel: '运行监控',
    navVisible: true,
    identityParams: [],
    queryKeys: ['caseInstanceId'],
  },
  {
    id: 'tianji.page.caseDetail',
    resourceKey: 'tianji.page.caseDetail',
    pattern: '/cases/:caseInstanceId',
    title: '案件详情',
    groupKey: 'runtime',
    groupLabel: '运行监控',
    navVisible: false,
    identityParams: ['caseInstanceId'],
    queryKeys: [],
  },
  {
    id: 'tianji.page.workerFailures',
    resourceKey: 'tianji.page.workerFailures',
    pattern: '/operations/worker-failures',
    title: 'Worker 失败观察',
    groupKey: 'operations',
    groupLabel: '运维诊断',
    navVisible: true,
    identityParams: [],
    queryKeys: ['status'],
  },
  {
    id: 'tianji.page.processReleases',
    resourceKey: 'tianji.page.processReleases',
    pattern: '/operations/process-releases',
    title: '流程发布元数据',
    groupKey: 'operations',
    groupLabel: '运维诊断',
    navVisible: true,
    identityParams: [],
    queryKeys: [],
  },
  {
    id: 'tianji.page.processCorrelations',
    resourceKey: 'tianji.page.processCorrelations',
    pattern: '/operations/process-correlations',
    title: '流程关联查询',
    groupKey: 'operations',
    groupLabel: '运维诊断',
    navVisible: true,
    identityParams: [],
    queryKeys: [],
  },
  {
    id: 'tianji.legacy.tasks',
    pattern: '/tasks',
    title: '此能力由业务平台提供',
    navVisible: false,
    legacyHandoff: true,
    identityParams: [],
    queryKeys: [],
  },
  {
    id: 'tianji.legacy.taskDetail',
    pattern: '/tasks/:taskId',
    title: '此能力由业务平台提供',
    navVisible: false,
    legacyHandoff: true,
    identityParams: ['taskId'],
    queryKeys: [],
  },
  {
    id: 'tianji.legacy.memory',
    pattern: '/memory',
    title: '此能力由业务平台提供',
    navVisible: false,
    legacyHandoff: true,
    identityParams: [],
    queryKeys: [],
  },
] as const

const catalogOrder: readonly string[] = [
  'tianji.page.processDefinitions',
  'tianji.page.processReleases',
  'tianji.page.processCorrelations',
  'tianji.page.processInstances',
  'tianji.page.workerFailures',
  'tianji.page.runs',
  'tianji.page.cases',
]

export const canAccessTianjiRoute = (
  checker: TianjiPermissionChecker,
  route: TianjiWorkbenchRoute,
): boolean => {
  if (route.legacyHandoff) return true
  if (!route.resourceKey) return false
  return checker.allows(route.resourceKey)
}

export const buildTianjiCatalogPages = (
  checker: TianjiPermissionChecker,
): AppPageDescriptor[] => {
  const byId = new Map(tianjiWorkbenchRoutes.map((route) => [route.id, route]))
  const descriptors: AppPageDescriptor[] = []
  for (const id of catalogOrder) {
    const route = byId.get(id)
    if (!route || !route.navVisible || !canAccessTianjiRoute(checker, route)) continue
    descriptors.push({
      pageId: route.id,
      pattern: route.pattern,
      label: route.title,
      ...(route.groupKey ? { groupKey: route.groupKey, groupLabel: route.groupLabel } : {}),
      identityParams: route.identityParams,
      queryKeys: route.queryKeys,
    })
  }
  return descriptors
}

const scorePattern = (pattern: string): number =>
  pattern
    .split('/')
    .filter(Boolean)
    .reduce((score, segment) => score * 10 + (segment.startsWith(':') ? 1 : 2), 0)

const sortedRoutes = [...tianjiWorkbenchRoutes].sort(
  (left, right) => scorePattern(right.pattern) - scorePattern(left.pattern),
)

export const matchTianjiRoute = (path: string): TianjiRouteMatch | null => {
  const normalized = path.split('?')[0] ?? path
  for (const route of sortedRoutes) {
    const routeSegments = route.pattern.split('/').filter(Boolean)
    const pathSegments = normalized.split('/').filter(Boolean)
    if (routeSegments.length !== pathSegments.length) continue
    const params: Record<string, string> = {}
    let matched = true
    for (let index = 0; index < routeSegments.length; index += 1) {
      const routeSegment = routeSegments[index]!
      const pathSegment = pathSegments[index]!
      if (routeSegment.startsWith(':')) {
        params[routeSegment.slice(1)] = decodeURIComponent(pathSegment)
      } else if (routeSegment !== pathSegment) {
        matched = false
        break
      }
    }
    if (matched) {
      return { route, params }
    }
  }
  return null
}
