"use client"

import { LocationGuard } from "@/features/security/components/LocationGuard"
import { useSecurityCheck } from "@/features/security/hooks/useSecurityCheck"
import { useTheme } from "@/lib/theme/ThemeProvider"
import Link from "next/link"
import { LogOut, LayoutDashboard, Settings, ShoppingCart, Calculator, Shield, Menu, MoreVertical, Moon, Sun, ChevronDown, ChevronRight, FileText, AlertTriangle, History, BarChart2, Package, ShoppingBag, User } from "lucide-react"
import { logout } from "@/features/auth/actions/auth-actions"
import { useRouter, usePathname } from "next/navigation"
import { useState, useEffect } from "react"

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode
}) {
    useSecurityCheck() // Run security hooks
    const router = useRouter()
    const { theme, toggleTheme } = useTheme()
    const [isCollapsed, setIsCollapsed] = useState(false)
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

    const handleLogout = async () => {
        await logout()
    }

    const closeMobileMenu = () => setIsMobileMenuOpen(false)

    return (
        // Temporarily disabled LocationGuard - will re-enable after setup
        // <LocationGuard>
        <div className="flex h-screen bg-gray-100 dark:bg-zinc-900 relative">
            {/* Mobile Header */}
            <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-white dark:bg-zinc-800 border-b z-30 flex items-center justify-between px-4">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                        className="p-2 -ml-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-700 rounded-md"
                    >
                        <Menu size={24} />
                    </button>
                    <span className="font-bold text-lg text-blue-600">Bagmati ERP</span>
                </div>
                <div className="flex items-center gap-2">
                    {/* Add any mobile header actions here (like user avatar) */}
                </div>
            </div>

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
                    fixed md:static inset-y-0 left-0 z-50
                    bg-white dark:bg-zinc-800 border-r flex flex-col transition-all duration-300
                    ${isCollapsed ? 'md:w-16' : 'md:w-64'}
                    ${isMobileMenuOpen ? 'w-64 translate-x-0' : 'w-64 -translate-x-full md:translate-x-0'}
                    h-full
                `}
            >
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
                            Inventory
                        </NavItem>
                    </div>

                    <div onClick={closeMobileMenu}>
                        <NavItem href="/dashboard/sales" icon={<ShoppingCart size={20} />} isCollapsed={isCollapsed}>
                            Sales
                        </NavItem>
                    </div>

                    <div onClick={closeMobileMenu}>
                        <NavItem
                            href="/dashboard/purchase"
                            icon={<ShoppingBag size={20} />}
                            isCollapsed={isCollapsed}
                        >
                            Purchase
                        </NavItem>
                    </div>
                    <div onClick={closeMobileMenu}>
                        <NavItem href="/dashboard/suppliers" icon={<Package size={20} />} isCollapsed={isCollapsed}>
                            Suppliers
                        </NavItem>
                    </div>
                    <div onClick={closeMobileMenu}>
                        <NavItem href="/dashboard/profile" icon={<User size={20} />} isCollapsed={isCollapsed}>
                            My Profile
                        </NavItem>
                    </div>
                    <div onClick={closeMobileMenu}>
                        <NavItem href="/dashboard/admin/users" icon={<Shield size={20} />} isCollapsed={isCollapsed}>
                            Users (Admin)
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
                        {!isCollapsed && <span>Logout</span>}
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-y-auto h-full pt-16 md:pt-0 pointer-events-auto">
                <div className="p-4 md:p-8">
                    {children}
                </div>
            </main>
        </div>
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
