import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "./components/Sidebar";
import SchedulerInitializer from "./components/SchedulerInitializer";
import { BusinessTypeProvider } from "./context/BusinessTypeContext";
import { ToastProvider } from "./components/Toast";
import { GlobalActivityProvider, GlobalActivityBar } from "./components/GlobalActivityBar";
import AutoRunInitializer from "./components/AutoRunInitializer";

export const metadata: Metadata = {
  title: "MIC Admin | AI SNS自動投稿",
  description: "AIが最適なSNS投稿文を自動生成します",
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body>
        <BusinessTypeProvider>
          <ToastProvider>
            <GlobalActivityProvider>
              <SchedulerInitializer />
              <AutoRunInitializer />
              <div style={{ display: 'flex' }}>
                <Sidebar />
                <main className="main-content">
                  {children}
                </main>
              </div>
              <GlobalActivityBar />
            </GlobalActivityProvider>
          </ToastProvider>
        </BusinessTypeProvider>
      </body>
    </html>
  );
}
