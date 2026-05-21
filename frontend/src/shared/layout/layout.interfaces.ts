import { ReactNode } from "react";

export interface INavItem {
  id: string;
  label: string;
  href: string;
  icon: ReactNode;
  exact?: boolean;
  badge?: string | number;
  // открыть в новой вкладке (для статики /public и внешних ссылок)
  external?: boolean;
}
