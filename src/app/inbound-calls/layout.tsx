import Sidebar from "@/components/Sidebar";
import AuthGuard from "@/components/AuthGuard";
import MainContent from "@/components/MainContent";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <div className="min-h-screen">
        <Sidebar />
        <MainContent>{children}</MainContent>
      </div>
    </AuthGuard>
  );
}
