import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "./components/Sidebar";
import SchedulerInitializer from "./components/SchedulerInitializer";
import { BusinessTypeProvider } from "./context/BusinessTypeContext";

export const metadata: Metadata = {
  title: "Mignon Admin | チャトレ事務所管理システム",
  description: "AIがチャトレ事務所に最適なX投稿文を自動生成します",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body>
        <BusinessTypeProvider>
          <SchedulerInitializer />
          <div style={{ display: 'flex' }}>
            <Sidebar />
            <main className="main-content">
              {children}
            </main>
          </div>
        </BusinessTypeProvider>
      </body>
    </html>
  );
}
