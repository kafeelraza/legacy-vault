import React from "react";
import { WagmiConfig, createConfig } from "wagmi";
import { sepolia } from "wagmi/chains";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  RainbowKitProvider,
  getDefaultWallets,
  lightTheme,
} from "@rainbow-me/rainbowkit";
import { http } from "viem";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

// Components
import AppShell from "./components/AppShell";
import Main from "./components/Main";
import CreateVault from "./components/CreateVault";
import HeirPage from "./components/HeirPage";
import SocialRecovery from "./components/SocialRecovery";
import GuardianSignPage from "./components/GuardianSignPage";
import SendETH from "./components/SendETH";
import ActivityPage from "./components/ActivityPage";
import { ToastProvider } from "./components/ToastProvider";
import { ActivityProvider } from "./components/ActivityProvider";

// --- Query Client (for React Query) ---
const queryClient = new QueryClient();

// --- WalletConnect Project ID ---
const WALLETCONNECT_PROJECT_ID =
  import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || "49038cec28ca241b175ff27065ad7b0f";
const SEPOLIA_RPC =
  import.meta.env.VITE_SEPOLIA_RPC_URL ||
  "https://ethereum-sepolia-rpc.publicnode.com";
// --- Chains setup ---
const chains = [sepolia];

// --- Wallets setup ---
const { connectors } = getDefaultWallets({
  appName: "My Web3 Wallet",
  projectId: WALLETCONNECT_PROJECT_ID,
  chains,
});

// --- Wagmi Config ---
const wagmiConfig = createConfig({
  autoConnect: true,
  connectors,
  chains,
  transports: {
    [sepolia.id]: http(SEPOLIA_RPC),
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <WagmiConfig config={wagmiConfig}>
        <RainbowKitProvider
          chains={chains}
          theme={lightTheme({
            accentColor: "#7c3aed",
            accentColorForeground: "#ffffff",
            borderRadius: "medium",
            fontStack: "system",
            overlayBlur: "small",
          })}
        >
          <ActivityProvider>
            <ToastProvider>
              <BrowserRouter>
                <Routes>
                  <Route path="/" element={<Navigate to="/app" replace />} />
                  <Route path="/app" element={<AppShell />}>
                    <Route index element={<Main />} />
                    <Route path="vault" element={<CreateVault />} />
                    <Route path="heir" element={<HeirPage />} />
                    <Route path="recovery" element={<SocialRecovery />} />
                    <Route path="recovery/guardian-sign" element={<GuardianSignPage />} />
                    <Route path="send" element={<SendETH />} />
                    <Route path="pay" element={<SendETH />} />
                    <Route path="activity" element={<ActivityPage />} />
                  </Route>
                </Routes>
              </BrowserRouter>
            </ToastProvider>
          </ActivityProvider>
        </RainbowKitProvider>
      </WagmiConfig>
    </QueryClientProvider>
  );
}
