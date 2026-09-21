'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'

export function Providers({ children }: { children: React.ReactNode }) {
  // useState, not a module constant: a client created at import time is shared across requests
  // during SSR and leaks one user's cache into another's render.
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          // The server owns every number on screen; refetching on focus mid-scenario would
          // fight the player's own state.
          queries: { refetchOnWindowFocus: false, retry: 1, staleTime: 10_000 },
        },
      }),
  )
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}
