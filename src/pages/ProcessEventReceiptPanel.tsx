import {ApiError} from '@stellar-enclosure/stellar-enclosure-web-shared'
import {Alert, Button, Descriptions, Empty, Space, Tag, Typography} from 'antd'
import {useCallback, useEffect, useLayoutEffect, useRef, useState} from 'react'
import {processEventsApi, type ProcessEventReceiptDTO} from '../api/processEvents'
import {gatewayAuth} from '../auth/gatewayAuth'
import {useAuth} from '../auth/AuthContext'

const PAGE = 'tianji.page.processInstance'

export type ProcessEventReceiptPanelProps = Readonly<{instanceId: string; receiptId?: string}>

type ReceiptState = Readonly<{
  phase: 'loaded' | 'not-visible' | 'unavailable'
  receipt?: ProcessEventReceiptDTO
}>

function decisionLabel(receipt: ProcessEventReceiptDTO): string {
  switch (receipt.state) {
    case 'RECEIVED': return '事件已接纳，等待处理'
    case 'APPLIED': return '事件已应用'
    case 'IGNORED_LATE': return '事件已忽略'
    case 'REJECTED': return '事件已拒绝'
    case 'DEAD': return '事件处理已结束'
  }
}

function failureLabel(failure: unknown): 'not-visible' | 'unavailable' {
  if (failure instanceof ApiError && [401, 403, 404].includes(failure.status)) return 'not-visible'
  return 'unavailable'
}

export function ProcessEventReceiptPanel({instanceId, receiptId}: ProcessEventReceiptPanelProps) {
  const {status, authorization, allows} = useAuth()
  const canObserve = status === 'ready' && !!authorization && allows(PAGE)
  if (!canObserve || !authorization) return <Alert type="warning" showIcon message="当前无法观察该事件回执。" />
  if (!receiptId) return <Empty description="暂无关联事件回执" />
  const {identity, binding} = authorization
  const scopeKey = JSON.stringify([identity.issuer, identity.subject, identity.tenantId, binding.requestEpoch,
    canObserve, instanceId, receiptId])
  return <EventReceiptObservation key={scopeKey} tenant={identity.tenantId} epoch={binding.requestEpoch}
    instanceId={instanceId} receiptId={receiptId} />
}

function EventReceiptObservation({tenant, epoch, instanceId, receiptId}: {
  tenant: string; epoch: number; instanceId: string; receiptId: string
}) {
  const {allows} = useAuth()
  const currentAllows = useRef(allows)
  const request = useRef<AbortController | null>(null)
  const sequence = useRef(0)
  const [observation, setObservation] = useState<ReceiptState>()
  const isCurrent = useCallback((controller: AbortController, current: number) =>
    !controller.signal.aborted && gatewayAuth.context.epoch === epoch && sequence.current === current
      && currentAllows.current(PAGE), [epoch])

  useLayoutEffect(() => { currentAllows.current = allows }, [allows])
  useLayoutEffect(() => () => {
    sequence.current += 1
    request.current?.abort()
    request.current = null
  }, [])

  const read = useCallback(() => {
    request.current?.abort()
    const controller = new AbortController()
    request.current = controller
    const current = ++sequence.current
    void processEventsApi.getReceipt(tenant, receiptId, controller.signal).then(receipt => {
      if (!isCurrent(controller, current)) return
      if (receipt.instanceId !== null && receipt.instanceId !== instanceId) {
        setObservation({phase: 'not-visible'})
        return
      }
      setObservation({phase: 'loaded', receipt})
    }).catch(failure => {
      if (!isCurrent(controller, current)) return
      const phase = failureLabel(failure)
      setObservation(previous => phase === 'unavailable' && previous?.receipt
        ? {...previous, phase: 'unavailable'} : {phase})
    }).finally(() => {
      if (request.current === controller) request.current = null
    })
  }, [instanceId, isCurrent, receiptId, tenant])

  useEffect(() => {
    read()
    return () => {
      sequence.current += 1
      request.current?.abort()
      request.current = null
    }
  }, [read])

  if (!observation) return <section aria-label="事件回执"><div role="status">正在读取事件回执</div></section>
  if (observation.phase === 'not-visible') {
    return <Alert type="warning" showIcon message="当前无法观察该事件回执。" />
  }
  if (!observation.receipt) return <Alert type="warning" showIcon title="暂时无法读取该事件回执。"
    action={<Button onClick={read}>重新读取</Button>} />
  const receipt = observation.receipt
  const stale = observation.phase === 'unavailable'
  return <section aria-labelledby="process-event-receipt-heading" className="page-stack">
    <header className="page-heading">
      <div>
        <Typography.Title level={4} id="process-event-receipt-heading">事件回执</Typography.Title>
        <Space>
          <Tag color={receipt.state === 'APPLIED' ? 'success' : receipt.state === 'RECEIVED' ? 'processing' : 'default'}>
            {decisionLabel(receipt)}
          </Tag>
          {stale && <Tag color="warning">观察结果可能已过期</Tag>}
        </Space>
      </div>
      <Button onClick={read}>重新读取</Button>
    </header>
    <Descriptions size="small" column={{xs: 1, sm: 2}} bordered>
      <Descriptions.Item label="发布版本">{receipt.releaseVersion}</Descriptions.Item>
      <Descriptions.Item label="生效修订">修订 {receipt.activationRevision}</Descriptions.Item>
      {receipt.instanceId === null && <Descriptions.Item label="流程关联">未关联流程实例</Descriptions.Item>}
      <Descriptions.Item label="接纳时间"><UtcTime value={receipt.admittedAt} /></Descriptions.Item>
      <Descriptions.Item label="决定时间">{receipt.decidedAt
        ? <UtcTime value={receipt.decidedAt} /> : '尚未决定'}</Descriptions.Item>
      {receipt.decisionCode && <Descriptions.Item label="处理代码">{receipt.decisionCode}</Descriptions.Item>}
      {receipt.instanceId && <Descriptions.Item label="关联实例">{receipt.instanceId}</Descriptions.Item>}
      {receipt.nodeExecutionRef && <Descriptions.Item label="节点执行">{receipt.nodeExecutionRef}</Descriptions.Item>}
    </Descriptions>
    {stale && <Alert type="warning" showIcon message="暂时无法读取最新回执，当前显示的是此前读取的服务端状态。" />}
  </section>
}

function UtcTime({value}: {value: string}) {
  return <time dateTime={value} title={value}>{value} UTC</time>
}
