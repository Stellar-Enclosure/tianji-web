import type {MemoryActiveFact, MemoryCandidate} from '../api/memory'
import type {MemoryMergePage} from '../api/memoryMerge'
import {candidate} from './memoryFixtures'

export const activeMemory = (id = 'active-a', source = candidate()): MemoryActiveFact => ({...source, memoryId: id, state: 'ACTIVE', confirmed: true,
  content: {text: `已有事实 ${id}`, facts: {language: '中文', format: '简洁'}}, confidence: 0.25})
export const memoryMergePage = (source: MemoryCandidate = candidate()): MemoryMergePage => ({candidate: source, semantic: false,
  items: [{hit: {entry: activeMemory('active-a', source), score: null}, relation: 'SHARED_VALUES'}], nextAfterMemoryId: null})
