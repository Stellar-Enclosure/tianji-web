export type OrchestrationActionState<Command extends object> =
  | Readonly<{phase: 'idle'}>
  | Readonly<{phase: 'proposed'; command: Command}>
  | Readonly<{phase: 'submitting'; command: Command}>
  | Readonly<{phase: 'unknown'; command: Command}>

export type OrchestrationActionEvent<Command extends object> =
  | Readonly<{type: 'propose'; command: Command}>
  | Readonly<{type: 'cancelProposal'}>
  | Readonly<{type: 'send'}>
  | Readonly<{type: 'uncertain'}>
  | Readonly<{type: 'settled'}>
  | Readonly<{type: 'reset'}>

export const actionReducer = <Command extends object>(
  state: OrchestrationActionState<Command>, event: OrchestrationActionEvent<Command>,
): OrchestrationActionState<Command> => {
  if (event.type === 'reset') return {phase: 'idle'}
  if (state.phase === 'idle' && event.type === 'propose') return {phase: 'proposed', command: event.command}
  if (state.phase === 'proposed' && event.type === 'cancelProposal') return {phase: 'idle'}
  if ((state.phase === 'proposed' || state.phase === 'unknown') && event.type === 'send') {
    return {phase: 'submitting', command: state.command}
  }
  if (state.phase === 'submitting' && event.type === 'uncertain') return {phase: 'unknown', command: state.command}
  if (state.phase === 'submitting' && event.type === 'settled') return {phase: 'idle'}
  return state
}
