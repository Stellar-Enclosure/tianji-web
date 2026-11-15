import {beforeEach, describe, expect, it, vi} from 'vitest'
import {requestJson} from './client'
import {processEventsApi} from './processEvents'

vi.mock('./client', () => ({requestJson: vi.fn()}))
const request = vi.mocked(requestJson)

const received = {
  receiptId: 'er-101',
  eventId: 'producer:evt-101',
  state: 'RECEIVED',
  releaseVersion: 'auto-2',
  activationRevision: 2,
  admittedAt: '2026-11-12T08:40:00.123455Z',
  instanceId: null,
  nodeExecutionRef: null,
  receivedAt: '2026-11-12T08:40:00.123455Z',
  decidedAt: null,
  decisionCode: null,
}
const applied = {
  ...received, state: 'APPLIED', instanceId: 'pi-1', decidedAt: '2026-11-12T08:40:00.123456Z', decisionCode: 'APPLIED',
}

beforeEach(() => request.mockReset())

describe('Process event receipt client', () => {
  it('reads only a known receipt with the verified tenant, no-store and abort signal', async () => {
    const signal = new AbortController().signal
    request.mockResolvedValueOnce(received)

    await expect(processEventsApi.getReceipt('20', 'er-101', signal)).resolves.toEqual(received)
    expect(request).toHaveBeenCalledExactlyOnceWith('/api/tianji/v2/process-event-receipts/er-101',
      '20', {method: 'GET', cache: 'no-store', signal}, 200)
    expect(Object.keys(processEventsApi)).toEqual(['getReceipt'])
  })

  it('preserves native linkage and the terminal decision in the wire projection', async () => {
    const signalReceipt = {...applied, nodeExecutionRef: 'exec:node-1'}
    const rejected = {...received, state: 'REJECTED', decidedAt: received.receivedAt, decisionCode: 'INVALID_PAYLOAD'}
    const dead = {...rejected, state: 'DEAD', decisionCode: null}
    request.mockResolvedValueOnce(applied).mockResolvedValueOnce(signalReceipt)
      .mockResolvedValueOnce(rejected).mockResolvedValueOnce(dead)

    await expect(processEventsApi.getReceipt('20', 'er-101')).resolves.toEqual(applied)
    await expect(processEventsApi.getReceipt('20', 'er-101')).resolves.toEqual(signalReceipt)
    await expect(processEventsApi.getReceipt('20', 'er-101')).resolves.toEqual(rejected)
    await expect(processEventsApi.getReceipt('20', 'er-101')).resolves.toEqual(dead)
  })

  it('propagates access denial and not-found without a substitute receipt', async () => {
    for (const status of [401, 403, 404]) {
      const failure = {status}
      request.mockImplementationOnce(async () => { throw failure })
      await expect(processEventsApi.getReceipt('20', 'er-101')).rejects.toBe(failure)
    }
    expect(request).toHaveBeenCalledTimes(3)
  })

  it('encodes valid logical IDs and rejects malformed identifiers before transport', async () => {
    await expect(processEventsApi.getReceipt('20', '../er-101')).rejects.toThrow()
    await expect(processEventsApi.getReceipt('20', 'er-101\n')).rejects.toThrow()
    expect(request).not.toHaveBeenCalled()

    request.mockResolvedValueOnce({...received, receiptId: 'er:101'})
    await processEventsApi.getReceipt('20', 'er:101')
    expect(request.mock.calls[0]?.[0]).toBe('/api/tianji/v2/process-event-receipts/er%3A101')
  })

  it('rejects missing fields, extra fields, out-of-range data and contradictory states', async () => {
    const {decisionCode: omitted, ...withoutDecision} = received
    expect(omitted).toBeNull()
    for (const invalid of [
      withoutDecision,
      {...received, payload: {}},
      {...received, waitToken: 'secret'},
      {...received, producerSubject: 'private'},
      {...received, receiptId: 'other'},
      {...received, activationRevision: 1000000000000000},
      {...received, receivedAt: '2026-11-12T08:40:00.123456Z'},
      {...received, receivedAt: '2026-11-12T08:40:00.123455+00:00'},
      {...received, instanceId: 'pi-1'},
      {...received, nodeExecutionRef: 'node-1'},
      {...received, state: 'IN_PROGRESS'},
      {...applied, instanceId: null},
      {...applied, instanceId: 'pi-1\t'},
      {...applied, decidedAt: null},
      {...applied, decidedAt: '2026-11-12T08:40:00.123454Z'},
      {...applied, decisionCode: 'NEW_REASON'},
      {...applied, state: 'IGNORED_LATE'},
    ]) {
      request.mockResolvedValueOnce(invalid)
      await expect(processEventsApi.getReceipt('20', 'er-101')).rejects.toThrow()
    }
  })
})
