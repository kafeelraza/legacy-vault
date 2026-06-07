import VaultAbi from "../abis/VaultABI.js";

const env = import.meta.env || {};

export const VAULT_ADDRESS =
  env.VITE_VAULT_ADDRESS || "0xBd940B854C5f761b8c0844A3bF7B205564E5B798";
export const VAULT_ABI = VaultAbi;
export const CHAIN_ID = Number(env.VITE_CHAIN_ID || 11155111);
const runtimeHost =
  typeof window !== "undefined" ? window.location.hostname : "localhost";
const defaultOracleBaseUrl =
  runtimeHost === "localhost" || runtimeHost === "127.0.0.1"
    ? "http://localhost:5000"
    : "https://legacy-vault-oracle.onrender.com";
export const ORACLE_BASE_URL = (
  env.VITE_ORACLE_BASE_URL || defaultOracleBaseUrl
).replace(/\/$/, "");
