import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PropsWithChildren, useState } from "react";

export function AppQueryProvider({ children }: PropsWithChildren) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            gcTime: 1000 * 60 * 30,
            networkMode: "offlineFirst",
            refetchOnReconnect: true,
            retry: 1,
            staleTime: 1000 * 30,
          },
          mutations: {
            networkMode: "offlineFirst",
          },
        },
      }),
  );

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
