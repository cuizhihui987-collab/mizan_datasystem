import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { TabBar } from "@/components/layout/tab-bar";
import { GlobalProgress } from "@/components/layout/global-progress";
import { ScrollToTop } from "@/components/layout/scroll-to-top";
import { Toaster } from "@/components/ui/sonner";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <TabBar />
        <main className="flex-1 overflow-y-auto p-6" id="main-scroll-container">
          {children}
        </main>
      </div>
      <ScrollToTop />
      <GlobalProgress />
      <Toaster />
    </div>
  );
}
