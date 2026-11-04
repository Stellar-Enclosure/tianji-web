import {describe, expect, it} from 'vitest'
import {actionReducer, type OrchestrationActionEvent, type OrchestrationActionState} from './orchestrationAction'

type Command = Readonly<{commandId: string; expectedVersion: string; form: Readonly<Record<string, string | number | boolean>>}>
const idle = (): OrchestrationActionState<Command> => ({phase: 'idle'})
const command = (): Command => Object.freeze({commandId: 'command-1', expectedVersion: 'a'.repeat(64),
  form: Object.freeze({approved: false, comment: '需补充票据'})})

describe('Orchestration action State protocol', () => {
  it('moves from idle through proposed and submitting to an unknown outcome with the exact frozen command', () => {
    const original = command()
    const proposed = actionReducer(idle(), {type: 'propose', command: original})
    expect(proposed).toEqual({phase: 'proposed', command: original})
    expect(proposed.phase === 'proposed' && proposed.command).toBe(original)
    expect(Object.isFrozen(original)).toBe(true)
    expect(Object.isFrozen(original.form)).toBe(true)

    const submitting = actionReducer(proposed, {type: 'send'})
    expect(submitting).toEqual({phase: 'submitting', command: original})
    const unknown = actionReducer(submitting, {type: 'uncertain'})
    expect(unknown).toEqual({phase: 'unknown', command: original})
    const retrying = actionReducer(unknown, {type: 'send'})
    expect(retrying).toEqual({phase: 'submitting', command: original})
    expect(retrying.phase === 'submitting' && retrying.command).toBe(original)
  })

  it('settles only a submitted command and permits cancellation only before send', () => {
    const original = command()
    const proposed = actionReducer(idle(), {type: 'propose', command: original})
    expect(actionReducer(proposed, {type: 'cancelProposal'})).toEqual({phase: 'idle'})
    const submitting = actionReducer(proposed, {type: 'send'})
    expect(actionReducer(submitting, {type: 'settled'})).toEqual({phase: 'idle'})
  })

  it('resets every non-idle phase without retaining a command', () => {
    const original = command()
    const proposed: OrchestrationActionState<Command> = {phase: 'proposed', command: original}
    const submitting: OrchestrationActionState<Command> = {phase: 'submitting', command: original}
    const unknown: OrchestrationActionState<Command> = {phase: 'unknown', command: original}
    expect(actionReducer(proposed, {type: 'reset'})).toEqual({phase: 'idle'})
    expect(actionReducer(submitting, {type: 'reset'})).toEqual({phase: 'idle'})
    expect(actionReducer(unknown, {type: 'reset'})).toEqual({phase: 'idle'})
  })

  it('keeps the same state object for every illegal transition and never replaces an in-flight command', () => {
    const first = command(), other = Object.freeze({...command(), commandId: 'other-command'})
    const proposed: OrchestrationActionState<Command> = {phase: 'proposed', command: first}
    const submitting: OrchestrationActionState<Command> = {phase: 'submitting', command: first}
    const unknown: OrchestrationActionState<Command> = {phase: 'unknown', command: first}
    const cases: readonly [OrchestrationActionState<Command>, OrchestrationActionEvent<Command>][] = [
      [idle(), {type: 'send'}], [idle(), {type: 'uncertain'}], [idle(), {type: 'settled'}], [idle(), {type: 'cancelProposal'}],
      [proposed, {type: 'propose', command: other}], [proposed, {type: 'uncertain'}], [proposed, {type: 'settled'}],
      [submitting, {type: 'propose', command: other}], [submitting, {type: 'send'}], [submitting, {type: 'cancelProposal'}],
      [unknown, {type: 'propose', command: other}], [unknown, {type: 'uncertain'}], [unknown, {type: 'settled'}], [unknown, {type: 'cancelProposal'}],
    ]
    for (const [state, event] of cases) expect(actionReducer(state, event)).toBe(state)
  })
})
