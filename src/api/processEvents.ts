import {requestJson} from './client'
import {isProcessCorrelationUtc} from './processCorrelations'
import {isProcessReleaseVersion} from './processReleases'

type EventReceiptObservation = Readonly<{
  receiptId: string
  eventId: string
  releaseVersion: string
  activationRevision: number
  admittedAt: string
  receivedAt: string
}>

type EventFailureCode = 'LATE' | 'RELEASE_CHANGED' | 'ROUTE_REVOKED' | 'INVALID_PAYLOAD' | 'EXPIRED'
type EventReceiptLink = {instanceId: string; nodeExecutionRef: string | null}
  | {instanceId: null; nodeExecutionRef: null}

export type ProcessEventReceiptDTO = EventReceiptObservation & Readonly<
  | {state: 'RECEIVED'; instanceId: null; nodeExecutionRef: null; decidedAt: null; decisionCode: null}
  | {state: 'APPLIED'; instanceId: string; nodeExecutionRef: string | null; decidedAt: string; decisionCode: 'APPLIED'}
  | (EventReceiptLink & {
      state: 'IGNORED_LATE' | 'REJECTED' | 'DEAD'
      decidedAt: string
      decisionCode: EventFailureCode | null
    })
>

const LOGICAL_ID = /^[A-Za-z][A-Za-z0-9_.:-]{0,127}(?![\s\S])/
const RECEIPT_FIELDS = ['receiptId', 'eventId', 'state', 'releaseVersion', 'activationRevision',
  'admittedAt', 'instanceId', 'nodeExecutionRef', 'receivedAt', 'decidedAt', 'decisionCode']

function isLogicalId(value: unknown): value is string {
  return typeof value === 'string' && LOGICAL_ID.test(value)
}

function isOpaqueInstanceId(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 255 && value.trim().length > 0
    && !/[\p{Cc}\p{Surrogate}]/u.test(value)
}

// Comparing validated instants with the same fractional width preserves microsecond ordering.
function instantKey(value: string): string {
  return value.slice(0, 19) + value.slice(20, -1).padEnd(6, '0')
}

function invalidReceipt(): never {
  throw new Error('服务返回的流程事件回执无效')
}

function parseReceipt(value: unknown, requestedId: string): ProcessEventReceiptDTO {
  if (!value || typeof value !== 'object' || Array.isArray(value)
      || Object.keys(value).length !== RECEIPT_FIELDS.length
      || !RECEIPT_FIELDS.every(field => Object.hasOwn(value, field))) return invalidReceipt()
  const {receiptId, eventId, state, releaseVersion, activationRevision, admittedAt, instanceId,
    nodeExecutionRef, receivedAt, decidedAt, decisionCode} = value as Record<string, unknown>
  if (receiptId !== requestedId || !isLogicalId(eventId) || !isProcessReleaseVersion(releaseVersion)
      || typeof activationRevision !== 'number' || !Number.isSafeInteger(activationRevision)
      || activationRevision < 1 || activationRevision > 999_999_999_999_999
      || !isProcessCorrelationUtc(admittedAt) || !isProcessCorrelationUtc(receivedAt)
      || instantKey(admittedAt) !== instantKey(receivedAt)) return invalidReceipt()

  const observation = {receiptId, eventId, releaseVersion, activationRevision, admittedAt, receivedAt}
  if (state === 'RECEIVED') {
    if (instanceId !== null || nodeExecutionRef !== null || decidedAt !== null || decisionCode !== null) {
      return invalidReceipt()
    }
    return {...observation, state, instanceId, nodeExecutionRef, decidedAt, decisionCode}
  }

  if (!isProcessCorrelationUtc(decidedAt) || instantKey(decidedAt) < instantKey(receivedAt)
      || (nodeExecutionRef !== null && !isLogicalId(nodeExecutionRef))) return invalidReceipt()

  if (state === 'APPLIED') {
    if (!isOpaqueInstanceId(instanceId) || decisionCode !== 'APPLIED') return invalidReceipt()
    return {...observation, state, instanceId, nodeExecutionRef, decidedAt, decisionCode}
  }
  if (state !== 'IGNORED_LATE' && state !== 'REJECTED' && state !== 'DEAD') return invalidReceipt()
  if (decisionCode !== null && decisionCode !== 'LATE' && decisionCode !== 'RELEASE_CHANGED'
      && decisionCode !== 'ROUTE_REVOKED' && decisionCode !== 'INVALID_PAYLOAD' && decisionCode !== 'EXPIRED') {
    return invalidReceipt()
  }
  if (instanceId === null) {
    if (nodeExecutionRef !== null) return invalidReceipt()
    return {...observation, state, instanceId, nodeExecutionRef, decidedAt, decisionCode}
  }
  if (!isOpaqueInstanceId(instanceId)) return invalidReceipt()
  return {...observation, state, instanceId, nodeExecutionRef, decidedAt, decisionCode}
}

export const processEventsApi = {
  async getReceipt(tenant: string, receiptId: string, signal?: AbortSignal): Promise<ProcessEventReceiptDTO> {
    if (!isLogicalId(receiptId)) throw new Error('流程事件回执标识无效')
    const path = '/api/tianji/v2/process-event-receipts/' + encodeURIComponent(receiptId)
    const value = await requestJson<unknown>(path, tenant, {method: 'GET', cache: 'no-store', signal}, 200)
    return parseReceipt(value, receiptId)
  },
}
