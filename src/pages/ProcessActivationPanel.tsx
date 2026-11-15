import {ApiError} from '@stellar-enclosure/stellar-enclosure-web-shared'
import {allowsSnapshotRequirement} from '@stellar-enclosure/stellar-enclosure-web-shared/permissions'
import {Alert, Button, Descriptions, Empty, Modal, Space, Table, Tag, Typography, type TableColumnsType} from 'antd'
import {useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState} from 'react'
import {isProcessReleaseVersion} from '../api/processReleases'
import {processActivationsApi, type ActivationCommand, type ActivationPageDTO,
  type AutomationActivationDTO} from '../api/processActivations'
import {gatewayAuth} from '../auth/gatewayAuth'
import {useAuth} from '../auth/AuthContext'

const ACTIVATE_BUTTON = 'tianji.button.processActivation.activate'
const READ_REQUIREMENT = {mode: 'ALL', codes: ['TIANJI_PROCESS_RELEASE_READ']} as const
const ACTIVATE_REQUIREMENT = {
  mode: 'ALL', codes: ['TIANJI_PROCESS_RELEASE_READ', 'TIANJI_PROCESS_RELEASE_ACTIVATE'],
} as const
const STORAGE_PREFIX = 'tianji.process-activation.v1'
const KNOWN_REJECTIONS = new Set(['TIANJI_PROCESS_VERSION_CONFLICT', 'TIANJI_PROCESS_ACTIVATION_CONFLICT'])
const MAX_REVISION = 999_999_999_999_999
const displayTime = new Intl.DateTimeFormat('zh-CN', {
  timeZone: 'Asia/Shanghai', dateStyle: 'short', timeStyle: 'medium', hourCycle: 'h23',
})

type ActivationIntent = Readonly<{
  version: 1
  operation: 'ACTIVATE'
  actorFingerprint: string
  tenantId: string
  definitionKey: string
  releaseVersion: string
  expectedActivationRevision: number
  commandId: string
}>

type ReadState =
  | Readonly<{phase: 'loading'}>
  | Readonly<{phase: 'unavailable'; message: string}>
  | Readonly<{phase: 'denied'; message: string}>
  | Readonly<{phase: 'loaded'; page: ActivationPageDTO}>

type IntentState = 'checking' | 'sending' | 'unknown'
type Confirmation = Readonly<{releaseVersion: string; expectedActivationRevision: number}>

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function decodeIntent(value: unknown, tenantId: string, definitionKey: string, actorFingerprint: string): ActivationIntent | null {
  if (!isRecord(value) || Object.keys(value).length !== 8
      || value.version !== 1 || value.operation !== 'ACTIVATE'
      || value.actorFingerprint !== actorFingerprint || value.tenantId !== tenantId
      || value.definitionKey !== definitionKey
      || !isProcessReleaseVersion(value.releaseVersion)
      || typeof value.expectedActivationRevision !== 'number'
      || !Number.isSafeInteger(value.expectedActivationRevision) || value.expectedActivationRevision < 0
      || value.expectedActivationRevision > MAX_REVISION
      || typeof value.commandId !== 'string' || !/^[A-Za-z][A-Za-z0-9_.:-]{0,127}(?![\s\S])/.test(value.commandId)) return null
  return value as ActivationIntent
}

async function ownerFingerprint(issuer: string, subject: string): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(['TIANJI_PROCESS_ACTIVATION_OWNER_V1', issuer, subject]))
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
}

function storageKey(tenantId: string, definitionKey: string): string {
  return STORAGE_PREFIX + ':' + encodeURIComponent(tenantId) + ':' + encodeURIComponent(definitionKey)
}

function isDenied(failure: unknown): boolean {
  return failure instanceof ApiError && ([401, 403, 404].includes(failure.status)
    || failure.status === 409 && failure.code === 'TIANJI_TENANT_CONTEXT_CHANGED')
}

function ActivationTime({value}: {value: string}) {
  return <time dateTime={value} title={value}>{displayTime.format(new Date(value))}</time>
}

export type ProcessActivationPanelProps = Readonly<{
  definitionKey: string
  releaseVersion: string
  baseReleaseVersion?: string | null
}>

export function ProcessActivationPanel({definitionKey, releaseVersion, baseReleaseVersion}: ProcessActivationPanelProps) {
  const {status, authorization, allows} = useAuth()
  const canRead = status === 'ready' && !!authorization
    && allowsSnapshotRequirement(authorization.snapshot, authorization.binding, READ_REQUIREMENT)
  if (!canRead || !authorization) {
    return <section aria-label="流程生效状态">
      <Alert type="warning" showIcon title="当前无法查看流程生效状态。" />
    </section>
  }
  const {identity, binding} = authorization
  const permissionGrant = allowsSnapshotRequirement(authorization.snapshot, authorization.binding, ACTIVATE_REQUIREMENT)
  const canActivate = permissionGrant && allows(ACTIVATE_BUTTON)
  const ownerScope = JSON.stringify([identity.issuer, identity.subject, identity.tenantId, binding.requestEpoch, definitionKey])
  return <ActivationObservation key={ownerScope} tenantId={identity.tenantId} issuer={identity.issuer}
    subject={identity.subject} epoch={binding.requestEpoch} definitionKey={definitionKey} releaseVersion={releaseVersion}
    baseReleaseVersion={baseReleaseVersion ?? null} canActivate={canActivate} />
}

export default ProcessActivationPanel

function ActivationObservation({tenantId, issuer, subject, epoch, definitionKey, releaseVersion, baseReleaseVersion,
                                canActivate}: {
  tenantId: string
  issuer: string
  subject: string
  epoch: number
  definitionKey: string
  releaseVersion: string
  baseReleaseVersion: string | null
  canActivate: boolean
}) {
  const {allows} = useAuth()
  const storeKey = storageKey(tenantId, definitionKey)
  const [actorHash, setActorHash] = useState<string>()
  const [readState, setReadState] = useState<ReadState>({phase: 'loading'})
  const [intent, setIntent] = useState<ActivationIntent>()
  const [intentState, setIntentState] = useState<IntentState>()
  const [commandReceipt, setCommandReceipt] = useState<AutomationActivationDTO>()
  const [storageReady, setStorageReady] = useState(false)
  const [storageError, setStorageError] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [confirmation, setConfirmation] = useState<Confirmation>()
  const [posting, setPosting] = useState(false)
  const [writeError, setWriteError] = useState<string>()
  const [historyPage, setHistoryPage] = useState<ActivationPageDTO>()
  const [historyCursor, setHistoryCursor] = useState<string>()
  const alive = useRef(false)
  const inFlight = useRef(false)
  const readController = useRef<AbortController | null>(null)
  const commandController = useRef<AbortController | null>(null)
  const sequence = useRef(0)
  const currentAllows = useRef(allows)

  const isCurrent = useCallback((request?: AbortController, serial?: number) => alive.current
    && gatewayAuth.context.epoch === epoch
    && (request === undefined || !request.signal.aborted)
    && (serial === undefined || serial === sequence.current), [epoch])

  const canMutateNow = useCallback(() => canActivate && currentAllows.current(ACTIVATE_BUTTON)
    && gatewayAuth.context.epoch === epoch, [canActivate, epoch])

  useLayoutEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
      sequence.current += 1
      readController.current?.abort()
      commandController.current?.abort()
      readController.current = null
      commandController.current = null
    }
  }, [])

  useLayoutEffect(() => { currentAllows.current = allows }, [allows])

  const clearIntent = useCallback((commandId: string, fingerprint: string) => {
    try {
      const raw = sessionStorage.getItem(storeKey)
      if (!raw) return
      const value: unknown = JSON.parse(raw)
      if (isRecord(value) && value.commandId === commandId && value.tenantId === tenantId
          && value.definitionKey === definitionKey && value.actorFingerprint === fingerprint) {
        sessionStorage.removeItem(storeKey)
      }
    } catch {
      setStorageError(true)
    }
  }, [definitionKey, storeKey, tenantId])

  const applyCommandPage = useCallback((page: ActivationPageDTO, pending: ActivationIntent, fingerprint: string) => {
    setReadState({phase: 'loaded', page})
    const receipt = page.items.find(item => item.commandId === pending.commandId)
    if (!receipt) return 'missing'
    if (receipt.releaseVersion !== pending.releaseVersion
        || receipt.expectedActivationRevision !== pending.expectedActivationRevision) {
      setWriteError('原命令回执与已保存的生效意图不一致，仍需核查。')
      return 'mismatch'
    }
    setCommandReceipt(receipt)
    clearIntent(pending.commandId, fingerprint)
    setIntent(undefined)
    setIntentState(undefined)
    setWriteError(undefined)
    return 'applied'
  }, [clearIntent])

  const readCurrent = useCallback(async (cursor?: string) => {
    if (!isCurrent()) return
    readController.current?.abort()
    const request = new AbortController()
    const serial = ++sequence.current
    readController.current = request
    setReadState({phase: 'loading'})
    try {
      const query = cursor === undefined ? {limit: 20} : {limit: 20, cursor}
      let page: ActivationPageDTO
      try {
        page = await processActivationsApi.list(tenantId, definitionKey, query, request.signal)
      } catch (failure) {
        if (!cursor || !isCurrent(request, serial) || !(failure instanceof ApiError) || failure.status !== 400) throw failure
        page = await processActivationsApi.list(tenantId, definitionKey, {limit: 20}, request.signal)
        cursor = undefined
      }
      if (!isCurrent(request, serial)) return
      setReadState({phase: 'loaded', page})
      setHistoryPage(page)
      setHistoryCursor(cursor)
    } catch (failure) {
      if (!isCurrent(request, serial)) return
      setReadState(isDenied(failure)
        ? {phase: 'denied', message: '当前无法查看流程生效记录。'}
        : {phase: 'unavailable', message: '暂时无法读取当前生效版本。'})
    } finally {
      if (readController.current === request) readController.current = null
    }
  }, [definitionKey, isCurrent, tenantId])

  const lookupCommand = useCallback(async (pending: ActivationIntent, fingerprint: string) => {
    if (!isCurrent() || pending.actorFingerprint !== fingerprint || pending.tenantId !== tenantId
        || pending.definitionKey !== definitionKey) return
    readController.current?.abort()
    const request = new AbortController()
    const serial = ++sequence.current
    readController.current = request
    setIntentState('checking')
    setWriteError(undefined)
    try {
      const page = await processActivationsApi.list(tenantId, definitionKey,
        {commandId: pending.commandId}, request.signal)
      if (!isCurrent(request, serial)) return
      const result = applyCommandPage(page, pending, fingerprint)
      if (result !== 'applied') {
        setIntentState('unknown')
        if (result === 'missing') setWriteError('原生效命令尚无可见回执。可以再次查证，或用同一命令重试。')
      }
    } catch (failure) {
      if (!isCurrent(request, serial)) return
      setReadState(isDenied(failure)
        ? {phase: 'denied', message: '当前无法查看流程生效记录。'}
        : {phase: 'unavailable', message: '暂时无法确认原生效命令。'})
      setIntentState('unknown')
      setWriteError('原命令仍待确认。查询失败没有改变原命令。')
    } finally {
      if (readController.current === request) readController.current = null
    }
  }, [applyCommandPage, definitionKey, isCurrent, tenantId])

  useEffect(() => {
    let active = true
    void ownerFingerprint(issuer, subject).then(fingerprint => {
      if (!active || !isCurrent()) return
      setActorHash(fingerprint)
      try {
        const raw = sessionStorage.getItem(storeKey)
        if (raw) {
          const decoded = decodeIntent(JSON.parse(raw) as unknown, tenantId, definitionKey, fingerprint)
          if (decoded) {
            setIntent(decoded)
            setIntentState('checking')
            void lookupCommand(decoded, fingerprint)
            setStorageReady(true)
            return
          }
          sessionStorage.removeItem(storeKey)
        }
        setStorageReady(true)
        void readCurrent()
      } catch {
        setStorageError(true)
        setStorageReady(true)
        void readCurrent()
      }
    }).catch(() => {
      if (!active || !isCurrent()) return
      setStorageError(true)
      setStorageReady(true)
      void readCurrent()
    })
    return () => { active = false }
  }, [definitionKey, isCurrent, issuer, lookupCommand, readCurrent, storeKey, subject, tenantId])

  const sendActivation = async (pending: ActivationIntent, fingerprint: string) => {
    if (!alive.current || !canMutateNow() || !isCurrent() || inFlight.current
        || pending.actorFingerprint !== fingerprint || pending.tenantId !== tenantId
        || pending.definitionKey !== definitionKey) return
    inFlight.current = true
    setPosting(true)
    setIntent(pending)
    setIntentState('sending')
    setWriteError(undefined)
    setDialogOpen(false)
    const request = new AbortController()
    commandController.current = request
    const command: ActivationCommand = {
      releaseVersion: pending.releaseVersion,
      expectedActivationRevision: pending.expectedActivationRevision,
      commandId: pending.commandId,
    }
    try {
      const receipt = await processActivationsApi.activate(tenantId, definitionKey, command, request.signal)
      if (!isCurrent(request)) return
      clearIntent(pending.commandId, fingerprint)
      setIntent(undefined)
      setIntentState(undefined)
      setCommandReceipt(receipt)
      setWriteError(undefined)
      void readCurrent()
    } catch (failure) {
      if (!isCurrent(request)) return
      if (failure instanceof ApiError && failure.status === 409 && KNOWN_REJECTIONS.has(failure.code)) {
        // The write endpoint reports a known CAS conflict only after checking
        // the idempotency receipt. Query that same command before deciding.
        setIntent(pending)
        setIntentState('checking')
        setWriteError('当前生效版本已变化，正在查证原命令。')
        const serial = ++sequence.current
        try {
          const page = await processActivationsApi.list(tenantId, definitionKey,
            {commandId: pending.commandId}, request.signal)
          if (!isCurrent(request, serial)) return
          const result = applyCommandPage(page, pending, fingerprint)
          if (result === 'applied') return
          if (result === 'mismatch') {
            setIntentState('unknown')
            return
          }
          clearIntent(pending.commandId, fingerprint)
          setIntent(undefined)
          setIntentState(undefined)
          setReadState({phase: 'loaded', page})
          setWriteError('当前生效版本已变化。已重新读取当前状态，请再次确认后使用新命令。')
        } catch (lookupFailure) {
          if (!isCurrent(request)) return
          setIntentState('unknown')
          setReadState(isDenied(lookupFailure)
            ? {phase: 'denied', message: '当前无法查看流程生效记录。'}
            : {phase: 'unavailable', message: '暂时无法读取当前生效版本。'})
          setWriteError('冲突后原命令仍待确认。请保留并查证原命令。')
        }
      } else {
        setIntent(pending)
        setIntentState('unknown')
        setWriteError('生效结果尚未确认。请查证原命令，不要创建第二条生效命令。')
        try {
          const page = await processActivationsApi.list(tenantId, definitionKey,
            {commandId: pending.commandId}, request.signal)
          if (!isCurrent(request)) return
          const result = applyCommandPage(page, pending, fingerprint)
          if (result !== 'applied') {
            setIntent(pending)
            setIntentState('unknown')
            if (result === 'missing') setWriteError('原命令尚无回执。可以查证或使用同一命令重试。')
          }
        } catch {
          if (!isCurrent(request)) return
          setIntentState('unknown')
        }
      }
    } finally {
      if (commandController.current === request) commandController.current = null
      inFlight.current = false
      if (isCurrent()) setPosting(false)
    }
  }

  const confirmNew = (confirmed: Confirmation) => {
    if (!canMutateNow() || !isCurrent() || inFlight.current || !actorHash || !storageReady || storageError
        || intent || readState.phase !== 'loaded' || !globalThis.crypto?.randomUUID) return
    const currentRevision = readState.page.current?.revision ?? 0
    if (confirmed.releaseVersion !== releaseVersion || confirmed.expectedActivationRevision !== currentRevision) {
      setDialogOpen(false)
      setWriteError('当前生效版本或目标发布已变化。请重新读取并再次确认。')
      return
    }
    const pending: ActivationIntent = {
      version: 1,
      operation: 'ACTIVATE',
      actorFingerprint: actorHash,
      tenantId,
      definitionKey,
      releaseVersion: confirmed.releaseVersion,
      expectedActivationRevision: confirmed.expectedActivationRevision,
      commandId: 'activate-' + globalThis.crypto.randomUUID(),
    }
    try {
      sessionStorage.setItem(storeKey, JSON.stringify(pending))
    } catch {
      setStorageError(true)
      setWriteError('无法安全保留生效命令。没有发送生效请求。')
      return
    }
    setIntent(pending)
    void sendActivation(pending, actorHash)
  }

  const openConfirmation = () => {
    if (!canMutateNow() || !mutationAllowed || readState.phase !== 'loaded') return
    setWriteError(undefined)
    setConfirmation({
      releaseVersion,
      expectedActivationRevision: readState.page.current?.revision ?? 0,
    })
    setDialogOpen(true)
  }

  const confirmationIsCurrent = confirmation !== undefined && readState.phase === 'loaded'
    && confirmation.releaseVersion === releaseVersion
    && confirmation.expectedActivationRevision === (readState.page.current?.revision ?? 0)

  const retryOriginal = () => {
    if (intent && intentState === 'unknown' && actorHash && canActivate) {
      void sendActivation(intent, actorHash)
    }
  }

  const checkOriginal = () => {
    if (intent && actorHash) void lookupCommand(intent, actorHash)
  }

  const page = readState.phase === 'loaded' ? readState.page : undefined
  const current = page?.current ?? null
  const mutationAllowed = canActivate && isProcessReleaseVersion(releaseVersion)
    && storageReady && !storageError && !intent && !posting
    && page !== undefined && page.definitionKey === definitionKey
    && (current === null || current.revision < MAX_REVISION)
  const baseDiffersFromCurrent = baseReleaseVersion !== null && current !== null
    && baseReleaseVersion !== current.releaseVersion

  const visibleHistory = page && (historyPage ?? page)
  const columns: TableColumnsType<AutomationActivationDTO> = useMemo(() => [
    {title: '生效修订', dataIndex: 'revision', key: 'revision', render: (value: number) => '修订 ' + value},
    {title: '发布版本', dataIndex: 'releaseVersion', key: 'releaseVersion'},
    {title: '命令时间（上海）', dataIndex: 'activatedAt', key: 'activatedAt',
      render: (value: string) => <ActivationTime value={value} />},
    {title: '命令', dataIndex: 'commandId', key: 'commandId', render: (value: string) => <Typography.Text code>{value}</Typography.Text>},
  ], [])

  return <section aria-labelledby="process-activation-title" className="page-stack">
    <header className="page-heading">
      <div>
        <Typography.Title level={3} id="process-activation-title">流程生效状态</Typography.Title>
        <Typography.Text type="secondary">发布版本与当前生效版本分别确认。</Typography.Text>
      </div>
      <Space wrap>
        {canActivate && <Button type="primary" onClick={openConfirmation} disabled={!mutationAllowed}>
          设为生效
        </Button>}
        <Button onClick={() => { void readCurrent() }}
          disabled={readState.phase === 'loading' || intentState === 'checking' || posting}>
          重新读取
        </Button>
      </Space>
    </header>

    <Descriptions size="small" bordered column={{xs: 1, sm: 2}}>
      <Descriptions.Item label="已发布版本">{releaseVersion}</Descriptions.Item>
      <Descriptions.Item label="待生效发布版本">{releaseVersion}</Descriptions.Item>
      <Descriptions.Item label="当前生效版本">{current ? current.releaseVersion : page ? '尚无生效修订' : '尚未确认'}</Descriptions.Item>
      {current && <Descriptions.Item label="当前生效修订">修订 {current.revision}</Descriptions.Item>}
      {current && <Descriptions.Item label="生效时间（上海）"><ActivationTime value={current.activatedAt} /></Descriptions.Item>}
    </Descriptions>

    {baseDiffersFromCurrent && <Alert type="warning" showIcon
      message="当前生效版本与此草稿的来源版本不同。请确认切换影响。" />}
    {readState.phase === 'loading' && <div role="status">正在读取当前生效状态</div>}
    {readState.phase === 'denied' && <Alert type="warning" showIcon title={readState.message} />}
    {readState.phase === 'unavailable' && <Alert type="warning" showIcon title={readState.message} />}
    {readState.phase === 'loaded' && !current && page?.items.length === 0
      && <Alert type="info" showIcon title="当前未生效" description="尚无可见的流程生效修订。" />}
    {writeError && <Alert type={intentState ? 'warning' : 'error'} showIcon title={writeError} />}
    {intent && intentState === 'checking' && <div role="status">正在查证原生效命令</div>}
    {intent && intentState === 'sending' && <div role="status">正在提交原生效命令</div>}
    {intent && intentState === 'unknown' && <Alert type="warning" showIcon title="生效结果尚未确认"
      description={<Space wrap>
        <Button onClick={checkOriginal} disabled={posting || readState.phase === 'loading'}>查证原命令</Button>
        <Button onClick={retryOriginal} disabled={!canActivate || posting || readState.phase === 'loading'}>用同一命令重试</Button>
      </Space>} />}
    {commandReceipt && <Alert type="success" showIcon title="此命令已生效"
      description={<Space wrap><span>命令生效版本</span><Tag>{commandReceipt.releaseVersion}</Tag>
        <span>修订 {commandReceipt.revision}</span></Space>} />}

    {visibleHistory?.items.length ? <Table<AutomationActivationDTO> rowKey="commandId" columns={columns}
      dataSource={[...visibleHistory.items]} pagination={false} scroll={{x: 720}} />
      : visibleHistory && <Empty description="暂无可见的生效历史记录" />}
    {visibleHistory && (historyCursor || visibleHistory.nextCursor) && <Space wrap>
      {historyCursor && <Button disabled={posting || intentState === 'checking'} onClick={() => { void readCurrent() }}>历史首页</Button>}
      {visibleHistory.nextCursor && <Button disabled={posting || intentState === 'checking'}
        onClick={() => { void readCurrent(visibleHistory.nextCursor ?? undefined) }}>更多生效历史</Button>}
    </Space>}

    <Modal title="确认设为当前生效版本" open={dialogOpen} okText="确认生效" cancelText="返回"
      confirmLoading={posting} destroyOnHidden onCancel={() => setDialogOpen(false)}
      okButtonProps={{disabled: !mutationAllowed || !confirmationIsCurrent}} onOk={() => {
        if (!confirmation || !confirmationIsCurrent) {
          setDialogOpen(false)
          setWriteError('当前生效版本或目标发布已变化。请重新读取并再次确认。')
          return
        }
        confirmNew(confirmation)
      }}>
      {page && <Space orientation="vertical" className="full-width">
        <Typography.Text>目标发布版本：{confirmation?.releaseVersion ?? releaseVersion}</Typography.Text>
        <Typography.Text>确认时的当前生效修订：{confirmation?.expectedActivationRevision ?? current?.revision ?? 0}</Typography.Text>
        {baseDiffersFromCurrent && <Alert type="warning" showIcon
          message="当前生效版本已与此稿来源版本不同。确认后会替换当前指针。" />}
      </Space>}
      {!confirmationIsCurrent && <Alert type="warning" showIcon title="当前生效版本或目标已变化，请返回并重新确认。" />}
    </Modal>
  </section>
}
