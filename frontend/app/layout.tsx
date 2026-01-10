import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "./components/Sidebar";
import SchedulerInitializer from "./components/SchedulerInitializer";
import { BusinessTypeProvider } from "./context/BusinessTypeContext";

export const metadata: Metadata = {
  title: "MIC Admin | AI SNS自動投稿",
  description: "AIが最適なSNS投稿文を自動生成します",
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
