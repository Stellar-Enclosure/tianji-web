import {ApiError} from '@stellar-enclosure/stellar-enclosure-web-shared'
import {Alert, Button, Card, Empty, InputNumber, Modal, Select, Space, Spin, Tag, Typography} from 'antd'
import {useEffect, useState} from 'react'
import type {MemoryActiveFact, MemoryCandidate} from '../api/memory'
import {memoryMergeApi, type MemoryMergePage, type MemoryMergeRelation} from '../api/memoryMerge'

const relationLabels: Record<MemoryMergeRelation, string> = {DIFFERING_FIELDS: '共同字段的值不同', SHARED_VALUES: '包含相同内容或字段值', RELATED_CONTENT: '语义相关'}
const kindLabels = {FACT: '事实', PREFERENCE: '偏好', EXPERIENCE: '经验'}
const sensitivityLabels = {PUBLIC: '公开', INTERNAL: '内部', CONFIDENTIAL: '机密', RESTRICTED: '受限'}

export default function MemoryMergeDialog({tenant, candidate, onClose}: {tenant: string; candidate: MemoryCandidate; onClose: () => void}) {
  const [draftMode, setDraftMode] = useState<'FACT' | 'SEMANTIC'>('FACT')
  const [threshold, setThreshold] = useState<number | null>(0.7)
  const [selection, setSelection] = useState<{semantic: boolean; minimumScore: number | null}>({semantic: false, minimumScore: null})
  const [cursors, setCursors] = useState<(string | null)[]>([null])
  const [pageIndex, setPageIndex] = useState(0)
  const [page, setPage] = useState<MemoryMergePage>()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>()

  useEffect(() => {
    const controller = new AbortController()
    void memoryMergeApi.compare(tenant, {owner: candidate.owner, scopeId: candidate.scopeId, memoryId: candidate.memoryId, expectedRevision: candidate.revision,
      ...selection, afterMemoryId: cursors[pageIndex], limit: 5}, candidate.contentSha256, controller.signal).then(result => {
      if (!controller.signal.aborted) setPage(result)
    }).catch(failure => {
      if (!controller.signal.aborted) setError(failure instanceof ApiError && failure.status === 409 ? '候选已变化，请关闭比较并刷新候选列表。'
        : failure instanceof ApiError && failure.status === 413 ? '当前内容或范围超出比较上限，可选择字段比较。'
          : '暂时无法比较当前记忆，请核对权限、业务策略或连接后重试。')
    }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [tenant, candidate, selection, cursors, pageIndex])

  const compare = () => {
    if (loading || draftMode === 'SEMANTIC' && (threshold === null || !Number.isFinite(threshold) || threshold < 0 || threshold > 1)) return
    setSelection({semantic: draftMode === 'SEMANTIC', minimumScore: draftMode === 'SEMANTIC' ? threshold : null})
    setCursors([null]); setPageIndex(0); setPage(undefined); setError(undefined); setLoading(true)
  }
  const turn = (index: number) => { setPageIndex(index); setPage(undefined); setError(undefined); setLoading(true) }

  return <Modal title="候选记忆比较" open width={960} onCancel={onClose} footer={<Button onClick={onClose}>关闭比较</Button>} styles={{body: {maxHeight: '70vh', overflowY: 'auto'}}}>
    <Typography.Paragraph>比较结果用于人工核对。相似度用于排列结果，确认或丢弃请返回候选审阅。</Typography.Paragraph>
    <Space wrap className="form-alert">
      <Select aria-label="比较方式" value={draftMode} disabled={loading} onChange={setDraftMode} options={[{value: 'FACT', label: '字段比较'}, {value: 'SEMANTIC', label: '语义比较（需策略允许）'}]} />
      {draftMode === 'SEMANTIC' && <Space><Typography.Text>最低相似度（0–1）</Typography.Text><InputNumber aria-label="最低相似度" min={0} max={1} step={0.05} value={threshold} disabled={loading} onChange={setThreshold} /></Space>}
      <Button loading={loading} onClick={compare} disabled={draftMode === 'SEMANTIC' && threshold === null}>开始比较</Button>
      <Tag>{selection.semantic ? '当前显示：语义比较' : '当前显示：字段比较'}</Tag>
    </Space>
    {draftMode === 'SEMANTIC' && <Typography.Paragraph type="secondary">语义比较将按业务数据策略处理候选内容。</Typography.Paragraph>}
    {error && <Alert type="warning" showIcon title={error} className="form-alert" />}
    <div className="memory-comparison-grid">
      <Card size="small" title="待审候选"><Entry entry={page?.candidate ?? candidate} /></Card>
      <div className="page-stack">
        {loading && <Spin description="正在比较当前事实" />}
        {!loading && !error && page?.items.length === 0 && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={page.nextAfterMemoryId ? '本页未找到匹配项，仍可继续比较后续事实。' : '当前范围未找到可供比较的已确认条目。'} />}
        {page?.items.map(item => <Card size="small" key={item.hit.entry.memoryId} title={<Space wrap><Tag color={item.relation === 'DIFFERING_FIELDS' ? 'warning' : 'default'}>{relationLabels[item.relation]}</Tag>
          {item.hit.score !== null && <Typography.Text>相似度 {Math.round(item.hit.score * 100)}%</Typography.Text>}</Space>}>
          <Entry entry={item.hit.entry} />
        </Card>)}
      </div>
    </div>
    {!selection.semantic && <div className="pagination-row"><Typography.Text type="secondary">第 {pageIndex + 1} 页比较结果</Typography.Text><Space>
      <Button disabled={pageIndex === 0 || loading} onClick={() => turn(pageIndex - 1)}>上一页比较</Button>
      <Button disabled={!page?.nextAfterMemoryId || loading} onClick={() => { setCursors(values => [...values.slice(0, pageIndex + 1), page?.nextAfterMemoryId ?? null]); turn(pageIndex + 1) }}>继续比较</Button>
    </Space></div>}
  </Modal>
}

function Entry({entry}: {entry: MemoryCandidate | MemoryActiveFact}) {
  return <>
    <Space wrap><Tag>{entry.confirmed ? '已确认' : '待确认'}</Tag><Tag>{kindLabels[entry.kind]}</Tag><Tag>{sensitivityLabels[entry.sensitivity]}</Tag><Typography.Text type="secondary">来源置信度 {Math.round(entry.confidence * 100)}%</Typography.Text></Space>
    {entry.content.text && <Typography.Paragraph className="event-summary">{entry.content.text}</Typography.Paragraph>}
    {Object.entries(entry.content.facts).map(([key, value]) => <Typography.Paragraph key={key} className="event-summary"><Typography.Text strong>{key}：</Typography.Text>{value}</Typography.Paragraph>)}
    <Typography.Paragraph type="secondary" className="event-summary">来源声明：{entry.source.reference}</Typography.Paragraph>
    <Typography.Text type="secondary">版本 {entry.revision} · {entry.memoryId}</Typography.Text>
  </>
}
