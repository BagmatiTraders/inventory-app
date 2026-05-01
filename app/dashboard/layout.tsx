"use client"

import { LocationGuard } from "@/features/security/components/LocationGuard"
import { useSecurityCheck } from "@/features/security/hooks/useSecurityCheck"
import { useTheme } from "@/lib/theme/ThemeProvider"
import Link from "next/link"
import { LogOut, LayoutDashboard, Settings, ShoppingCart, Calculator, Shield, Menu, MoreVertical, Moon, Sun, ChevronDown, ChevronRight, FileText, AlertTriangle, History, BarChart2, Package, ShoppingBag, User, Plus, Camera as CameraIcon, Wallet } from "lucide-react"
import { logout } from "@/features/auth/actions/auth-actions"
import { useRouter, usePathname } from "next/navigation"
import { useState, useEffect } from "react"

import dynamic from 'next/dynamic'
import { createContext, useContext } from "react"
import { useQueryClient } from '@tanstack/react-query'
import { MobileModeProvider, useMobileMode } from "@/context/MobileModeContext"
import MobileHeader from "@/components/dashboard/MobileHeader"

const AddProductModal = dynamic(() => import('@/features/inventory/components/AddProductModal').then(mod => mod.AddProductModal), { ssr: false })
const MobileDashboard = dynamic(() => import('@/components/dashboard/MobileDashboard').then(mod => mod.MobileDashboard), { ssr: false })
const MobileFooter = dynamic(() => import('@/components/dashboard/MobileFooter').then(mod => mod.MobileFooter), { ssr: false })
const NavItem = dynamic(() => import('./NavItem').then(mod => mod.NavItem), { ssr: false })

interface DashboardContextType {
    isMobileMenuOpen: boolean
    setIsMobileMenuOpen: (isOpen: boolean) => void
    isCollapsed: boolean
    setHeaderTitle?: (title: string | React.ReactNode | null) => void
    setHeaderAction?: (action: React.ReactNode | null) => void
}

const DashboardContext = createContext<DashboardContextType | undefined>(undefined)

export function useDashboard() {
    const context = useContext(DashboardContext)
    if (context === undefined) {
        throw new Error('useDashboard must be used within a DashboardLayout')
    }
    return context
}

import { PermissionProvider } from '@/lib/permissions/PermissionContext'
import { PermissionFilteredNav } from '@/components/permissions/PermissionFilteredNav'

export default function DashboardLayoutWrapper(props: any) {
    return (
        <PermissionProvider>
            <MobileModeProvider>
                <DashboardLayout {...props} />
            </MobileModeProvider>
        </PermissionProvider>
    )
}

function DashboardLayout({
    children,
}: {
    children: React.ReactNode
}) {
    useSecurityCheck() // Run security hooks
    const router = useRouter()
    const pathname = usePathname()
    const { theme, toggleTheme } = useTheme()
    const [isCollapsed, setIsCollapsed] = useState(false)
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
    const [isAddProductModalOpen, setIsAddProductModalOpen] = useState(false)
    const [headerTitle, setHeaderTitle] = useState<string | React.ReactNode | null>(null)
    const [headerAction, setHeaderAction] = useState<React.ReactNode | null>(null)
    const queryClient = useQueryClient()
    const { isMobileMode } = useMobileMode()

    const handleLogout = async () => {
        await logout()
    }

    const closeMobileMenu = () => setIsMobileMenuOpen(false)

    return (
        // Temporarily disabled LocationGuard - will re-enable after setup
        // <LocationGuard>
        <DashboardContext.Provider value={{ isMobileMenuOpen, setIsMobileMenuOpen, isCollapsed, setHeaderTitle, setHeaderAction }}>
            <div className="flex h-screen bg-gray-100 dark:bg-zinc-900 relative">
                {/* Mobile Header - Hide for Stock Ledger and other specific pages */}
                {pathname !== '/dashboard/suppliers/dashboard' &&
                    !pathname?.includes('/dashboard/inventory/stock-ledger') && (
                        <MobileHeader
                            pathname={pathname}
                            isMobileMode={isMobileMode}
                            setIsMobileMenuOpen={setIsMobileMenuOpen}
                            headerTitle={headerTitle}
                            headerAction={headerAction}
                            isAddProductModalOpen={isAddProductModalOpen}
                            setIsAddProductModalOpen={setIsAddProductModalOpen}
                        />
                    )}

                {/* Mobile Footer */}
                {isMobileMode && pathname === '/dashboard' && <MobileFooter />}

                {/* Mobile Overlay */}
                {isMobileMenuOpen && (
                    <div
                        className="fixed inset-0 bg-black/50 z-40 md:hidden"
                        onClick={closeMobileMenu}
                    />
                )}

                {/* Sidebar */}
                <aside
                    className={`
                    fixed md:static inset-y-0 left-0 z-[100]
                    bg-white dark:bg-zinc-800 border-r flex flex-col transition-all duration-300
                    ${isCollapsed ? 'md:w-16' : 'md:w-64'}
                    ${isMobileMenuOpen ? 'w-64 translate-x-0' : 'w-64 -translate-x-full md:translate-x-0'}
                    h-full
                `}
                >
                    {/* Hide sidebar content if in mobile mode */}
                    {!isMobileMode && (
                        <>
                            {/* Desktop Toggle Button & Logo */}
                            <div className="h-16 flex items-center justify-between px-4 border-b shrink-0">
                                {!isCollapsed && (
                                    <div className="hidden md:block">
                                        <h2 className="font-bold text-xl text-blue-600">Bagmati ERP</h2>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">Staff Panel</p>
                                    </div>
                                )}
                                {/* Unique Logo for Mobile sidebar header */}
                                <div className="md:hidden">
                                    <h2 className="font-bold text-xl text-blue-600">Menu</h2>
                                </div>

                                <button
                                    onClick={() => setIsCollapsed(!isCollapsed)}
                                    className="p-2 text-gray-600 dark:text-gray-300 hidden md:block"
                                    title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                                >
                                    <Menu size={20} />
                                </button>

                                {/* Close button for mobile */}
                                <button
                                    onClick={closeMobileMenu}
                                    className="md:hidden p-2 text-gray-600 dark:text-gray-300"
                                >
                                    <Menu size={20} />
                                </button>
                            </div>

                            <nav className={`flex-1 overflow-y-auto ${isCollapsed ? 'p-2' : 'p-4'}`}>
                                <div onClick={closeMobileMenu}>
                                    <NavItem href="/dashboard" icon={<LayoutDashboard size={20} />} isCollapsed={isCollapsed}>
                                        Dashboard
                                    </NavItem>
                                </div>

                                {/* Inventory with Sub-menu */}
                                <PermissionFilteredNav mainRole="Inventory">
                                    <div onClick={closeMobileMenu}>
                                        <NavItem href="/dashboard/inventory" icon={<Calculator size={20} />} isCollapsed={isCollapsed}>
                                            Inventory Management
                                        </NavItem>
                                    </div>
                                </PermissionFilteredNav>

                                <PermissionFilteredNav mainRole="Daraz">
                                    <div onClick={closeMobileMenu}>
                                        <NavItem href="/dashboard/sales" icon={<ShoppingCart size={20} />} isCollapsed={isCollapsed}>
                                            Sales & Orders
                                        </NavItem>
                                    </div>
                                </PermissionFilteredNav>

                                <PermissionFilteredNav mainRole="Purchase">
                                    <div onClick={closeMobileMenu}>
                                        <NavItem
                                            href="/dashboard/purchase"
                                            icon={<ShoppingBag size={20} />}
                                            isCollapsed={isCollapsed}
                                        >
                                            Purchasing
                                        </NavItem>
                                    </div>
                                </PermissionFilteredNav>

                                <PermissionFilteredNav mainRole="Suppliers">
                                    <div onClick={closeMobileMenu}>
                                        <NavItem href="/dashboard/suppliers" icon={<Package size={20} />} isCollapsed={isCollapsed}>
                                            Suppliers
                                        </NavItem>
                                    </div>
                                </PermissionFilteredNav>

                                <PermissionFilteredNav mainRole="Accounts">
                                    <div onClick={closeMobileMenu}>
                                        <NavItem href="/dashboard/account" icon={<Wallet size={20} />} isCollapsed={isCollapsed}>
                                            Finance & Accounts
                                        </NavItem>
                                    </div>
                                </PermissionFilteredNav>

                                <div onClick={closeMobileMenu}>
                                    <NavItem href="/dashboard/profile" icon={<User size={20} />} isCollapsed={isCollapsed}>
                                        My Profile
                                    </NavItem>
                                </div>

                                {/* Settings should ideally be Admin-only, but users might have permissions for staff/roles later? Actually only Admin can do settings, so we can require 'Settings' mainRole or let the pages themselves guard it. For now let's just let it be accessible, or we can add a guard. The user spec says Staff Management is admin/editor maybe? We'll leave it unguarded here but guard the pages. */}
                                <PermissionFilteredNav mainRole="Settings">
                                    <div onClick={closeMobileMenu}>
                                        <NavItem href="/dashboard/settings" icon={<Settings size={20} />} isCollapsed={isCollapsed}>
                                            Settings
                                        </NavItem>
                                    </div>
                                </PermissionFilteredNav>
                            </nav>

                            <div className="p-4 border-t space-y-2 shrink-0">
                                {/* Theme Toggle Button */}
                                <button
                                    onClick={toggleTheme}
                                    className={`flex items-center gap-2 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-zinc-700 w-full px-4 py-2 text-sm font-medium rounded-md transition-colors ${isCollapsed ? 'justify-center' : ''
                                        }`}
                                    title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
                                >
                                    {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
                                    {!isCollapsed && <span>{theme === 'light' ? 'Dark Mode' : 'Light Mode'}</span>}
                                </button>

                                {/* Logout Button */}
                                <button
                                    onClick={handleLogout}
                                    className={`flex items-center gap-2 text-red-500 hover:text-red-700 w-full px-4 py-2 text-sm font-medium rounded-md transition-colors hover:bg-red-50 dark:hover:bg-red-950/30 ${isCollapsed ? 'justify-center' : ''
                                        }`}
                                    title="Logout"
                                >
                                    <LogOut size={16} />
                                    {!isCollapsed && <span>Sign - Out</span>}
                                </button>
                            </div>
                        </>
                    )}
                </aside>

                {/* Main Content */}
                <main className={`
                    flex-1 
                    ${(isMobileMode && pathname === '/dashboard') || pathname === '/dashboard/purchase/daily-purchase-list' ? 'overflow-hidden' : 'overflow-y-auto'}
                    ${pathname === '/dashboard/purchase/inventory-price-reports' || pathname === '/dashboard/purchase/daily-purchase-list' || pathname === '/dashboard/purchase/analytics' || pathname === '/dashboard/suppliers/suppliers-account' || pathname === '/dashboard/sales/daraz/status-sync' || pathname === '/dashboard/sales/daraz/order-sync' || pathname?.startsWith('/dashboard/inventory/stock-ledger') ? 'pt-0' : 'mt-16 md:mt-0'} 
                    ${pathname === '/dashboard/purchase/inventory-price-reports' || pathname === '/dashboard/purchase/analytics' || pathname === '/dashboard/purchase/daily-purchase-list' || pathname === '/dashboard/suppliers/dashboard' || pathname === '/dashboard/suppliers' || pathname === '/dashboard/purchase/buy-sell-suppliers' || pathname === '/dashboard/suppliers/suppliers-account' || pathname === '/dashboard/sales/daraz/status-sync' || pathname === '/dashboard/sales/daraz/order-sync' || pathname === '/dashboard/sales/marketplace/sales-entry' || pathname === '/dashboard/sales/daraz/dashboard' || pathname === '/dashboard/sales/daraz/profit-tracker' ? 'h-full' : 'h-[calc(100vh-4rem)] md:h-full'}
                    pointer-events-auto
                `}>
                    <div className={`${pathname === '/dashboard/purchase/inventory-price-reports' || pathname === '/dashboard/purchase/analytics' || pathname === '/dashboard/purchase/daily-purchase-list' || pathname === '/dashboard/suppliers/dashboard' || pathname === '/dashboard/suppliers' || pathname === '/dashboard/purchase/buy-sell-suppliers' || pathname === '/dashboard/suppliers/suppliers-account' || pathname === '/dashboard/sales/daraz/status-sync' || pathname === '/dashboard/sales/daraz/order-sync' || pathname === '/dashboard/sales/marketplace/sales-entry' || pathname === '/dashboard/sales/daraz/dashboard' || pathname === '/dashboard/sales/daraz/profit-tracker' ? 'p-0 h-full' : 'px-4 pb-4 pt-1'} md:p-8 ${isMobileMode ? 'pb-24' : ''}`}>
                        {isMobileMode && pathname === '/dashboard' ? (
                            <MobileDashboard />
                        ) : (
                            children
                        )}
                    </div>
                </main>
            </div>
        </DashboardContext.Provider>
        // </LocationGuard>
    )
}


