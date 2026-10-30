import {defineResourceReferences} from '@stellar-enclosure/stellar-enclosure-web-shared/permissions'

export const references = defineResourceReferences([
  {key: 'tianji.api.authorization.current', usage: 'CALLS'},
  {key: 'tianji.api.agent.list', usage: 'CALLS'},
  {key: 'tianji.api.agent.start', usage: 'CALLS'},
  {key: 'tianji.api.agent.get', usage: 'CALLS'},
  {key: 'tianji.api.agent.result', usage: 'CALLS'},
  {key: 'tianji.api.agent.events', usage: 'CALLS'},
  {key: 'tianji.api.agent.cancel', usage: 'CALLS'},
  {key: 'tianji.api.memory.candidates', usage: 'CALLS'},
  {key: 'tianji.api.memory.correct', usage: 'CALLS'},
  {key: 'tianji.api.memory.forget', usage: 'CALLS'},
  {key: 'tianji.api.memory.preparePreferences', usage: 'CALLS'},
  {key: 'tianji.api.memory.extractPreferences', usage: 'CALLS'},
  {key: 'tianji.api.memory.mergeSuggestions', usage: 'CALLS'},
] as const)
