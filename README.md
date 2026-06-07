## Foundry

**Foundry is a blazing fast, portable and modular toolkit for Ethereum application development written in Rust.**

Foundry consists of:

- **Forge**: Ethereum testing framework (like Truffle, Hardhat and DappTools).
- **Cast**: Swiss army knife for interacting with EVM smart contracts, sending transactions and getting chain data.
- **Anvil**: Local Ethereum node, akin to Ganache, Hardhat Network.
- **Chisel**: Fast, utilitarian, and verbose solidity REPL.

## Documentation

https://book.getfoundry.sh/

## Usage

### Frontend + Oracle Backend

Install dependencies from both project roots:

```shell
npm install
cd legacy-vault-ui
npm install
```

Create environment files from the examples:

```shell
copy .env.example .env
copy legacy-vault-ui\.env.example legacy-vault-ui\.env
```

Run the oracle backend from the repository root:

```shell
npm run oracle
```

Run the React frontend in a second terminal:

```shell
cd legacy-vault-ui
npm run dev
```

By default, the frontend expects the oracle at `http://localhost:5000` via
`VITE_ORACLE_BASE_URL`, and the dApp is configured for Sepolia chain id
`11155111`.

### Persistent Recovery Data

Set `MONGO_URI` in the root `.env` to a persistent MongoDB database before
starting the oracle. Registered passkeys, guardian configuration, guardian
recovery requests, and signed guardian approvals are stored in MongoDB and
survive oracle restarts.

Activity timeline entries are synced to MongoDB per connected wallet. Browser
storage remains only as an offline fallback.

WebAuthn registration and authentication challenges are also stored in MongoDB,
but intentionally expire after five minutes for security. JWT recovery sessions
expire after one hour and can authorize only one oracle recovery signature.
Guardian approval requests expire after fifteen minutes and cannot be replayed
after a recovery token is issued. For a hosted Sepolia demo, set
`FRONTEND_ORIGINS` to the deployed frontend URL and set `WEBAUTHN_RP_ID` to
that frontend domain.

Activity timeline writes are rate limited. Clearing a synced timeline requires
an owner-wallet signature.

### Hosting And Future Updates

The frontend can be hosted as a Vite static site. Set the hosting project root
to `legacy-vault-ui`, build with `npm run build`, and publish `dist`. The
included `vercel.json` preserves React routes such as `/app/recovery`.

Host the oracle as a persistent Node service using `npm start`. Configure every
root `.env.example` value as a hosting-provider secret. In production:

```text
NODE_ENV=production
FRONTEND_ORIGINS=https://your-frontend-domain.example
WEBAUTHN_RP_ID=your-frontend-domain.example
```

The oracle accepts a hosting-provider supplied `PORT` and exposes `/health` for
service health checks. Free hosts that sleep while idle can delay the first
passkey or recovery request after inactivity.

For Render, the included `render.yaml` creates a free Node web service and
prompts for all sensitive environment values instead of storing them in Git.

The frontend and oracle can be updated later by pushing code and redeploying.
MongoDB data survives redeployments. Never expose `ORACLE_PRIVATE_KEY`,
`JWT_SECRET`, or `MONGO_URI` in frontend variables or source control.

### Contract Version Detection

Old broadcast and deployment artifacts may be stale after proxy upgrades. Treat
live proxy reads as the source of truth for the active contract version. The
frontend performs read-only checks against the configured vault address using
`version()`, `usedNonces(address)`, `dailyLimit(address)`, and
`spentToday(address)` before enabling V2/V3-only recovery and wallet-spending
features.

The active Sepolia proxy was deployed and upgraded through Remix. The current
V3 contract does not contain on-chain guardian storage or a
`depositFor(address)` function. Fully trustless guardian recovery and direct
QR-to-vault deposits require a separately reviewed V4 implementation and a
deliberate Remix proxy upgrade; the current UI does not present those features
as available.

### Build

```shell
$ forge build
```

### Test

```shell
$ forge test
```

### Format

```shell
$ forge fmt
```

### Gas Snapshots

```shell
$ forge snapshot
```

### Anvil

```shell
$ anvil
```

### Deploy

```shell
$ forge script script/Counter.s.sol:CounterScript --rpc-url <your_rpc_url> --private-key <your_private_key>
```

### Cast

```shell
$ cast <subcommand>
```

### Help

```shell
$ forge --help
$ anvil --help
$ cast --help
```
