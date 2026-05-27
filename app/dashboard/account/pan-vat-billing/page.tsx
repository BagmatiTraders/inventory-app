'use client'

import React, { useState, useEffect } from 'react'
import { ArrowLeft, ShoppingBag, ShoppingCart, FileText, Plus, Building, Calendar, Wallet, Layers, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { Card } from '@/components/ui-shim'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getCompanyDetails } from '@/features/settings/actions/company-details-actions'
import { getPanVatBills } from '@/features/account/actions/pan-vat-bill-actions'
import { useFiscalYears, useActiveFiscalYear } from '@/features/settings/hooks/useFiscalYears'
import { formatNepaliCurrency } from '@/lib/utils/date-converter'
import { AddPanVatCompanyModal } from '@/features/account/components/AddPanVatCompanyModal'
import { AddPanVatBillModal } from '@/features/account/components/AddPanVatBillModal'

export default function PanVatBillingPage() {
    const [fiscalYearId, setFiscalYearId] = useState<string>('all')
    const [isAddBillModalOpen, setIsAddBillModalOpen] = useState(false)
    const [isAddCompanyModalOpen, setIsAddCompanyModalOpen] = useState(false)
    const queryClient = useQueryClient()

    // Fetch fiscal years
    const { data: fiscalYears = [] } = useFiscalYears()
    const { data: activeFiscalYear } = useActiveFiscalYear()

    // Set active fiscal year as default on mount
    useEffect(() => {
        if (activeFiscalYear && fiscalYearId === 'all') {
            setFiscalYearId(activeFiscalYear.id)
        }
    }, [activeFiscalYear])

    // Get selected fiscal year data
    const selectedFiscalYear = fiscalYearId !== 'all' ? fiscalYears.find(fy => fy.id === fiscalYearId) : null

    // Fetch company details (our own company details)
    const { data: companies = [], isLoading: isLoadingCompanies } = useQuery({
        queryKey: ['company-details'],
        queryFn: getCompanyDetails,
    })

    // Fetch purchase bills
    const { data: bills = [], isLoading: isLoadingBills } = useQuery({
        queryKey: ['pan-vat-bills', fiscalYearId, selectedFiscalYear?.start_date, selectedFiscalYear?.end_date],
        queryFn: () => getPanVatBills({
            fiscalYearId: fiscalYearId !== 'all' ? fiscalYearId : undefined,
            startDate: selectedFiscalYear?.start_date,
            endDate: selectedFiscalYear?.end_date,
        }),
    })

    // Aggregate bill details for each company
    const activeCompanies = companies.map(company => {
        // Filter bills where buyer is this company
        const companyBills = bills.filter(bill => bill.buyer_company_id === company.id)
        const totalPurchaseAmount = companyBills.reduce((sum, bill) => sum + (bill.total_amount || 0), 0)
        const totalBillCount = companyBills.length

        return {
            ...company,
            totalPurchaseAmount,
            totalBillCount
        }
    }).filter(company => company.totalPurchaseAmount > 0 || company.totalBillCount > 0)

    const billingModules = [
        {
            name: 'Purchase Billing',
            href: '/dashboard/account/pan-vat-billing/purchase-billing',
            icon: ShoppingBag,
            color: 'bg-blue-600 dark:bg-blue-500',
            description: 'Invoices, parties statement and billing reports'
        },
        {
            name: 'Sales Billing',
            href: '/dashboard/account/pan-vat-billing/sales-billing',
            icon: ShoppingCart,
            color: 'bg-emerald-600 dark:bg-emerald-500',
            description: 'Manage sales invoices and tax billing details'
        },
        {
            name: 'Report',
            href: '/dashboard/account/pan-vat-billing/report',
            icon: FileText,
            color: 'bg-violet-600 dark:bg-violet-500',
            description: 'Comprehensive tax and VAT transaction reports'
        },
        {
            name: 'Daraz Transaction',
            href: '/dashboard/account/pan-vat-billing/daraz-transaction',
            icon: Wallet,
            color: 'bg-orange-600 dark:bg-orange-500',
            description: 'Weekly Daraz settlement amounts, commission fees and vouchers'
        },
    ]

    const isLoading = isLoadingCompanies || isLoadingBills

    return (
        <div className="flex flex-col h-full bg-gray-50 dark:bg-zinc-950 space-y-5 pb-8 overflow-y-auto">
            {/* Top Bar with Fiscal Year */}
            <div className="bg-white dark:bg-zinc-900 border-b dark:border-zinc-800 px-4 py-3 shadow-sm sticky top-0 z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center gap-3">
                    <Link
                        href="/dashboard/account"
                        className="p-1.5 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg transition-colors text-gray-600 dark:text-gray-400 hidden md:block"
                    >
                        <ArrowLeft className="h-5 w-5" />
                    </Link>
                    <div>
                        <h1 className="text-xl font-extrabold text-gray-900 dark:text-gray-100 tracking-tight">Pan/Vat Billing</h1>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Manage tax, purchase and sales invoices</p>
                    </div>
                </div>

                {/* Fiscal Year Filter */}
                <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-gray-400" />
                    <span className="text-sm font-semibold text-gray-600 dark:text-gray-400">Fiscal Year:</span>
                    <select
                        value={fiscalYearId}
                        onChange={(e) => setFiscalYearId(e.target.value)}
                        className="min-w-[150px] px-3 py-1.5 text-[13px] font-semibold border dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm cursor-pointer"
                    >
                        <option value="all">All Fiscal Years</option>
                        {fiscalYears.map((fy) => (
                            <option key={fy.id} value={fy.id}>
                                {fy.name} {fy.is_active ? '(Running)' : ''}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Quick Navigation Modules Grid */}
            <div className="px-4 md:px-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {billingModules.map((module) => {
                        const Icon = module.icon
                        return (
                            <Link key={module.name} href={module.href} className="group">
                                <Card className="p-4 hover:shadow-md border border-gray-200 dark:border-zinc-800 hover:border-gray-300 dark:hover:border-zinc-700 bg-white dark:bg-zinc-900 transition-all duration-300 cursor-pointer h-full flex items-start gap-4">
                                    <div className={`${module.color} p-3 rounded-xl shadow-md text-white shrink-0 group-hover:scale-110 transition-transform`}>
                                        <Icon size={20} />
                                    </div>
                                    <div className="space-y-1 pr-6 relative w-full">
                                        <h3 className="font-bold text-[15px] text-gray-900 dark:text-gray-100">{module.name}</h3>
                                        <p className="text-[12px] text-gray-500 dark:text-gray-400 leading-normal">{module.description}</p>
                                        <ArrowRight size={14} className="absolute right-0 top-1/2 -translate-y-1/2 text-gray-400 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                                    </div>
                                </Card>
                            </Link>
                        )
                    })}
                </div>
            </div>

            {/* Purchase Billing Section */}
            <div className="px-4 md:px-6 space-y-4">
                {/* Section Header */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-gray-200 dark:border-zinc-800 pb-3 gap-3">
                    <div className="flex items-center gap-2">
                        <ShoppingBag className="h-5 w-5 text-blue-600 dark:text-blue-500" />
                        <h2 className="text-[17px] font-bold text-gray-800 dark:text-gray-100">Purchase Billing</h2>
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                            {selectedFiscalYear ? selectedFiscalYear.name : 'All Years'}
                        </span>
                    </div>

                    {/* Action Shortcuts */}
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setIsAddBillModalOpen(true)}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm transition-colors"
                        >
                            <Plus size={14} />
                            Add Bill
                        </button>
                        <button
                            onClick={() => setIsAddCompanyModalOpen(true)}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-white dark:bg-zinc-900 hover:bg-gray-50 dark:hover:bg-zinc-800 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-zinc-700 rounded-lg shadow-sm transition-colors"
                        >
                            <Plus size={14} />
                            Add Company
                        </button>
                    </div>
                </div>

                {/* Company Cards Grid */}
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-12 space-y-2">
                        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
                        <p className="text-sm text-gray-500">Loading purchase summaries...</p>
                    </div>
                ) : activeCompanies.length === 0 ? (
                    <div className="bg-white dark:bg-zinc-900 border border-dashed border-gray-300 dark:border-zinc-800 rounded-2xl p-8 text-center max-w-lg mx-auto">
                        <Building className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                        <h3 className="font-bold text-[15px] text-gray-800 dark:text-gray-200">No Active Purchases</h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-sm mx-auto">
                            No company details have recorded purchases or bills in the selected fiscal year {selectedFiscalYear ? `(${selectedFiscalYear.name})` : ''}.
                        </p>
                        <button
                            onClick={() => setIsAddBillModalOpen(true)}
                            className="mt-4 px-4 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow transition-colors inline-flex items-center gap-1.5"
                        >
                            <Plus size={14} />
                            Create First Purchase Bill
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {activeCompanies.map((company) => (
                            <Card
                                key={company.id}
                                className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800/80 hover:border-blue-400 dark:hover:border-blue-500 hover:-translate-y-1 hover:shadow-lg transition-all duration-300 flex flex-col justify-between overflow-hidden"
                            >
                                <div className="p-4 space-y-3">
                                    {/* Company Name Header */}
                                    <div className="flex items-start gap-3">
                                        <div className="p-2 rounded-lg bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-400 shrink-0">
                                            <Building className="h-4.5 w-4.5" />
                                        </div>
                                        <div className="space-y-0.5">
                                            <h3 className="font-extrabold text-[15px] text-gray-900 dark:text-gray-100 line-clamp-1">
                                                {company.company_name}
                                            </h3>
                                            {company.pan_vat_details && (
                                                <p className="text-[11px] text-gray-500 dark:text-gray-400">
                                                    PAN/VAT: <span className="font-semibold">{company.pan_vat_details}</span>
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Address */}
                                    {company.address && (
                                        <p className="text-[11px] text-gray-500 dark:text-gray-400 line-clamp-1 border-t dark:border-zinc-800 pt-2">
                                            {company.address}
                                        </p>
                                    )}
                                </div>

                                {/* Financial Details Block */}
                                <div className="bg-blue-50/50 dark:bg-blue-950/20 border-t border-gray-100 dark:border-zinc-800 p-4 flex items-center justify-between">
                                    <div className="space-y-0.5">
                                        <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider block">
                                            Total Purchases
                                        </span>
                                        <span className="text-base font-extrabold text-blue-600 dark:text-blue-400">
                                            {formatNepaliCurrency(company.totalPurchaseAmount)}
                                        </span>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider block">
                                            Total Bills
                                        </span>
                                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-bold bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 rounded-full mt-0.5">
                                            <Layers className="h-3 w-3" />
                                            {company.totalBillCount} {company.totalBillCount === 1 ? 'Bill' : 'Bills'}
                                        </span>
                                    </div>
                                </div>
                            </Card>
                        ))}
                    </div>
                )}
            </div>

            {/* Modals */}
            <AddPanVatCompanyModal
                isOpen={isAddCompanyModalOpen}
                onClose={() => setIsAddCompanyModalOpen(false)}
                onSuccess={() => {
                    queryClient.invalidateQueries({ queryKey: ['pan-vat-companies'] })
                    queryClient.invalidateQueries({ queryKey: ['company-details'] })
                }}
            />

            {isAddBillModalOpen && (
                <AddPanVatBillModal
                    onClose={() => {
                        setIsAddBillModalOpen(false)
                        queryClient.invalidateQueries({ queryKey: ['pan-vat-bills'] })
                    }}
                />
            )}
        </div>
    )
}
