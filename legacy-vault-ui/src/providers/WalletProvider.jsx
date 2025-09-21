// WalletProvider.jsx
import React, { createContext, useContext, useState } from "react";

const WalletContext = createContext();

export const WalletProvider = ({ children }) => {
  const [account, setAccount] = useState(null);
  const [walletType, setWalletType] = useState(null);

  const connectWallet = async () => {
    try {
      if (window.ethereum) {
        const accounts = await window.ethereum.request({
          method: "eth_requestAccounts",
        });
        setAccount(accounts[0]);
        setWalletType("metamask");
      } else if (window.solana && window.solana.isPhantom) {
        const resp = await window.solana.connect({ onlyIfTrusted: false });
        setAccount(resp.publicKey.toString());
        setWalletType("phantom");
      } else {
        alert("No wallet found!");
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <WalletContext.Provider value={{ account, walletType, connectWallet }}>
      {children}
    </WalletContext.Provider>
  );
};

// custom hook
export const useWallet = () => useContext(WalletContext);
