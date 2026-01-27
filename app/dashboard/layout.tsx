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

const AddProductModal = dynamic(() => import('@/features/inventory/components/AddProductModal').then(mod => mod.AddProductModal), { ssr: false })
const MobileDashboard = dynamic(() => import('@/components/dashboard/MobileDashboard').then(mod => mod.MobileDashboard), { ssr: false })
const MobileFooter = dynamic(() => import('@/components/dashboard/MobileFooter').then(mod => mod.MobileFooter), { ssr: false })

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

export default function DashboardLayoutWrapper(props: any) {
    return (
        <MobileModeProvider>
            <DashboardLayout {...props} />
        </MobileModeProvider>
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
                        <div className={`md:hidden fixed top-0 left-0 right-0 h-16 bg-white dark:bg-zinc-800 border-b z-30 flex items-center justify-between px-4 transition-all ${isMobileMode ? 'shadow-sm' : ''}`}>
                            <div className="flex items-center gap-3 relative z-20">
                                {!isMobileMode && (
                                    <button
                                        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                                        className="p-2 -ml-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-700 rounded-md"
                                    >
                                        <Menu size={24} />
                                    </button>
                                )}
                            </div>

                            {/* Centered Titles */}
                            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
                                {headerTitle ? (
                                    typeof headerTitle === 'string' ? (
                                        <span className="font-bold text-lg whitespace-nowrap">{headerTitle}</span>
                                    ) : (
                                        headerTitle
                                    )
                                ) : (
                                    <>

                                        {pathname === '/dashboard/sales/daraz' && (
                                            <span className="font-bold text-lg whitespace-nowrap">E-commerce Sales & Orders</span>
                                        )}
                                        {pathname === '/dashboard/sales/marketplace' && (
                                            <span className="font-bold text-lg whitespace-nowrap">Marketplace Sales & Orders</span>
                                        )}
                                        {pathname === '/dashboard/sales/daraz/sales-entry' && (
                                            <span className="font-bold text-lg whitespace-nowrap">Order Entry</span>
                                        )}
                                        {pathname === '/dashboard/sales/marketplace/sales-entry' && (
                                            <span className="font-bold text-lg whitespace-nowrap">Marketplace Sales Entry</span>
                                        )}
                                        {pathname === '/dashboard/sales/daraz/update-status' && (
                                            <span className="font-bold text-lg whitespace-nowrap">Update Order Status</span>
                                        )}
                                        {pathname === '/dashboard/sales/daraz/dashboard' && (
                                            <span className="font-bold text-lg whitespace-nowrap">Order Summary</span>
                                        )}
                                        {pathname === '/dashboard/inventory/stock-adjustment' && (
                                            <span className="font-bold text-lg whitespace-nowrap">Stock Adjustment</span>
                                        )}
                                        {pathname === '/dashboard/inventory/product-list' && (
                                            <span className="font-bold text-lg whitespace-nowrap">Inventory List</span>
                                        )}
                                        {pathname === '/dashboard/inventory/damaged-stocks' && (
                                            <span className="font-bold text-lg whitespace-nowrap">Damaged Goods</span>
                                        )}
                                        {pathname === '/dashboard/purchase' && (
                                            <span className="font-bold text-lg whitespace-nowrap">Purchasing</span>
                                        )}
                                        {pathname === '/dashboard/purchase/purchase-entry' && (
                                            <span className="font-bold text-lg whitespace-nowrap">Purchase Summary</span>
                                        )}
                                        {pathname === '/dashboard/purchase/all-purchase-list' && (
                                            <span className="font-bold text-lg whitespace-nowrap">Purchase History</span>
                                        )}
                                        {pathname === '/dashboard/purchase/daily-purchase-list' && (
                                            <span className="font-bold text-lg whitespace-nowrap">Daily Purchases</span>
                                        )}
                                        {pathname === '/dashboard/purchase/buy-sell-suppliers' && (
                                            <span className="font-bold text-lg whitespace-nowrap">Vendor Trade Report</span>
                                        )}
                                        {pathname === '/dashboard/suppliers' && (
                                            <span className="font-bold text-lg whitespace-nowrap">Supplier Management</span>
                                        )}
                                        {pathname === '/dashboard/suppliers/suppliers-transaction' && (
                                            <span className="font-bold text-lg whitespace-nowrap">Supplier Transactions</span>
                                        )}
                                        {pathname === '/dashboard/suppliers/suppliers-account' && (
                                            <span className="font-bold text-lg whitespace-nowrap">Supplier Ledger</span>
                                        )}
                                        {pathname === '/dashboard/sales/daraz/status-sync' && (
                                            <span className="font-bold text-lg whitespace-nowrap">Order Status Sync</span>
                                        )}
                                        {pathname === '/dashboard/sales/daraz/order-sync' && (
                                            <span className="font-bold text-lg whitespace-nowrap">Order Sync</span>
                                        )}
                                        {pathname === '/dashboard/profile' && (
                                            <span className="font-bold text-lg whitespace-nowrap">My Profile</span>
                                        )}
                                        {pathname === '/dashboard/sales/daraz/profit-tracker' && (
                                            <span className="font-bold text-lg whitespace-nowrap">Profit Tracker</span>
                                        )}
                                        {pathname === '/dashboard/mobile-uploads' && (
                                            <span className="font-bold text-lg whitespace-nowrap">Field Data Entry</span>
                                        )}
                                        {pathname === '/dashboard/stock-analysis' && (
                                            <span className="font-bold text-lg whitespace-nowrap">Stock Analysis</span>
                                        )}
                                        {pathname === '/dashboard/account' && (
                                            <span className="font-bold text-lg whitespace-nowrap">Finance & Accounts</span>
                                        )}

                                        {/* Default Title */}
                                        {pathname !== '/dashboard/sales/daraz' &&
                                            pathname !== '/dashboard/sales/marketplace' &&
                                            pathname !== '/dashboard/sales/daraz/sales-entry' &&
                                            pathname !== '/dashboard/sales/marketplace/sales-entry' &&
                                            pathname !== '/dashboard/sales/daraz/update-status' &&
                                            pathname !== '/dashboard/sales/daraz/dashboard' &&
                                            pathname !== '/dashboard/inventory/product-list' &&
                                            pathname !== '/dashboard/inventory/stock-adjustment' &&
                                            pathname !== '/dashboard/inventory/damaged-stocks' &&
                                            pathname !== '/dashboard/purchase' &&
                                            pathname !== '/dashboard/purchase/purchase-entry' &&
                                            pathname !== '/dashboard/purchase/all-purchase-list' &&
                                            pathname !== '/dashboard/purchase/daily-purchase-list' &&
                                            pathname !== '/dashboard/purchase/buy-sell-suppliers' &&
                                            pathname !== '/dashboard/suppliers' &&
                                            pathname !== '/dashboard/suppliers/suppliers-transaction' &&
                                            pathname !== '/dashboard/suppliers/suppliers-account' &&
                                            pathname !== '/dashboard/sales/daraz/status-sync' &&
                                            pathname !== '/dashboard/sales/daraz/order-sync' &&
                                            pathname !== '/dashboard/profile' &&
                                            pathname !== '/dashboard/sales/daraz/profit-tracker' &&
                                            pathname !== '/dashboard/mobile-uploads' &&
                                            pathname !== '/dashboard/stock-analysis' &&
                                            pathname !== '/dashboard/account' && (
                                                <span className="font-bold text-lg text-black dark:text-white whitespace-nowrap">BAGMATI TRADERS</span>
                                            )}

                                    </>
                                )}
                            </div>

                            {/* Portal Target for Page Actions */}
                            <div id="mobile-header-actions" className="flex items-center gap-2 relative z-30" />

                            <div id="navbar-actions" className="flex items-center gap-2 relative z-20">
                                {/* Add any mobile header actions here (like user avatar) */}


                                {pathname === '/dashboard/inventory/product-list' && (
                                    <>
                                        <button
                                            onClick={() => setIsAddProductModalOpen(true)}
                                            className="p-1.5 bg-blue-600 text-white rounded-md shadow-sm"
                                        >
                                            <Plus size={18} />
                                        </button>
                                        <AddProductModal
                                            isOpen={isAddProductModalOpen}
                                            onClose={() => setIsAddProductModalOpen(false)}
                                        />
                                    </>
                                )}
                            </div>

                            {/* Right Side Actions */}
                            <div className="flex items-center gap-2 relative z-20">
                                {headerAction}
                            </div>
                        </div>
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
                                <div onClick={closeMobileMenu}>
                                    <NavItem href="/dashboard/inventory" icon={<Calculator size={20} />} isCollapsed={isCollapsed}>
                                        Inventory Management
                                    </NavItem>
                                </div>

                                <div onClick={closeMobileMenu}>
                                    <NavItem href="/dashboard/sales" icon={<ShoppingCart size={20} />} isCollapsed={isCollapsed}>
                                        Sales & Orders
                                    </NavItem>
                                </div>

                                <div onClick={closeMobileMenu}>
                                    <NavItem
                                        href="/dashboard/purchase"
                                        icon={<ShoppingBag size={20} />}
                                        isCollapsed={isCollapsed}
                                    >
                                        Purchasing
                                    </NavItem>
                                </div>
                                <div onClick={closeMobileMenu}>
                                    <NavItem href="/dashboard/suppliers" icon={<Package size={20} />} isCollapsed={isCollapsed}>
                                        Suppliers
                                    </NavItem>
                                </div>
                                <div onClick={closeMobileMenu}>
                                    <NavItem href="/dashboard/account" icon={<Wallet size={20} />} isCollapsed={isCollapsed}>
                                        Finance & Accounts
                                    </NavItem>
                                </div>
                                <div onClick={closeMobileMenu}>
                                    <NavItem href="/dashboard/profile" icon={<User size={20} />} isCollapsed={isCollapsed}>
                                        My Profile
                                    </NavItem>
                                </div>

                                <div onClick={closeMobileMenu}>
                                    <NavItem href="/dashboard/settings" icon={<Settings size={20} />} isCollapsed={isCollapsed}>
                                        Settings
                                    </NavItem>
                                </div>
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
                    ${pathname === '/dashboard/purchase/inventory-price-reports' || pathname === '/dashboard/purchase/daily-purchase-list' || pathname === '/dashboard/purchase/analytics' || pathname === '/dashboard/suppliers/suppliers-account' || pathname === '/dashboard/sales/daraz/status-sync' || pathname === '/dashboard/sales/daraz/order-sync' || pathname?.startsWith('/dashboard/inventory/stock-ledger') ? 'h-full' : 'h-[calc(100vh-4rem)] md:h-full'}
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

function NavItem({
    href,
    icon,
    children,
    isCollapsed,
    subItems,
    onMobileItemClick
}: {
    href: string
    icon: React.ReactNode
    children: React.ReactNode
    isCollapsed: boolean
    subItems?: { label: string; href: string; icon?: React.ReactNode }[]
    onMobileItemClick?: () => void
}) {
    const [isOpen, setIsOpen] = useState(false)
    const pathname = usePathname()
    const isActive = pathname === href || (subItems && subItems.some(item => pathname === item.href || pathname.startsWith(item.href + '/'))) || pathname.startsWith(href + '/')

    // Auto-expand if active or one of sub-items is active
    useEffect(() => {
        if (isActive && !isCollapsed && subItems) {
            setIsOpen(true)
        }
    }, [isActive, isCollapsed, subItems])

    // If collapsed, clicking main link should probably just go there (or expand sidebar?)
    // For now, if collapsed, we show simple tooltip behavior, no sub-menu dropdown (simplification)
    // Or we could unlock it. Let's keep specific behavior simple: 
    // If collapsed, sub-items are hidden. User must expand sidebar to see them.

    if (subItems && !isCollapsed) {
        return (
            <div className="space-y-1">
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className={`w-full flex items-center justify-between px-3 py-2 text-sm font-medium rounded-md transition-colors ${isActive
                        ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400'
                        : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-zinc-700/50'
                        }`}
                >
                    <div className="flex items-center gap-3">
                        <span className="shrink-0">{icon}</span>
                        <span>{children}</span>
                    </div>
                    {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </button>

                {isOpen && (
                    <div className="pl-10 space-y-1">
                        {subItems.map((item) => (
                            <Link
                                key={item.href}
                                href={item.href}
                                onClick={onMobileItemClick}
                                className={`block px-3 py-2 text-sm rounded-md transition-colors flex items-center gap-2 ${pathname === item.href
                                    ? 'bg-gray-100 text-gray-900 dark:bg-zinc-800 dark:text-white font-medium'
                                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-zinc-800/50'
                                    }`}
                            >
                                {item.icon}
                                {item.label}
                            </Link>
                        ))}
                    </div>
                )}
            </div>
        )
    }

    return (
        <Link
            href={href}
            onClick={onMobileItemClick}
            className={`flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors ${isActive
                ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400'
                : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-zinc-700/50'
                } ${isCollapsed ? 'justify-center' : ''}`}
            title={isCollapsed ? String(children) : undefined}
        >
            <span className="shrink-0">{icon}</span>
            {!isCollapsed && children}
        </Link>
    )
}
