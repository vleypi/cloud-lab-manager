

export const ROUTES = {
  ROOT: "/",
  LOGIN: "/login",

  ADMIN: {
    OVERVIEW: "/admin",
    POOL: "/admin/pool",
    STANDS: "/admin/stands",
    STAND: (standId: string) => `/admin/stands/${standId}`,
    MAPPINGS: "/admin/mappings",
    PLATFORMS: "/admin/platforms",
    SETTINGS: "/admin/settings",
  },

  LTI: {
    LAUNCHING: (standId: string) => `/lti/launching/${standId}`,
  },

  // статический HTML-симулятор Moodle лежит в /public/, не в Next-роутинге
  FAKE_MOODLE: "/fake-moodle-login.html",
} as const;
