import React from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useChainId, useSwitchChain } from "wagmi";
import NetworkBanner from "./NetworkBanner";
import useContractFeatures from "./useContractFeatures";
import { CHAIN_ID } from "../config/contract";

const navItems = [
  { label: "Dashboard", to: "/app", icon: "M4 13h7V4H4v9Zm9 7h7V4h-7v16ZM4 20h7v-5H4v5Z" },
  { label: "Vault", to: "/app/vault", icon: "M5 10V8a7 7 0 0 1 14 0v2h1v10H4V10h1Zm2 0h10V8A5 5 0 0 0 7 8v2Z" },
  { label: "Heir", to: "/app/heir", icon: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0H5Z" },
  { label: "Payments", to: "/app/pay", icon: "M3 11 21 3l-8 18-2-8-8-2Z" },
  { label: "Recovery", to: "/app/recovery", icon: "M12 3a9 9 0 1 0 9 9h-2a7 7 0 1 1-2.05-4.95L14 10h7V3l-2.62 2.62A8.97 8.97 0 0 0 12 3Z" },
  { label: "Activity", to: "/app/activity", icon: "M4 19h16v2H4v-2Zm1-4h3V5H5v10Zm5 0h3V9h-3v6Zm5 0h3V3h-3v12Z" },
];

const routeTitles = {
  "/app": "Dashboard",
  "/app/vault": "Vault Operations",
  "/app/heir": "Heir Setup",
  "/app/send": "Send ETH",
  "/app/pay": "Payments",
  "/app/recovery": "Social Recovery",
  "/app/activity": "Activity Timeline",
};

function shortAddress(address) {
  if (!address) return "";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function NavIcon({ path }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d={path} />
    </svg>
  );
}

export default function AppShell() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain, isPending: isSwitching } = useSwitchChain();
  const location = useLocation();
  const contractFeatures = useContractFeatures();
  const showNetworkWarning = isConnected && chainId !== CHAIN_ID;
  const pageTitle = routeTitles[location.pathname] || "LegacyVault";

  const handleSwitchNetwork = () => {
    switchChain?.({ chainId: CHAIN_ID });
  };

  return (
    <div className="app-container">
      <aside className="sidebar">
        <div>
          <NavLink to="/" className="brand" aria-label="LegacyVault home">
            LegacyVault <span className="brand-dot" />
          </NavLink>

          <nav className="nav-menu" aria-label="App navigation">
            {navItems.map((item) => (
              <div className="nav-item" key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.to === "/app"}
                  className={({ isActive }) =>
                    isActive ? "nav-link active" : "nav-link"
                  }
                >
                  <NavIcon path={item.icon} />
                  <span>{item.label}</span>
                </NavLink>
              </div>
            ))}
          </nav>
        </div>

        <div className="sidebar-footer">
          <span className="version-badge">
            {contractFeatures.isLoading
              ? "Checking contract"
              : `${contractFeatures.detectedVersion} ${
                  contractFeatures.isCompatible ? "Compatible" : "Warning"
                }`}
          </span>
        </div>
      </aside>

      <main className="main-window">
        {showNetworkWarning && (
          <div className="network-banner">
            <span>
              Wrong Network: LegacyVault is configured for Sepolia Testnet.
            </span>
            <button
              className="btn-switch-network"
              type="button"
              onClick={handleSwitchNetwork}
              disabled={isSwitching}
            >
              {isSwitching ? "Switching" : "Switch Network"}
            </button>
          </div>
        )}

        <header className="app-header">
          <div>
            <p className="header-kicker">Clean crypto inheritance dashboard</p>
            <h1 className="page-title">{pageTitle}</h1>
          </div>
          <div className="header-actions">
            {isConnected && (
              <div className="wallet-badge" title={address}>
                <span className="dot" />
                {shortAddress(address)}
              </div>
            )}
            <ConnectButton />
          </div>
        </header>

        <div className="view-viewport">
          <NetworkBanner />
          <Outlet />
        </div>
      </main>
    </div>
  );
}
