import { getVaultContract } from "../utils/contract";

export default function TriggerInheritance() {
  async function trigger() {
    const contract = getVaultContract();
    const tx = await contract.triggerInheritance();
    await tx.wait();
    alert("Inheritance distributed among heirs!");
  }

  return (
    <div>
      <button onClick={trigger}>Trigger Inheritance</button>
    </div>
  );
}
