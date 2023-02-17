import { JsonFragment, LogDescription } from "@ethersproject/abi";
import { BigNumber } from "@ethersproject/bignumber";
import { Log } from "@ethersproject/abstract-provider";

import {
  Contract,
  ContractInterface,
  ContractFunction,
  Overrides,
  CallOverrides,
  PopulatedTransaction,
  ContractTransaction
} from "@ethersproject/contracts";

import activePoolAbi from "../abi/ActivePool.json";
import borrowerOperationsAbi from "../abi/BorrowerOperations.json";
import troveManagerAbi from "../abi/TroveManager.json";
import thusdTokenAbi from "../abi/THUSDToken.json";
import collSurplusPoolAbi from "../abi/CollSurplusPool.json";
import defaultPoolAbi from "../abi/DefaultPool.json";
import hintHelpersAbi from "../abi/HintHelpers.json";
import pcvAbi from "../abi/PCV.json";
import multiTroveGetterAbi from "../abi/MultiTroveGetter.json";
import priceFeedAbi from "../abi/PriceFeed.json";
import priceFeedTestnetAbi from "../abi/PriceFeedTestnet.json";
import sortedTrovesAbi from "../abi/SortedTroves.json";
import stabilityPoolAbi from "../abi/StabilityPool.json";
import bammAbi from "../abi/BAMM.json";
import bLensAbi from "../abi/BLens.json";
import chainlinkTestnetAbi from "../abi/ChainlinkTestnet.json";
import gasPoolAbi from "../abi/GasPool.json";
import erc20Abi from "../abi/ERC20Test.json";

import {
  ActivePool,
  BorrowerOperations,
  TroveManager,
  THUSDToken,
  CollSurplusPool,
  DefaultPool,
  HintHelpers,
  PCV,
  MultiTroveGetter,
  PriceFeed,
  PriceFeedTestnet,
  SortedTroves,
  StabilityPool,
  BAMM,
  BLens,
  ChainlinkTestnet,
  GasPool,
  ERC20Test,
} from "../types";

import { EthersProvider, EthersSigner } from "./types";

export interface _TypedLogDescription<T> extends Omit<LogDescription, "args"> {
  args: T;
}

type BucketOfFunctions = Record<string, (...args: unknown[]) => never>;

// Removes unsafe index signatures from an Ethers contract type
export type _TypeSafeContract<T> = Pick<
  T,
  {
    [P in keyof T]: BucketOfFunctions extends T[P] ? never : P;
  } extends {
    [_ in keyof T]: infer U;
  }
    ? U
    : never
>;

type EstimatedContractFunction<R = unknown, A extends unknown[] = unknown[], O = Overrides> = (
  overrides: O,
  adjustGas: (gas: BigNumber) => BigNumber,
  ...args: A
) => Promise<R>;

type CallOverridesArg = [overrides?: CallOverrides];

type TypedContract<T extends Contract, U, V> = _TypeSafeContract<T> &
  U &
  {
    [P in keyof V]: V[P] extends (...args: infer A) => unknown
      ? (...args: A) => Promise<ContractTransaction>
      : never;
  } & {
    readonly callStatic: {
      [P in keyof V]: V[P] extends (...args: [...infer A, never]) => infer R
        ? (...args: [...A, ...CallOverridesArg]) => R
        : never;
    };

    readonly estimateGas: {
      [P in keyof V]: V[P] extends (...args: infer A) => unknown
        ? (...args: A) => Promise<BigNumber>
        : never;
    };

    readonly populateTransaction: {
      [P in keyof V]: V[P] extends (...args: infer A) => unknown
        ? (...args: A) => Promise<PopulatedTransaction>
        : never;
    };

    readonly estimateAndPopulate: {
      [P in keyof V]: V[P] extends (...args: [...infer A, infer O | undefined]) => unknown
        ? EstimatedContractFunction<PopulatedTransaction, A, O>
        : never;
    };
  };

const buildEstimatedFunctions = <T>(
  estimateFunctions: Record<string, ContractFunction<BigNumber>>,
  functions: Record<string, ContractFunction<T>>
): Record<string, EstimatedContractFunction<T>> =>
  Object.fromEntries(
    Object.keys(estimateFunctions).map(functionName => [
      functionName,
      async (overrides, adjustEstimate, ...args) => {
        if (overrides.gasLimit === undefined) {
          const estimatedGas = await estimateFunctions[functionName](...args, overrides);

          overrides = {
            ...overrides,
            gasLimit: adjustEstimate(estimatedGas)
          };
        }

        return functions[functionName](...args, overrides);
      }
    ])
  );

export class _LiquityContract extends Contract {
  readonly estimateAndPopulate: Record<string, EstimatedContractFunction<PopulatedTransaction>>;

  constructor(
    addressOrName: string,
    contractInterface: ContractInterface,
    signerOrProvider?: EthersSigner | EthersProvider
  ) {
    super(addressOrName, contractInterface, signerOrProvider);

    // this.estimateAndCall = buildEstimatedFunctions(this.estimateGas, this);
    this.estimateAndPopulate = buildEstimatedFunctions(this.estimateGas, this.populateTransaction);
  }

  extractEvents(logs: Log[], name: string): _TypedLogDescription<unknown>[] {
    return logs
      .filter(log => log.address === this.address)
      .map(log => this.interface.parseLog(log))
      .filter(e => e.name === name);
  }
}

/** @internal */
export type _TypedLiquityContract<T = unknown, U = unknown> = TypedContract<_LiquityContract, T, U>;

/** @internal */
export interface _LiquityContracts {
  activePool: ActivePool;
  borrowerOperations: BorrowerOperations;
  troveManager: TroveManager;
  thusdToken: THUSDToken;
  collSurplusPool: CollSurplusPool;
  defaultPool: DefaultPool;
  hintHelpers: HintHelpers;
  pcv: PCV;
  multiTroveGetter: MultiTroveGetter;
  priceFeed: PriceFeed | PriceFeedTestnet;
  sortedTroves: SortedTroves;
  stabilityPool: StabilityPool;
  bamm: BAMM;
  bLens: BLens;
  chainlink: ChainlinkTestnet;
  gasPool: GasPool;
  erc20: ERC20Test;
}

/** @internal */
export const _priceFeedIsTestnet = (
  priceFeed: PriceFeed | PriceFeedTestnet
): priceFeed is PriceFeedTestnet => "setPrice" in priceFeed;

/** @internal */
export type _LiquityContractsKey = keyof _LiquityContracts;

/** @internal */
export type _LiquityContractAddresses = Record<_LiquityContractsKey, string>;

type LiquityContractAbis = Record<_LiquityContractsKey, JsonFragment[]>;

const getAbi = (priceFeedIsTestnet: boolean): LiquityContractAbis => ({
  activePool: activePoolAbi,
  borrowerOperations: borrowerOperationsAbi,
  troveManager: troveManagerAbi,
  thusdToken: thusdTokenAbi,
  defaultPool: defaultPoolAbi,
  hintHelpers: hintHelpersAbi,
  pcv: pcvAbi,
  multiTroveGetter: multiTroveGetterAbi,
  priceFeed: priceFeedIsTestnet ? priceFeedTestnetAbi : priceFeedAbi,
  sortedTroves: sortedTrovesAbi,
  stabilityPool: stabilityPoolAbi,
  bamm: bammAbi,
  bLens: bLensAbi,
  chainlink: chainlinkTestnetAbi,
  gasPool: gasPoolAbi,
  collSurplusPool: collSurplusPoolAbi,
  erc20: erc20Abi,
});

/** @internal */
export interface _LiquityDeploymentJSON {
  readonly chainId: number;
  readonly addresses: _LiquityContractAddresses;
  readonly version: string;
  readonly deploymentDate: number;
  readonly startBlock: number;
  readonly _priceFeedIsTestnet: boolean;
  readonly _isDev: boolean;
}

/** @internal */
export type Versions = Record<string, _LiquityDeploymentJSON>

/** @public */
export type CollateralsVersionedDeployments = Record<string, Versions>

const mapLiquityContracts = <T, U>(
  contracts: Record<_LiquityContractsKey, T>,
  f: (t: T, key: _LiquityContractsKey) => U
) => {
  // Check that contracts is not null or undefined
  if (!contracts) {
    throw new Error('Contracts object cannot be null or undefined');
  }

  return Object.fromEntries(
    Object.entries(contracts).map(([key, t]) => [key, f(t, key as _LiquityContractsKey)])
  ) as Record<_LiquityContractsKey, U>
}

/** @internal */
export const _connectToContracts = (
  signerOrProvider: EthersSigner | EthersProvider,
  { addresses, _priceFeedIsTestnet }: _LiquityDeploymentJSON
): _LiquityContracts => {
  // Check that addresses is not null or undefined
  if (!addresses) {
    throw new Error('Addresses object cannot be null or undefined');
  }

  const abi = getAbi(_priceFeedIsTestnet);

  return mapLiquityContracts(
    addresses,
    (address, key) => {
      // Check that address is not null or undefined
      if (!address) {
        throw new Error(`Address for ${key} cannot be null or undefined`);
      }

      // Check that the ABI for the key is not null or undefined
      if (!abi[key]) {
        throw new Error(`ABI for ${key} cannot be null or undefined`);
      }

      return new _LiquityContract(address, abi[key], signerOrProvider) as _TypedLiquityContract
    }
  ) as _LiquityContracts;
};
