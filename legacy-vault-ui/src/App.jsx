// import React, { useEffect, useState } from "react";
// import { ethers } from "ethers";

// const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS;
// const ABI = [
//   "function deposit() payable",
//   "function heartbeat()",
//   "function setHeir(address,uint256)",
//   "function triggerInheritance()",
//   "function getHeirs() view returns (address[])",
//   "function ownerWithdraw(uint256)",
//   "event Deposited(address indexed from, uint256 amount)",
// ];

// function App() {
//   const [provider, setProvider] = useState(null);
//   const [signer, setSigner] = useState(null);
//   const [contract, setContract] = useState(null);
//   const [account, setAccount] = useState(null);
//   const [txStatus, setTxStatus] = useState("");

//   useEffect(() => {
//     if (window.ethereum) {
//       const p = new ethers.BrowserProvider(window.ethereum);
//       setProvider(p);
//     }
//   }, []);

//   async function connect() {
//     await window.ethereum.request({ method: "eth_requestAccounts" });
//     const p = new ethers.BrowserProvider(window.ethereum);
//     const s = await p.getSigner();
//     const addr = await s.getAddress();
//     setSigner(s);
//     setAccount(addr);
//     const c = new ethers.Contract(CONTRACT_ADDRESS, ABI, s);
//     setContract(c);
//   }

//   async function deposit(amountEth) {
//     try {
//       setTxStatus("sending deposit...");
//       const tx = await contract.deposit({ value: ethers.parseEther(amountEth) });
//       await tx.wait();
//       setTxStatus("deposit confirmed");
//     } catch (e) { setTxStatus("error: "+(e?.message||e)); }
//   }

//   async function heartbeat() {
//     try {
//       setTxStatus("sending heartbeat...");
//       const tx = await contract.heartbeat();
//       await tx.wait();
//       setTxStatus("heartbeat done");
//     } catch (e) { setTxStatus("error: "+(e?.message||e)); }
//   }

//   async function setHeir(addr, amountEth) {
//     try {
//       setTxStatus("setting heir...");
//       const amt = ethers.parseEther(amountEth);
//       const tx = await contract.setHeir(addr, amt);
//       await tx.wait();
//       setTxStatus("heir set");
//     } catch (e) { setTxStatus("error: "+(e?.message||e)); }
//   }

//   async function triggerInheritance() {
//     try {
//       setTxStatus("triggering...");
//       const tx = await contract.triggerInheritance();
//       await tx.wait();
//       setTxStatus("triggered");
//     } catch (e) { setTxStatus("error: "+(e?.message||e)); }
//   }

//   return (
//     <div style={{padding:20, fontFamily:'Inter, Arial'}}>
//       <h1>LegacyVault — UI (Sepolia)</h1>
//       {!account ? (
//         <button onClick={connect}>Connect MetaMask</button>
//       ) : (
//         <div>
//           <div>Connected: {account}</div>
//           <div style={{ marginTop: 10 }}>
//   {/* Manual input for deposit */}
//   <input
//     id="depositAmt"
//     placeholder="Amount (ETH)"
//     style={{ width: 150 }}
//   />
//   <button
//     onClick={() => {
//       const amt = document.getElementById("depositAmt").value;
//       if (amt) deposit(amt);
//     }}
//     style={{ marginLeft: 8 }}
//   >
//     Deposit
//   </button>

//   <button onClick={heartbeat} style={{ marginLeft: 8 }}>
//     Heartbeat
//   </button>
//   <button onClick={triggerInheritance} style={{ marginLeft: 8 }}>
//     Trigger Inheritance
//   </button>
// </div>

//           <div style={{marginTop:12}}>
//             <input id="heirAddr" placeholder="heir address" style={{width:320}}/>
//             <input id="heirAmt" placeholder="amount (ETH)" style={{width:120, marginLeft:8}}/>
//             <button onClick={()=>{
//               const a = document.getElementById("heirAddr").value;
//               const am = document.getElementById("heirAmt").value;
//               setHeir(a, am);
//             }} style={{marginLeft:8}}>Set Heir</button>
//           </div>

//           <div style={{marginTop:12}}>Status: {txStatus}</div>
//         </div>
//       )}
//     </div>
//   );
// }

// export default App;

// import React, { useState, useEffect } from "react";
// import { useAccount, useSigner, usePublicClient } from "wagmi";
// import { ethers } from "ethers";
// import { LEGACY_VAULT_ABI, LEGACY_VAULT_ADDRESS } from "./constants/abi";

// import { ConnectButton } from "@rainbow-me/rainbowkit";

// function App() {
//   const { address, isConnected } = useAccount();
//   const { data: signer } = useSigner();
//   const publicClient = usePublicClient();

//   const [vaultBalance, setVaultBalance] = useState("0");
//   const [lastHeartbeat, setLastHeartbeat] = useState(0);
//   const [inactivityPeriod, setInactivityPeriod] = useState(0);
//   const [heirs, setHeirs] = useState([]);

//   const [newHeirAddress, setNewHeirAddress] = useState("");
//   const [newHeirShare, setNewHeirShare] = useState("");

//   // Contract object
//   function getContract(write = false) {
//     const provider = publicClient;
//     const contract = new ethers.Contract(
//       LEGACY_VAULT_ADDRESS,
//       LEGACY_VAULT_ABI,
//       write ? signer : provider
//     );
//     console.log("📌 Contract created (write =", write, "):", LEGACY_VAULT_ADDRESS);
//     return contract;
//   }

//   // Fetch vault data
//   async function fetchVaultData() {
//     console.log("🔄 Fetching vault data...");
//     try {
//       const contract = getContract(false);

//       const bal = await contract.getVaultBalance();
//       console.log("✅ Vault balance fetched:", bal.toString());
//       setVaultBalance(ethers.formatEther(bal));

//       const t = await contract.timeUntilInactive();
//       console.log("✅ Time until inactive:", t.toString());
//       setLastHeartbeat(Date.now() + t * 1000);

//       const period = await contract.inactivityPeriod();
//       console.log("✅ Inactivity period fetched:", period.toString());
//       setInactivityPeriod(period.toString());

//       const heirAddrs = await contract.getHeirs();
//       console.log("✅ Heir addresses fetched:", heirAddrs);

//       const heirList = await Promise.all(
//         heirAddrs.map(async (h) => {
//           const share = await contract.getHeirShare(h);
//           console.log(`   ↳ Heir ${h} has share:`, share.toString());
//           return { address: h, share: share.toString() };
//         })
//       );
//       setHeirs(heirList);
//     } catch (err) {
//       console.error("❌ Error fetching vault data:", err);
//     }
//   }

//   useEffect(() => {
//     if (isConnected) {
//       console.log("🔌 Wallet connected:", address);
//       fetchVaultData();
//     }
//   }, [isConnected]);

//   // UI actions
//   async function handleDeposit() {
//     try {
//       const amount = prompt("Enter amount in ETH to deposit:");
//       if (!amount) return;
//       console.log("💰 Depositing:", amount, "ETH");

//       const contract = getContract(true);
//       const tx = await contract.deposit({ value: ethers.parseEther(amount) });
//       console.log("⏳ Waiting for deposit tx:", tx.hash);
//       await tx.wait();
//       console.log("✅ Deposit confirmed:", tx.hash);

//       fetchVaultData();
//     } catch (err) {
//       console.error("❌ Deposit error:", err);
//     }
//   }

//   async function handleHeartbeat() {
//     try {
//       console.log("❤️ Sending heartbeat...");
//       const contract = getContract(true);
//       const tx = await contract.heartbeat();
//       console.log("⏳ Waiting for heartbeat tx:", tx.hash);
//       await tx.wait();
//       console.log("✅ Heartbeat confirmed:", tx.hash);
//       fetchVaultData();
//     } catch (err) {
//       console.error("❌ Heartbeat error:", err);
//     }
//   }

//   async function handleSetInactivity() {
//     const period = prompt("Enter inactivity period in seconds:");
//     if (!period) return;
//     console.log("⚙️ Setting inactivity period to:", period, "seconds");

//     try {
//       const contract = getContract(true);
//       const tx = await contract.setInactivityPeriod(period);
//       console.log("⏳ Waiting for setInactivityPeriod tx:", tx.hash);
//       await tx.wait();
//       console.log("✅ Inactivity period set:", tx.hash);
//       fetchVaultData();
//     } catch (err) {
//       console.error("❌ InactivityPeriod error:", err);
//     }
//   }

//   async function handleSetHeir() {
//     const addr = newHeirAddress.trim();
//     const shareInput = newHeirShare.trim();
//     if (!addr || !shareInput) {
//       alert("Enter both address and share");
//       return;
//     }

//     let bps;
//     if (+shareInput <= 100) {
//       bps = +shareInput * 100;
//     } else {
//       bps = +shareInput;
//     }
//     console.log("👤 Setting heir:", addr, "with share:", bps, "bps");

//     try {
//       const contract = getContract(true);
//       const tx = await contract.setHeirShare(addr, bps);
//       console.log("⏳ Waiting for setHeirShare tx:", tx.hash);
//       await tx.wait();
//       console.log("✅ Heir share set:", tx.hash);

//       setNewHeirAddress("");
//       setNewHeirShare("");
//       fetchVaultData();
//     } catch (err) {
//       console.error("❌ setHeirShare error:", err);
//     }
//   }

//   async function handleTriggerInheritance() {
//     try {
//       console.log("⚡ Triggering inheritance...");
//       const contract = getContract(true);
//       const tx = await contract.triggerInheritance();
//       console.log("⏳ Waiting for triggerInheritance tx:", tx.hash);
//       await tx.wait();
//       console.log("✅ Inheritance triggered:", tx.hash);
//       fetchVaultData();
//     } catch (err) {
//       console.error("❌ triggerInheritance error:", err);
//     }
//   }

//   async function handleWithdraw() {
//     try {
//       const amt = prompt("Enter amount in ETH to withdraw:");
//       if (!amt) return;
//       console.log("🏧 Withdrawing:", amt, "ETH");

//       const contract = getContract(true);
//       const tx = await contract.withdraw(ethers.parseEther(amt));
//       console.log("⏳ Waiting for withdraw tx:", tx.hash);
//       await tx.wait();
//       console.log("✅ Withdraw confirmed:", tx.hash);

//       fetchVaultData();
//     } catch (err) {
//       console.error("❌ Withdraw error:", err);
//     }
//   }

//   return (
//     <div style={{ padding: 20 }}>
//       <h1>LegacyVault V3 Dashboard</h1>
//       <WalletConnectSection />

//       {isConnected && (
//         <>
//           <div>Connected address: {address}</div>
//           <div>Vault Balance: {vaultBalance} ETH</div>
//           <div>Inactivity Period: {inactivityPeriod} seconds</div>
//           <div>Time until inactive (ms): {lastHeartbeat - Date.now()}</div>

//           <button onClick={handleDeposit}>Deposit</button>
//           <button onClick={handleHeartbeat}>Heartbeat</button>
//           <button onClick={handleSetInactivity}>Set Inactivity Period</button>

//           <h2>Heirs</h2>
//           {heirs.map((h, idx) => (
//             <div key={idx}>
//               <span>{h.address}</span> — <span>{h.share} bps</span>
//             </div>
//           ))}

//           <div style={{ marginTop: 10 }}>
//             <input
//               placeholder="Heir Address"
//               value={newHeirAddress}
//               onChange={(e) => setNewHeirAddress(e.target.value)}
//             />
//             <input
//               placeholder="Share (%) or bps"
//               value={newHeirShare}
//               onChange={(e) => setNewHeirShare(e.target.value)}
//             />
//             <button onClick={handleSetHeir}>Set Heir Share</button>
//           </div>

//           <button onClick={handleTriggerInheritance} style={{ marginTop: 20 }}>
//             Trigger Inheritance
//           </button>

//           <button onClick={handleWithdraw} style={{ marginTop: 20 }}>
//             Withdraw
//           </button>
//         </>
//       )}
//     </div>
//   );
// }

// function WalletConnectSection() {
//   return (
//     <div style={{ marginBottom: 20 }}>
//       <ConnectButton />
//     </div>
//   );
// }
// src/App.jsx
// src/App.jsx
import { WalletProvider, useWallet } from "./providers/WalletProvider";

function App() {
  const { account, connectWallet } = useWallet();

  return (
    <div>
      <button onClick={connectWallet}>
        {account ? `Connected: ${account}` : "Connect Wallet"}
      </button>
    </div>
  );
}

export default function Root() {
  return (
    <WalletProvider>
      <App />
    </WalletProvider>
  );
}
