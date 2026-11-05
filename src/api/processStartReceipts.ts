import {requestJson} from './client'
import {isProcessCorrelationUtc} from './processCorrelations'
import {isProcessInstanceId} from './processWorkerFailures'

export type ProcessStartReceiptQuery = Readonly<{commandId: string; requestSha256: string}>
export type ProcessStartReceipt = Readonly<{instanceId: string; status: 'APPLIED'; recordedAt: string}>

const command = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}(?![\s\S])/
const digest = /^[0-9a-f]{64}(?![\s\S])/
const fields = ['instanceId', 'status', 'recordedAt']
const invalid = (): never => { throw new Error('服务返回的 START 回执无效') }

export function isProcessStartReceiptQuery(value: ProcessStartReceiptQuery): boolean {
  return typeof value.commandId === 'string' && command.test(value.commandId)
    && typeof value.requestSha256 === 'string' && digest.test(value.requestSha256)
}

function parseReceipt(value: unknown): ProcessStartReceipt {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return invalid()
  const result = value as Record<string, unknown>
  if (Object.keys(result).length !== fields.length || !fields.every(field => Object.hasOwn(result, field))
      || !isProcessInstanceId(result.instanceId) || result.status !== 'APPLIED' || !isProcessCorrelationUtc(result.recordedAt)) {
    return invalid()
  }
  return {instanceId: result.instanceId, status: result.status, recordedAt: result.recordedAt}
}

export const processStartReceiptsApi = {
  async get(tenant: string, query: ProcessStartReceiptQuery, signal?: AbortSignal): Promise<ProcessStartReceipt> {
    if (!isProcessStartReceiptQuery(query)) throw new Error('START 回执查询条件无效')
    const params = new URLSearchParams({commandId: query.commandId, requestSha256: query.requestSha256})
    const result = await requestJson<unknown>('/api/tianji/v1/process-start-receipts?' + params.toString(),
      tenant, {method: 'GET', cache: 'no-store', signal})
    return parseReceipt(result)
  },
}
