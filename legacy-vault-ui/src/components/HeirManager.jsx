import { getVaultContract } from "../utils/contract";
import { useState } from "react";

export default function HeirManager() {
  const [addr, setAddr] = useState("");
  const [bps, setBps] = useState("");

  async function setHeirShare() {
    const contract = getVaultContract();
    const tx = await contract.setHeirShare(addr, Number(bps));
    await tx.wait();
    alert(`Heir set with ${bps} bps`);
  }

  return (
    <div>
      <h3>Set Heir Share</h3>
      <input
        type="text"
        placeholder="Heir Address"
        value={addr}
        onChange={(e) => setAddr(e.target.value)}
      />
      <input
        type="number"
        placeholder="BPS (10000 = 100%)"
        value={bps}
        onChange={(e) => setBps(e.target.value)}
      />
      <button onClick={setHeirShare}>Add / Update Heir</button>
    </div>
  );
}
