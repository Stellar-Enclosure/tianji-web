import type {PublicOAuthIdentity} from '@stellar-enclosure/stellar-enclosure-web-shared'

const STORAGE_KEY = 'tianji.agent-event-checkpoint.v1'

export async function openAgentEventCheckpoint(identity: PublicOAuthIdentity, runId: string) {
  let owner: string | undefined
  try {
    const {issuer, tenantId, subject, clientId, resource} = identity
    const binding = new TextEncoder().encode(JSON.stringify([STORAGE_KEY, issuer, tenantId, subject, clientId, resource, runId]))
    const digest = await crypto.subtle.digest('SHA-256', binding)
    owner = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
  } catch {
    // The authenticated stream can start from the beginning if local storage or hashing is unavailable.
  }

  const read = (): number => {
    if (!owner) return 0
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY)
      if (!raw || raw.length > 256) return 0
      const value: {owner?: unknown; sequence?: unknown} | null = JSON.parse(raw)
      return value?.owner === owner && typeof value.sequence === 'number'
        && Number.isSafeInteger(value.sequence) && value.sequence > 0 ? value.sequence : 0
    } catch {
      return 0
    }
  }

  return {
    read,
    advance(sequence: number) {
      if (!owner || sequence <= read()) return
      try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify({owner, sequence})) } catch { /* Observation can continue. */ }
    },
    clear() {
      if (read() > 0) clearAgentEventCheckpoint()
    },
  }
}

export function clearAgentEventCheckpoint(): void {
  try { sessionStorage.removeItem(STORAGE_KEY) } catch { /* Local storage is optional. */ }
}
