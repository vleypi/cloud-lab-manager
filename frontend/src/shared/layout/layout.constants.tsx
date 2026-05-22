import {
  DashboardIcon,
  ExternalLinkIcon,
  LayersIcon,
  LinkIcon,
  NetworkIcon,
  ServerIcon,
  SettingsIcon,
} from "@/shared/icons/index-icons";
import { ROUTES } from "@/shared/config/routes.constant";
import { INavItem } from "@/shared/layout/layout.interfaces";

export const ADMIN_NAV_ITEMS: ReadonlyArray<INavItem> = [
  {
    id: "overview",
    label: "Обзор кластера",
    href: ROUTES.ADMIN.OVERVIEW,
    icon: <DashboardIcon size={18} />,
    exact: true,
  },
  {
    id: "pool",
    label: "Пул проектов КИ",
    href: ROUTES.ADMIN.POOL,
    icon: <LayersIcon size={18} />,
  },
  {
    id: "stands",
    label: "Стенды",
    href: ROUTES.ADMIN.STANDS,
    icon: <ServerIcon size={18} />,
  },
  {
    id: "mappings",
    label: "Маппинги курсов",
    href: ROUTES.ADMIN.MAPPINGS,
    icon: <LinkIcon size={18} />,
  },
  {
    id: "platforms",
    label: "LTI платформы",
    href: ROUTES.ADMIN.PLATFORMS,
    icon: <NetworkIcon size={18} />,
  },
  {
    id: "settings",
    label: "Лимиты системы",
    href: ROUTES.ADMIN.SETTINGS,
    icon: <SettingsIcon size={18} />,
  },
  {
    id: "fake-moodle",
    label: "Fake Moodle (демо)",
    href: ROUTES.FAKE_MOODLE,
    icon: <ExternalLinkIcon size={18} />,
    badge: "",
    external: true,
  },
];

export const SIDEBAR_WIDTH_EXPANDED_PX = 240;
export const SIDEBAR_WIDTH_COLLAPSED_PX = 64;
