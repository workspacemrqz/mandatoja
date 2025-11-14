import { useState, useEffect } from "react";
import { Users, Settings, Menu, X, Bot, LogOut, Calendar, MessageCircle } from "lucide-react";
import { useLocation, Link } from "wouter";
import { Button } from "@/components/ui/button";
import LogoIcon from "@/assets/icons/Logo.svg";
import EleitoresIcon from "@/assets/icons/Eleitores.svg";
import LiderancasIcon from "@/assets/icons/Liderancas.svg";
import MaterialIcon from "@/assets/icons/Material.svg";
import DashboardMetrics from "../components/dashboard-metrics";
import VotersTab from "../components/voters-tab";
import LeadershipTab from "../components/leadership-tab";
import MaterialsTab from "../components/materials-tab";
import AgentesTab from "../components/agentes-tab";
import SchedulingsTab from "../components/schedulings-tab";
import SettingsTab from "../components/settings-tab";
import ChatPage from "./chat";

type TabType = 'dashboard' | 'eleitores' | 'equipe' | 'material' | 'agentes' | 'chat' | 'agendamentos' | 'configuracoes';

export default function Home() {
  const [location, setLocation] = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isDesktopSidebarCollapsed, setIsDesktopSidebarCollapsed] = useState(false);
  
  // Determine active tab based on current route
  const getActiveTabFromLocation = (path: string): TabType => {
    if (path === '/eleitores') return 'eleitores';
    if (path === '/equipe') return 'equipe';
    if (path === '/material') return 'material';
    if (path === '/agentes') return 'agentes';
    if (path === '/chat') return 'chat';
    if (path === '/agendamentos') return 'agendamentos';
    if (path === '/configuracoes') return 'configuracoes';
    return 'dashboard';
  };
  
  const [activeTab, setActiveTab] = useState<TabType>(getActiveTabFromLocation(location));
  
  // Update active tab when location changes
  useEffect(() => {
    setActiveTab(getActiveTabFromLocation(location));
  }, [location]);
  
  // Close sidebar when clicking on a link in mobile
  const handleLinkClick = () => {
    setIsSidebarOpen(false);
  };

  // Toggle desktop sidebar collapse (only on desktop)
  const handleDesktopSidebarToggle = () => {
    setIsDesktopSidebarCollapsed(!isDesktopSidebarCollapsed);
  };

  // Handle logout
  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      window.location.href = "/login";
    } catch (error) {
      console.error("Error during logout:", error);
      window.location.href = "/login";
    }
  };

  const tabs = [
    { id: 'dashboard' as TabType, label: 'Dashboard', icon: 'logo' },
    { id: 'eleitores' as TabType, label: 'Eleitores', icon: 'eleitores' },
    { id: 'equipe' as TabType, label: 'Equipe', icon: 'liderancas' },
    { id: 'material' as TabType, label: 'Material', icon: 'material' },
    { id: 'agentes' as TabType, label: 'Agentes', icon: 'bot' },
    { id: 'chat' as TabType, label: 'Chat', icon: 'chat' },
    { id: 'agendamentos' as TabType, label: 'Agendamentos', icon: 'calendar' },
    { id: 'configuracoes' as TabType, label: 'Configurações', icon: 'settings' },
  ];

  return (
    <div className="h-screen flex bg-background overflow-hidden">
      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-card border-b border-border px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" className="w-8 h-8 text-primary" fill="currentColor">
                <g><path d="M226.877 20.416a206.61 206.61 0 0 0-55.922 7.72c-28.518 5.13-56 17.362-79.572 36.71L29.203 28.67 65.51 91.078a173.06 173.06 0 0 0-32.88 66.938C7.28 230.34 23.513 313.994 81.33 371.81c52.018 52.02 124.946 70.363 191.723 55.06l69.315 65.65-20.04-83.825a205.077 205.077 0 0 0 36.693-24.603L498.85 498.326 384.625 358.502a205.073 205.073 0 0 0 24.867-37.148l83.112 19.87-65.125-68.76c15.314-66.787-3.026-139.73-55.052-191.76-17.117-17.116-36.504-30.574-57.186-40.4l.688-1.27-1.565.85c-27.637-12.973-57.56-19.468-87.488-19.468zM202.07 43.908c24.817 0 49.633 5.904 72.186 17.703l-97.574 52.86-67.93-39.52C136.357 54.263 169.21 43.91 202.07 43.91zm94.09 31.623a157.965 157.965 0 0 1 16.184 14.113c54.775 54.776 60.34 139.89 16.715 200.84l-89.796-109.92L296.16 75.53zM75.668 108.544l39.793 68.4L63.84 272.24C36.7 220.5 40.648 156.814 75.668 108.543zm104.77 129.66 110.26 90.076c-60.798 42.13-144.68 36.112-198.88-18.07l-.02-.017v-.002a157.83 157.83 0 0 1-14.187-16.284l102.828-55.703z"></path></g>
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-semibold text-card-foreground">MandatoJá</h1>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            data-testid="button-mobile-menu"
            className="lg:hidden"
          >
            {isSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </Button>
        </div>
      </div>

      {/* Mobile Overlay */}
      {isSidebarOpen && (
        <div 
          className="lg:hidden fixed inset-0 z-40 bg-black/50" 
          onClick={() => setIsSidebarOpen(false)}
          data-testid="mobile-overlay"
        />
      )}

      {/* Sidebar */}
      <div className={`${isDesktopSidebarCollapsed ? 'lg:w-16' : 'w-64'} bg-card border-r border-border flex flex-col transition-all duration-300 lg:relative lg:translate-x-0 ${
        isSidebarOpen ? 'fixed inset-y-0 left-0 z-50 translate-x-0' : 'fixed inset-y-0 left-0 z-50 -translate-x-full lg:translate-x-0'
      }`}>
        {/* Header */}
        <div className={`${isDesktopSidebarCollapsed ? 'lg:p-3' : 'p-6'} border-b border-border`}>
          <div className="flex items-center justify-between">
            <div className={`flex items-center ${isDesktopSidebarCollapsed ? 'lg:justify-center' : 'gap-3'}`}>
              <div 
                className={`${isDesktopSidebarCollapsed ? 'lg:w-10 lg:h-10' : 'w-10 h-10'} flex items-center justify-center cursor-pointer hover:bg-accent rounded-lg transition-colors hidden lg:flex`}
                onClick={handleDesktopSidebarToggle}
                data-testid="button-desktop-sidebar-toggle"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" className={`${isDesktopSidebarCollapsed ? 'lg:w-5 lg:h-5' : 'w-10 h-10'} text-primary`} fill="currentColor">
                  <g><path d="M226.877 20.416a206.61 206.61 0 0 0-55.922 7.72c-28.518 5.13-56 17.362-79.572 36.71L29.203 28.67 65.51 91.078a173.06 173.06 0 0 0-32.88 66.938C7.28 230.34 23.513 313.994 81.33 371.81c52.018 52.02 124.946 70.363 191.723 55.06l69.315 65.65-20.04-83.825a205.077 205.077 0 0 0 36.693-24.603L498.85 498.326 384.625 358.502a205.073 205.073 0 0 0 24.867-37.148l83.112 19.87-65.125-68.76c15.314-66.787-3.026-139.73-55.052-191.76-17.117-17.116-36.504-30.574-57.186-40.4l.688-1.27-1.565.85c-27.637-12.973-57.56-19.468-87.488-19.468zM202.07 43.908c24.817 0 49.633 5.904 72.186 17.703l-97.574 52.86-67.93-39.52C136.357 54.263 169.21 43.91 202.07 43.91zm94.09 31.623a157.965 157.965 0 0 1 16.184 14.113c54.775 54.776 60.34 139.89 16.715 200.84l-89.796-109.92L296.16 75.53zM75.668 108.544l39.793 68.4L63.84 272.24C36.7 220.5 40.648 156.814 75.668 108.543zm104.77 129.66 110.26 90.076c-60.798 42.13-144.68 36.112-198.88-18.07l-.02-.017v-.002a157.83 157.83 0 0 1-14.187-16.284l102.828-55.703z"></path></g>
                </svg>
              </div>
              {/* Mobile version of the icon (non-clickable) */}
              <div className="w-10 h-10 flex items-center justify-center lg:hidden">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" className="w-10 h-10 text-primary" fill="currentColor">
                  <g><path d="M226.877 20.416a206.61 206.61 0 0 0-55.922 7.72c-28.518 5.13-56 17.362-79.572 36.71L29.203 28.67 65.51 91.078a173.06 173.06 0 0 0-32.88 66.938C7.28 230.34 23.513 313.994 81.33 371.81c52.018 52.02 124.946 70.363 191.723 55.06l69.315 65.65-20.04-83.825a205.077 205.077 0 0 0 36.693-24.603L498.85 498.326 384.625 358.502a205.073 205.073 0 0 0 24.867-37.148l83.112 19.87-65.125-68.76c15.314-66.787-3.026-139.73-55.052-191.76-17.117-17.116-36.504-30.574-57.186-40.4l.688-1.27-1.565.85c-27.637-12.973-57.56-19.468-87.488-19.468zM202.07 43.908c24.817 0 49.633 5.904 72.186 17.703l-97.574 52.86-67.93-39.52C136.357 54.263 169.21 43.91 202.07 43.91zm94.09 31.623a157.965 157.965 0 0 1 16.184 14.113c54.775 54.776 60.34 139.89 16.715 200.84l-89.796-109.92L296.16 75.53zM75.668 108.544l39.793 68.4L63.84 272.24C36.7 220.5 40.648 156.814 75.668 108.543zm104.77 129.66 110.26 90.076c-60.798 42.13-144.68 36.112-198.88-18.07l-.02-.017v-.002a157.83 157.83 0 0 1-14.187-16.284l102.828-55.703z"></path></g>
                </svg>
              </div>
              {!isDesktopSidebarCollapsed && (
                <div className="lg:block">
                  <h1 className="text-lg font-semibold text-card-foreground">MandatoJá</h1>
                  <p className="text-sm text-muted-foreground">Campanha Inteligente</p>
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* Navigation */}
        <nav className={`flex-1 overflow-y-auto ${isDesktopSidebarCollapsed ? 'lg:p-3' : 'p-4'}`}>
          <ul className="space-y-2">
            {tabs.map((tab) => {
              const getIcon = (iconType: string) => {
                switch (iconType) {
                  case 'logo': return <img src={LogoIcon} alt="" className="w-5 h-5 min-w-[20px]" />;
                  case 'eleitores': return <img src={EleitoresIcon} alt="" className="w-5 h-5 min-w-[20px]" />;
                  case 'liderancas': return <img src={LiderancasIcon} alt="" className="w-5 h-5 min-w-[20px]" />;
                  case 'material': return <img src={MaterialIcon} alt="" className="w-5 h-5 min-w-[20px]" />;
                  case 'bot': return <Bot className="w-5 h-5 min-w-[20px]" />;
                  case 'chat': return <MessageCircle className="w-5 h-5 min-w-[20px]" />;
                  case 'calendar': return <Calendar className="w-5 h-5 min-w-[20px]" />;
                  case 'settings': return <Settings className="w-5 h-5 min-w-[20px]" />;
                  default: return <img src={LogoIcon} alt="" className="w-5 h-5 min-w-[20px]" />;
                }
              };
              return (
                <li key={tab.id}>
                  <Link
                    href={tab.id === 'dashboard' ? '/' : `/${tab.id}`}
                    data-testid={`tab-${tab.id}`}
                    onClick={handleLinkClick}
                    className={`${isDesktopSidebarCollapsed ? 'lg:w-10 lg:h-10' : 'w-full'} ${isDesktopSidebarCollapsed ? 'lg:mx-auto' : ''} flex items-center ${isDesktopSidebarCollapsed ? 'lg:justify-center lg:p-0' : 'gap-3 px-4 py-3'} rounded-lg text-left transition-colors ${
                      activeTab === tab.id
                        ? 'bg-primary text-primary-foreground'
                        : 'hover:bg-accent text-card-foreground'
                    }`}
                    title={isDesktopSidebarCollapsed ? tab.label : undefined}
                  >
                    {getIcon(tab.icon)}
                    {!isDesktopSidebarCollapsed && <span className="lg:block">{tab.label}</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        
        {/* User Info */}
        <div className={`${isDesktopSidebarCollapsed ? 'lg:p-3' : 'p-4'} border-t border-border`}>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className={`${isDesktopSidebarCollapsed ? 'lg:w-10 lg:h-10 lg:p-0' : 'w-full'} flex items-center ${isDesktopSidebarCollapsed ? 'lg:justify-center' : 'justify-start gap-2'} text-muted-foreground hover:text-destructive hover:bg-destructive/10`}
            data-testid="button-logout"
            title={isDesktopSidebarCollapsed ? "Sair" : undefined}
          >
            <LogOut className="w-4 h-4" />
            {!isDesktopSidebarCollapsed && <span>Sair</span>}
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto lg:ml-0 pt-16 lg:pt-0">
        {activeTab === 'dashboard' && <DashboardMetrics />}
        {activeTab === 'eleitores' && <VotersTab />}
        {activeTab === 'equipe' && <LeadershipTab />}
        {activeTab === 'material' && <MaterialsTab />}
        {activeTab === 'agentes' && <AgentesTab />}
        {activeTab === 'chat' && <ChatPage />}
        {activeTab === 'agendamentos' && <SchedulingsTab />}
        {activeTab === 'configuracoes' && <SettingsTab />}
      </div>
    </div>
  );
}
