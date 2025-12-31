import DamagedStock from "@/features/inventory/components/stock-adjustment/DamagedStock"

export default function DamagedStocksPage() {
    return (
        <div className="space-y-6">
            <div className="hidden md:block">
                <h1 className="text-2xl font-bold">Damaged Stocks</h1>
                <p className="text-gray-500">Record and manage damaged, repaired, or exchanged items.</p>
            </div>

            <DamagedStock />
        </div>
    )
}
