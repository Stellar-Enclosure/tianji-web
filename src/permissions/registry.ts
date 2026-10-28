import {FrontendResourceRegistry} from '@stellar-enclosure/stellar-enclosure-tianquan-jianshen-react-sdk'
import {references} from './references'
import {resources} from './resources'

export const resourceRegistry = new FrontendResourceRegistry(resources, references)
