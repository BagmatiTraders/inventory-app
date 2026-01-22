"use client"

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import * as React from 'react'

export function ReactQueryProvider({ children }: { children: React.ReactNode }) {
    const [queryClient] = React.useState(() => new QueryClient({
        defaultOptions: {
            queries: {
                staleTime: 5 * 60 * 1000, // 5 minutes - data stays fresh longer
                gcTime: 10 * 60 * 1000, // 10 minutes - keep in cache longer (previously cacheTime)
                refetchOnWindowFocus: false, // Don't refetch on window focus
                retry: 1, // Only retry once on failure
                refetchOnReconnect: false, // Don't refetch on reconnect
            },
        },
    }))

    return (
        <QueryClientProvider client={queryClient}>
            {children}
        </QueryClientProvider>
    )
}
