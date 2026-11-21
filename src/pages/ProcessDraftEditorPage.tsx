import {
  ApiError,
  useEmbeddedWorkbench,
  useWorkbenchLeaveGuard,
} from '@stellar-enclosure/stellar-enclosure-web-shared'
import {Alert, Button, Checkbox, Descriptions, Divider, Empty, Input, Modal, Select, Space, Spin, Tag, Typography} from 'antd'
import {useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState} from 'react'
import {useBlocker, useBeforeUnload, useNavigate, useParams} from 'react-router-dom'
import {prepareDraftSave, processDraftsApi, type DraftCommandReceiptDTO, type DraftContentVO,
  type DraftValidationResultDTO, type PreparedDraftSave,
  type ProcessDraftDTO, type PublishProcessDraftCommand, type SaveProcessDraftCommand} from '../api/processDrafts'
import {isCanonicalTenant} from '../api/client'
import {isProcessReleaseVersion} from '../api/processReleases'
import {ProcessGraph} from '../components/process/ProcessGraph'
import {ProcessGraphList} from '../components/process/ProcessGraphList'
import {gatewayAuth} from '../auth/gatewayAuth'
import {useAuth} from '../auth/AuthContext'
import {ProcessActivationPanel} from './ProcessActivationPanel'

const PAGE = 'tianji.page.processDraftEditor'
const SAVE_ACTION = 'tianji.button.processDraftEditor.save'
const VALIDATE_ACTION = 'tianji.button.processDraftEditor.validate'
const PUBLISH_ACTION = 'tianji.button.processDraftEditor.publish'
const DISCARD_ACTION = 'tianji.button.processDraftEditor.discard'
const RECOVERY_PREFIX = 'tianji.process-draft-editor.v1'
const COMMAND_ID = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}(?![\s\S])/
const SHA256 = /^[a-f0-9]{64}(?![\s\S])/
const KNOWN_CONFLICTS = new Set(['TIANJI_DRAFT_VERSION_CONFLICT', 'TIANJI_DRAFT_STATE_CONFLICT'])

type Operation = 'SAVE' | 'PUBLISH' | 'DISCARD'
type RecoveryPointer = Readonly<{
  version: 1
  operation: Operation
  actorFingerprint: string
  tenantId: string
  draftId: string
  commandId: string
  expectedRevision: number
  expectedContentSha256: string
  releaseVersion: string | null
}>
type EditorBuffer = Readonly<{title: string; content: DraftContentVO}>
type EditorState = Readonly<{phase: 'loading'}>
  | Readonly<{phase: 'unavailable'; message: string}>
  | Readonly<{phase: 'loaded'; draft: ProcessDraftDTO}>
type MutationState = 'idle' | 'saving' | 'validating' | 'publishing' | 'discarding' | 'checking' | 'reading' | 'unknown'
type PendingBody = Readonly<{
  pointer: RecoveryPointer
  save?: SaveProcessDraftCommand
  publication?: PublishProcessDraftCommand
  discard?: Readonly<{commandId: string; expectedRevision: number}>
  bufferGeneration?: number
}>

const contentFields = [
  ['inputSchemaSource', '输入结构 JSON'],
  ['outputSchemaSource', '输出结构 JSON'],
  ['nodeBindingsSource', '节点绑定 JSON'],
  ['eventRoutesSource', '事件路由 JSON'],
] as const

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function decodePointer(value: unknown, tenantId: string, draftId: string, actorFingerprint: string): RecoveryPointer | null {
  if (!isRecord(value)) return null
  const fields = ['version', 'operation', 'actorFingerprint', 'tenantId', 'draftId', 'commandId',
    'expectedRevision', 'expectedContentSha256', 'releaseVersion']
  if (Object.keys(value).length !== fields.length || !fields.every(field => Object.hasOwn(value, field))
      || value.version !== 1 || !['SAVE', 'PUBLISH', 'DISCARD'].includes(String(value.operation))
      || value.actorFingerprint !== actorFingerprint || value.tenantId !== tenantId || value.draftId !== draftId
      || typeof value.commandId !== 'string' || !COMMAND_ID.test(value.commandId)
      || typeof value.expectedRevision !== 'number' || !Number.isSafeInteger(value.expectedRevision) || value.expectedRevision < 1
      || typeof value.expectedContentSha256 !== 'string' || !SHA256.test(value.expectedContentSha256)
      || !(value.releaseVersion === null || typeof value.releaseVersion === 'string' && isProcessReleaseVersion(value.releaseVersion))
      || (value.operation === 'PUBLISH') !== (value.releaseVersion !== null)) return null
  return value as RecoveryPointer
}

function recoveryKey(tenantId: string, draftId: string): string {
  return `${RECOVERY_PREFIX}:${encodeURIComponent(tenantId)}:${encodeURIComponent(draftId)}`
}

function randomCommandId(prefix: string): string {
  if (!globalThis.crypto?.randomUUID) throw new Error('当前环境无法创建安全命令标识')
  return `${prefix}-${globalThis.crypto.randomUUID()}`
}

async function ownerFingerprint(issuer: string, subject: string): Promise<string> {
  const source = new TextEncoder().encode(JSON.stringify(['TIANJI_PROCESS_DRAFT_OWNER_V1', issuer, subject]))
  const digest = await globalThis.crypto.subtle.digest('SHA-256', source)
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
}

function toBuffer(draft: ProcessDraftDTO): EditorBuffer {
  return {title: draft.title, content: {
    models: draft.content.models === null ? null : draft.content.models.map(model => ({...model})),
    inputSchemaSource: draft.content.inputSchemaSource,
    outputSchemaSource: draft.content.outputSchemaSource,
    nodeBindingsSource: draft.content.nodeBindingsSource,
    eventRoutesSource: draft.content.eventRoutesSource,
  }}
}

function bufferMatchesDraft(buffer: EditorBuffer, draft: ProcessDraftDTO): boolean {
  if (buffer.title !== draft.title) return false
  const left = buffer.content
  const right = draft.content
  if (left.inputSchemaSource !== right.inputSchemaSource || left.outputSchemaSource !== right.outputSchemaSource
      || left.nodeBindingsSource !== right.nodeBindingsSource || left.eventRoutesSource !== right.eventRoutesSource) return false
  if (left.models === null || right.models === null) return left.models === right.models
  return left.models.length === right.models.length && left.models.every((model, index) => {
    const other = right.models?.[index]
    return other !== undefined && model.type === other.type && model.definitionKey === other.definitionKey && model.xml === other.xml
  })
}

function commandReceiptMatches(receipt: DraftCommandReceiptDTO | null, pointer: RecoveryPointer): boolean {
  return receipt !== null && receipt.commandId === pointer.commandId && receipt.operation === pointer.operation
    && receipt.resultRevision === pointer.expectedRevision + 1
    && receipt.releaseVersion === pointer.releaseVersion
}

function commandLabel(operation: Operation): string {
  if (operation === 'SAVE') return '原暂存命令'
  if (operation === 'PUBLISH') return '原发布命令'
  return '原放弃命令'
}

export function ProcessDraftEditorPage() {
  const {draftId = ''} = useParams()
  const {status, authorization, allows} = useAuth()
  if (status !== 'ready' || !authorization || !isCanonicalTenant(authorization.identity.tenantId)
      || !allows(PAGE) || authorization.binding.requestEpoch !== gatewayAuth.context.epoch) {
    return <Alert type="warning" showIcon title="当前身份不能访问此草稿。" />
  }
  const {identity, binding} = authorization
  const ownerKey = JSON.stringify([identity.issuer, identity.subject, identity.tenantId, binding.requestEpoch, draftId])
  return <DraftEditor key={ownerKey} draftId={draftId} tenantId={identity.tenantId} issuer={identity.issuer}
    subject={identity.subject} epoch={binding.requestEpoch} />
}

function DraftEditor({draftId, tenantId, issuer, subject, epoch}: {
  draftId: string
  tenantId: string
  issuer: string
  subject: string
  epoch: number
}) {
  const {embedded, activeTabKey} = useEmbeddedWorkbench()
  const {allows} = useAuth()
  const navigate = useNavigate()
  const currentAllows = useRef(allows)
  const request = useRef<AbortController | null>(null)
  const alive = useRef(false)
  const inFlight = useRef(false)
  const allowNextNavigation = useRef(false)
  const sequence = useRef(0)
  const bufferGeneration = useRef(0)
  const savedRef = useRef<ProcessDraftDTO | undefined>(undefined)
  const pointerRef = useRef<RecoveryPointer | undefined>(undefined)
  const pendingBodyRef = useRef<PendingBody | undefined>(undefined)
  const [editorState, setEditorState] = useState<EditorState>({phase: 'loading'})
  const [buffer, setBuffer] = useState<EditorBuffer>()
  const [mutationState, setMutationState] = useState<MutationState>('idle')
  const [pending, setPending] = useState<RecoveryPointer>()
  const [validation, setValidation] = useState<DraftValidationResultDTO | undefined>(undefined)
  const [selectedNodeId, setSelectedNodeId] = useState<string | undefined>(undefined)
  const [message, setMessage] = useState<string | undefined>(undefined)
  const [formError, setFormError] = useState<string | undefined>(undefined)
  const [storageError, setStorageError] = useState(false)
  const [requiresReload, setRequiresReload] = useState(false)
  const [serverRevision, setServerRevision] = useState<ProcessDraftDTO | undefined>(undefined)
  const [reloadOpen, setReloadOpen] = useState(false)
  const [publishOpen, setPublishOpen] = useState(false)
  const [discardOpen, setDiscardOpen] = useState(false)
  const [releaseVersion, setReleaseVersion] = useState('')
  const [fingerprint, setFingerprint] = useState<string | undefined>(undefined)
  const [pendingBodyAvailable, setPendingBodyAvailable] = useState(false)
  const [publishConfirmation, setPublishConfirmation] = useState<Readonly<{
    releaseVersion: string; expectedRevision: number; expectedContentSha256: string
  }> | undefined>(undefined)
  const [discardConfirmation, setDiscardConfirmation] = useState<Readonly<{
    expectedRevision: number; expectedContentSha256: string
  }> | undefined>(undefined)
  const preparing = useRef(false)

  const currentDraft = editorState.phase === 'loaded' ? editorState.draft : undefined
  const draftBuffer = buffer
  const contentEditable = currentDraft?.state === 'EDITING'
    && pending?.operation !== 'PUBLISH' && pending?.operation !== 'DISCARD'
  const dirty = currentDraft !== undefined && draftBuffer !== undefined && !bufferMatchesDraft(draftBuffer, currentDraft)
  const canLeave = dirty || pending !== undefined
  useWorkbenchLeaveGuard(activeTabKey ?? `tianji:draft:${draftId}`, {
    dirty,
    pendingMutation: pending !== undefined
      || mutationState === 'saving'
      || mutationState === 'publishing'
      || mutationState === 'discarding',
  })
  const blocker = useBlocker(({currentLocation, nextLocation}) => alive.current
    && gatewayAuth.context.epoch === epoch && !allowNextNavigation.current && canLeave
    && currentLocation.pathname !== nextLocation.pathname)
  useBeforeUnload(event => {
    if (!alive.current || gatewayAuth.context.epoch !== epoch || !canLeave) return
    event.preventDefault()
    event.returnValue = ''
  })

  useLayoutEffect(() => { currentAllows.current = allows }, [allows])

  const isCurrent = useCallback((controller?: AbortController, serial?: number) => alive.current
    && gatewayAuth.context.epoch === epoch && currentAllows.current(PAGE)
    && (controller === undefined || !controller.signal.aborted)
    && (serial === undefined || sequence.current === serial), [epoch])

  useLayoutEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
      sequence.current += 1
      request.current?.abort()
      request.current = null
      inFlight.current = false
    }
  }, [])

  const setDraft = useCallback((draft: ProcessDraftDTO) => {
    savedRef.current = draft
    setEditorState({phase: 'loaded', draft})
  }, [])

  const clearPointer = useCallback((pointer: RecoveryPointer) => {
    try {
      const key = recoveryKey(tenantId, draftId)
      const decoded = decodePointer(JSON.parse(sessionStorage.getItem(key) ?? 'null'), tenantId, draftId, pointer.actorFingerprint)
      if (decoded?.commandId === pointer.commandId) sessionStorage.removeItem(key)
    } catch {
      setStorageError(true)
    }
    if (pointerRef.current?.commandId === pointer.commandId) pointerRef.current = undefined
    if (pendingBodyRef.current?.pointer.commandId === pointer.commandId) {
      pendingBodyRef.current = undefined
      setPendingBodyAvailable(false)
    }
    setPending(current => current?.commandId === pointer.commandId ? undefined : current)
  }, [draftId, tenantId])

  const applyCurrentDraft = useCallback((draft: ProcessDraftDTO) => {
    setDraft(draft)
    setBuffer(toBuffer(draft))
    bufferGeneration.current += 1
    setValidation(undefined)
  }, [setDraft])

  const confirmRecoveredOperation = useCallback((draft: ProcessDraftDTO, pointer: RecoveryPointer): boolean => {
    const receipt = draft.commandReceipt
    if (receipt === null || !commandReceiptMatches(receipt, pointer)) return false
    if (pointer.operation === 'PUBLISH' && (!draft.publication
        || draft.publication.commandId !== pointer.commandId || draft.publication.releaseVersion !== pointer.releaseVersion)) return false
    clearPointer(pointer)
    setMutationState('idle')
    setMessage(`${commandLabel(pointer.operation)}已确认，原结果修订 ${receipt.resultRevision}。当前稿为修订 ${draft.revision}。`)
    if (pointer.operation === 'DISCARD' && draft.state === 'DISCARDED') {
      allowNextNavigation.current = true
      navigate('/process-definitions')
    }
    return true
  }, [clearPointer, navigate])

  const recoverOperation = useCallback(async (pointer: RecoveryPointer, applyToCurrent = true) => {
    const generationBeforeLookup = bufferGeneration.current
    const wasClean = !!savedRef.current && !!draftBuffer && !dirty
    const bodyBeforeLookup = pendingBodyRef.current
    const controller = new AbortController()
    request.current?.abort()
    request.current = controller
    const serial = ++sequence.current
    setMutationState('checking')
    setMessage(`${commandLabel(pointer.operation)}尚无可见回执，正在查询原命令。`)
    try {
      const draft = await processDraftsApi.get(tenantId, draftId, pointer.commandId, controller.signal)
      if (!isCurrent(controller, serial)) return
      setDraft(draft)
      const matched = commandReceiptMatches(draft.commandReceipt, pointer)
        && (pointer.operation !== 'PUBLISH' || draft.publication?.commandId === pointer.commandId
          && draft.publication.releaseVersion === pointer.releaseVersion)
      const confirmed = confirmRecoveredOperation(draft, pointer)
      if (!confirmed) {
        setMutationState('unknown')
        setMessage('原命令仍待确认。查询结果没有提供匹配回执，请保留原命令并稍后查证。')
      } else if (matched && (applyToCurrent || wasClean) && generationBeforeLookup === bufferGeneration.current
          && (bodyBeforeLookup?.bufferGeneration === undefined
            || bodyBeforeLookup.bufferGeneration === generationBeforeLookup)) {
        setBuffer(toBuffer(draft))
      }
    } catch {
      if (!isCurrent(controller, serial)) return
      setMutationState('unknown')
      setMessage('原命令仍待确认。当前查询失败，没有重放或修改原命令。')
    } finally {
      if (request.current === controller) request.current = null
    }
  }, [confirmRecoveredOperation, dirty, draftBuffer, draftId, isCurrent, setDraft, tenantId])

  useEffect(() => {
    let active = true
    void ownerFingerprint(issuer, subject).then(fingerprint => {
      if (!active || !isCurrent()) return
      setFingerprint(fingerprint)
      let savedPointer: RecoveryPointer | null = null
      try {
        const key = recoveryKey(tenantId, draftId)
        const stored = sessionStorage.getItem(key)
        if (stored !== null) {
          savedPointer = decodePointer(JSON.parse(stored) as unknown, tenantId, draftId, fingerprint)
          if (!savedPointer) sessionStorage.removeItem(key)
        }
      } catch {
        setStorageError(true)
      }
      if (savedPointer) {
        pointerRef.current = savedPointer
        setPending(savedPointer)
      }
      const controller = new AbortController()
      request.current = controller
      const serial = ++sequence.current
      void processDraftsApi.get(tenantId, draftId, savedPointer?.commandId, controller.signal).then(draft => {
        if (!active || !isCurrent(controller, serial)) return
        setDraft(draft)
        setBuffer(toBuffer(draft))
        bufferGeneration.current += 1
        if (savedPointer) {
          if (confirmRecoveredOperation(draft, savedPointer)) return
          setMutationState('unknown')
          setMessage(`${commandLabel(savedPointer.operation)}仍待确认。已恢复服务器已保存稿，未重放本地正文。`)
        }
      }).catch(failure => {
        if (!active || !isCurrent(controller, serial)) return
        const denied = failure instanceof ApiError && [401, 403, 404].includes(failure.status)
        setEditorState({phase: 'unavailable', message: denied
          ? '当前无法访问此草稿。' : '暂时无法读取草稿，请稍后重试。'})
      }).finally(() => {
        if (request.current === controller) request.current = null
      })
    }).catch(() => {
      if (active && isCurrent()) setEditorState({phase: 'unavailable', message: '无法验证草稿所属身份。'})
    })
    return () => { active = false }
  }, [confirmRecoveredOperation, draftId, isCurrent, issuer, setDraft, subject, tenantId])

  const writePointer = useCallback((pointer: RecoveryPointer) => {
    try {
      sessionStorage.setItem(recoveryKey(tenantId, draftId), JSON.stringify(pointer))
      pointerRef.current = pointer
      setPending(pointer)
      return true
    } catch {
      setStorageError(true)
      setFormError('无法安全保存此命令的恢复引用，因此没有发送请求。')
      return false
    }
  }, [draftId, tenantId])

  const beginRequest = useCallback(() => {
    if (inFlight.current) return undefined
    inFlight.current = true
    request.current?.abort()
    const controller = new AbortController()
    request.current = controller
    return controller
  }, [])

  const endRequest = useCallback((controller: AbortController) => {
    if (request.current === controller) request.current = null
    inFlight.current = false
  }, [])

  const clearIntentAndMessage = useCallback((pointer: RecoveryPointer) => {
    clearPointer(pointer)
    setMutationState('idle')
    setMessage(undefined)
  }, [clearPointer])

  const refreshAfterConflict = useCallback(async (pointer: RecoveryPointer, controller: AbortController) => {
    clearIntentAndMessage(pointer)
    setValidation(undefined)
    setRequiresReload(true)
    setMutationState('reading')
    setMessage('服务端拒绝了此修订操作。正在读取当前服务器稿，您的本地编辑仍会保留。')
    try {
      const latest = await processDraftsApi.get(tenantId, draftId, undefined, controller.signal)
      if (!isCurrent(controller)) return
      setServerRevision(latest)
      setMessage(`服务器当前为修订 ${latest.revision}。本地编辑仍保留，可明确查看并重载服务器稿。`)
    } catch {
      if (isCurrent(controller)) setMessage('服务器拒绝了此修订操作，当前稿读取失败。本地编辑仍保留，可稍后重新读取。')
    } finally {
      if (isCurrent(controller)) setMutationState('idle')
    }
  }, [clearIntentAndMessage, draftId, isCurrent, tenantId])

  const handleUnknown = useCallback(async (pointer: RecoveryPointer) => {
    setMutationState('unknown')
    setMessage(`${commandLabel(pointer.operation)}结果尚未确认。请查询原命令，或在原正文仍保留时使用同一命令重试。`)
    await recoverOperation(pointer, false)
  }, [recoverOperation])

  const sendSave = useCallback(async (pendingSave: PendingBody, alreadyStored = false) => {
    const body = pendingSave.save
    if (!body || !isCurrent() || inFlight.current || !currentAllows.current(SAVE_ACTION)) return
    const controller = beginRequest()
    if (!controller) return
    const pointer = pendingSave.pointer
    if (!alreadyStored && !writePointer(pointer)) {
      endRequest(controller)
      return
    }
    pendingBodyRef.current = pendingSave
    setPendingBodyAvailable(true)
    setMutationState('saving')
    setFormError(undefined)
    setMessage(undefined)
    try {
      const result = await processDraftsApi.save(tenantId, draftId, body, controller.signal)
      if (!isCurrent(controller)) return
      const current = savedRef.current
      if (!current) return
      let next = current
      if (current.revision === body.expectedRevision) {
        next = {...current, title: body.title, content: body.content,
          revision: result.revision, contentSha256: result.contentSha256, updatedAt: result.updatedAt,
          lastCommandId: result.commandId, state: result.state, commandReceipt: null}
        setDraft(next)
      }
      setValidation(undefined)
      if (bufferGeneration.current === pendingSave.bufferGeneration) setBuffer(toBuffer(next))
      clearPointer(pointer)
      setMutationState('idle')
      setMessage(current.revision > result.revision
        ? `原暂存命令已确认修订 ${result.revision}，当前服务器稿为修订 ${current.revision}。`
        : `已暂存修订 ${result.revision}。`)
    } catch (failure) {
      if (!isCurrent(controller)) return
      if (failure instanceof ApiError && failure.status === 409 && KNOWN_CONFLICTS.has(failure.code)) {
        await refreshAfterConflict(pointer, controller)
      } else {
        await handleUnknown(pointer)
      }
    } finally {
      endRequest(controller)
    }
  }, [beginRequest, clearPointer, draftId, endRequest, handleUnknown, isCurrent, refreshAfterConflict,
    setDraft, tenantId, writePointer])

  const saveBuffer = useCallback(() => {
    const current = savedRef.current
    const currentBuffer = draftBuffer
    if (!current || !currentBuffer || !fingerprint || !currentAllows.current(SAVE_ACTION)
        || !current.availableActions.includes('SAVE') || current.state !== 'EDITING'
        || inFlight.current || preparing.current || pending || pointerRef.current || requiresReload || storageError) return
    preparing.current = true
    const capturedGeneration = bufferGeneration.current
    let prepared: PreparedDraftSave
    try {
      const command: SaveProcessDraftCommand = {
        commandId: randomCommandId('draft-save'), expectedRevision: current.revision,
        title: currentBuffer.title, content: currentBuffer.content,
      }
      prepared = prepareDraftSave(draftId, command)
    } catch {
      preparing.current = false
      setFormError('草稿内容或请求超出可暂存范围。请检查标题和原始文本。')
      return
    }
    setFormError(undefined)
    const pointer: RecoveryPointer = {
      version: 1, operation: 'SAVE', actorFingerprint: fingerprint, tenantId, draftId,
      commandId: prepared.body.commandId, expectedRevision: current.revision,
      expectedContentSha256: current.contentSha256, releaseVersion: null,
    }
    const captured: PendingBody = {pointer, save: prepared.body, bufferGeneration: capturedGeneration}
    preparing.current = false
    if (!isCurrent() || !currentAllows.current(SAVE_ACTION)) return
    void sendSave(captured)
  }, [draftBuffer, draftId, fingerprint, isCurrent, pending, requiresReload, sendSave, storageError, tenantId])

  const startValidation = useCallback(async () => {
    const current = savedRef.current
    if (!current || !currentAllows.current(VALIDATE_ACTION) || !current.availableActions.includes('VALIDATE')
        || current.state === 'DISCARDED' || dirty || inFlight.current || pending || pointerRef.current || requiresReload) return
    const controller = beginRequest()
    if (!controller) return
    const serial = ++sequence.current
    const generationAtStart = bufferGeneration.current
    setMutationState('validating')
    setFormError(undefined)
    setMessage(undefined)
    try {
      const result = await processDraftsApi.validate(tenantId,
        {draftId, expectedRevision: current.revision, expectedContentSha256: current.contentSha256}, controller.signal)
      if (!isCurrent(controller, serial)) return
      const latest = savedRef.current
      if (!latest || latest.revision !== result.revision || latest.contentSha256 !== result.contentSha256
          || generationAtStart !== bufferGeneration.current) return
      setValidation(result)
      setSelectedNodeId(undefined)
      setMessage(result.valid ? undefined : '模型校验发现需要修正的问题。')
    } catch (failure) {
      if (!isCurrent(controller, serial)) return
      setFormError(failure instanceof ApiError && failure.status === 409
        ? '草稿修订已变化。请重新读取后再校验。' : '暂时无法校验此已保存修订。')
    } finally {
      endRequest(controller)
      if (isCurrent()) setMutationState('idle')
    }
  }, [beginRequest, dirty, draftId, endRequest, isCurrent, pending, requiresReload, tenantId])

  const sendPublication = useCallback(async (pendingPublication: PendingBody, alreadyStored = false) => {
    if (!pendingPublication.publication || !isCurrent() || inFlight.current
        || !currentAllows.current(PUBLISH_ACTION)) return
    const current = savedRef.current
    const result = validation
    const command = pendingPublication.publication
    const pointer = pendingPublication.pointer
    const replayingOriginal = alreadyStored && pointerRef.current?.commandId === pointer.commandId
    if (!current || (!replayingOriginal && (pointerRef.current || pending || requiresReload))) return
    if (!replayingOriginal && (!result?.valid || dirty || !current.availableActions.includes('PUBLISH')
        || current.state !== 'EDITING' || command.expectedRevision !== current.revision
        || command.expectedContentSha256 !== current.contentSha256 || result.revision !== current.revision
        || result.contentSha256 !== current.contentSha256)) return
    const controller = beginRequest()
    if (!controller) return
    if (!alreadyStored && !writePointer(pointer)) {
      endRequest(controller)
      return
    }
    pendingBodyRef.current = pendingPublication
    setPendingBodyAvailable(true)
    setPublishOpen(false)
    setMutationState('publishing')
    setFormError(undefined)
    try {
      const outcome = await processDraftsApi.publish(tenantId, command, controller.signal)
      if (!isCurrent(controller)) return
      const sealed: ProcessDraftDTO = {...current, state: 'PUBLISHED', revision: outcome.draftRevision,
        publishedReleaseVersion: outcome.releaseVersion, updatedAt: outcome.publishedAt,
        lastCommandId: outcome.commandId, publication: outcome, availableActions: ['VALIDATE'], commandReceipt: null}
      setDraft(sealed)
      savedRef.current = sealed
      clearPointer(pointer)
      setMutationState('idle')
      setMessage(`已发布修订 ${outcome.publishedRevision}，发布版本 ${outcome.releaseVersion}。`)
    } catch (failure) {
      if (!isCurrent(controller)) return
      if (failure instanceof ApiError && failure.status === 409 && KNOWN_CONFLICTS.has(failure.code)) {
        await refreshAfterConflict(pointer, controller)
      } else {
        await handleUnknown(pointer)
      }
    } finally {
      endRequest(controller)
    }
  }, [beginRequest, clearPointer, dirty, endRequest, handleUnknown, isCurrent, refreshAfterConflict,
    pending, requiresReload, setDraft, tenantId, validation, writePointer])

  const sendDiscard = useCallback(async (pendingDiscard: PendingBody, alreadyStored = false) => {
    if (!pendingDiscard.discard || !isCurrent() || inFlight.current || !currentAllows.current(DISCARD_ACTION)) return
    const current = savedRef.current
    const command = pendingDiscard.discard
    const pointer = pendingDiscard.pointer
    const replayingOriginal = alreadyStored && pointerRef.current?.commandId === pointer.commandId
    if (!current || (!replayingOriginal && (pointerRef.current || pending || requiresReload))) return
    if (!replayingOriginal && (current.state !== 'EDITING' || !current.availableActions.includes('DISCARD')
        || command.expectedRevision !== current.revision || pointer.expectedContentSha256 !== current.contentSha256)) return
    const controller = beginRequest()
    if (!controller) return
    if (!alreadyStored && !writePointer(pointer)) {
      endRequest(controller)
      return
    }
    pendingBodyRef.current = pendingDiscard
    setPendingBodyAvailable(true)
    setDiscardOpen(false)
    setMutationState('discarding')
    setFormError(undefined)
    try {
      const result = await processDraftsApi.discard(tenantId, draftId, command, controller.signal)
      if (!isCurrent(controller)) return
      const closed: ProcessDraftDTO = {...current, state: 'DISCARDED', revision: result.revision,
        contentSha256: result.contentSha256, updatedAt: result.updatedAt, lastCommandId: result.commandId,
        publication: null, publishedReleaseVersion: null, availableActions: [], commandReceipt: null}
      setDraft(closed)
      savedRef.current = closed
      clearPointer(pointer)
      setMutationState('idle')
      setMessage(`已放弃修订 ${result.revision}，正在返回流程工作区。`)
      allowNextNavigation.current = true
      navigate('/process-definitions')
    } catch (failure) {
      if (!isCurrent(controller)) return
      if (failure instanceof ApiError && failure.status === 409 && KNOWN_CONFLICTS.has(failure.code)) {
        await refreshAfterConflict(pointer, controller)
      } else {
        await handleUnknown(pointer)
      }
    } finally {
      endRequest(controller)
    }
  }, [beginRequest, clearPointer, draftId, endRequest, handleUnknown, isCurrent, navigate, pending,
    refreshAfterConflict, requiresReload, setDraft, tenantId, writePointer])

  const retryOriginal = () => {
    const body = pendingBodyRef.current
    const pointer = pending ?? pointerRef.current
    if (!pointer || inFlight.current || preparing.current) return
    if (body?.pointer.commandId === pointer.commandId && body.save) void sendSave(body, true)
    else if (body?.pointer.commandId === pointer.commandId && body.publication) void sendPublication(body, true)
    else if (body?.pointer.commandId === pointer.commandId && body.discard) void sendDiscard(body, true)
    else if (pointer.operation === 'PUBLISH' && pointer.releaseVersion) {
      void sendPublication({pointer, publication: {draftId, expectedRevision: pointer.expectedRevision,
        expectedContentSha256: pointer.expectedContentSha256, releaseVersion: pointer.releaseVersion,
        commandId: pointer.commandId}}, true)
    } else if (pointer.operation === 'DISCARD') {
      void sendDiscard({pointer, discard: {commandId: pointer.commandId, expectedRevision: pointer.expectedRevision}}, true)
    }
  }

  const checkOriginal = () => {
    const pointer = pointerRef.current
    if (!pointer || inFlight.current || preparing.current) return
    void recoverOperation(pointer)
  }

  const queryCurrent = async () => {
    if (!isCurrent() || pointerRef.current || serverRevision || dirty && !requiresReload) return
    const controller = beginRequest()
    if (!controller) return
    const generationAtStart = bufferGeneration.current
    setMutationState('reading')
    setFormError(undefined)
    try {
      const latest = await processDraftsApi.get(tenantId, draftId, undefined, controller.signal)
      if (!isCurrent(controller)) return
      if (requiresReload || generationAtStart !== bufferGeneration.current) {
        setRequiresReload(true)
        setServerRevision(latest)
        setMessage(`服务器当前为修订 ${latest.revision}。本地编辑仍保留，可明确查看并重载服务器稿。`)
      } else {
        applyCurrentDraft(latest)
        setMessage(undefined)
      }
    } catch (failure) {
      if (!isCurrent(controller)) return
      if (failure instanceof ApiError && [401, 403, 404].includes(failure.status)) {
        savedRef.current = undefined
        setBuffer(undefined)
        setValidation(undefined)
        setEditorState({phase: 'unavailable', message: '当前无法访问此草稿。'})
      } else {
        setFormError('暂时无法重新读取服务器稿。')
      }
    } finally {
      endRequest(controller)
      if (isCurrent(controller)) setMutationState('idle')
    }
  }

  const confirmReload = () => {
    if (!serverRevision || !isCurrent()) return
    applyCurrentDraft(serverRevision)
    setReloadOpen(false)
    setMessage(`已重载服务器修订 ${serverRevision.revision}。`)
    setRequiresReload(false)
    setServerRevision(undefined)
  }

  const updateBuffer = (update: (current: EditorBuffer) => EditorBuffer) => {
    bufferGeneration.current += 1
    setFormError(undefined)
    setValidation(undefined)
    setBuffer(current => {
      if (!current) return current
      return update(current)
    })
  }

  const changeContent = (update: (current: DraftContentVO) => DraftContentVO) => {
    updateBuffer(current => ({...current, content: update(current.content)}))
  }

  const canSave = !!currentDraft && currentDraft.state === 'EDITING' && currentDraft.availableActions.includes('SAVE')
    && allows(SAVE_ACTION) && !storageError && !pending && !requiresReload && mutationState === 'idle' && dirty
  const canValidate = !!currentDraft && currentDraft.state !== 'DISCARDED' && currentDraft.availableActions.includes('VALIDATE')
    && allows(VALIDATE_ACTION) && !dirty && !pending && !requiresReload && mutationState === 'idle'
  const canPublish = !!currentDraft && currentDraft.state === 'EDITING' && currentDraft.availableActions.includes('PUBLISH')
    && allows(PUBLISH_ACTION) && !dirty && validation?.valid === true
    && validation.revision === currentDraft.revision && validation.contentSha256 === currentDraft.contentSha256
    && !pending && !requiresReload && mutationState === 'idle'
    && isProcessReleaseVersion(releaseVersion)
  const canDiscard = !!currentDraft && currentDraft.state === 'EDITING' && currentDraft.availableActions.includes('DISCARD')
    && allows(DISCARD_ACTION) && !pending && !requiresReload && mutationState === 'idle'

  const openPublishConfirmation = () => {
    const current = savedRef.current
    if (!current || !canPublish) return
    setPublishConfirmation({releaseVersion, expectedRevision: current.revision,
      expectedContentSha256: current.contentSha256})
    setPublishOpen(true)
  }

  const confirmPublish = () => {
    const current = savedRef.current
    const confirmation = publishConfirmation
    if (!current || !confirmation || !isCurrent() || !currentAllows.current(PUBLISH_ACTION)
        || !current.availableActions.includes('PUBLISH') || current.state !== 'EDITING'
        || dirty || !validation?.valid || validation.revision !== confirmation.expectedRevision
        || validation.contentSha256 !== confirmation.expectedContentSha256
        || current.revision !== confirmation.expectedRevision || current.contentSha256 !== confirmation.expectedContentSha256
        || releaseVersion !== confirmation.releaseVersion || !isProcessReleaseVersion(confirmation.releaseVersion)
        || inFlight.current || preparing.current || pointerRef.current || requiresReload) {
      setPublishOpen(false)
      setMessage('发布目标、草稿修订或校验结果已变化。请重新校验并再次确认。')
      return
    }
    if (!fingerprint) {
      setFormError('无法验证草稿所属身份。没有发送发布请求。')
      return
    }
    let commandId: string
    try {
      commandId = randomCommandId('draft-publish')
    } catch {
      setFormError('当前环境无法创建发布命令标识。')
      return
    }
    const command: PublishProcessDraftCommand = {
      draftId, expectedRevision: confirmation.expectedRevision,
      expectedContentSha256: confirmation.expectedContentSha256,
      releaseVersion: confirmation.releaseVersion, commandId,
    }
    const pointer: RecoveryPointer = {version: 1, operation: 'PUBLISH', actorFingerprint: fingerprint,
      tenantId, draftId, commandId, expectedRevision: command.expectedRevision,
      expectedContentSha256: command.expectedContentSha256, releaseVersion: command.releaseVersion}
    void sendPublication({pointer, publication: command})
  }

  const openDiscardConfirmation = () => {
    const current = savedRef.current
    if (!current || !canDiscard) return
    setDiscardConfirmation({expectedRevision: current.revision, expectedContentSha256: current.contentSha256})
    setDiscardOpen(true)
  }

  const confirmDiscard = () => {
    const current = savedRef.current
    const confirmation = discardConfirmation
    if (!current || !confirmation || !isCurrent() || !currentAllows.current(DISCARD_ACTION)
        || !current.availableActions.includes('DISCARD') || current.state !== 'EDITING'
        || current.revision !== confirmation.expectedRevision || current.contentSha256 !== confirmation.expectedContentSha256
        || inFlight.current || preparing.current || pointerRef.current || requiresReload) {
      setDiscardOpen(false)
      setMessage('草稿修订已变化。请重新读取后再次确认放弃。')
      return
    }
    if (!fingerprint) {
      setFormError('无法验证草稿所属身份。没有发送放弃请求。')
      return
    }
    let commandId: string
    try {
      commandId = randomCommandId('draft-discard')
    } catch {
      setFormError('当前环境无法创建放弃命令标识。')
      return
    }
    const command = {commandId, expectedRevision: confirmation.expectedRevision}
    const pointer: RecoveryPointer = {version: 1, operation: 'DISCARD', actorFingerprint: fingerprint,
      tenantId, draftId, commandId, expectedRevision: confirmation.expectedRevision,
      expectedContentSha256: confirmation.expectedContentSha256, releaseVersion: null}
    void sendDiscard({pointer, discard: command})
  }

  const validationIssues = useMemo(() => validation && !validation.valid ? validation.issues : [], [validation])

  if (editorState.phase === 'loading') return <section className="page-stack" aria-labelledby="process-draft-editor-title">
    <div className="page-heading"><Typography.Title id="process-draft-editor-title" level={2}>流程草稿编辑</Typography.Title></div>
    <Spin tip="正在恢复已保存草稿" />
  </section>
  if (editorState.phase === 'unavailable') return <section className="page-stack" aria-labelledby="process-draft-editor-title">
    <div className="page-heading"><Typography.Title id="process-draft-editor-title" level={2}>流程草稿编辑</Typography.Title></div>
    <Alert type="warning" showIcon title={editorState.message} />
  </section>

  const stateLabel = currentDraft?.state === 'PUBLISHED' ? '已发布封存' : currentDraft?.state === 'DISCARDED' ? '已放弃' : '编辑中'
  return <section className="page-stack process-draft-editor" aria-labelledby={embedded ? undefined : 'process-draft-editor-title'} aria-label={embedded ? '编辑流程草稿' : undefined}>
    <header className="page-heading">
      {!embedded && (
        <div>
          <Typography.Title id="process-draft-editor-title" level={2}>编辑流程草稿</Typography.Title>
          <Typography.Text type="secondary">{currentDraft?.definitionKey} · 服务端草稿修订独立递增。</Typography.Text>
        </div>
      )}
      <Space wrap>
        <Tag color={currentDraft?.state === 'EDITING' ? 'processing' : 'default'}>{stateLabel}</Tag>
        <Button onClick={() => void queryCurrent()} aria-label="重新读取服务器稿" aria-busy={mutationState === 'reading'}
          loading={mutationState === 'reading'}
          disabled={mutationState !== 'idle' || dirty && !requiresReload || !!pending || !!serverRevision}>重新读取服务器稿</Button>
      </Space>
    </header>

    {currentDraft && <Descriptions size="small" bordered column={{xs: 1, sm: 2, lg: 3}}>
      <Descriptions.Item label="定义键">{currentDraft.definitionKey}</Descriptions.Item>
      <Descriptions.Item label="当前为已保存修订">{currentDraft.revision}</Descriptions.Item>
      <Descriptions.Item label="内容摘要"><Typography.Text code copyable>{currentDraft.contentSha256}</Typography.Text></Descriptions.Item>
      <Descriptions.Item label="来源发布版本">{currentDraft.baseReleaseVersion ?? '新建草稿'}</Descriptions.Item>
      {currentDraft.publication && <Descriptions.Item label="发布版本">{currentDraft.publication.releaseVersion}</Descriptions.Item>}
    </Descriptions>}

    {currentDraft?.state === 'EDITING' && dirty && <Alert type="info" showIcon title="尚有未暂存修改" />}
    {storageError && <Alert type="warning" showIcon title="浏览器无法安全保存恢复引用。草稿内容仍留在当前页面，写操作已停用。" />}
    {message && <Alert type={mutationState === 'unknown' ? 'warning' : 'info'} showIcon title={message}
      action={<Space wrap>
        {pending && <>
          <Button onClick={checkOriginal} disabled={mutationState === 'checking'}>查询原命令</Button>
          {(pendingBodyAvailable || pending.operation !== 'SAVE')
            && <Button onClick={retryOriginal} disabled={mutationState !== 'unknown'}>
            用同一命令重试
          </Button>}
        </>}
        {serverRevision && <Button onClick={() => setReloadOpen(true)}>查看并重载服务器修订 {serverRevision.revision}</Button>}
      </Space>} />}
    {formError && <Alert type="error" showIcon title={formError} />}

    {currentDraft && draftBuffer && <>
      <section className="page-stack" aria-label="草稿正文">
        <Typography.Title level={3}>基本信息</Typography.Title>
        <label htmlFor="draft-title">草稿标题</label>
        <Input id="draft-title" value={draftBuffer.title} maxLength={256} disabled={!contentEditable}
          onChange={event => updateBuffer(current => ({...current, title: event.target.value}))} />

        <Divider />
        <div className="page-heading">
          <Typography.Title level={3}>流程模型</Typography.Title>
          {contentEditable && <Space wrap>
            <Button onClick={() => changeContent(source => ({...source, models: [
              ...(source.models ?? []), {type: 'BPMN', definitionKey: '', xml: ''},
            ]}))}>添加 BPMN 模型</Button>
            <Button onClick={() => changeContent(source => ({...source, models: [
              ...(source.models ?? []), {type: 'DMN', definitionKey: '', xml: ''},
            ]}))}>添加 DMN 模型</Button>
          </Space>}
        </div>
        {draftBuffer.content.models === null && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="模型内容尚未设置。选择 BPMN 或 DMN 可创建模型草稿。" />}
        {draftBuffer.content.models?.map((model, index) => <section key={`${index}-${model.type}`} className="surface-card">
          <div className="page-heading">
            <Typography.Title level={4}>{model.type} 模型 {index + 1}</Typography.Title>
            {contentEditable && <Button danger onClick={() => changeContent(source => ({...source,
              models: (source.models ?? []).filter((_, row) => row !== index)}))}>移除模型 {index + 1}</Button>}
          </div>
          <label htmlFor={`model-type-${index}`}>模型类型</label>
          <Select id={`model-type-${index}`} aria-label={`模型类型 ${index + 1}`} value={model.type}
            disabled={!contentEditable} options={[{value: 'BPMN', label: 'BPMN'}, {value: 'DMN', label: 'DMN'}]}
            onChange={type => changeContent(source => ({...source,
              models: (source.models ?? []).map((row, position) => position === index ? {...row, type} : row)}))} />
          <label htmlFor={`model-key-${index}`}>模型定义键 {index + 1}</label>
          <Input id={`model-key-${index}`} aria-label={`模型定义键 ${index + 1}`} value={model.definitionKey} maxLength={128}
            disabled={!contentEditable} onChange={event => changeContent(source => ({...source,
              models: (source.models ?? []).map((row, position) => position === index
                ? {...row, definitionKey: event.target.value} : row)}))} />
          <label htmlFor={`model-source-${index}`}>{model.type} 模型 {index + 1} XML</label>
          <Input.TextArea id={`model-source-${index}`} aria-label={`${model.type} 模型 ${index + 1} XML`}
            className="process-editor-source" rows={14} spellCheck={false} value={model.xml}
            disabled={!contentEditable} onChange={event => changeContent(source => ({...source,
              models: (source.models ?? []).map((row, position) => position === index
                ? {...row, xml: event.target.value} : row)}))} />
        </section>)}

        <Divider />
        <Typography.Title level={3}>输入、输出与节点配置</Typography.Title>
        {contentFields.map(([field, label]) => {
          const value = draftBuffer.content[field]
          return <section key={field} className="page-stack">
            <label htmlFor={`draft-source-${field}`}>{label}</label>
            <Checkbox checked={value === null} disabled={!contentEditable}
              onChange={event => {
                const checked = event.target.checked
                changeContent(source => ({...source, [field]: checked ? null : ''}))
              }}>不设置{label}</Checkbox>
            <Input.TextArea id={`draft-source-${field}`} className="process-editor-source" rows={7} spellCheck={false}
              value={value ?? ''} disabled={!contentEditable || value === null}
              onChange={event => changeContent(source => ({...source, [field]: event.target.value}))} />
          </section>
        })}
      </section>

      {validation && <section className="page-stack" aria-labelledby="draft-validation-title">
        <Typography.Title id="draft-validation-title" level={3}>已保存修订校验</Typography.Title>
        <Typography.Text>修订 {validation.revision} · 摘要 {validation.contentSha256}</Typography.Text>
        {validation.valid ? <>
          <Alert type="success" showIcon title="模型校验通过" description={`编译器 ${validation.compilerVersion} · 来源摘要 ${validation.sourceManifestSha256}`} />
          {validation.graph && <>
            <ProcessGraph graph={validation.graph} executions={[]} selectedNodeId={selectedNodeId}
              onSelectNode={setSelectedNodeId} />
            <ProcessGraphList graph={validation.graph} executions={[]} selectedNodeId={selectedNodeId}
              onSelectNode={setSelectedNodeId} />
          </>}
        </> : <Alert type="error" showIcon title="模型校验发现需要修正的问题" description={<ul>
          {validationIssues.map((issue, index) => <li key={`${issue.path}-${index}`}>
            <Typography.Text code>{issue.path}</Typography.Text>{issue.nodeId && <> · 节点 {issue.nodeId}</>} · {issue.message} · {issue.code}
          </li>)}
        </ul>} />}
      </section>}

      {currentDraft.publication && <section className="page-stack" aria-label="已发布成果">
        <Alert type="success" showIcon title={`已发布修订 ${currentDraft.publication.publishedRevision}`}
          description={`发布版本 ${currentDraft.publication.releaseVersion} · 来源摘要 ${currentDraft.publication.sourceManifestSha256}`} />
        <ProcessActivationPanel definitionKey={currentDraft.definitionKey}
          releaseVersion={currentDraft.publication.releaseVersion} baseReleaseVersion={currentDraft.baseReleaseVersion} />
      </section>}

      <Divider />
      <Space wrap>
        {currentDraft.state === 'EDITING' && <>
          <Button type="primary" onClick={saveBuffer} disabled={!canSave}>
            {mutationState === 'saving' ? '正在暂存' : `暂存修订 ${currentDraft.revision}`}
          </Button>
          <Button onClick={() => void startValidation()} disabled={!canValidate}>
            {mutationState === 'validating' ? '正在校验' : '校验已保存修订'}
          </Button>
          <label htmlFor="draft-release-version">发布版本号</label>
          <Input id="draft-release-version" aria-label="发布版本号" value={releaseVersion} maxLength={128}
            disabled={pending?.operation === 'PUBLISH' || pending?.operation === 'DISCARD'}
            onChange={event => setReleaseVersion(event.target.value)} />
          <Button onClick={openPublishConfirmation} disabled={!canPublish}>发布已保存修订</Button>
          <Button danger onClick={openDiscardConfirmation} disabled={!canDiscard}>放弃草稿</Button>
        </>}
        {currentDraft.state !== 'EDITING' && <Typography.Text type="secondary">此草稿已封存，正文为只读状态。</Typography.Text>}
      </Space>
    </>}

    <Modal title="确认发布固定修订" open={publishOpen} okText="确认发布" cancelText="返回编辑"
      onCancel={() => setPublishOpen(false)} onOk={confirmPublish}>
      <Space orientation="vertical">
        <Typography.Text>发布版本：{publishConfirmation?.releaseVersion}</Typography.Text>
        <Typography.Text>草稿修订：{publishConfirmation?.expectedRevision}</Typography.Text>
        <Typography.Text>内容摘要：{publishConfirmation?.expectedContentSha256}</Typography.Text>
      </Space>
    </Modal>

    <Modal title="确认放弃此草稿" open={discardOpen} okText="确认放弃" cancelText="继续编辑"
      onCancel={() => setDiscardOpen(false)} onOk={confirmDiscard}>
      <Typography.Paragraph>只放弃当前编辑稿修订 {discardConfirmation?.expectedRevision}。草稿来源发布和已发布版本不会改变。
        {dirty && ' 此页面未暂存的本地修改也会随本次放弃清除。'}
      </Typography.Paragraph>
    </Modal>

    <Modal title="重载服务器修订" open={reloadOpen} okText={`用修订 ${serverRevision?.revision ?? ''} 替换本地编辑`}
      cancelText="保留本地编辑" onCancel={() => setReloadOpen(false)} onOk={confirmReload}>
      <Typography.Paragraph>当前服务器稿为修订 {serverRevision?.revision}。重载会替换此页面中的未暂存标题与正文。</Typography.Paragraph>
    </Modal>

    <Modal title="离开草稿编辑" open={blocker.state === 'blocked'} okText="离开此页" cancelText="留在此页"
      onCancel={() => blocker.reset?.()} onOk={() => blocker.proceed?.()}>
      <Typography.Paragraph>此草稿存在未暂存修改或结果待确认。离开后，未暂存正文不会保存在浏览器中。</Typography.Paragraph>
    </Modal>
  </section>
}

export default ProcessDraftEditorPage
