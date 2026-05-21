

export const STANDS_QK = {
  all: ["stands"] as const,
  byOwner: (ownerExternalId: string) => ["stands", "owner", ownerExternalId] as const,
  one: (standId: string) => ["stands", "id", standId] as const,
  active: () => ["stands", "active"] as const,
} as const;

export const CAPACITY_QK = {
  all: ["capacity"] as const,
  current: () => ["capacity", "current"] as const,
} as const;

export const POOL_QK = {
  all: ["pool"] as const,
  inventory: () => ["pool", "inventory"] as const,
  projects: () => ["pool", "projects"] as const,
  discover: (domainId?: string) =>
    domainId ? (["pool", "discover", domainId] as const) : (["pool", "discover"] as const),
} as const;

export const CLOUD_QK = {
  images: () => ["cloud", "images"] as const,
  flavors: () => ["cloud", "flavors"] as const,
  networks: () => ["cloud", "networks"] as const,
} as const;

export const INSPECTOR_QK = {
  all: ["inspector"] as const,
  runsForStand: (standId: string) => ["inspector", "stand", standId] as const,
  run: (runId: string) => ["inspector", "run", runId] as const,
} as const;

export const ADMIN_QK = {
  lifecycleSettings: () => ["admin", "lifecycle-settings"] as const,
} as const;

export const MAPPINGS_QK = {
  all: ["mappings"] as const,
  list: (ltiContextId?: string) =>
    ltiContextId ? (["mappings", "context", ltiContextId] as const) : (["mappings", "all"] as const),
} as const;

export const PLATFORMS_QK = {
  all: ["platforms"] as const,
  list: () => ["platforms", "list"] as const,
} as const;

export const HEALTH_QK = {
  liveness: () => ["health", "liveness"] as const,
  readiness: () => ["health", "readiness"] as const,
} as const;

export const AUTH_QK = {
  me: () => ["auth", "me"] as const,
} as const;
