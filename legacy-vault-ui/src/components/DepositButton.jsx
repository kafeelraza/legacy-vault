import { useContractWrite, usePrepareContractWrite } from "wagmi";
import { LEGACY_VAULT_ABI, LEGACY_VAULT_ADDRESS } from "../abi/abi";

export function DepositButton() {
  const { config } = usePrepareContractWrite({
    address: LEGACY_VAULT_ADDRESS,
    abi: LEGACY_VAULT_ABI,
    functionName: "deposit",
    overrides: {
      value: BigInt(1000000000000000), // 0.001 ETH
    },
  });

  const { write } = useContractWrite(config);

  return <button onClick={() => write?.()}>Deposit</button>;
}
