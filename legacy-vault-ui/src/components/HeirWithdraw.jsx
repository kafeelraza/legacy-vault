import { getVaultContract } from "../utils/contract";

export default function HeirWithdraw() {
  async function withdraw() {
    const contract = getVaultContract();
    const tx = await contract.heirWithdraw();
    await tx.wait();
    alert("Heir withdrawn!");
  }

  return (
    <div>
      <button onClick={withdraw}>Withdraw as Heir</button>
    </div>
  );
}
