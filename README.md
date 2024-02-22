(THUSD THUSDFee thUSD).THUSD# Threshold USD: Decentralized Borrowing Protocol


Threshold USD is a decentralized protocol that allows ETH and tBTC holders to obtain maximum liquidity against
their collateral without paying interest. After locking up ETH or tBTC as collateral in a smart contract and
creating an individual position called a "vault", the user can get instant liquidity by minting thUSD,
a USD-pegged stablecoin. Each vault is required to be collateralized at a minimum of 110%. Any
owner of thUSD can redeem their stablecoins for the underlying collateral at any time. The redemption
mechanism along with algorithmically adjusted fees guarantee a minimum stablecoin value of USD 1.

A liquidation mechanism based on incentivized stability deposits and a redistribution
cycle from riskier to safer vaults provides stability at a much lower collateral ratio than current
systems. Stability is maintained via economically-driven user interactions and arbitrage, rather
than by active governance or monetary interventions.

## More information

Visit [thresholdusd.org](https://www.thresholdusd.org) to find out more and join the discussion.

## Threshold USD System Summary

- [Disclaimer](#disclaimer)
- [Threshold USD Overview](#thresholdusd-overview)
- [Liquidation and the Stability Pool](#liquidation-and-the-stability-pool)
  - [Liquidation gas costs](#liquidation-gas-costs)
  - [Liquidation Logic](#liquidation-logic)
    - [Liquidations in Normal Mode: TCR >= 150%](#liquidations-in-normal-mode-tcr--150)
    - [Liquidations in Recovery Mode: TCR < 150%](#liquidations-in-recovery-mode-tcr--150)
- [Gains From Liquidations](#gains-from-liquidations)
- [thUSD Token Redemption](#thusd-token-redemption)
  - [Partial redemption](#partial-redemption)
  - [Full redemption](#full-redemption)
  - [Redemptions create a price floor](#redemptions-create-a-price-floor)
- [Recovery Mode](#recovery-mode)
- [Project Structure](#project-structure)
  - [Directories](#directories)
  - [Branches](#branches)
- [Core System Architecture](#core-system-architecture)
  - [Core Smart Contracts](#core-smart-contracts)
  - [Data and Value Silo Contracts](#data-and-value-silo-contracts)
  - [Contract Interfaces](#contract-interfaces)
  - [PriceFeed and Oracle](#pricefeed-and-oracle)
  - [PriceFeed Logic](#pricefeed-logic)
  - [Testnet PriceFeed and PriceFeed tests](#testnet-pricefeed-and-pricefeed-tests)
  - [PriceFeed limitations and known issues](#pricefeed-limitations-and-known-issues)
  - [Keeping a sorted list of vaults ordered by ICR](#keeping-a-sorted-list-of-vaults-ordered-by-icr)
  - [Flow of Collateral in Threshold USD](#flow-of-ether-in-thresholdusd)
  - [Flow of thUSD tokens in Threshold USD](#flow-of-thusd-tokens-in-thresholdusd)
- [Expected User Behaviors](#expected-user-behaviors)
- [Contract Ownership and Function Permissions](#contract-ownership-and-function-permissions)
- [Deployment to a Development Blockchain](#deployment-to-a-development-blockchain)
- [Running Tests](#running-tests)
  - [Brownie Tests](#brownie-tests)
  - [OpenEthereum](#openethereum)
  - [Coverage](#coverage)
- [System Quantities - Units and Representation](#system-quantities---units-and-representation)
  - [Integer representations of decimals](#integer-representations-of-decimals)
- [Public Data](#public-data)
- [Public User-Facing Functions](#public-user-facing-functions)
  - [Borrower (Vault) Operations - `BorrowerOperations.sol`](#borrower-vault-operations---borroweroperationssol)
  - [TroveManager Functions - `TroveManager.sol`](#trovemanager-functions---trovemanagersol)
  - [Hint Helper Functions - `HintHelpers.sol`](#hint-helper-functions---hinthelperssol)
  - [Stability Pool Functions - `StabilityPool.sol`](#stability-pool-functions---stabilitypoolsol)
  - [thUSD token `THUSDToken.sol`](#thusd-token-thusdtokensol)
- [Supplying Hints to Vault operations](#supplying-hints-to-vault-operations)
  - [Hints for `redeemCollateral`](#hints-for-redeemcollateral)
    - [First redemption hint](#first-redemption-hint)
    - [Partial redemption hints](#partial-redemption-hints)
- [Gas compensation](#gas-compensation)
  - [Gas compensation schedule](#gas-compensation-schedule)
  - [Liquidation](#liquidation)
  - [Gas compensation and redemptions](#gas-compensation-and-redemptions)
  - [Gas compensation helper functions](#gas-compensation-helper-functions)
- [The Stability Pool](#the-stability-pool)
  - [Mixed liquidations: offset and redistribution](#mixed-liquidations-offset-and-redistribution)
  - [Stability Pool deposit losses and collateral gains - implementation](#stability-pool-deposit-losses-and-eth-gains---implementation)
  - [Stability Pool example](#stability-pool-example)
  - [Stability Pool implementation](#stability-pool-implementation)
  - [How deposits and collateral gains are tracked](#how-deposits-and-eth-gains-are-tracked)
- [Threshold USD System Fees](#thresholdusd-system-fees)
  - [Redemption Fee](#redemption-fee)
  - [Issuance fee](#issuance-fee)
  - [Fee Schedule](#fee-schedule)
  - [Intuition behind fees](#intuition-behind-fees)
  - [Fee decay Implementation](#fee-decay-implementation)
- [Redistributions and Corrected Stakes](#redistributions-and-corrected-stakes)
  - [Corrected Stake Solution](#corrected-stake-solution)
- [Math Proofs](#math-proofs)
- [Definitions](#definitions)
- [Development](#development)
  - [Prerequisites](#prerequisites)
    - [Making node-gyp work](#making-node-gyp-work)
  - [Clone & Install](#clone--install)
  - [Top-level scripts](#top-level-scripts)
    - [Run all tests](#run-all-tests)
    - [Deploy contracts to a testnet](#deploy-contracts-to-a-testnet)
    - [Start a local blockchain and deploy the contracts](#start-a-local-blockchain-and-deploy-the-contracts)
    - [Start dev-frontend in development mode](#start-dev-frontend-in-development-mode)
    - [Start dev-frontend in demo mode](#start-dev-frontend-in-demo-mode)
    - [Build dev-frontend for production](#build-dev-frontend-for-production)
- [Known Issues](#known-issues)
  - [Front-running issues](#front-running-issues)
- [Disclaimer](#disclaimer)

## Threshold USD Overview

Threshold USD is a collateralized debt platform. Users can lock up collateral, and issue stablecoin tokens (thUSD) to their own Ethereum address, and subsequently transfer those tokens to any other Ethereum address. The individual collateralized debt positions are called vaults.

The stablecoin tokens are economically geared towards maintaining value of 1 thUSD = \$1 USD, due to the following properties:

1. The system is designed to always be over-collateralized - the dollar value of the locked collateral exceeds the dollar value of the issued stablecoins

2. The stablecoins are fully redeemable - users can always swap $x worth of thUSD for $x worth of collateral (minus fees), directly with the system.

3. The system algorithmically controls the generation of thUSD through a variable issuance fee.

After opening a Vault with some collateral, users may issue ("borrow") tokens such that the collateralization ratio of their Vault remains above 110%. A user with $1000 worth of collateral in a Vault can issue up to 909.09 thUSD.

The tokens are freely exchangeable - anyone with an Ethereum address can send or receive thUSD tokens, whether they have an open Vault or not. The tokens are burned upon repayment of a Vault's debt.

The Threshold USD system regularly updates the collateral:USD price via a decentralized data feed. When a Vault falls below a minimum collateralization ratio (MCR) of 110%, it is considered under-collateralized, and is vulnerable to liquidation.

## Liquidation and the Stability Pool

Threshold USD utilizes a two-step liquidation mechanism in the following order of priority:

1. Offset under-collateralized vaults against the Stability Pool containing thUSD tokens

2. Redistribute under-collateralized vaults to other borrowers if the Stability Pool is emptied

Threshold USD primarily uses the thUSD tokens in its Stability Pool to absorb the under-collateralized debt, i.e. to repay the liquidated borrower's liability.

Any user may deposit thUSD tokens to the Stability Pool. This allows them to earn the collateral from the liquidated Vault. When a liquidation occurs, the liquidated debt is cancelled with the same amount of thUSD in the Pool (which is burned as a result), and the liquidated collateral is proportionally distributed to depositors.

Stability Pool depositors can expect to earn net gains from liquidations, as in most cases, the value of the liquidated collateral will be greater than the value of the cancelled debt (since a liquidated Vault will likely have an ICR just slightly below 110%).

If the liquidated debt is higher than the amount of thUSD in the Stability Pool, the system tries to cancel as much debt as possible with the tokens in the Stability Pool, and then redistributes the remaining liquidated collateral and debt across all active vaults.

Anyone may call the public `liquidateTroves()` function, which will check for under-collateralized vaults, and liquidate them. Alternatively they can call `batchLiquidateTroves()` with a custom list of vault addresses to attempt to liquidate.

### Liquidation gas costs

Currently, mass liquidations performed via the above functions cost 60-65k gas per vault. Thus the system can liquidate up to a maximum of 95-105 vaults in a single transaction.

### Liquidation Logic

The precise behavior of liquidations depends on the ICR of the Vault being liquidated and global system conditions:  the total collateralization ratio (TCR) of the system, the size of the Stability Pool, etc.  

Here is the liquidation logic for a single Vault in Normal Mode and Recovery Mode.  `SP.THUSD` represents the thUSD in the Stability Pool.

#### Liquidations in Normal Mode: TCR >= 150%

| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Condition                      | Liquidation behavior                                                                                                                                                                                                                                                                                                |
|----------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| ICR < MCR & SP.THUSD >= vault.debt | thUSD in the StabilityPool equal to the Vault's debt is offset with the Vault's debt. The Vault's collateral is shared between depositors.                                                                                                                                                                       |
| ICR < MCR & SP.THUSD < vault.debt | The total StabilityPool thUSD is offset with an equal amount of debt from the Vault.  A fraction of the Vault's collateral (equal to the ratio of its offset debt to its entire debt) is shared between depositors. The remaining debt and collateral (minus ETH gas compensation) is redistributed to active vaults |
| ICR < MCR & SP.THUSD = 0          | Redistribute all debt and collateral (minus ETH gas compensation) to active vaults.                                                                                                                                                                                                                                 |
| ICR  >= MCR                      | Do nothing.                                                                                                                                                                                                                                                                                                         |
#### Liquidations in Recovery Mode: TCR < 150%

| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Condition                                | Liquidation behavior                                                                                                                                                                                                                                                                                                                                                                                         |
|------------------------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| ICR <=100%                               | Redistribute all debt and collateral (minus ETH gas compensation) to active vaults.                                                                                                                                                                                                                                                                                                                          |
| 100% < ICR < MCR & SP.THUSD > vault.debt  | thUSD in the StabilityPool equal to the Vault's debt is offset with the Vault's debt. The Vault's collateral (minus ETH gas compensation) is shared between depsitors.                                                                                                                                                                                                                                    |
| 100% < ICR < MCR & SP.THUSD < vault.debt  | The total StabilityPool thUSD is offset with an equal amount of debt from the Vault.  A fraction of the Vault's collateral (equal to the ratio of its offset debt to its entire debt) is shared between depositors. The remaining debt and collateral (minus ETH gas compensation) is redistributed to active vaults                                                                                          |
| MCR <= ICR < TCR & SP.THUSD >= vault.debt  |  The Pool thUSD is offset with an equal amount of debt from the Vault. A fraction of collateral with dollar value equal to `1.1 * debt` is shared between depositors. Nothing is redistributed to other active vaults. Since it's ICR was > 1.1, the Vault has a collateral remainder, which is sent to the `CollSurplusPool` and is claimable by the borrower. The Vault is closed. |
| MCR <= ICR < TCR & SP.THUSD  < vault.debt | Do nothing.                                                                                                                                                                                                                                                                                                                                                                                                  |
| ICR >= TCR                               | Do nothing.                                                                                                                                                                                                                                                                                                                                                                                                  |

## Gains From Liquidations

Stability Pool depositors gain collateral over time, as liquidated debt is cancelled with their deposit. When they withdraw all or part of their deposited tokens, or top up their deposit, the system sends them their accumulated collateral gains.

Similarly, a Vault's accumulated gains from liquidations are automatically applied to the Vault when the owner performs any operation - e.g. adding/withdrawing collateral, or issuing/repaying thUSD.

## thUSD Token Redemption

Any thUSD holder (whether or not they have an active Vault) may redeem their thUSD directly with the system. Their thUSD is exchanged for collateral, at face value: redeeming x thUSD tokens returns \$x worth of collateral (minus a [redemption fee](#redemption-fee)).

When thUSD is redeemed for collateral, the system cancels the thUSD with debt from vaults, and the collateral is drawn from their collateral.

In order to fulfill the redemption request, vaults are redeemed from in ascending order of their collateralization ratio.

A redemption sequence of `n` steps will **fully** redeem from up to `n-1` vaults, and, and **partially** redeems from up to 1 Vault, which is always the last Vault in the redemption sequence.

Redemptions are blocked when TCR < 110% (there is no need to restrict ICR < TCR). At that TCR redemptions would likely be unprofitable, as thUSD is probably trading above $1 if the system has crashed that badly, but it could be a way for an attacker with a lot of thUSD to lower the TCR even further.

Note that redemptions are disabled during the first 14 days of operation since deployment of the Threshold USD protocol to protect the monetary system in its infancy.

### Partial redemption

Most redemption transactions will include a partial redemption, since the amount redeemed is unlikely to perfectly match the total debt of a series of vaults.

The partially redeemed Vault is re-inserted into the sorted list of vaults, and remains active, with reduced collateral and debt.

### Full redemption

A Vault is defined as “fully redeemed from” when the redemption has caused (debt-200) of its debt to absorb (debt-200) thUSD. Then, its 200 thUSD Liquidation Reserve is cancelled with its remaining 200 debt: the Liquidation Reserve is burned from the gas address, and the 200 debt is zero’d.

Before closing, we must handle the Trove’s **collateral surplus**: that is, the excess collateral remaining after redemption, due to its initial over-collateralization.

This collateral surplus is sent to the `CollSurplusPool`, and the borrower can reclaim it later. The Vault is then fully closed.

### Redemptions create a price floor

Economically, the redemption mechanism creates a hard price floor for thUSD, ensuring that the market price stays at or near to $1 USD.

## Recovery Mode

Recovery Mode kicks in when the total collateralization ratio (TCR) of the system falls below 150%.

During Recovery Mode, liquidation conditions are relaxed, and the system blocks borrower transactions that would further decrease the TCR. New thUSD may only be issued by adjusting existing vaults in a way that improves their ICR, or by opening a new Vault with an ICR of >=150%. In general, if an existing Vault's adjustment reduces its ICR, the transaction is only executed if the resulting TCR is above 150%

Recovery Mode is structured to incentivize borrowers to behave in ways that promptly raise the TCR back above 150%, and to incentivize thUSD holders to replenish the Stability Pool.

Economically, Recovery Mode is designed to encourage collateral top-ups and debt repayments, and also itself acts as a self-negating deterrent: the possibility of it occurring actually guides the system away from ever reaching it.

## Project Structure

### Directories
- `papers` - Whitepaper and math papers: a proof of Threshold USD's vault order invariant, and a derivation of the scalable Stability Pool staking formula
- `packages/dev-frontend/` - Threshold USD Developer UI: a fully functional React app used for interfacing with the smart contracts during development
- `packages/fuzzer/` - A very simple, purpose-built tool based on Threshold USD middleware for randomly interacting with the system
- `packages/lib-base/` - Common interfaces and classes shared by the other `lib-` packages
- `packages/lib-ethers/` - [Ethers](https://github.com/ethers-io/ethers.js/)-based middleware that can read Threshold USD state and send transactions
- `packages/lib-react/` - Components and hooks that React-based apps can use to view Threshold USD contract state
- `packages/lib-subgraph/` - [Apollo Client](https://github.com/apollographql/apollo-client)-based middleware backed by the Threshold USD subgraph that can read Threshold USD state
- `packages/providers/` - Subclassed Ethers providers used by the frontend
- `packages/subgraph/` - [Subgraph](https://thegraph.com) for querying Threshold USD state as well as historical data like transaction history
- `packages/contracts/` - The backend development folder, contains the Hardhat project, contracts and tests
- `packages/contracts/contracts/` - The core back end smart contracts written in Solidity
- `packages/contracts/test/` - JS test suite for the system. Tests run in Mocha/Chai
- `packages/contracts/tests/` - Python test suite for the system. Tests run in Brownie
- `packages/contracts/gasTest/` - Non-assertive tests that return gas costs for Threshold USD operations under various scenarios
- `packages/contracts/fuzzTests/` - Echidna tests, and naive "random operation" tests
- `packages/contracts/migrations/` - contains Hardhat script for deploying the smart contracts to the blockchain
- `packages/contracts/utils/` - external Hardhat and node scripts - deployment helpers, gas calculators, etc

Backend development is done in the Hardhat framework, and allows Threshold USD to be deployed on the Hardhat EVM network for fast compilation and test execution.

### Branches

As of 18/01/2021, the current working branch is `main`. `master` is out of date.

## Core System Architecture

The core Threshold USD system consists of several smart contracts, which are deployable to the Ethereum blockchain.

All application logic and data is contained in these contracts - there is no need for a separate database or back end logic running on a web server. In effect, the Ethereum network is itself the Threshold USD back end. As such, all balances and contract data are public.

The system has no admin key or human governance. Once deployed, it is fully automated, decentralized and no user holds any special privileges in or control over the system.

The three main contracts - `BorrowerOperations.sol`, `TroveManager.sol` and `StabilityPool.sol` - hold the user-facing public functions, and contain most of the internal system logic. Together they control Vault state updates and movements of collateral and thUSD tokens around the system.

### Core Smart Contracts

`BorrowerOperations.sol` - contains the basic operations by which borrowers interact with their Vault: Vault creation, collateral top-up / withdrawal, stablecoin issuance and repayment. It also sends issuance fees to the `PCV` contract. BorrowerOperations functions call in to TroveManager, telling it to update Vault state, where necessary. BorrowerOperations functions also call in to the various Pools, telling them to move collateral/Tokens between Pools or between Pool <> user, where necessary.

`TroveManager.sol` - contains functionality for liquidations and redemptions. It sends redemption fees to the `PCV` contract. Also contains the state of each Vault - i.e. a record of the Trove’s collateral and debt. TroveManager does not hold value (i.e. collateral / other tokens). TroveManager functions call in to the various Pools to tell them to move collateral/tokens between Pools, where necessary.

`LiquityBase.sol` - Both TroveManager and BorrowerOperations inherit from the parent contract LiquityBase, which contains global constants and some common functions.

`StabilityPool.sol` - contains functionality for Stability Pool operations: making deposits, and withdrawing compounded deposits and accumulated collateral gains. Holds the thUSD Stability Pool deposits, and the collateral gains for depositors, from liquidations.

`THUSDToken.sol` - the stablecoin token contract, which implements the ERC20 fungible token standard in conjunction with EIP-2612 and a mechanism that blocks (accidental) transfers to addresses like the StabilityPool and address(0) that are not supposed to receive funds through direct transfers. The contract mints, burns and transfers thUSD tokens.

`SortedTroves.sol` - a doubly linked list that stores addresses of Vault owners, sorted by their individual collateralization ratio (ICR). It inserts and re-inserts vaults at the correct position, based on their ICR.

`PriceFeed.sol` - Contains functionality for obtaining the current collateral:USD price, which the system uses for calculating collateralization ratios.

`HintHelpers.sol` - Helper contract, containing the read-only functionality for calculation of accurate hints to be supplied to borrower operations and redemptions.

### Data and Value Silo Contracts

Along with `StabilityPool.sol`, these contracts hold collateral and/or tokens for their respective parts of the system, and contain minimal logic:

`ActivePool.sol` - holds the total collateral balance and records the total stablecoin debt of the active vaults.

`DefaultPool.sol` - holds the total collateral balance and records the total stablecoin debt of the liquidated vaults that are pending redistribution to active vaults. If a Vault has pending ether/debt “rewards” in the DefaultPool, then they will be applied to the Vault when it next undergoes a borrower operation, a redemption, or a liquidation.

`CollSurplusPool.sol` - holds the collateral surplus from vaults that have been fully redeemed from as well as from vaults with an ICR > MCR that were liquidated in Recovery Mode. Sends the surplus back to the owning borrower, when told to do so by `BorrowerOperations.sol`.

`GasPool.sol` - holds the total thUSD liquidation reserves. thUSD is moved into the `GasPool` when a Vault is opened, and moved out when a Vault is liquidated or closed.

### Contract Interfaces

`ITroveManager.sol`, `IPool.sol` etc. These provide specification for a contract’s functions, without implementation. They are similar to interfaces in Java or C#.

### PriceFeed and Oracle

Threshold USD functions that require the most current collateral:USD price data fetch the price dynamically, as needed, via the core `PriceFeed.sol` contract using the Chainlink collateral:USD reference contract as its primary and Tellor's collateral:USD price feed as its secondary (fallback) data source. PriceFeed is stateful, i.e. it records the last good price that may come from either of the two sources based on the contract's current state.

The fallback logic distinguishes 3 different failure modes for Chainlink and 2 failure modes for Tellor:

- `Frozen` (for both oracles): last price update more than 4 hours ago
- `Broken` (for both oracles): response call reverted, invalid timeStamp that is either 0 or in the future, or reported price is non-positive (Chainlink) or zero (Tellor). Chainlink is considered broken if either the response for the latest round _or_ the response for the round before the latest fails one of these conditions.
- `PriceChangeAboveMax` (Chainlink only): higher than 50% deviation between two consecutive price updates

There is also a return condition `bothOraclesLiveAndUnbrokenAndSimilarPrice` which is a function returning true if both oracles are live and not broken, and the percentual difference between the two reported prices is below 5%.

The current `PriceFeed.sol` contract has an external `fetchPrice()` function that is called by core Threshold USD functions which require a current collateral:USD price.  `fetchPrice()` calls each oracle's proxy, asserts on the responses, and converts returned prices to 18 digits.

### PriceFeed Logic

The PriceFeed contract fetches the current price and previous price from Chainlink and changes its state (called `Status`) based on certain conditions.

**Initial PriceFeed state:** `chainlinkWorking`. The initial system state that is maintained as long as Chainlink is working properly, i.e. neither broken nor frozen nor exceeding the maximum price change threshold between two consecutive rounds. PriceFeed then obeys the logic found in this table:

  https://docs.google.com/spreadsheets/d/18fdtTUoqgmsK3Mb6LBO-6na0oK-Y9LWBqnPCJRp5Hsg/edit?usp=sharing


### Testnet PriceFeed and PriceFeed tests

The `PriceFeedTestnet.sol` is a mock PriceFeed for testnet and general back end testing purposes, with no oracle connection. It contains a manual price setter, `setPrice()`, and a getter, `getPrice()`, which returns the latest stored price.

The mainnet PriceFeed is tested in `test/PriceFeedTest.js`, using a mock Chainlink aggregator and a mock TellorMaster contract.

### PriceFeed limitations and known issues

The purpose of the PriceFeed is to be at least as good as an immutable PriceFeed that relies purely on Chainlink, while also having some resilience in case of Chainlink failure / timeout, and chance of recovery.

The PriceFeed logic consists of automatic on-chain decision-making for obtaining fallback price data from Tellor, and if possible, for returning to Chainlink if/when it recovers.

The PriceFeed logic is complex, and although we would prefer simplicity, it does allow the system a chance of switching to an accurate price source in case of a Chainlink failure or timeout, and also the possibility of returning to an honest Chainlink price after it has failed and recovered.

We believe the benefit of the fallback logic is worth the complexity, given that our system is entirely immutable - if we had no fallback logic and Chainlink were to be hacked or permanently fail, Threshold USD would become permanently unusable anyway.



**Chainlink Decimals**: the `PriceFeed` checks for and uses the latest `decimals` value reported by the Chainlink aggregator in order to calculate the Chainlink price at 18-digit precision, as needed by Threshold USD.  `PriceFeed` does not assume a value for decimals and can handle the case where Chainlink change their decimal value.

However, the check `chainlinkIsBroken` uses both the current response from the latest round and the response previous round. Since `decimals` is not attached to round data, Threshold USD has no way of knowing whether decimals has changed between the current round and the previous round, so we assume it is the same. Threshold USD assumes the current return value of decimals() applies to both current round `i` and previous round `i-1`.

This means that a decimal change that coincides with a Threshold USD price fetch could cause Threshold USD to assert that the Chainlink price has deviated too much, and fall back to Tellor. There is nothing we can do about this. We hope/expect Chainlink to never change their `decimals()` return value (currently 8), and if a hack/technical error causes Chainlink's decimals to change, Threshold USD may fall back to Tellor.

To summarize the Chainlink decimals issue:
- Threshold USD can handle the case where Chainlink decimals changes across _two consecutive rounds `i` and `i-1` which are not used in the same Threshold USD price fetch_
- If Threshold USD fetches the price at round `i`, it will not know if Chainlink decimals changed across round `i-1` to round `i`, and the consequent price scaling distortion may cause Threshold USD to fall back to Tellor
- Threshold USD will always calculate the correct current price at 18-digit precision assuming the current return value of `decimals()` is correct (i.e. is the value used by the nodes).

**Tellor Decimals**: Tellor uses 6 decimal precision for their ETHUSD price as determined by a social consensus of Tellor miners/data providers, and shown on Tellor's price feed page. Their decimals value is not offered in their on-chain contracts.  We rely on the continued social consensus around 6 decimals for their ETHUSD price feed. Tellor have informed us that if there was demand for an ETHUSD price at different precision, they would simply create a new `requestId`, and make no attempt to alter the social consensus around the precision of the current ETHUSD `requestId` (1) used by Threshold USD.


### Keeping a sorted list of vaults ordered by ICR

Threshold USD relies on a particular data structure: a sorted doubly-linked list of vaults that remains ordered by individual collateralization ratio (ICR), i.e. the amount of collateral (in USD) divided by the amount of debt (in thUSD).

This ordered list is critical for gas-efficient redemption sequences and for the `liquidateTroves` sequence, both of which target vaults in ascending order of ICR.

The sorted doubly-linked list is found in `SortedTroves.sol`.

Nodes map to active vaults in the system - the ID property is the address of a vault owner. The list accepts positional hints for efficient O(1) insertion - please see the [hints](#supplying-hints-to-cdp-operations) section for more details.

ICRs are computed dynamically at runtime, and not stored on the node. This is because ICRs of active vaults change dynamically, when:

- The collateral:USD price varies, altering the USD of the collateral of every Vault
- A liquidation that redistributes collateral and debt to active vaults occurs

The list relies on the fact that a collateral and debt redistribution due to a liquidation preserves the ordering of all active vaults (though it does decrease the ICR of each active Vault above the MCR).

The fact that ordering is maintained as redistributions occur, is not immediately obvious: please see the [mathematical proof](https://github.com/threshold-usd/dev/blob/main/papers) which shows that this holds in Threshold USD.

A node inserted based on current ICR will maintain the correct position, relative to its peers, as liquidation gains accumulate, as long as its raw collateral and debt have not changed.

Nodes also remain sorted as the collateral:USD price varies, since price fluctuations change the collateral value of each Vault by the same proportion.

Thus, nodes need only be re-inserted to the sorted list upon a Vault operation - when the owner adds or removes collateral or debt to their position.

### Flow of Collateral in Threshold USD

Collateral in the system lives in three Pools: the ActivePool, the DefaultPool and the StabilityPool. When an operation is made, collateral is transferred in one of three ways:

- From a user to a Pool
- From a Pool to a user
- From one Pool to another Pool

Collateral is recorded on an _individual_ level, but stored in _aggregate_ in a Pool. An active Vault with collateral and debt has a struct in the TroveManager that stores its ether collateral value in a uint, but its actual collateral is in the balance of the ActivePool contract.

Likewise, the StabilityPool holds the total accumulated collateral gains from liquidations for all depositors.

**Borrower Operations**

| Function                     | Collateral quantity                        | Path                                       |
|------------------------------|-------------------------------------|--------------------------------------------|
| openTrove                    | msg.value                           | msg.sender->BorrowerOperations->ActivePool |
| addColl                      | msg.value                           | msg.sender->BorrowerOperations->ActivePool |
| withdrawColl                 | _collWithdrawal parameter           | ActivePool->msg.sender                     |
| adjustTrove: adding collateral      | msg.value                           | msg.sender->BorrowerOperations->ActivePool |
| adjustTrove: withdrawing collateral | _collWithdrawal parameter           | ActivePool->msg.sender                     |
| closeTrove                   | All remaining                       | ActivePool->msg.sender                     |
| claimCollateral              | CollSurplusPool.balance[msg.sender] | CollSurplusPool->msg.sender                |

**Vault Manager**

| Function                                | Collateral quantity                           | Path                          |
|-----------------------------------------|----------------------------------------|-------------------------------|
| liquidate (offset)                      | collateral to be offset                | ActivePool->StabilityPool     |
| liquidate (redistribution)              | collateral to be redistributed         | ActivePool->DefaultPool       |
| liquidateTroves (offset)                | collateral to be offset                | ActivePool->StabilityPool     |
| liquidateTroves (redistribution)        | collateral to be redistributed         | ActivePool->DefaultPool       |
| batchLiquidateTroves (offset)           | collateral to be offset                | ActivePool->StabilityPool     |
| batchLiquidateTroves (redistribution).  | collateral to be redistributed         | ActivePool->DefaultPool       |
| redeemCollateral                        | collateral to be swapped with redeemer | ActivePool->msg.sender        |
| redeemCollateral                        | redemption fee                         | ActivePool->PCV       |
| redeemCollateral                        | vault's collateral surplus             | ActivePool->CollSurplusPool |

**Stability Pool**

| Function               | Collateral quantity                     | Path                                              |
|------------------------|----------------------------------|---------------------------------------------------|
| provideToSP            | depositor's accumulated collateral gain | StabilityPool -> msg.sender                       |
| withdrawFromSP         | depositor's accumulated collateral gain | StabilityPool -> msg.sender                       |
| withdrawETHGainToTrove | depositor's accumulated collateral gain | StabilityPool -> BorrowerOperations -> ActivePool |

### Flow of thUSD tokens in Threshold USD

![Flow of thUSD](images/THUSD_flows.svg)

When a user issues debt from their Vault, thUSD tokens are minted to their own address, and a debt is recorded on the Vault. Conversely, when they repay their Trove’s thUSD debt, thUSD is burned from their address, and the debt on their Vault is reduced.

Redemptions burn thUSD from the redeemer’s balance, and reduce the debt of the Vault redeemed against.

Liquidations that involve a Stability Pool offset burn tokens from the Stability Pool’s balance, and reduce the thUSD debt of the liquidated Vault.

The only time thUSD is transferred to/from a Threshold USD contract, is when a user deposits thUSD to, or withdraws thUSD from, the StabilityPool.

**Borrower Operations**

| Function                      | thUSD Quantity | ERC20 Operation                      |
|-------------------------------|---------------|--------------------------------------|
| openTrove                     | Drawn thUSD    | thUSD._mint(msg.sender, _THUSDAmount)  |
|                               | Issuance fee  | thUSD._mint(PCV,  THUSDFee)    |
| withdrawTHUSD                  | Drawn thUSD    | thUSD._mint(msg.sender, _THUSDAmount)  |
|                               | Issuance fee  | thUSD._mint(PCV,  THUSDFee)    |
| repayTHUSD                     | Repaid thUSD   | thUSD._burn(msg.sender, _THUSDAmount)  |
| adjustTrove: withdrawing thUSD | Drawn thUSD    | thUSD._mint(msg.sender, _THUSDAmount)  |
|                               | Issuance fee  | thUSD._mint(PCV,  THUSDFee)    |
| adjustTrove: repaying thUSD    | Repaid thUSD   | thUSD._burn(msg.sender, _THUSDAmount)  |
| closeTrove                    | Repaid thUSD   | thUSD._burn(msg.sender, _THUSDAmount) |

**Trove Manager**

| Function                 | thUSD Quantity            | ERC20 Operation                                  |
|--------------------------|--------------------------|--------------------------------------------------|
| liquidate (offset)       | thUSD to offset with debt | thUSD._burn(stabilityPoolAddress, _debtToOffset); |
| liquidateTroves (offset)   | thUSD to offset with debt | thUSD._burn(stabilityPoolAddress, _debtToOffset); |
| batchLiquidateTroves (offset) | thUSD to offset with debt | thUSD._burn(stabilityPoolAddress, _debtToOffset); |
| redeemCollateral         | thUSD to redeem           | thUSD._burn(msg.sender, _THUSD)                    |

**Stability Pool**

| Function       | thUSD Quantity    | ERC20 Operation                                             |
|----------------|------------------|-------------------------------------------------------------|
| provideToSP    | deposit / top-up | thUSD._transfer(msg.sender, stabilityPoolAddress, _amount);  |
| withdrawFromSP | withdrawal       | thUSD._transfer(stabilityPoolAddress, msg.sender, _amount);  |

## Expected User Behaviors

Generally, borrowers call functions that trigger Vault operations on their own Vault. Stability Pool users (who may or may not also be borrowers) call functions that trigger Stability Pool operations, such as depositing or withdrawing tokens to/from the Stability Pool.

Anyone may call the public liquidation functions, and attempt to liquidate one or several vaults.

thUSD token holders may also redeem their tokens, and swap an amount of tokens 1-for-1 in value (minus fees) with collateral.

## Contract Ownership and Function Permissions

All the core smart contracts inherit from the OpenZeppelin `Ownable.sol` contract template. As such all contracts have a single owning address, which is the deploying address. The contract's ownership is renounced either upon deployment, or immediately after its address setter has been called, connecting it to the rest of the core Threshold USD system.

Several public and external functions have modifiers such as `requireCallerIsTroveManager`, `requireCallerIsActivePool`, etc - ensuring they can only be called by the respective permitted contract.

## Deployment to a Development Blockchain

The Hardhat migrations script and deployment helpers in `utils/deploymentHelpers.js` deploy all contracts, and connect all contracts to their dependency contracts, by setting the necessary deployed addresses.

The project is deployed on the Sepolia testnet.

## Running Tests

Run all tests with `npx hardhat test`, or run a specific test with `npx hardhat test ./test/contractTest.js`

Tests are run against the Hardhat EVM.

### Brownie Tests
There are some special tests that are using Brownie framework.

To test, install brownie with:
```
python3 -m pip install --user pipx
python3 -m pipx ensurepath

pipx install eth-brownie
```

and add numpy with:
```
pipx inject eth-brownie numpy
```

Add OpenZeppelin package:
```
brownie pm install OpenZeppelin/openzeppelin-contracts@3.3.0
```

Run, from `packages/contracts/`:
```
brownie test -s
```

### OpenEthereum

Add the local node as a `live` network at `~/.brownie/network-config.yaml`:
```
(...)
      - name: Local Openethereum
        chainid: 17
        id: openethereum
        host: http://localhost:8545
```

Make sure state is cleaned up first:
```
rm -Rf build/deployments/*
```

Start Openthereum node from this repo’s root with:
```
yarn start-dev-chain:openethereum
```

Then, again from `packages/contracts/`, run it with:
```
brownie test -s --network openethereum
```

To stop the Openethereum node, you can do it with:
```
yarn stop-dev-chain
```

### Coverage

To check test coverage you can run:
```
yarn coverage
```

You can see the coverage status at mainnet deployment.

## System Quantities - Units and Representation

### Integer representations of decimals

Several ratios and the collateral:USD price are integer representations of decimals, to 18 digits of precision. For example:

| **uint representation of decimal** | **Number**    |
| ---------------------------------- | ------------- |
| 1100000000000000000                | 1.1           |
| 200000000000000000000              | 200           |
| 1000000000000000000                | 1             |
| 5432100000000000000                | 5.4321        |
| 34560000000                        | 0.00000003456 |
| 370000000000000000000              | 370           |
| 1                                  | 1e-18         |

etc.

## Public Data

All data structures with the ‘public’ visibility specifier are ‘gettable’, with getters automatically generated by the compiler. Simply call `TroveManager::MCR()` to get the MCR, etc.

## Public User-Facing Functions

### Borrower (Vault) Operations - `BorrowerOperations.sol`

`openTrove(uint _maxFeePercentage, uint _THUSDAmount, address _upperHint, address _lowerHint)`: payable function that creates a Vault for the caller with the requested debt, and the collateral received. Successful execution is conditional mainly on the resulting collateralization ratio which must exceed the minimum (110% in Normal Mode, 150% in Recovery Mode). In addition to the requested debt, extra debt is issued to pay the issuance fee, and cover the gas compensation. The borrower has to provide a `_maxFeePercentage` that he/she is willing to accept in case of a fee slippage, i.e. when a redemption transaction is processed first, driving up the issuance fee.

`addColl(address _upperHint, address _lowerHint))`: payable function that adds the received collateral to the caller's active Vault.

`withdrawColl(uint _amount, address _upperHint, address _lowerHint)`: withdraws `_amount` of collateral from the caller’s Vault. Executes only if the user has an active Vault, the withdrawal would not pull the user’s Vault below the minimum collateralization ratio, and the resulting total collateralization ratio of the system is above 150%.

`function withdrawTHUSD(uint _maxFeePercentage, uint _THUSDAmount, address _upperHint, address _lowerHint)`: issues `_amount` of thUSD from the caller’s Vault to the caller. Executes only if the Vault's collateralization ratio would remain above the minimum, and the resulting total collateralization ratio is above 150%. The borrower has to provide a `_maxFeePercentage` that he/she is willing to accept in case of a fee slippage, i.e. when a redemption transaction is processed first, driving up the issuance fee.

`repayTHUSD(uint _amount, address _upperHint, address _lowerHint)`: repay `_amount` of thUSD to the caller’s Vault, subject to leaving 50 debt in the Vault (which corresponds to the 50 thUSD gas compensation).

`_adjustTrove(address _borrower, uint _collWithdrawal, uint _debtChange, bool _isDebtIncrease, address _upperHint, address _lowerHint, uint _maxFeePercentage)`: enables a borrower to simultaneously change both their collateral and debt, subject to all the restrictions that apply to individual increases/decreases of each quantity with the following particularity: if the adjustment reduces the collateralization ratio of the Vault, the function only executes if the resulting total collateralization ratio is above 150%. The borrower has to provide a `_maxFeePercentage` that he/she is willing to accept in case of a fee slippage, i.e. when a redemption transaction is processed first, driving up the issuance fee. The parameter is ignored if the debt is not increased with the transaction.

`closeTrove()`: allows a borrower to repay all debt, withdraw all their collateral, and close their Vault. Requires the borrower have a thUSD balance sufficient to repay their vault's debt, excluding gas compensation - i.e. `(debt - 50)` thUSD.

`claimCollateral(address _user)`: when a borrower’s Vault has been fully redeemed from and closed, or liquidated in Recovery Mode with a collateralization ratio above 110%, this function allows the borrower to claim their collateral surplus that remains in the system (collateral - debt upon redemption; collateral - 110% of the debt upon liquidation).

### TroveManager Functions - `TroveManager.sol`

`liquidate(address _borrower)`: callable by anyone, attempts to liquidate the Vault of `_user`. Executes successfully if `_user`’s Vault meets the conditions for liquidation (e.g. in Normal Mode, it liquidates if the Vault's ICR < the system MCR).  

`liquidateTroves(uint n)`: callable by anyone, checks for under-collateralized vaults below MCR and liquidates up to `n`, starting from the Vault with the lowest collateralization ratio; subject to gas constraints and the actual number of under-collateralized vaults. The gas costs of `liquidateTroves(uint n)` mainly depend on the number of vaults that are liquidated, and whether the vaults are offset against the Stability Pool or redistributed. For n=1, the gas costs per liquidated Vault are roughly between 215K-400K, for n=5 between 80K-115K, for n=10 between 70K-82K, and for n=50 between 60K-65K.

`batchLiquidateTroves(address[] calldata _troveArray)`: callable by anyone, accepts a custom list of vaults addresses as an argument. Steps through the provided list and attempts to liquidate every Vault, until it reaches the end or it runs out of gas. A Vault is liquidated only if it meets the conditions for liquidation. For a batch of 10 vaults, the gas costs per liquidated Vault are roughly between 75K-83K, for a batch of 50 vaults between 54K-69K.

`redeemCollateral(uint _THUSDAmount, address _firstRedemptionHint, address _upperPartialRedemptionHint, address _lowerPartialRedemptionHint, uint _partialRedemptionHintNICR, uint _maxIterations, uint _maxFeePercentage)`: redeems `_THUSDamount` of stablecoins for ether from the system. Decreases the caller’s thUSD balance, and sends them the corresponding amount of collateral. Executes successfully if the caller has sufficient thUSD to redeem. The number of vaults redeemed from is capped by `_maxIterations`. The borrower has to provide a `_maxFeePercentage` that he/she is willing to accept in case of a fee slippage, i.e. when another redemption transaction is processed first, driving up the redemption fee.

`getCurrentICR(address _user, uint _price)`: computes the user’s individual collateralization ratio (ICR) based on their total collateral and total thUSD debt. Returns 2^256 -1 if they have 0 debt.

`getTroveOwnersCount()`: get the number of active vaults in the system.

`getPendingETHReward(address _borrower)`: get the pending collateral reward from liquidation redistribution events, for the given Vault.

`getPendingTHUSDDebtReward(address _borrower)`: get the pending Vault debt "reward" (i.e. the amount of extra debt assigned to the Vault) from liquidation redistribution events.

`getEntireDebtAndColl(address _borrower)`: returns a Trove’s entire debt and collateral, which respectively include any pending debt rewards and collateral rewards from prior redistributions.

`getEntireSystemColl()`:  Returns the systemic entire collateral allocated to vaults, i.e. the sum of the collateral in the Active Pool and the Default Pool.

`getEntireSystemDebt()` Returns the systemic entire debt assigned to vaults, i.e. the sum of the THUSDDebt in the Active Pool and the Default Pool.

`getTCR()`: returns the total collateralization ratio (TCR) of the system.  The TCR is based on the the entire system debt and collateral (including pending rewards).

`checkRecoveryMode()`: reveals whether or not the system is in Recovery Mode (i.e. whether the Total Collateralization Ratio (TCR) is below the Critical Collateralization Ratio (CCR)).

### Hint Helper Functions - `HintHelpers.sol`

`function getApproxHint(uint _CR, uint _numTrials, uint _inputRandomSeed)`: helper function, returns a positional hint for the sorted list. Used for transactions that must efficiently re-insert a Vault to the sorted list.

`getRedemptionHints(uint _THUSDamount, uint _price, uint _maxIterations)`: helper function specifically for redemptions. Returns three hints:

- `firstRedemptionHint` is a positional hint for the first redeemable Vault (i.e. Vault with the lowest ICR >= MCR).
- `partialRedemptionHintNICR` is the final nominal ICR of the last Vault after being hit by partial redemption, or zero in case of no partial redemption (see [Hints for `redeemCollateral`](#hints-for-redeemcollateral)).
- `truncatedTHUSDamount` is the maximum amount that can be redeemed out of the the provided `_THUSDamount`. This can be lower than `_THUSDamount` when redeeming the full amount would leave the last Vault of the redemption sequence with less debt than the minimum allowed value.

The number of vaults to consider for redemption can be capped by passing a non-zero value as `_maxIterations`, while passing zero will leave it uncapped.

### Stability Pool Functions - `StabilityPool.sol`

`provideToSP(uint _amount)`: allows stablecoin holders to deposit `_amount` of thUSD to the Stability Pool. It sends `_amount` of thUSD from their address to the Pool, and tops up their thUSD deposit by `_amount`. If the depositor already has a non-zero deposit, it sends their accumulated collateral to their address.

`withdrawFromSP(uint _amount)`: allows a stablecoin holder to withdraw `_amount` of thUSD from the Stability Pool, up to the value of their remaining Stability deposit. It decreases their thUSD balance by `_amount`. It sends the depositor’s accumulated collateral gains to their address. If the user makes a partial withdrawal, their deposit remainder will earn further gains. To prevent potential loss evasion by depositors, withdrawals from the Stability Pool are suspended when there are liquidable vaults with ICR < 110% in the system.

`withdrawETHGainToTrove(address _hint)`: sends the user's entire accumulated collateral gain to the user's active Vault, and updates their Stability deposit with its accumulated loss from debt absorptions.

`getDepositorETHGain(address _depositor)`: returns the accumulated collateral gain for a given Stability Pool depositor

`getCompoundedTHUSDDeposit(address _depositor)`: returns the remaining deposit amount for a given Stability Pool depositor

### thUSD token `THUSDToken.sol`

Standard ERC20 and EIP2612 (`permit()` ) functionality.

**Note**: `permit()` can be front-run, as it does not require that the permitted spender be the `msg.sender`.

This allows flexibility, as it means that _anyone_ can submit a Permit signed by A that allows B to spend a portion of A's tokens.

The end result is the same for the signer A and spender B, but does mean that a `permit` transaction
could be front-run and revert - which may hamper the execution flow of a contract that is intended to handle the submission of a Permit on-chain.

For more details please see the original proposal EIP-2612:
https://eips.ethereum.org/EIPS/eip-2612

## Supplying Hints to Vault operations

vaults in Threshold USD are recorded in a sorted doubly linked list, sorted by their NICR, from high to low. NICR stands for the nominal collateral ratio that is simply the amount of collateral (in collateral) multiplied by 100e18 and divided by the amount of debt (in thUSD), without taking the collateral:USD price into account. Given that all vaults are equally affected by collateral price changes, they do not need to be sorted by their real ICR.

All Vault operations that change the collateralization ratio need to either insert or reinsert the Vault to the `SortedTroves` list. To reduce the computational complexity (and gas cost) of the insertion to the linked list, two ‘hints’ may be provided.

A hint is the address of a Vault with a position in the sorted list close to the correct insert position.

All Vault operations take two ‘hint’ arguments: a `_lowerHint` referring to the `nextId` and an `_upperHint` referring to the `prevId` of the two adjacent nodes in the linked list that are (or would become) the neighbors of the given Vault. Taking both direct neighbors as hints has the advantage of being much more resilient to situations where a neighbor gets moved or removed before the caller's transaction is processed: the transaction would only fail if both neighboring vaults are affected during the pendency of the transaction.

The better the ‘hint’ is, the shorter the list traversal, and the cheaper the gas cost of the function call. `SortedList::findInsertPosition(uint256 _NICR, address _prevId, address _nextId)` that is called by the Vault operation firsts check if `prevId` is still existant and valid (larger NICR than the provided `_NICR`) and then descends the list starting from `prevId`. If the check fails, the function further checks if `nextId` is still existant and valid (smaller NICR than the provided `_NICR`) and then ascends list starting from `nextId`.

The `HintHelpers::getApproxHint(...)` function can be used to generate a useful hint pointing to a Vault relatively close to the target position, which can then be passed as an argument to the desired Vault operation or to `SortedTroves::findInsertPosition(...)` to get its two direct neighbors as ‘exact‘ hints (based on the current state of the system).

`getApproxHint(uint _CR, uint _numTrials, uint _inputRandomSeed)` randomly selects `numTrials` amount of vaults, and returns the one with the closest position in the list to where a Vault with a nominal collateralization ratio of `_CR` should be inserted. It can be shown mathematically that for `numTrials = k * sqrt(n)`, the function's gas cost is with very high probability worst case `O(sqrt(n)) if k >= 10`. For scalability reasons (Infura is able to serve up to ~4900 trials), the function also takes a random seed `_inputRandomSeed` to make sure that calls with different seeds may lead to a different results, allowing for better approximations through multiple consecutive runs.

**Vault operation without a hint**

1. User performs Vault operation in their browser
2. Call the Vault operation with `_lowerHint = _upperHint = userAddress`

Gas cost will be worst case `O(n)`, where n is the size of the `SortedTroves` list.

**Vault operation with hints**

1. User performs Vault operation in their browser
2. The front end computes a new collateralization ratio locally, based on the change in collateral and/or debt.
3. Call `HintHelpers::getApproxHint(...)`, passing it the computed nominal collateralization ratio. Returns an address close to the correct insert position
4. Call `SortedTroves::findInsertPosition(uint256 _NICR, address _prevId, address _nextId)`, passing it the same approximate hint via both `_prevId` and `_nextId` and the new nominal collateralization ratio via `_NICR`.
5. Pass the ‘exact‘ hint in the form of the two direct neighbors, i.e. `_nextId` as `_lowerHint` and `_prevId` as `_upperHint`, to the Vault operation function call. (Note that the hint may become slightly inexact due to pending transactions that are processed first, though this is gracefully handled by the system that can ascend or descend the list as needed to find the right position.)

Gas cost of steps 2-4 will be free, and step 5 will be `O(1)`.

Hints allow cheaper Vault operations for the user, at the expense of a slightly longer time to completion, due to the need to await the result of the two read calls in steps 1 and 2 - which may be sent as JSON-RPC requests to Infura.

### Example Borrower Operations with Hints

#### Opening a vault
```
  const toWei = web3.utils.toWei
  const toBN = web3.utils.toBN

  const THUSDAmount = toBN(toWei('2500')) // borrower wants to withdraw 2500 thUSD
  const ETHColl = toBN(toWei('5')) // borrower wants to lock 5 collateral

  // Call deployed TroveManager contract to read the liquidation reserve and latest borrowing fee
  const liquidationReserve = await troveManager.THUSD_GAS_COMPENSATION()
  const expectedFee = await troveManager.getBorrowingFeeWithDecay(THUSDAmount)

  // Total debt of the new vault = thUSD amount drawn, plus fee, plus the liquidation reserve
  const expectedDebt = THUSDAmount.add(expectedFee).add(liquidationReserve)

  // Get the nominal NICR of the new vault
  const _1e20 = toBN(toWei('100'))
  let NICR = ETHColl.mul(_1e20).div(expectedDebt)

  // Get an approximate address hint from the deployed HintHelper contract. Use (15 * number of vaults) trials
  // to get an approx. hint that is close to the right position.
  let numTroves = await sortedTroves.getSize()
  let numTrials = numTroves.mul(toBN('15'))
  let { 0: approxHint } = await hintHelpers.getApproxHint(NICR, numTrials, 42)  // random seed of 42

  // Use the approximate hint to get the exact upper and lower hints from the deployed SortedTroves contract
  let { 0: upperHint, 1: lowerHint } = await sortedTroves.findInsertPosition(NICR, approxHint, approxHint)

  // Finally, call openTrove with the exact upperHint and lowerHint
  const maxFee = '5'.concat('0'.repeat(16)) // Slippage protection: 5%
  await borrowerOperations.openTrove(maxFee, THUSDAmount, upperHint, lowerHint, { value: ETHColl })
```

#### Adjusting a Vault
```
  const collIncrease = toBN(toWei('1'))  // borrower wants to add 1 collateral
  const THUSDRepayment = toBN(toWei('230')) // borrower wants to repay 230 thUSD

  // Get vault's current debt and coll
  const {0: debt, 1: coll} = await troveManager.getEntireDebtAndColl(borrower)

  const newDebt = debt.sub(THUSDRepayment)
  const newColl = coll.add(collIncrease)

  NICR = newColl.mul(_1e20).div(newDebt)

  // Get an approximate address hint from the deployed HintHelper contract. Use (15 * number of vaults) trials
  // to get an approx. hint that is close to the right position.
  numTroves = await sortedTroves.getSize()
  numTrials = numTroves.mul(toBN('15'))
  ({0: approxHint} = await hintHelpers.getApproxHint(NICR, numTrials, 42))

  // Use the approximate hint to get the exact upper and lower hints from the deployed SortedTroves contract
  ({ 0: upperHint, 1: lowerHint } = await sortedTroves.findInsertPosition(NICR, approxHint, approxHint))

  // Call adjustTrove with the exact upperHint and lowerHint
  await borrowerOperations.adjustTrove(maxFee, 0, THUSDRepayment, false, upperHint, lowerHint, {value: collIncrease})
```

### Hints for `redeemCollateral`

`TroveManager::redeemCollateral` as a special case requires additional hints:
- `_firstRedemptionHint` hints at the position of the first Vault that will be redeemed from,
- `_lowerPartialRedemptionHint` hints at the `nextId` neighbor of the last redeemed Vault upon reinsertion, if it's partially redeemed,
- `_upperPartialRedemptionHint` hints at the `prevId` neighbor of the last redeemed Vault upon reinsertion, if it's partially redeemed,
- `_partialRedemptionHintNICR` ensures that the transaction won't run out of gas if neither `_lowerPartialRedemptionHint` nor `_upperPartialRedemptionHint` are  valid anymore.

`redeemCollateral` will only redeem from vaults that have an ICR >= MCR. In other words, if there are vaults at the bottom of the SortedTroves list that are below the minimum collateralization ratio (which can happen after an collateral:USD price drop), they will be skipped. To make this more gas-efficient, the position of the first redeemable Vault should be passed as `_firstRedemptionHint`.

#### First redemption hint

The first redemption hint is the address of the vault from which to start the redemption sequence - i.e the address of the first vault in the system with ICR >= 110%.

If when the transaction is confirmed the address is in fact not valid - the system will start from the lowest ICR vault in the system, and step upwards until it finds the first vault with ICR >= 110% to redeem from. In this case, since the number of vaults below 110% will be limited due to ongoing liquidations, there's a good chance that the redemption transaction still succeed.

#### Partial redemption hints

All vaults that are fully redeemed from in a redemption sequence are left with zero debt, and are closed. The remaining collateral (the difference between the orginal collateral and the amount used for the redemption) will be claimable by the owner.

It’s likely that the last Vault in the redemption sequence would be partially redeemed from - i.e. only some of its debt cancelled with thUSD. In this case, it should be reinserted somewhere between top and bottom of the list. The `_lowerPartialRedemptionHint` and `_upperPartialRedemptionHint` hints passed to `redeemCollateral` describe the future neighbors the expected reinsert position.

However, if between the off-chain hint computation and on-chain execution a different transaction changes the state of a Vault that would otherwise be hit by the redemption sequence, then the off-chain hint computation could end up totally inaccurate. This could lead to the whole redemption sequence reverting due to out-of-gas error.

To mitigate this, another hint needs to be provided: `_partialRedemptionHintNICR`, the expected nominal ICR of the final partially-redeemed-from Vault. The on-chain redemption function checks whether, after redemption, the nominal ICR of this Vault would equal the nominal ICR hint.

If not, the redemption sequence doesn’t perform the final partial redemption, and terminates early. This ensures that the transaction doesn’t revert, and most of the requested thUSD redemption can be fulfilled.

#### Example Redemption with hints
```
 // Get the redemptions hints from the deployed HintHelpers contract
  const redemptionhint = await hintHelpers.getRedemptionHints(THUSDAmount, price, 50)

  const { 0: firstRedemptionHint, 1: partialRedemptionNewICR, 2: truncatedTHUSDAmount } = redemptionhint

  // Get the approximate partial redemption hint
  const { hintAddress: approxPartialRedemptionHint } = await contracts.hintHelpers.getApproxHint(partialRedemptionNewICR, numTrials, 42)

  /* Use the approximate partial redemption hint to get the exact partial redemption hint from the
  * deployed SortedTroves contract
  */
  const exactPartialRedemptionHint = (await sortedTroves.findInsertPosition(partialRedemptionNewICR,
    approxPartialRedemptionHint,
    approxPartialRedemptionHint))

  /* Finally, perform the on-chain redemption, passing the truncated thUSD amount, the correct hints, and the expected
  * ICR of the final partially redeemed vault in the sequence.
  */
  await troveManager.redeemCollateral(truncatedTHUSDAmount,
    firstRedemptionHint,
    exactPartialRedemptionHint[0],
    exactPartialRedemptionHint[1],
    partialRedemptionNewICR,
    0, maxFee,
    { from: redeemer },
  )
```

## Gas compensation

In Threshold USD, we want to maximize liquidation throughput, and ensure that undercollateralized vaults are liquidated promptly by “liquidators” - agents who may also hold Stability Pool deposits, and who expect to profit from liquidations.

However, gas costs in Ethereum are substantial. If the gas costs of our public liquidation functions are too high, this may discourage liquidators from calling them, and leave the system holding too many undercollateralized vaults for too long.

The protocol thus directly compensates liquidators for their gas costs, to incentivize prompt liquidations in both normal and extreme periods of high gas prices. Liquidators should be confident that they will at least break even by making liquidation transactions.

Gas compensation is paid in a mix of thUSD and collateral. While the collateral is taken from the liquidated Vault, the thUSD is provided by the borrower. When a borrower first issues debt, some thUSD is reserved as a Liquidation Reserve. A liquidation transaction thus draws collateral from the vault(s) it liquidates, and sends the both the reserved thUSD and the compensation in collateral to the caller, and liquidates the remainder.

When a liquidation transaction liquidates multiple vaults, each Vault contributes thUSD and collateral towards the total compensation for the transaction.

Gas compensation per liquidated Vault is given by the formula:

Gas compensation = `200 thUSD + 0.5% of trove’s collateral (collateral)`

The intentions behind this formula are:
- To ensure that smaller vaults are liquidated promptly in normal times, at least
- To ensure that larger vaults are liquidated promptly even in extreme high gas price periods. The larger the Vault, the stronger the incentive to liquidate it.

### Gas compensation schedule

When a borrower opens a Vault, an additional 200 thUSD debt is issued, and 200 thUSD is minted and sent to a dedicated contract (`GasPool`) for gas compensation - the "gas pool".

When a borrower closes their active Vault, this gas compensation is refunded: 200 thUSD is burned from the gas pool's balance, and the corresponding 200 thUSD debt on the Vault is cancelled.

The purpose of the 200 thUSD Liquidation Reserve is to provide a minimum level of gas compensation, regardless of the Vault's collateral size or the current collateral price.

### Liquidation

When a Vault is liquidated, 0.5% of its collateral is sent to the liquidator, along with the 200 thUSD Liquidation Reserve. Thus, a liquidator always receives `{200 thUSD + 0.5% collateral}` per Vault that they liquidate. The collateral remainder of the Vault is then either offset, redistributed or a combination of both, depending on the amount of thUSD in the Stability Pool.

### Gas compensation and redemptions

When a Vault is redeemed from, the redemption is made only against (debt - 200), not the entire debt.

But if the redemption causes an amount (debt - 200) to be cancelled, the Vault is then closed: the 200 thUSD Liquidation Reserve is cancelled with its remaining 200 debt. That is, the gas compensation is burned from the gas pool, and the 200 debt is zero’d. The collateral surplus from the Vault remains in the system, to be later claimed by its owner.

### Gas compensation helper functions

Gas compensation functions are found in the parent _LiquityBase.sol_ contract:

`_getCollGasCompensation(uint _entireColl)` returns the amount of collateral to be drawn from a vault's collateral and sent as gas compensation.

`_getCompositeDebt(uint _debt)` returns the composite debt (drawn debt + gas compensation) of a vault, for the purpose of ICR calculation.

## The Stability Pool

Any thUSD holder may deposit thUSD to the Stability Pool. It is designed to absorb debt from liquidations, and reward depositors with the liquidated collateral, shared between depositors in proportion to their deposit size.

Since liquidations are expected to occur at an ICR of just below 110%, and even in most extreme cases, still above 100%, a depositor can expect to receive a net gain from most liquidations. When that holds, the dollar value of the collateral gain from a liquidation exceeds the dollar value of the thUSD loss (assuming the price of thUSD is $1).  

We define the **collateral surplus** in a liquidation as `$(collateral) - debt`, where `$(...)` represents the dollar value.

At an thUSD price of $1, vaults with `ICR > 100%` have a positive collateral surplus.

After one or more liquidations, a deposit will have absorbed thUSD losses, and received collateral gains. The remaining reduced deposit is the **compounded deposit**.

Stability Providers expect a positive ROI on their initial deposit. That is:

`$(collateral Gain + compounded deposit) > $(initial deposit)`

### Mixed liquidations: offset and redistribution

When a liquidation hits the Stability Pool, it is known as an **offset**: the debt of the Vault is offset against the thUSD in the Pool. When **x** thUSD debt is offset, the debt is cancelled, and **x** thUSD in the Pool is burned. When the thUSD Stability Pool is greater than the debt of the Vault, all the Vault's debt is cancelled, and all its collateral is shared between depositors. This is a **pure offset**.

It can happen that the thUSD in the Stability Pool is less than the debt of a Vault. In this case, the the whole Stability Pool will be used to offset a fraction of the Trove’s debt, and an equal fraction of the Trove’s collateral will be assigned to Stability Providers. The remainder of the Trove’s debt and collateral gets redistributed to active vaults. This is a **mixed offset and redistribution**.

Because the collateral fraction matches the offset debt fraction, the effective ICR of the collateral and debt that is offset, is equal to the ICR of the Vault. So, for depositors, the ROI per liquidation depends only on the ICR of the liquidated Vault.

### Stability Pool deposit losses and collateral gains - implementation

Deposit functionality is handled by `StabilityPool.sol` (`provideToSP`, `withdrawFromSP`, etc).  StabilityPool also handles the liquidation calculation, and holds the thUSD and collateral balances.

When a liquidation is offset with the Stability Pool, debt from the liquidation is cancelled with an equal amount of thUSD in the pool, which is burned.

Individual deposits absorb the debt from the liquidated Vault in proportion to their deposit as a share of total deposits.

Similarly the liquidated Trove’s collateral is assigned to depositors in the same proportion.

For example: a liquidation that empties 30% of the Stability Pool will reduce each deposit by 30%, no matter the size of the deposit.

### Stability Pool example

Here’s an example of the Stability Pool absorbing liquidations. The Stability Pool contains 3 depositors, A, B and C, and the collateral:USD price is 100.

There are two vaults to be liquidated, T1 and T2:

|   | Vault | Collateral (collateral) | Debt (THUSD) | ICR         | $(collateral) ($) | Collateral surplus ($) |
|---|-------|------------------|-------------|-------------|------------|------------------------|
|   | T1    | 1.6              | 150         | 1.066666667 | 160        | 10                     |
|   | T2    | 2.45             | 225         | 1.088888889 | 245        | 20                     |

Here are the deposits, before any liquidations occur:

| Depositor | Deposit | Share  |
|-----------|---------|--------|
| A         | 100     | 0.1667 |
| B         | 200     | 0.3333 |
| C         | 300     | 0.5    |
| Total     | 600     | 1      |

Now, the first liquidation T1 is absorbed by the Pool: 150 debt is cancelled with 150 Pool thUSD, and its 1.6 collateral is split between depositors. We see the gains earned by A, B, C, are in proportion to their share of the total thUSD in the Stability Pool:

| Deposit | Debt absorbed from T1 | Deposit after | Total collateral gained | $(deposit + collateral gain) ($) | Current ROI   |
|---------|-----------------------|---------------|------------------|---------------------------|---------------|
| A       | 25                    | 75            | 0.2666666667     | 101.6666667               | 0.01666666667 |
| B       | 50                    | 150           | 0.5333333333     | 203.3333333               | 0.01666666667 |
| C       | 75                    | 225           | 0.8              | 305                       | 0.01666666667 |
| Total   | 150                   | 450           | 1.6              | 610                       | 0.01666666667 |

And now the second liquidation, T2, occurs: 225 debt is cancelled with 225 Pool thUSD, and 2.45 collateral is split between depositors. The accumulated collateral gain includes all collateral gain from T1 and T2.

| Depositor | Debt absorbed from T2 | Deposit after | Accumulated collateral | $(deposit + collateral gain) ($) | Current ROI |
|-----------|-----------------------|---------------|-----------------|---------------------------|-------------|
| A         | 37.5                  | 37.5          | 0.675           | 105                       | 0.05        |
| B         | 75                    | 75            | 1.35            | 210                       | 0.05        |
| C         | 112.5                 | 112.5         | 2.025           | 315                       | 0.05        |
| Total     | 225                   | 225           | 4.05            | 630                       | 0.05        |

It’s clear that:

- Each depositor gets the same ROI from a given liquidation
- Depositors return increases over time, as the deposits absorb liquidations with a positive collateral surplus

Eventually, a deposit can be fully “used up” in absorbing debt, and reduced to 0. This happens whenever a liquidation occurs that empties the Stability Pool. A deposit stops earning collateral gains when it has been reduced to 0.


### Stability Pool implementation

A depositor obtains their compounded deposits and corresponding collateral gain in a “pull-based” manner. The system calculates the depositor’s compounded deposit and accumulated collateral gain when the depositor makes an operation that changes their collateral deposit.

Depositors deposit thUSD via `provideToSP`, and withdraw with `withdrawFromSP`. Their accumulated collateral gain is paid out every time they make a deposit operation - so collateral payout is triggered by both deposit withdrawals and top-ups.

### How deposits and collateral gains are tracked

We use a highly scalable method of tracking deposits and collateral gains that has O(1) complexity.

When a liquidation occurs, rather than updating each depositor’s deposit and collateral gain, we simply update two intermediate variables: a product `P`, and a sum `S`.

A mathematical manipulation allows us to factor out the initial deposit, and accurately track all depositors’ compounded deposits and accumulated collateral gains over time, as liquidations occur, using just these two variables. When depositors join the Pool, they get a snapshot of `P` and `S`.

The formula for a depositor’s accumulated collateral gain is derived here:

[Scalable reward distribution for compounding, decreasing stake](https://github.com/threshold-usd/dev/blob/main/papers/Scalable_Reward_Distribution_with_Compounding_Stakes.pdf)

Each liquidation updates `P` and `S`. After a series of liquidations, a compounded deposit and corresponding collateral gain can be calculated using the initial deposit, the depositor’s snapshots, and the current values of `P` and `S`.

Any time a depositor updates their deposit (withdrawal, top-up) their collateral gain is paid out, and they receive new snapshots of `P` and `S`.

This is similar in spirit to the simpler [Scalable Reward Distribution on the Ethereum Network by Bogdan Batog et al](http://batog.info/papers/scalable-reward-distribution.pdf), however, the mathematics is more involved as we handle a compounding, decreasing stake, and a corresponding collateral reward.

## Threshold USD System Fees

Threshold USD generates fee revenue from certain operations. Fees are captured by the PCV.

Threshold USD generates revenue in two ways: redemptions, and issuance of new thUSD tokens.

Redemptions fees are paid in collateral. Issuance fees (when a user opens a Vault, or issues more thUSD from their existing Vault) are paid in thUSD.

### Redemption Fee

The redemption fee is taken as a cut of the total collateral drawn from the system in a redemption. It is based on the current redemption rate.

In the `TroveManager`, `redeemCollateral` calculates the collateral fee and transfers it to the staking contract, `PCV.sol`

### Issuance fee

The issuance fee is charged on the thUSD drawn by the user and is added to the Vault's thUSD debt. It is based on the current borrowing rate.

When new thUSD are drawn via one of the `BorrowerOperations` functions `openTrove`, `withdrawTHUSD` or `adjustTrove`, an extra amount `THUSDFee` is minted, and an equal amount of debt is added to the user’s Vault. The `THUSDFee` is transferred to the staking contract, `PCV.sol`.

### Fee Schedule

Redemption and issuance fees are based on the `baseRate` state variable in TroveManager, which is dynamically updated. The `baseRate` increases with each redemption, and decays according to time passed since the last fee event - i.e. the last redemption or issuance of thUSD.

The current fee schedule:

Upon each redemption:
- `baseRate` is decayed based on time passed since the last fee event
- `baseRate` is incremented by an amount proportional to the fraction of the total thUSD supply that was redeemed
- The redemption rate is given by `min{REDEMPTION_FEE_FLOOR + baseRate * ETHdrawn, DECIMAL_PRECISION}`

Upon each debt issuance:
- `baseRate` is decayed based on time passed since the last fee event
- The borrowing rate is given by `min{BORROWING_FEE_FLOOR + baseRate * newDebtIssued, MAX_BORROWING_FEE}`

`REDEMPTION_FEE_FLOOR` and `BORROWING_FEE_FLOOR` are both set to 0.5%, while `MAX_BORROWING_FEE` is 5% and `DECIMAL_PRECISION` is 100%.

### Intuition behind fees

The larger the redemption volume, the greater the fee percentage.

The longer the time delay since the last operation, the more the `baseRate` decreases.

The intent is to throttle large redemptions with higher fees, and to throttle borrowing directly after large redemption volumes. The `baseRate` decay over time ensures that the fee for both borrowers and redeemers will “cool down”, while redemptions volumes are low.

Furthermore, the fees cannot become smaller than 0.5%, which in the case of redemptions protects the redemption facility from being front-run by arbitrageurs that are faster than the price feed. The 5% maximum on the issuance is meant to keep the system (somewhat) attractive for new borrowers even in phases where the monetary is contracting due to redemptions.

### Fee decay Implementation

Time is measured in units of minutes. The `baseRate` decay is based on `block.timestamp - lastFeeOpTime`. If less than a minute has passed since the last fee event, then `lastFeeOpTime` is not updated. This prevents “base rate griefing”: i.e. it prevents an attacker stopping the `baseRate` from decaying by making a series of redemptions or issuing thUSD with time intervals of < 1 minute.

The decay parameter is tuned such that the fee changes by a factor of 0.99 per hour, i.e. it loses 1% of its current value per hour. At that rate, after one week, the baseRate decays to 18% of its prior value. The exact decay parameter is subject to change, and will be fine-tuned via economic modelling.

## Redistributions and Corrected Stakes

When a liquidation occurs and the Stability Pool is empty or smaller than the liquidated debt, the redistribution mechanism should distribute the remaining collateral and debt of the liquidated Vault, to all active vaults in the system, in proportion to their collateral.

For two vaults A and B with collateral `A.coll > B.coll`, Vault A should earn a bigger share of the liquidated collateral and debt.

In Threshold USD it is important that all active vaults remain ordered by their ICR. We have proven that redistribution of the liquidated debt and collateral proportional to active Troves’ collateral, preserves the ordering of active vaults by ICR, as liquidations occur over time.  Please see the [proofs section](https://github.com/threshold-usd/dev/tree/main/papers).

However, when it comes to implementation, Ethereum gas costs make it too expensive to loop over all vaults and write new data to storage for each one. When a Vault receives redistribution rewards, the system does not update the Vault's collateral and debt properties - instead, the Trove’s rewards remain "pending" until the borrower's next operation.

These “pending rewards” can not be accounted for in future reward calculations in a scalable way.

However: the ICR of a Vault is always calculated as the ratio of its total collateral to its total debt. So, a Trove’s ICR calculation **does** include all its previous accumulated rewards.

**This causes a problem: redistributions proportional to initial collateral can break vault ordering.**

Consider the case where new Vault is created after all active vaults have received a redistribution from a liquidation. This “fresh” Vault has then experienced fewer rewards than the older vaults, and thus, it receives a disproportionate share of subsequent rewards, relative to its total collateral.

The fresh vault would earns rewards based on its **entire** collateral, whereas old vaults would earn rewards based only on **some portion** of their collateral - since a part of their collateral is pending, and not included in the Trove’s `coll` property.

This can break the ordering of vaults by ICR - see the [proofs section](https://github.com/threshold-usd/dev/tree/main/papers).

### Corrected Stake Solution

We use a corrected stake to account for this discrepancy, and ensure that newer vaults earn the same liquidation rewards per unit of total collateral, as do older vaults with pending rewards. Thus the corrected stake ensures the sorted list remains ordered by ICR, as liquidation events occur over time.

When a Vault is opened, its stake is calculated based on its collateral, and snapshots of the entire system collateral and debt which were taken immediately after the last liquidation.

A Trove’s stake is given by:

```
stake = _coll.mul(totalStakesSnapshot).div(totalCollateralSnapshot)
```

It then earns redistribution rewards based on this corrected stake. A newly opened Trove’s stake will be less than its raw collateral, if the system contains active vaults with pending redistribution rewards when it was made.

Whenever a borrower adjusts their Trove’s collateral, their pending rewards are applied, and a fresh corrected stake is computed.

To convince yourself this corrected stake preserves ordering of active vaults by ICR, please see the [proofs section](https://github.com/threshold-usd/dev/blob/main/papers).

## Math Proofs

The Threshold USD implementation relies on some important system properties and mathematical derivations.

In particular, we have:

- Proofs that Vault ordering is maintained throughout a series of liquidations and new Vault openings
- A derivation of a formula and implementation for a highly scalable (O(1) complexity) reward distribution in the Stability Pool, involving compounding and decreasing stakes.

PDFs of these can be found in https://github.com/threshold-usd/dev/blob/main/papers

## Definitions

_**Vault:**_ a collateralized debt position, bound to a single Ethereum address. Also referred to as a “CDP” in similar protocols.

_**THUSD**_:  The stablecoin that may be issued from a user's collateralized debt position and freely transferred/traded to any Ethereum address. Intended to maintain parity with the US dollar, and can always be redeemed directly with the system: 1 thUSD is always exchangeable for $1 USD worth of collateral.

_**Active Vault:**_ an Ethereum address owns an “active Trove” if there is a node in the `SortedTroves` list with ID equal to the address, and non-zero collateral is recorded on the Vault struct for that address.

_**Closed Vault:**_ a Vault that was once active, but now has zero debt and zero collateral recorded on its struct, and there is no node in the `SortedTroves` list with ID equal to the owning address.

_**Active collateral:**_ the amount of collateral recorded on a Trove’s struct

_**Active debt:**_ the amount of thUSD debt recorded on a Trove’s struct

_**Entire collateral:**_ the sum of a Trove’s active collateral plus its pending collateral rewards accumulated from distributions

_**Entire debt:**_ the sum of a Trove’s active debt plus its pending debt rewards accumulated from distributions

_**Individual collateralization ratio (ICR):**_ a Vault's ICR is the ratio of the dollar value of its entire collateral at the current collateral:USD price, to its entire debt

_**Nominal collateralization ratio (nominal ICR, NICR):**_ a Vault's nominal ICR is its entire collateral (in collateral) multiplied by 100e18 and divided by its entire debt.

_**Total active collateral:**_ the sum of active collateral over all vaults. Equal to the collateral in the ActivePool.

_**Total active debt:**_ the sum of active debt over all vaults. Equal to the thUSD in the ActivePool.

_**Total defaulted collateral:**_ the total collateral in the DefaultPool

_**Total defaulted debt:**_ the total thUSD debt in the DefaultPool

_**Entire system collateral:**_ the sum of the collateral in the ActivePool and DefaultPool

_**Entire system debt:**_ the sum of the debt in the ActivePool and DefaultPool

_**Total collateralization ratio (TCR):**_ the ratio of the dollar value of the entire system collateral at the current collateral:USD price, to the entire system debt

_**Critical collateralization ratio (CCR):**_ 150%. When the TCR is below the CCR, the system enters Recovery Mode.

_**Borrower:**_ an externally owned account or contract that locks collateral in a Vault and issues thUSD tokens to their own address. They “borrow” thUSD tokens against their collateral.

_**Depositor:**_ an externally owned account or contract that has assigned thUSD tokens to the Stability Pool, in order to earn returns from liquidations.

_**Redemption:**_ the act of swapping thUSD tokens with the system, in return for an equivalent value of collateral. Any account with a thUSD token balance may redeem them, whether or not they are a borrower.

When thUSD is redeemed for collateral, the collateral is always withdrawn from the lowest collateral vaults, in ascending order of their collateralization ratio. A redeemer can not selectively target vaults with which to swap thUSD for collateral.

_**Repayment:**_ when a borrower sends thUSD tokens to their own Vault, reducing their debt, and increasing their collateralization ratio.

_**Retrieval:**_ when a borrower with an active Vault withdraws some or all of their collateral from their own vault, either reducing their collateralization ratio, or closing their Vault (if they have zero debt and withdraw all their collateral)

_**Liquidation:**_ the act of force-closing an undercollateralized Vault and redistributing its collateral and debt. When the Stability Pool is sufficiently large, the liquidated debt is offset with the Stability Pool, and the collateral distributed to depositors. If the liquidated debt can not be offset with the Pool, the system redistributes the liquidated collateral and debt directly to the active vaults with >110% collateralization ratio.

Liquidation functionality is permissionless and publically available - anyone may liquidate an undercollateralized Vault, or batch liquidate vaults in ascending order of collateralization ratio.

_**Collateral Surplus**_: The difference between the dollar value of a Vault's collateral, and the dollar value of its thUSD debt. In a full liquidation, this is the net gain earned by the recipients of the liquidation.

_**Offset:**_ cancellation of liquidated debt with thUSD in the Stability Pool, and assignment of liquidated collateral to Stability Pool depositors, in proportion to their deposit.

_**Redistribution:**_ assignment of liquidated debt and collateral directly to active vaults, in proportion to their collateral.

_**Pure offset:**_  when a Vault's debt is entirely cancelled with thUSD in the Stability Pool, and all of it's liquidated collateral is assigned to Stability Providers.

_**Mixed offset and redistribution:**_  When the Stability Pool thUSD only covers a fraction of the liquidated Vault's debt.  This fraction of debt is cancelled with thUSD in the Stability Pool, and an equal fraction of the Vault's collateral is assigned to depositors. The remaining collateral & debt is redistributed directly to active vaults.

_**Gas compensation:**_ A refund, in thUSD and collateral, automatically paid to the caller of a liquidation function, intended to at least cover the gas cost of the transaction. Designed to ensure that liquidators are not dissuaded by potentially high gas costs.

## Development

The Threshold USD monorepo is based on Yarn's [workspaces](https://classic.yarnpkg.com/en/docs/workspaces/) feature. You might be able to install some of the packages individually with npm, but to make all interdependent packages see each other, you'll need to use Yarn.

In addition, some package scripts require Docker to be installed (Docker Desktop on Windows and Mac, Docker Engine on Linux).

### Prerequisites

You'll need to install the following:

- [Git](https://help.github.com/en/github/getting-started-with-github/set-up-git) (of course)
- [Node v12.x](https://nodejs.org/dist/latest-v12.x/)
- [Docker](https://docs.docker.com/get-docker/)
- [Yarn](https://classic.yarnpkg.com/en/docs/install)

#### Making node-gyp work

Threshold USD indirectly depends on some packages with native addons. To make sure these can be built, you'll have to take some additional steps. Refer to the subsection of [Installation](https://github.com/nodejs/node-gyp#installation) in node-gyp's README that corresponds to your operating system.

Note: you can skip the manual installation of node-gyp itself (`npm install -g node-gyp`), but you will need to install its prerequisites to make sure Threshold USD can be installed.

### Clone & Install

```
git clone https://github.com/threshold-usd/dev.git thresholdusd
cd thresholdusd
yarn
```

### Top-level scripts

There are a number of scripts in the top-level package.json file to ease development, which you can run with yarn.

#### Run all tests

```
yarn test
```

#### Deploy contracts to a testnet

E.g.:

```
yarn deploy --network sepolia
```

Supported networks are currently: sepolia. The above command will deploy into the default channel (the one that's used by the public dev-frontend). To deploy into the internal channel instead:

```
yarn deploy --network sepolia --channel internal
```

You can optionally specify an explicit gas price too:

```
yarn deploy --network sepolia --gas-price 20
```

After a successful deployment, the addresses of the newly deployed contracts will be written to a version-controlled JSON file under `packages/lib-ethers/deployments/default`.

To publish a new deployment, you must execute the above command for all of the following combinations:

| Network  | Channel  |
| -------  | -------- |
| sepolia  | default  |

At some point in the future, we will make this process automatic. Once you're done deploying to all the networks, execute the following command:

```
yarn save-live-version
```

This copies the contract artifacts to a version controlled area (`packages/lib/live`) then checks that you really did deploy to all the networks. Next you need to commit and push all changed files. The repo's GitHub workflow will then build a new Docker image of the frontend interfacing with the new addresses.

#### Start a local blockchain and deploy the contracts

```
yarn start-dev-chain
```

Starts an openethereum node in a Docker container, running the [private development chain](https://openethereum.github.io/wiki/Private-development-chain), then deploys the contracts to this chain.

You may want to use this before starting the dev-frontend in development mode. To use the newly deployed contracts, switch MetaMask to the built-in "Localhost 8545" network.

> Q: How can I get collateral on the local blockchain?  
> A: Import this private key into MetaMask:  
> `0x4d5db4107d237df6a3d58ee5f70ae63d73d7658d4026f2eefd2f204c81682cb7`  
> This account has all the collateral you'll ever need.

Once you no longer need the local node, stop it with:

```
yarn stop-dev-chain
```

#### Start dev-frontend in development mode

```
yarn start-dev-frontend
```

This will start dev-frontend in development mode on http://localhost:3000. The app will automatically be reloaded if you change a source file under `packages/dev-frontend`.

If you make changes to a different package under `packages`, it is recommended to rebuild the entire project with `yarn prepare` in the root directory of the repo. This makes sure that a change in one package doesn't break another.

To stop the dev-frontend running in this mode, bring up the terminal in which you've started the command and press Ctrl+C.

#### Start dev-frontend in demo mode

This will automatically start the local blockchain, so you need to make sure that's not already running before you run the following command.

```
yarn start-demo
```

This spawns a modified version of dev-frontend that ignores MetaMask, and directly uses the local blockchain node. Every time the page is reloaded (at http://localhost:3000), a new random account is created with a balance of 100 collateral. Additionally, transactions are automatically signed, so you no longer need to accept wallet confirmations. This lets you play around with Threshold USD more freely.

When you no longer need the demo mode, press Ctrl+C in the terminal then run:

```
yarn stop-demo
```

#### Build dev-frontend for production

In a freshly cloned & installed monorepo, or if you have only modified code inside the dev-frontend package:

```
yarn build
```

If you have changed something in one or more packages apart from dev-frontend, it's best to use:

```
yarn rebuild
```

This combines the top-level `prepare` and `build` scripts.

You'll find the output in `packages/dev-frontend/build`.

### Temporary and slightly inaccurate TCR calculation within `batchLiquidateTroves` in Recovery Mode.

When liquidating a vault with `ICR > 110%`, a collateral surplus remains claimable by the borrower. This collateral surplus should be excluded from subsequent TCR calculations, but within the liquidation sequence in `batchLiquidateTroves` in Recovery Mode, it is not. This results in a slight distortion to the TCR value used at each step of the liquidation sequence going forward. This distortion only persists for the duration the `batchLiquidateTroves` function call, and the TCR is again calculated correctly after the liquidation sequence ends. In most cases there is no impact at all, and when there is, the effect tends to be minor. The issue is not present at all in Normal Mode.

There is a theoretical and extremely rare case where it incorrectly causes a loss for Stability Depositors instead of a gain. It relies on the stars aligning: the system must be in Recovery Mode, the TCR must be very close to the 150% boundary, a large vault must be liquidated, and the collateral price must drop by >10% at exactly the right moment. No profitable exploit is possible. For more details, please see [this security advisory](https://github.com/threshold-usd/dev/security/advisories/GHSA-xh2p-7p87-fhgh).

### SortedTroves edge cases - top and bottom of the sorted list

When the vault is at one end of the `SortedTroves` list and adjusted such that its ICR moves further away from its neighbor, `findInsertPosition` returns unhelpful positional hints, which if used can cause the `adjustTrove` transaction to run out of gas. This is due to the fact that one of the returned addresses is in fact the address of the vault to move - however, at re-insertion, it has already been removed from the list. As such the insertion logic defaults to `0x0` for that hint address, causing the system to search for the vault starting at the opposite end of the list.

### Front-running issues

#### Loss evasion by front-running Stability Pool depositors

*Example sequence 1): evade liquidation tx*
- Depositor sees incoming liquidation tx that would cause them a net loss
- Depositor front-runs with `withdrawFromSP()` to evade the loss

*Example sequence 2): evade price drop*
- Depositor sees incoming price drop tx (or just anticipates one, by reading exchange price data), that would shortly be followed by unprofitable liquidation txs
- Depositor front-runs with `withdrawFromSP()` to evade the loss

Stability Pool depositors expect to make profits from liquidations which are likely to happen at a collateral ratio slightly below 110%, but well above 100%. In rare cases (flash crashes, oracle failures), vaults may be liquidated below 100% though, resulting in a net loss for stability depositors. Depositors thus have an incentive to withdraw their deposits if they anticipate liquidations below 100% (note that the exact threshold of such “unprofitable” liquidations will depend on the current Dollar price of thUSD).

As long the difference between two price feed updates is <10% and price stability is maintained, loss evasion situations should be rare. The percentage changes between two consecutive prices reported by Chainlink’s collateral:USD oracle has only ever come close to 10% a handful of times in the past few years.

In the current implementation, deposit withdrawals are prohibited if and while there are vaults with a collateral ratio (ICR) < 110% in the system. This prevents loss evasion by front-running the liquidate transaction as long as there are vaults that are liquidatable in normal mode.

This solution is only partially effective since it does not prevent stability depositors from monitoring the collateral price feed and front-running oracle price update transactions that would make vaults liquidatable. Given that we expect loss-evasion opportunities to be very rare, we do not expect that a significant fraction of stability depositors would actually apply front-running strategies, which require sophistication and automation. In the unlikely event that large fraction of the depositors withdraw shortly before the liquidation of vaults at <100% CR, the redistribution mechanism will still be able to absorb defaults.


#### Reaping liquidation gains on the fly

*Example sequence:*
- User sees incoming profitable liquidation tx
- User front-runs it and immediately makes a deposit with `provideToSP()`
- User earns a profit

Front-runners could deposit funds to the Stability Pool on the fly (instead of keeping their funds in the pool) and make liquidation gains when they see a pending price update or liquidate transaction. They could even borrow the thUSD using a vault as a flash loan.

Such flash deposit-liquidations would actually be beneficial (in terms of TCR) to system health and prevent redistributions, since the pool can be filled on the spot to liquidate vaults anytime, if only for the length of 1 transaction.


#### Front-running and changing the order of vaults as a DoS attack

*Example sequence:**
-Attacker sees incoming operation(`openLoan()`, `redeemCollateral()`, etc) that would insert a vault to the sorted list
-Attacker front-runs with mass openLoan txs
-Incoming operation becomes more costly - more traversals needed for insertion

It’s theoretically possible to increase the number of the vaults that need to be traversed on-chain. That is, an attacker that sees a pending borrower transaction (or redemption or liquidation transaction) could try to increase the number of traversed vaults by introducing additional vaults on the way. However, the number of vaults that an attacker can inject before the pending transaction gets mined is limited by the amount of spendable gas. Also, the total costs of making the path longer by 1 are significantly higher (gas costs of opening a vault, plus the 0.5% borrowing fee) than the costs of one extra traversal step (simply reading from storage). The attacker also needs significant capital on-hand, since the minimum debt for a vault is 2000 thUSD.

In case of a redemption, the “last” vault affected by the transaction may end up being only partially redeemed from, which means that its ICR will change so that it needs to be reinserted at a different place in the sorted vault list (note that this is not the case for partial liquidations in recovery mode, which preserve the ICR). A special ICR hint therefore needs to be provided by the transaction sender for that matter, which may become incorrect if another transaction changes the order before the redemption is processed. The protocol gracefully handles this by terminating the redemption sequence at the last fully redeemed vault (see [here](https://github.com/threshold-usd/dev#hints-for-redeemcollateral)).

An attacker trying to DoS redemptions could be bypassed by redeeming an amount that exactly corresponds to the debt of the affected vault(s).

Finally, this DoS could be avoided if the initial transaction avoids the public gas auction entirely and is sent direct-to-miner, via (for example) Flashbots.


## Disclaimer

The content of this readme document (“Readme”) is of purely informational nature. In particular, none of the content of the Readme shall be understood as advice provided by Threshold USD AG, any Threshold USD Project Team member or other contributor to the Readme, nor does any of these persons warrant the actuality and accuracy of the Readme.

Please read this Disclaimer carefully before accessing, interacting with, or using the Threshold USD Protocol software, consisting of the Threshold USD Protocol technology stack (in particular its smart contracts) as well as any other Threshold USD technology.

While Threshold USD AG developed the Threshold USD Protocol Software, the Threshold USD Protocol Software runs in a fully decentralized and autonomous manner on the Ethereum network. Threshold USD AG is not involved in the operation of the Threshold USD Protocol Software nor has it any control over transactions made using its smart contracts. Further, Threshold USD AG does neither enter into any relationship with users of the Threshold USD Protocol Software. Any and all functionalities of the Threshold USD Protocol Software, including the thUSD, are of purely technical nature and there is no claim towards any private individual or legal entity in this regard.

THRESHOLD USD AG IS NOT LIABLE TO ANY USER FOR DAMAGES, INCLUDING ANY GENERAL, SPECIAL, INCIDENTAL OR CONSEQUENTIAL DAMAGES ARISING OUT OF THE USE, IN CONNECTION WITH THE USE OR INABILITY TO USE THE THRESHOLD USD PROTOCOL SOFTWARE (INCLUDING BUT NOT LIMITED TO LOSS OF collateral, thUSD, LOSS OF DATA, BUSINESS INTERRUPTION, DATA BEING RENDERED INACCURATE OR OTHER LOSSES SUSTAINED BY A USER OR THIRD PARTIES AS A RESULT OF THE THRESHOLD USD PROTOCOL SOFTWARE OR A FAILURE OF THE THRESHOLD USD PROTOCOL SOFTWARE TO OPERATE WITH ANY OTHER SOFTWARE).

The Threshold USD Protocol Software has been developed and published under the GNU GPL v3 open-source license, which forms an integral part of this disclaimer.

THE THRESHOLD USD PROTOCOL SOFTWARE HAS BEEN PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. THE THRESHOLD USD PROTOCOL SOFTWARE IS HIGHLY EXPERIMENTAL AND ANY REAL collateral AND/OR thUSD, STAKED OR DEPOSITED TO THE THRESHOLD USD PROTOCOL SOFTWARE ARE AT RISK OF BEING LOST INDEFINITELY, WITHOUT ANY KIND OF CONSIDERATION.

User is solely responsible for complying with applicable law when interacting (in particular, when using collateral, thUSD or other Token) with the Threshold USD Protocol Software whatsoever.
