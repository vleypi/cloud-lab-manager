import { Metadata, Viewport } from "next";
import { Toaster } from "sonner";

import { ModalProvider } from "@/shared/modal/ModalProvider";

import { QueryProvider } from "@/app/providers/QueryProvider";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Cloud-Lab Manager",
    template: "%s · Cloud-Lab Manager",
  },
  description:
    "Безопасный веб-сервис для управления облачными ресурсами Кибер Инфраструктуры из LMS Moodle с автоматической проверкой конфигураций",
  applicationName: "Cloud-Lab Manager",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#ffffff",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body>
        <QueryProvider>
          <ModalProvider>{children}</ModalProvider>
        </QueryProvider>
        <Toaster
          position="bottom-right"
          richColors
          theme="light"
          expand
          visibleToasts={3}
          toastOptions={{
            style: {
              borderRadius: "12px",
              fontFamily: "Inter, 'Segoe UI', sans-serif",
              fontSize: "14px",
              boxShadow:
                "0 4px 6px -1px rgba(0,0,0,0.07), 0 2px 4px -1px rgba(0,0,0,0.04)",
              padding: "12px 16px",
            },
          }}
        />
      </body>
    </html>
  );
}
