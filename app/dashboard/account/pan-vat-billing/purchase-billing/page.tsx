'use client'

import { ArrowLeft, FileText, Users, Building, BarChart3, Plus, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'
import { AddPanVatCompanyModal } from '@/features/account/components/AddPanVatCompanyModal'
import { AddPanVatBillModal } from '@/features/account/components/AddPanVatBillModal'
import { PanVatBillList } from '@/features/account/components/PanVatBillList'
import { getPanVatCompanies, deletePanVatCompany, type PanVatCompany } from '@/features/account/actions/pan-vat-company-actions'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { PartiesStatement } from '@/features/account/components/PartiesStatement'

type TabType = 'pan-vat-bill' | 'parties-statement' | 'pan-vat-company' | 'report'

export default function PurchaseBillingPage() {
    const [activeTab, setActiveTab] = useState<TabType>('pan-vat-bill')
    const [isAddCompanyModalOpen, setIsAddCompanyModalOpen] = useState(false)
    const [isAddBillModalOpen, setIsAddBillModalOpen] = useState(false)
    const queryClient = useQueryClient()

    const tabs = [
        { id: 'pan-vat-bill' as TabType, label: 'Pan/Vat Bill', icon: FileText },
        { id: 'parties-statement' as TabType, label: 'Parties Statement', icon: Users },
        { id: 'pan-vat-company' as TabType, label: 'Pan/Vat Company', icon: Building },
        { id: 'report' as TabType, label: 'Report', icon: BarChart3 },
    ]

    // Fetch Pan/Vat Companies
    const { data: companies = [], isLoading } = useQuery({
        queryKey: ['pan-vat-companies'],
        queryFn: getPanVatCompanies,
    })

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this company?')) return

        try {
            await deletePanVatCompany(id)
            queryClient.invalidateQueries({ queryKey: ['pan-vat-companies'] })
        } catch (error) {
            console.error('Error deleting company:', error)
            alert('Failed to delete company')
        }
    }

    return (
        <div className="min-h-full bg-gray-50 dark:bg-zinc-950">
            {/* Header */}
            <div className="bg-white dark:bg-zinc-900 border-b dark:border-zinc-800">
                {/* First Row - Title */}
                <div className="px-6 py-4">
                    <div className="flex items-center gap-4">
                        <Link
                            href="/dashboard/account/pan-vat-billing"
                            className="p-2 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-md transition-colors"
                        >
                            <ArrowLeft className="h-5 w-5" />
                        </Link>
                        <div>
                            <h1 className="text-xl font-bold">Purchase Billing</h1>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                Manage purchase invoices and PAN/VAT details
                            </p>
                        </div>
                    </div>
                </div>

                {/* Second Row - Navigation Buttons & Add Button */}
                <div className="px-6 pb-4">
                    <div className="flex items-center justify-between gap-4">
                        <div className="flex flex-wrap gap-2">
                            {tabs.map((tab) => {
                                const Icon = tab.icon
                                return (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveTab(tab.id)}
                                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === tab.id
                                            ? 'bg-blue-600 text-white shadow-md'
                                            : 'bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-zinc-700'
                                            }`}
                                    >
                                        <Icon className="h-4 w-4" />
                                        {tab.label}
                                    </button>
                                )
                            })}
                        </div>

                        {/* Add Button - Changes based on active tab */}
                        {activeTab === 'pan-vat-bill' && (
                            <button
                                onClick={() => setIsAddBillModalOpen(true)}
                                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap"
                            >
                                <Plus className="h-4 w-4" />
                                Add Bill
                            </button>
                        )}
                        {activeTab === 'pan-vat-company' && (
                            <button
                                onClick={() => setIsAddCompanyModalOpen(true)}
                                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap"
                            >
                                <Plus className="h-4 w-4" />
                                Add Company
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="p-6">

                {activeTab === 'pan-vat-bill' ? (
                    <PanVatBillList onAddBill={() => setIsAddBillModalOpen(true)} />
                ) : activeTab === 'parties-statement' ? (
                    <PartiesStatement />
                ) : activeTab === 'pan-vat-company' ? (
                    <div className="bg-white dark:bg-zinc-900 rounded-lg border dark:border-zinc-800">
                        {/* Table Header */}
                        <div className="p-4 border-b dark:border-zinc-800">
                            <h2 className="text-lg font-semibold">Pan/Vat Companies</h2>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                Total: {companies.length} {companies.length === 1 ? 'company' : 'companies'}
                            </p>
                        </div>

                        {/* Table */}
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-gray-50 dark:bg-zinc-800">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                            Company Name
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                            Pan/Vat No
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                            Supplier Name
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                            Remarks
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                            Created At
                                        </th>
                                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                            Actions
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white dark:bg-zinc-900 divide-y divide-gray-200 dark:divide-zinc-800">
                                    {isLoading ? (
                                        <tr>
                                            <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                                                Loading companies...
                                            </td>
                                        </tr>
                                    ) : companies.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                                                No companies found. Click "Add Company" to create one.
                                            </td>
                                        </tr>
                                    ) : (
                                        companies.map((company) => (
                                            <tr key={company.id} className="hover:bg-gray-50 dark:hover:bg-zinc-800/50">
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                                        {company.company_name}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="text-sm text-gray-900 dark:text-gray-100">
                                                        {company.pan_vat_no}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="text-sm text-gray-900 dark:text-gray-100">
                                                        {company.supplier_name || '-'}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="text-sm text-gray-500 dark:text-gray-400 max-w-xs truncate">
                                                        {company.remarks || '-'}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="text-sm text-gray-500 dark:text-gray-400">
                                                        {format(new Date(company.created_at), 'MMM dd, yyyy')}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-right">
                                                    <button
                                                        onClick={() => handleDelete(company.id)}
                                                        className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors"
                                                        title="Delete company"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ) : (
                    <div className="bg-white dark:bg-zinc-900 rounded-lg border dark:border-zinc-800 p-8">
                        <div className="text-center text-gray-500 dark:text-gray-400">
                            <p className="text-lg font-semibold">Report</p>
                            <p className="text-sm mt-2">Report content will be implemented here</p>
                        </div>
                    </div>
                )}
            </div>

            {/* Add Company Modal */}
            <AddPanVatCompanyModal
                isOpen={isAddCompanyModalOpen}
                onClose={() => setIsAddCompanyModalOpen(false)}
                onSuccess={() => {
                    queryClient.invalidateQueries({ queryKey: ['pan-vat-companies'] })
                }}
            />

            {/* Add Bill Modal */}
            {isAddBillModalOpen && (
                <AddPanVatBillModal
                    onClose={() => setIsAddBillModalOpen(false)}
                />
            )}
        </div>
    )
}
