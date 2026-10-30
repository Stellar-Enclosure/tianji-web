import {fireEvent, render, screen, waitFor} from '@testing-library/react'
import {beforeEach, describe, expect, it, vi} from 'vitest'
import {memoryMergeApi} from '../api/memoryMerge'
import {candidate} from '../test/memoryFixtures'
import {memoryMergePage} from '../test/memoryMergeFixtures'
import MemoryMergeDialog from './MemoryMergeDialog'

vi.mock('../api/memoryMerge', () => ({memoryMergeApi: {compare: vi.fn()}}))
const source = candidate()

describe('Human memory comparison', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.mocked(memoryMergeApi.compare).mockResolvedValue(memoryMergePage(source)) })

  it('starts with fact-only comparison, displays current source confidence and offers no mutations', async () => {
    render(<MemoryMergeDialog tenant="20" candidate={source} onClose={() => {}} />)
    expect(await screen.findByText('已有事实 active-a')).toBeInTheDocument()
    expect(memoryMergeApi.compare).toHaveBeenCalledWith('20', {owner: source.owner, scopeId: source.scopeId, memoryId: source.memoryId, expectedRevision: source.revision,
      semantic: false, minimumScore: null, afterMemoryId: null, limit: 5}, source.contentSha256, expect.any(AbortSignal))
    expect(screen.getByText('来源置信度 25%')).toBeInTheDocument(); expect(screen.queryByRole('button', {name: /确认|更正|丢弃|合并/})).not.toBeInTheDocument()
  })

  it('continues a scan even when the current comparison page has no related rows', async () => {
    vi.mocked(memoryMergeApi.compare).mockResolvedValueOnce({...memoryMergePage(source), items: [], nextAfterMemoryId: 'active-0'}).mockResolvedValueOnce(memoryMergePage(source))
    render(<MemoryMergeDialog tenant="20" candidate={source} onClose={() => {}} />)
    expect(await screen.findByText(/仍可继续比较后续事实/)).toBeInTheDocument(); fireEvent.click(screen.getByRole('button', {name: '继续比较'}))
    expect(await screen.findByText('已有事实 active-a')).toBeInTheDocument(); expect(vi.mocked(memoryMergeApi.compare).mock.calls[1][1].afterMemoryId).toBe('active-0')
  })

  it('requires an explicit semantic request and shows ranking separately from confidence', async () => {
    const semantic = {...memoryMergePage(source), semantic: true, items: [{...memoryMergePage(source).items[0], hit: {...memoryMergePage(source).items[0].hit, score: 0.9}}]}
    vi.mocked(memoryMergeApi.compare).mockResolvedValueOnce(memoryMergePage(source)).mockResolvedValueOnce(semantic)
    render(<MemoryMergeDialog tenant="20" candidate={source} onClose={() => {}} />); await screen.findByText('已有事实 active-a')
    fireEvent.mouseDown(screen.getByRole('combobox', {name: '比较方式'})); fireEvent.click(await screen.findByText('语义比较（需策略允许）'))
    expect(memoryMergeApi.compare).toHaveBeenCalledTimes(1); fireEvent.click(screen.getByRole('button', {name: /开始比较/}))
    expect(await screen.findByText('相似度 90%')).toBeInTheDocument(); expect(screen.getByText('来源置信度 25%')).toBeInTheDocument()
    expect(vi.mocked(memoryMergeApi.compare).mock.calls[1][1]).toMatchObject({semantic: true, minimumScore: 0.7, afterMemoryId: null})
  })

  it('aborts an outstanding comparison when its dialog is removed', async () => {
    vi.mocked(memoryMergeApi.compare).mockImplementation(() => new Promise(() => {}))
    const current = render(<MemoryMergeDialog tenant="20" candidate={source} onClose={() => {}} />)
    await waitFor(() => expect(memoryMergeApi.compare).toHaveBeenCalledTimes(1)); const signal = vi.mocked(memoryMergeApi.compare).mock.calls[0][3]
    current.unmount(); expect(signal?.aborted).toBe(true)
  })
})
