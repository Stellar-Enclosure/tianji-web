import {Alert, Button, Input, Select, Space, Table, Tag, Typography, type TableColumnsType} from 'antd'
import {
  ApiError,
  WorkspaceList,
  useEmbeddedWorkbench,
  useWorkbenchLeaveGuard,
} from '@stellar-enclosure/stellar-enclosure-web-shared'
import {useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState} from 'react'
import {Link, useLocation, useNavigate} from 'react-router-dom'
import {processDraftsApi, type DraftState, type DraftSummaryDTO, type ListProcessDraftsQuery,
  type ProcessDraftPageDTO} from '../api/processDrafts'
import {isCanonicalTenant} from '../api/client'
import {isProcessReleaseVersion} from '../api/processReleases'
import {processAutomationApi, parseStartOverridesJson, parseStartVariablesJson,
  type AutomationInstanceDTO, type AutomationStartCommand} from '../api/processAutomation'
import {processStartReceiptsApi} from '../api/processStartReceipts'
import {gatewayAuth} from '../auth/gatewayAuth'
import {useAuth} from '../auth/AuthContext'

const PAGE = 'tianji.page.processDefinitions'
const CREATE = 'tianji.button.processDefinitions.create'
const COPY = 'tianji.button.processDefinitions.copy'
const RECOVERY_KEY = 'tianji.process-draft-create.v1'
const START_RECOVERY_KEY = 'tianji.process-start.v2'
const CREATE_REJECTIONS: Readonly<Partial<Record<number, string>>> = {
  400: 'TIANJI_INVALID_COMMAND',
  404: 'TIANJI_RESOURCE_NOT_FOUND',
  409: 'TIANJI_DRAFT_SOURCE_UNAVAILABLE',
  413: 'TIANJI_REQUEST_TOO_LARGE',
}
const START_REJECTIONS: Readonly<Partial<Record<number, readonly string[]>>> = {
  400: ['TIANJI_INVALID_COMMAND'],
  409: ['TIANJI_PROCESS_NOT_ACTIVATED', 'TIANJI_PROCESS_ACTIVATION_CONFLICT'],
}
const START_ACTION = 'tianji.button.processDefinitions.start'
const PROCESS_READ_CODE = 'TIANJI_PROCESS_READ'
const PROCESS_START_CODE = 'TIANJI_PROCESS_START'
const STATES: readonly DraftState[] = ['EDITING', 'PUBLISHED', 'DISCARDED']
const DEFINITION_KEY = /^[A-Za-z_][A-Za-z0-9_.-]{0,127}(?![\s\S])/
const COMMAND_ID = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}(?![\s\S])/
const CONTROL = /\p{Cc}/u
const SURROGATE = /\p{Surrogate}/u
const JAVA_SPACE_CODEPOINTS = new Set([0x1680, 0x2000, 0x2001, 0x2002, 0x2003, 0x2004,
  0x2005, 0x2006, 0x2008, 0x2009, 0x200a, 0x2028, 0x2029, 0x205f, 0x3000])
const encoder = new TextEncoder()
const recoveryFields = ['version', 'operation', 'actorFingerprint', 'tenantId', 'definitionKey', 'title', 'baseReleaseVersion', 'commandId'] as const

type CreateIntent = Readonly<{
  version: 1
  operation: 'CREATE'
  actorFingerprint: string
  tenantId: string
  definitionKey: string
  title: string
  baseReleaseVersion: string | null
  commandId: string
}>
type RecoveryState = 'dispatching' | 'checking' | 'unknown'
type StartPointer = Readonly<{
  version: 1
  operation: 'START'
  actorFingerprint: string
  tenantId: string
  commandId: string
  requestSha256: string
}>
type StartState = 'preparing' | 'checking' | 'sending' | 'unknown'
type StartedInstance = Pick<AutomationInstanceDTO, 'instanceId' | 'releaseVersion' | 'activationRevision'>
type CopyFromRelease = Readonly<{definitionKey: string; releaseVersion: string}>

function hasExactFields(value: Record<string, unknown>, fields: readonly string[]): boolean {
  const keys = Object.keys(value)
  return keys.length === fields.length && fields.every(field => Object.hasOwn(value, field))
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function decodeStartPointer(value: unknown): StartPointer | null {
  if (!isRecord(value) || !hasExactFields(value,
    ['version', 'operation', 'actorFingerprint', 'tenantId', 'commandId', 'requestSha256'])
      || value.version !== 1 || value.operation !== 'START'
      || typeof value.actorFingerprint !== 'string' || !/^[a-f0-9]{64}(?![\s\S])/.test(value.actorFingerprint)
      || typeof value.tenantId !== 'string' || !isCanonicalTenant(value.tenantId)
      || typeof value.commandId !== 'string'
      || !/^start-[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}(?![\s\S])/.test(value.commandId)
      || typeof value.requestSha256 !== 'string' || !/^[a-f0-9]{64}(?![\s\S])/.test(value.requestSha256)) return null
  return value as StartPointer
}

function decodeCopyFrom(value: unknown): CopyFromRelease | null {
  if (!isRecord(value) || !hasExactFields(value, ['definitionKey', 'releaseVersion'])
      || typeof value.definitionKey !== 'string' || !DEFINITION_KEY.test(value.definitionKey)
      || !isProcessReleaseVersion(value.releaseVersion)) return null
  return {definitionKey: value.definitionKey, releaseVersion: value.releaseVersion}
}

function isDefiniteStartRejection(failure: unknown): failure is ApiError {
  return failure instanceof ApiError && START_REJECTIONS[failure.status]?.includes(failure.code) === true
}

function isTitle(value: string): boolean {
  return value.length <= 256 && [...value].length <= 128 && !value.includes('\0')
    && !SURROGATE.test(value) && !CONTROL.test(value)
    && [...value].some(character => !isJavaWhitespace(character))
}

function isJavaWhitespace(character: string): boolean {
  const codePoint = character.codePointAt(0)
  return codePoint !== undefined && ((codePoint >= 0x09 && codePoint <= 0x0d)
    || (codePoint >= 0x1c && codePoint <= 0x20) || JAVA_SPACE_CODEPOINTS.has(codePoint))
}

function decodeIntent(value: unknown): CreateIntent | null {
  if (!isRecord(value) || !hasExactFields(value, recoveryFields) || value.version !== 1
      || typeof value.actorFingerprint !== 'string' || !/^[a-f0-9]{64}(?![\s\S])/.test(value.actorFingerprint)
      || typeof value.tenantId !== 'string' || !isCanonicalTenant(value.tenantId)
      || value.operation !== 'CREATE'
      || typeof value.definitionKey !== 'string' || !DEFINITION_KEY.test(value.definitionKey)
      || typeof value.title !== 'string' || !isTitle(value.title)
      || !(value.baseReleaseVersion === null || isProcessReleaseVersion(value.baseReleaseVersion))
      || typeof value.commandId !== 'string' || !COMMAND_ID.test(value.commandId)) return null
  return value as CreateIntent
}

async function actorFingerprint(issuer: string, subject: string): Promise<string> {
  const payload = encoder.encode(JSON.stringify(['TIANJI_PROCESS_DRAFT_OWNER_V1', issuer, subject]))
  const digest = await globalThis.crypto.subtle.digest('SHA-256', payload)
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
}

function isExactRecovery(summary: DraftSummaryDTO, intent: CreateIntent): boolean {
  return summary.definitionKey === intent.definitionKey
    && summary.baseReleaseVersion === intent.baseReleaseVersion
}

function OwnerDraftWorkspace({tenant, issuer, subject, epoch, canView, canCreate, canCopy, startEnabled}: {
  tenant: string
  issuer: string
  subject: string
  epoch: number
  canView: boolean
  canCreate: boolean
  canCopy: boolean
  startEnabled: boolean
}) {
  const location = useLocation()
  const navigate = useNavigate()
  const isNew = location.pathname === '/process-definitions/new'
  const isWorkspace = location.pathname === '/process-definitions' || isNew
  const copyFrom = canCopy && isNew && isRecord(location.state)
    ? decodeCopyFrom(location.state.copyFrom) : null
  const [fingerprint, setFingerprint] = useState<string>()
  const [storageReady, setStorageReady] = useState(false)
  const [storageError, setStorageError] = useState(false)
  const [recovery, setRecovery] = useState<CreateIntent | null>(null)
  const [recoveryState, setRecoveryState] = useState<RecoveryState>()
  const [recoveryError, setRecoveryError] = useState<string>()
  const [definitionInput, setDefinitionInput] = useState(() => copyFrom?.definitionKey ?? '')
  const [title, setTitle] = useState('')
  const [baseReleaseVersion, setBaseReleaseVersion] = useState(() => copyFrom?.releaseVersion ?? '')
  const [startDefinitionKey, setStartDefinitionKey] = useState('')
  const [startBusinessKey, setStartBusinessKey] = useState('')
  const [startCorrelationId, setStartCorrelationId] = useState('')
  const [startVariablesSource, setStartVariablesSource] = useState('{}')
  const [startOverridesSource, setStartOverridesSource] = useState('')
  const [startPointer, setStartPointer] = useState<StartPointer | null>(null)
  const [startPointerReady, setStartPointerReady] = useState(false)
  const [startState, setStartState] = useState<StartState>()
  const [startError, setStartError] = useState<string>()
  const [started, setStarted] = useState<StartedInstance>()
  const [pendingStartBody, setPendingStartBody] = useState<AutomationStartCommand>()
  const [startFormError, setStartFormError] = useState<string>()
  const copyStateCaptured = useRef(false)
  const [formError, setFormError] = useState<string>()
  const [filters, setFilters] = useState<{definitionKey?: string; state: DraftState}>({state: 'EDITING'})
  const [filterError, setFilterError] = useState<string>()
  const [filterDefinition, setFilterDefinition] = useState('')
  const [filterState, setFilterState] = useState<DraftState>('EDITING')
  const [pageCursor, setPageCursor] = useState<string>()
  const [previousCursors, setPreviousCursors] = useState<(string | undefined)[]>([])
  const [draftPage, setDraftPage] = useState<ProcessDraftPageDTO>()
  const [listFailure, setListFailure] = useState(false)
  const [loading, setLoading] = useState(true)
  const alive = useRef(false)
  const listController = useRef<AbortController | null>(null)
  const recoveryController = useRef<AbortController | null>(null)
  const createController = useRef<AbortController | null>(null)
  const startController = useRef<AbortController | null>(null)
  const startInFlight = useRef(false)
  const currentCanStart = useRef(false)
  const sequence = useRef(0)

  const isCurrent = useCallback(() => alive.current && gatewayAuth.context.epoch === epoch, [epoch])
  const isStartScopeCurrent = useCallback(() => isCurrent() && currentCanStart.current, [isCurrent])

  useEffect(() => {
    if (!copyFrom || copyStateCaptured.current) return
    copyStateCaptured.current = true
    navigate(location.pathname, {replace: true, state: null})
  }, [copyFrom, location.pathname, navigate])
  const canStart = canView && startEnabled
  const {embedded, activeTabKey} = useEmbeddedWorkbench()
  useWorkbenchLeaveGuard(activeTabKey ?? 'tianji:process-definitions', {
    dirty: Boolean(recovery || startPointer),
    pendingMutation: recoveryState === 'dispatching'
      || recoveryState === 'checking'
      || startState === 'preparing'
      || startState === 'checking'
      || startState === 'sending',
  })

  useLayoutEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
      sequence.current += 1
      listController.current?.abort()
      recoveryController.current?.abort()
      createController.current?.abort()
      startController.current?.abort()
      listController.current = null
      recoveryController.current = null
      createController.current = null
      startController.current = null
      startInFlight.current = false
    }
  }, [])

  useLayoutEffect(() => { currentCanStart.current = canStart }, [canStart])

  useEffect(() => {
    let active = true
    void actorFingerprint(issuer, subject).then(value => {
      if (active && isCurrent()) setFingerprint(value)
    }).catch(() => {
      if (active && isCurrent()) {
        setStorageError(true)
        setStorageReady(true)
      }
    })
    return () => { active = false }
  }, [issuer, subject, isCurrent])

  const removeStartPointer = useCallback((intent: StartPointer) => {
    try {
      const stored = decodeStartPointer(JSON.parse(sessionStorage.getItem(START_RECOVERY_KEY) ?? 'null'))
      if (stored && stored.actorFingerprint === intent.actorFingerprint
          && stored.tenantId === intent.tenantId && stored.commandId === intent.commandId) {
        sessionStorage.removeItem(START_RECOVERY_KEY)
      }
    } catch {
      setStorageError(true)
    }
  }, [])

  const verifyStartReceipt = useCallback(async (intent: StartPointer) => {
    if (!isStartScopeCurrent() || !fingerprint || intent.actorFingerprint !== fingerprint || intent.tenantId !== tenant) return
    setStartState('checking')
    setStartError(undefined)
    const request = new AbortController()
    startController.current?.abort()
    startController.current = request
    try {
      const receipt = await processStartReceiptsApi.get(tenant, {
        commandId: intent.commandId, requestSha256: intent.requestSha256,
      }, request.signal)
      if (!isStartScopeCurrent() || request.signal.aborted) return
      removeStartPointer(intent)
      setStartPointer(null)
      setPendingStartBody(undefined)
      navigate('/process-instances/' + encodeURIComponent(receipt.instanceId))
    } catch {
      if (!isStartScopeCurrent() || request.signal.aborted) return
      setStartState('unknown')
      setStartError('服务尚未提供原 START 的 APPLIED 回执。请稍后查证，或在本页重放原请求。')
    } finally {
      if (startController.current === request) startController.current = null
    }
  }, [fingerprint, isStartScopeCurrent, navigate, removeStartPointer, tenant])

  useEffect(() => {
    if (!fingerprint) return
    let active = true
    void Promise.resolve().then(() => {
      if (!active || !isCurrent()) return
      try {
        const raw = sessionStorage.getItem(START_RECOVERY_KEY)
        if (!raw) {
          setStartPointerReady(true)
          return
        }
        const intent = decodeStartPointer(JSON.parse(raw))
        if (!intent || intent.actorFingerprint !== fingerprint || intent.tenantId !== tenant) {
          sessionStorage.removeItem(START_RECOVERY_KEY)
          setStartPointerReady(true)
          return
        }
        setStartPointer(intent)
        setStartState('unknown')
        setStartPointerReady(true)
        if (canStart) void verifyStartReceipt(intent)
      } catch {
        setStorageError(true)
        setStartPointerReady(true)
      }
    })
    return () => { active = false }
  }, [canStart, fingerprint, isCurrent, tenant, verifyStartReceipt])

  const transmitStart = async (intent: StartPointer, body: AutomationStartCommand, heldInFlightGuard = false): Promise<void> => {
    if ((!heldInFlightGuard && startInFlight.current) || !isStartScopeCurrent() || !fingerprint
        || intent.actorFingerprint !== fingerprint || intent.tenantId !== tenant) return
    startInFlight.current = true
    setStartState('sending')
    setStartError(undefined)
    setPendingStartBody(body)
    const request = new AbortController()
    startController.current?.abort()
    startController.current = request
    try {
      const digest = await processAutomationApi.startRequestSha256(body)
      if (!isStartScopeCurrent() || request.signal.aborted) return
      if (digest !== intent.requestSha256) {
        setStartState('unknown')
        setStartError('原 START 请求摘要与内存请求不一致。仅可查证回执。')
        return
      }
      const result = await processAutomationApi.start(tenant, body, request.signal)
      if (!isStartScopeCurrent() || request.signal.aborted) return
      removeStartPointer(intent)
      setStartPointer(null)
      setPendingStartBody(undefined)
      setStartState(undefined)
      setStarted({instanceId: result.instanceId, releaseVersion: result.releaseVersion,
        activationRevision: result.activationRevision})
    } catch (failure) {
      if (!isStartScopeCurrent() || request.signal.aborted) return
      if (isDefiniteStartRejection(failure)) {
        removeStartPointer(intent)
        setStartPointer(null)
        setPendingStartBody(undefined)
        setStartState(undefined)
        setStartFormError(failure.code === 'TIANJI_PROCESS_NOT_ACTIVATED'
          ? '此流程定义当前没有生效版本。完成发布和生效后，可提交新的启动请求。'
          : failure.code === 'TIANJI_PROCESS_ACTIVATION_CONFLICT'
            ? '启动期间生效版本发生变化。请重新确认当前生效版本后，再提交新的启动请求。'
            : 'START 请求未被接受。请检查字段后重新提交。')
      } else {
        setStartPointer(intent)
        setStartState('unknown')
        setStartError('START 结果尚未确认。请使用原命令查证，或重放仍保存在本页的原请求。')
      }
    } finally {
      if (startController.current === request) startController.current = null
      startInFlight.current = false
    }
  }

  const submitStart = async () => {
    if (!isStartScopeCurrent() || startInFlight.current || startPointer
        || !startPointerReady || storageError || !fingerprint || !globalThis.crypto?.randomUUID) return
    startInFlight.current = true
    setStartState('preparing')
    setStartFormError(undefined)
    setStartError(undefined)
    try {
      const variables = parseStartVariablesJson(startVariablesSource)
      const overrides = startOverridesSource.trim() ? parseStartOverridesJson(startOverridesSource) : undefined
      const command: AutomationStartCommand = {
        definitionKey: startDefinitionKey,
        businessKey: startBusinessKey,
        commandId: 'start-' + globalThis.crypto.randomUUID(),
        correlationId: startCorrelationId,
        variables,
        ...(overrides === undefined ? {} : {agentTaskOverrides: overrides}),
      }
      const requestSha256 = await processAutomationApi.startRequestSha256(command)
      if (!isStartScopeCurrent()) {
        setStartState(undefined)
        return
      }
      const intent: StartPointer = {
        version: 1, operation: 'START', actorFingerprint: fingerprint, tenantId: tenant,
        commandId: command.commandId, requestSha256,
      }
      sessionStorage.setItem(START_RECOVERY_KEY, JSON.stringify(intent))
      if (!isStartScopeCurrent()) {
        removeStartPointer(intent)
        setStartState(undefined)
        return
      }
      setStartPointer(intent)
      await transmitStart(intent, command, true)
    } catch (failure) {
      if (!isStartScopeCurrent()) {
        setStartState(undefined)
        return
      }
      if (failure instanceof DOMException && failure.name === 'SecurityError') setStorageError(true)
      setStartFormError(failure instanceof Error && failure.message === '流程类型化数据无效'
        ? '启动变量或节点覆盖必须是符合限制的类型化 JSON。'
        : failure instanceof SyntaxError ? '启动变量或节点覆盖 JSON 格式无效。'
          : '请检查启动定义、业务标识及关联标识。')
      setStartState(undefined)
    } finally {
      startInFlight.current = false
    }
  }

  const removeRecovery = useCallback((commandId: string) => {
    try {
      const current = sessionStorage.getItem(RECOVERY_KEY)
      if (!current) return
      const parsed = decodeIntent(JSON.parse(current))
      if (parsed?.commandId === commandId && parsed.tenantId === tenant
          && parsed.actorFingerprint === fingerprint) sessionStorage.removeItem(RECOVERY_KEY)
    } catch {
      setStorageError(true)
    }
  }, [fingerprint, tenant])

  const verifyRecovery = useCallback(async (intent: CreateIntent) => {
    if (!isCurrent() || intent.actorFingerprint !== fingerprint || intent.tenantId !== tenant) return
    recoveryController.current?.abort()
    const request = new AbortController()
    recoveryController.current = request
    setRecoveryState('checking')
    setRecoveryError(undefined)
    try {
      const result = await processDraftsApi.list(tenant, {creationCommandId: intent.commandId}, request.signal)
      if (!isCurrent() || request.signal.aborted) return
      const found = result.items[0]
      if (!found) {
        setRecoveryState('unknown')
        return
      }
      if (!isExactRecovery(found, intent)) {
        setRecoveryError('上次创建结果与原请求不一致，请联系流程管理员核查。')
        setRecoveryState('unknown')
        return
      }
      removeRecovery(intent.commandId)
      navigate('/process-definitions/drafts/' + encodeURIComponent(found.draftId))
    } catch {
      if (!isCurrent() || request.signal.aborted) return
      setRecoveryState('unknown')
      setRecoveryError('暂时无法核对创建结果，请稍后重试。')
    } finally {
      if (recoveryController.current === request) recoveryController.current = null
    }
  }, [fingerprint, isCurrent, navigate, removeRecovery, tenant])

  useEffect(() => {
    if (!fingerprint) return
    let active = true
    void Promise.resolve().then(() => {
      if (!active || !isCurrent()) return
      try {
        const stored = sessionStorage.getItem(RECOVERY_KEY)
        if (!stored) {
          setStorageReady(true)
          return
        }
        const candidate = decodeIntent(JSON.parse(stored))
        if (!candidate || candidate.actorFingerprint !== fingerprint || candidate.tenantId !== tenant) {
          sessionStorage.removeItem(RECOVERY_KEY)
          setStorageReady(true)
          return
        }
        if (!canView) {
          setStorageReady(true)
          return
        }
        setRecovery(candidate)
        setStorageReady(true)
        void verifyRecovery(candidate)
      } catch {
        setStorageError(true)
        setStorageReady(true)
      }
    })
    return () => { active = false }
  }, [canView, fingerprint, isCurrent, tenant, verifyRecovery])

  useEffect(() => {
    if (!canView || !isWorkspace || isNew || !storageReady
        || recoveryState === 'checking' || recoveryState === 'dispatching') return
    const request = new AbortController()
    const requestSequence = ++sequence.current
    listController.current?.abort()
    listController.current = request
    const query: ListProcessDraftsQuery = {
      ...(filters.definitionKey ? {definitionKey: filters.definitionKey} : {}),
      state: filters.state,
      limit: 20,
      ...(pageCursor ? {cursor: pageCursor} : {}),
    }
    void processDraftsApi.list(tenant, query, request.signal).then(result => {
      if (isCurrent() && !request.signal.aborted && sequence.current === requestSequence) setDraftPage(result)
    }).catch(() => {
      if (isCurrent() && !request.signal.aborted && sequence.current === requestSequence) {
        setDraftPage(undefined)
        setListFailure(true)
      }
    }).finally(() => {
      if (listController.current === request) listController.current = null
      if (isCurrent() && sequence.current === requestSequence) setLoading(false)
    })
    return () => {
      request.abort()
      if (listController.current === request) listController.current = null
      sequence.current += 1
    }
  }, [canView, filters, isNew, isWorkspace, isCurrent, pageCursor, recoveryState, storageError, storageReady, tenant])

  const submitCreate = async (copy: boolean) => {
    if (!isCurrent()) {
      setFormError('登录状态已变化，请重新打开草稿工作区后重试。')
      return
    }
    if (createController.current || !canCreate || copy && !canCopy || recovery || recoveryState !== undefined
        || !storageReady || storageError || !fingerprint || !globalThis.crypto?.randomUUID) return
    const definitionKey = definitionInput
    const capturedTitle = title
    const sourceVersion = copy ? baseReleaseVersion : ''
    const invalidDefinition = !DEFINITION_KEY.test(definitionKey)
    const invalidTitle = !isTitle(capturedTitle)
    const invalidRelease = copy && !isProcessReleaseVersion(sourceVersion)
    if (invalidDefinition || invalidTitle || invalidRelease) {
      setFormError('请填写有效的流程定义标识、草稿标题和精确发布版本。')
      return
    }
    setFormError(undefined)
    const intent: CreateIntent = {
      version: 1, operation: 'CREATE', actorFingerprint: fingerprint, tenantId: tenant, definitionKey, title: capturedTitle,
      baseReleaseVersion: copy ? sourceVersion : null, commandId: globalThis.crypto.randomUUID(),
    }
    try {
      sessionStorage.setItem(RECOVERY_KEY, JSON.stringify(intent))
    } catch {
      setStorageError(true)
      setFormError('无法安全保存本次创建请求，草稿尚未提交。')
      return
    }
    setRecovery(intent)
    setRecoveryState('dispatching')
    const request = new AbortController()
    createController.current = request
    try {
      const result = await processDraftsApi.create(tenant, definitionKey, {
        title: capturedTitle, baseReleaseVersion: intent.baseReleaseVersion, commandId: intent.commandId,
      }, request.signal)
      if (!isCurrent() || request.signal.aborted) return
      if (!isExactRecovery(result, intent)) {
        setRecoveryState('unknown')
        setRecoveryError('创建结果与原请求不一致，请使用原命令键查证。')
        void verifyRecovery(intent)
        return
      }
      removeRecovery(intent.commandId)
      navigate('/process-definitions/drafts/' + encodeURIComponent(result.draftId))
    } catch (failure) {
      if (!isCurrent() || request.signal.aborted) return
      if (failure instanceof ApiError && CREATE_REJECTIONS[failure.status] === failure.code) {
        removeRecovery(intent.commandId)
        setRecovery(null)
        setRecoveryState(undefined)
        setFormError('无法创建此草稿。请检查流程标识、标题和发布版本权限后重试。')
      } else {
        void verifyRecovery(intent)
      }
    } finally {
      if (createController.current === request) createController.current = null
    }
  }

  const applyFilters = () => {
    if (filterDefinition && !DEFINITION_KEY.test(filterDefinition)) {
      setFilterError('请输入有效的流程定义标识。')
      return
    }
    setFilterError(undefined)
    setFilters({definitionKey: filterDefinition || undefined, state: filterState})
    setPreviousCursors([])
    setPageCursor(undefined)
    setDraftPage(undefined)
    setLoading(true)
    setListFailure(false)
  }

  const goNext = () => {
    const next = draftPage?.nextCursor
    if (!next || loading) return
    setPreviousCursors(cursors => [...cursors, pageCursor])
    setPageCursor(next)
    setLoading(true)
    setDraftPage(undefined)
  }

  const goPrevious = () => {
    if (!previousCursors.length || loading) return
    const previous = previousCursors[previousCursors.length - 1]
    setPreviousCursors(cursors => cursors.slice(0, -1))
    setPageCursor(previous)
    setDraftPage(undefined)
    setLoading(true)
  }

  const columns: TableColumnsType<DraftSummaryDTO> = useMemo(() => [
    {title: '草稿名称', key: 'title', render: (_, draft) =>
      <Link to={'/process-definitions/drafts/' + encodeURIComponent(draft.draftId)}>{draft.title}</Link>},
    {title: '流程定义', dataIndex: 'definitionKey'},
    {title: '状态', key: 'state', render: (_, draft) => <Tag>{draft.state}</Tag>},
    {title: '修订', dataIndex: 'revision'},
    {title: '创建时间（UTC）', key: 'createdAt', render: (_, draft) => <time dateTime={draft.createdAt}>{draft.createdAt}</time>},
    {title: '发布版本', key: 'publishedReleaseVersion', render: (_, draft) => draft.publishedReleaseVersion ?? '—'},
  ], [])

  if (!canView) return <Alert type="warning" showIcon message="当前身份不能访问草稿工作区。" />
  if (!isWorkspace) return null

  return <section aria-labelledby={embedded ? undefined : 'process-definition-workspace-heading'} aria-label={embedded ? '流程设计' : undefined} className="page-stack">
    <header className="page-heading">
      {!embedded && (
        <div>
          <Typography.Title level={2} id="process-definition-workspace-heading">流程设计</Typography.Title>
          <Typography.Text type="secondary">查看和恢复当前身份创建的流程草稿。</Typography.Text>
        </div>
      )}
      <Space>
        {isNew && <Button onClick={() => { setLoading(true); navigate('/process-definitions') }}>返回工作区</Button>}
        {!isNew && canCreate && <Button type="primary" onClick={() => navigate('/process-definitions/new')}>新建草稿</Button>}
      </Space>
    </header>

    {storageError && <Alert type="error" showIcon message="无法安全保存本次创建请求，请检查浏览器会话存储设置。" />}
    {recovery && <Alert type={recoveryState === 'unknown' ? 'warning' : 'info'} showIcon
      message={recoveryState === 'dispatching' ? '正在创建草稿'
        : recoveryState === 'checking' ? '正在查证创建结果' : '创建结果尚未确认'}
      description={<Space orientation="vertical" size="small">
        <span>{recoveryError ?? (recoveryState === 'unknown'
          ? '创建结果仍未知。请使用原创建命令查证结果，系统不会再次提交创建请求。'
          : '正在使用原命令键核对服务器记录。')}</span>
        {recoveryState === 'unknown' && <Button onClick={() => void verifyRecovery(recovery)}>
          查证创建结果
        </Button>}
      </Space>} />}

    {copyFrom && isNew && canCopy && <Alert type="info" showIcon
      message="已选择发布版作为草稿来源"
      description={`${copyFrom.definitionKey} · ${copyFrom.releaseVersion}。提交后服务器会从此精确发布版创建草稿。`} />}

    {canStart && !isNew && <section aria-labelledby="technical-start-heading" className="surface-card">
      <Typography.Title level={3} id="technical-start-heading">技术启动</Typography.Title>
      <Typography.Text type="secondary">
        输入已知流程定义、业务标识、关联标识和类型化 JSON。服务器选择当前已生效发布版。
      </Typography.Text>
      {startPointer && <Alert type={startState === 'unknown' ? 'warning' : 'info'} showIcon
        message={startState === 'checking' ? '正在查证原 START 回执'
          : startState === 'sending' ? '正在提交 START'
            : startState === 'unknown' ? '启动结果尚未确认' : '原 START 已保留待核对'}
        description={<Space orientation="vertical" size="small">
          <span>{startError ?? (pendingStartBody
            ? '原始请求仍在本页内存。请重放同一请求或查证 APPLIED 回执。'
            : '刷新后不再保留业务正文，只能查证原命令的 APPLIED 回执。')}</span>
          <Space wrap>
            <Button disabled={startState === 'checking' || startState === 'sending'}
              onClick={() => void verifyStartReceipt(startPointer)}>查证原 START 回执</Button>
            {pendingStartBody && <Button disabled={startState === 'checking' || startState === 'sending'}
              onClick={() => void transmitStart(startPointer, pendingStartBody)}>重放原 START 请求</Button>}
          </Space>
        </Space>} />}
      {started && !startPointer && <Alert type="success" showIcon
        message="流程实例已启动"
        description={<Space orientation="vertical">
          <span>{started.releaseVersion} · 生效修订 {started.activationRevision}</span>
          <Link to={'/process-instances/' + encodeURIComponent(started.instanceId)}>打开已启动实例</Link>
        </Space>} />}
      {startFormError && <Alert type="error" showIcon message={startFormError} />}
      {startState === 'preparing' && <Typography.Text role="status" type="secondary">
        正在计算请求摘要并安全保存原命令指针…
      </Typography.Text>}
      <Space orientation="vertical" size="middle" className="full-width">
        <label htmlFor="start-definition-key">启动定义标识</label>
        <Input id="start-definition-key" autoComplete="off" maxLength={128} value={startDefinitionKey}
          disabled={!!startPointer || !startPointerReady || storageError}
          onChange={event => setStartDefinitionKey(event.target.value)} />
        <label htmlFor="start-business-key">业务标识</label>
        <Input id="start-business-key" autoComplete="off" maxLength={255} value={startBusinessKey}
          disabled={!!startPointer || !startPointerReady || storageError}
          onChange={event => setStartBusinessKey(event.target.value)} />
        <label htmlFor="start-correlation-id">关联标识</label>
        <Input id="start-correlation-id" autoComplete="off" maxLength={128} value={startCorrelationId}
          disabled={!!startPointer || !startPointerReady || storageError}
          onChange={event => setStartCorrelationId(event.target.value)} />
        <label htmlFor="start-variables-json">启动变量 JSON</label>
        <Input.TextArea id="start-variables-json" aria-label="启动变量 JSON" rows={6}
          className="process-editor-source" spellCheck={false} value={startVariablesSource}
          disabled={!!startPointer || !startPointerReady || storageError}
          onChange={event => setStartVariablesSource(event.target.value)} />
        <label htmlFor="start-overrides-json">Agent 节点覆盖 JSON（可选）</label>
        <Input.TextArea id="start-overrides-json" aria-label="Agent 节点覆盖 JSON（可选）" rows={4}
          className="process-editor-source" spellCheck={false} value={startOverridesSource}
          disabled={!!startPointer || !startPointerReady || storageError}
          onChange={event => setStartOverridesSource(event.target.value)} />
        <Button type="primary" aria-label="技术启动" loading={startState === 'preparing' || startState === 'sending'}
          disabled={!startPointerReady || storageError || !!startPointer || startState !== undefined}
          onClick={() => void submitStart()}>技术启动</Button>
      </Space>
    </section>}

    {isNew ? recovery ? null : <section aria-labelledby="new-draft-heading">
      <Typography.Title level={3} id="new-draft-heading">新建草稿</Typography.Title>
      <div className="surface-card">
        <Space orientation="vertical" size="middle" className="full-width">
          <label htmlFor="draft-definition-key">流程定义标识</label>
          <Input id="draft-definition-key" autoComplete="off" maxLength={128} value={definitionInput}
            onChange={event => setDefinitionInput(event.target.value)} disabled={!!recovery || !canCreate} />
          <label htmlFor="draft-title">草稿标题</label>
          <Input id="draft-title" autoComplete="off" maxLength={256} value={title}
            onChange={event => setTitle(event.target.value)} disabled={!!recovery || !canCreate} />
          {canCopy && <>
            <label htmlFor="draft-base-release">复制自发布版本（可选）</label>
            <Input id="draft-base-release" autoComplete="off" maxLength={128} value={baseReleaseVersion}
              onChange={event => setBaseReleaseVersion(event.target.value)} disabled={!!recovery} />
          </>}
          {formError && <Alert type="error" showIcon message={formError} />}
          <Space wrap>
            {canCreate && <Button type="primary" onClick={() => void submitCreate(false)}
              disabled={!storageReady || storageError || !!recovery || recoveryState !== undefined}>
              创建空稿
            </Button>}
            {canCopy && <Button onClick={() => void submitCreate(true)}
              disabled={!storageReady || storageError || !!recovery || recoveryState !== undefined}>
              复制为草稿
            </Button>}
          </Space>
        </Space>
      </div>
    </section> : <>
      {filterError && <Alert type="error" showIcon message={filterError} />}
      <WorkspaceList
        ariaLabel="流程草稿列表"
        filters={(
          <Space wrap align="end">
            <label htmlFor="draft-filter-definition">流程定义</label>
            <Input id="draft-filter-definition" autoComplete="off" maxLength={128} value={filterDefinition}
              onChange={event => setFilterDefinition(event.target.value)} />
            <label htmlFor="draft-filter-state">状态</label>
            <Select id="draft-filter-state" aria-label="状态" value={filterState} style={{minWidth: 150}}
              options={STATES.map(state => ({value: state, label: state}))}
              onChange={(state: DraftState) => setFilterState(state)} />
            <Button aria-label="筛选" onClick={applyFilters}>应用筛选</Button>
          </Space>
        )}
        pageState={{
          loading,
          error: listFailure ? new Error('暂时无法读取草稿列表。') : null,
          empty: !loading && !listFailure && draftPage?.items.length === 0,
          emptyDescription: '还没有草稿',
          onRetry: () => {
            setDraftPage(undefined)
            setPageCursor(undefined)
            setPreviousCursors([])
            setListFailure(false)
            setLoading(true)
            setFilters(current => ({...current}))
          },
        }}
        table={(
          <Table<DraftSummaryDTO> rowKey="draftId" dataSource={draftPage?.items ? [...draftPage.items] : []} columns={columns} pagination={false}
            scroll={{x: 760}} />
        )}
        pagination={
          draftPage && (previousCursors.length > 0 || draftPage.nextCursor !== null)
            ? {
                mode: 'cursor',
                hasMore: draftPage.nextCursor !== null,
                hasPrevious: previousCursors.length > 0,
                loadingMore: loading,
                onNext: goNext,
                onPrevious: goPrevious,
              }
            : undefined
        }
      />
    </>}
  </section>
}

export default function ProcessDefinitionWorkspacePage() {
  const {status, authorization: current, allows} = useAuth()
  const location = useLocation()
  if (status !== 'ready' && status !== 'forbidden' || !current || !isCanonicalTenant(current.identity.tenantId)) {
    return <Alert type="warning" showIcon message="当前身份不能访问草稿工作区。" />
  }
  const {identity, binding} = current
  const canView = status === 'ready' && allows(PAGE)
  const canCreate = canView && allows(CREATE)
  const canCopy = canView && allows(COPY)
  const canStart = canView && allows(START_ACTION)
    && current.snapshot.permissionCodes.includes(PROCESS_READ_CODE)
    && current.snapshot.permissionCodes.includes(PROCESS_START_CODE)
  const key = JSON.stringify([identity.issuer, identity.subject, identity.tenantId, binding.requestEpoch, canView, location.pathname])
  return <OwnerDraftWorkspace key={key} tenant={identity.tenantId} issuer={identity.issuer} subject={identity.subject}
    epoch={binding.requestEpoch} canView={canView} canCreate={canCreate} canCopy={canCopy} startEnabled={canStart} />
}
