import { Block, BlockTag } from "@ethersproject/abstract-provider";
import { Signer } from "@ethersproject/abstract-signer";

import { numberify, panic } from "./_utils";
import { EthersProvider, EthersSigner } from "./types";

import {
  _VersionedLiquityDeployments,
  _connectToContracts,
  _LiquityContractAddresses,
  _LiquityContracts,
  _LiquityDeploymentJSON
} from "./contracts";

import { _connectToMulticall, _Multicall } from "./_Multicall";

declare const brand: unique symbol;

const branded = <T>(t: Omit<T, typeof brand>): T => t as T;

/**
 * Information about a connection to the Liquity protocol.
 *
 * @remarks
 * Provided for debugging / informational purposes.
 *
 * Exposed through {@link ReadableEthersLiquity.connection} and {@link EthersLiquity.connection}.
 *
 * @public
 */
export interface EthersLiquityConnection extends EthersLiquityConnectionOptionalParams {
  /** Ethers `Provider` used for connecting to the network. */
  readonly provider: EthersProvider;

  /** Ethers `Signer` used for sending transactions. */
  readonly signer?: EthersSigner;

  /** deployment collateral version of the connected network. */
  readonly deploymentVersion: string;

  /** Chain ID of the connected network. */
  readonly chainId: number;

  /** Version of the Liquity contracts (Git commit hash). */
  readonly version: string;

  /** Date when the Liquity contracts were deployed. */
  readonly deploymentDate: Date;

  /** Number of block in which the first Liquity contract was deployed. */
  readonly startBlock: number;

  /** A mapping of Liquity contracts' names to their addresses. */
  readonly addresses: Record<string, string>;

  /** @internal */
  readonly _priceFeedIsTestnet: boolean;

  /** @internal */
  readonly _isDev: boolean;

  /** @internal */
  readonly [brand]: unique symbol;
}

/** @internal */
export interface _InternalEthersLiquityConnection extends EthersLiquityConnection {
  readonly addresses: _LiquityContractAddresses;
  readonly _contracts: _LiquityContracts;
  readonly _multicall?: _Multicall;
}

const connectionFrom = (
  deploymentVersion: string,
  provider: EthersProvider,
  signer: EthersSigner | undefined,
  _contracts: _LiquityContracts,
  _multicall: _Multicall | undefined,
  {
    deploymentDate,
    ...deployment
  }: _LiquityDeploymentJSON,
  optionalParams?: EthersLiquityConnectionOptionalParams
): _InternalEthersLiquityConnection => {
  if (
    optionalParams &&
    optionalParams.useStore !== undefined &&
    !validStoreOptions.includes(optionalParams.useStore)
  ) {
    throw new Error(`Invalid useStore value ${optionalParams.useStore}`);
  }

  return branded({
    deploymentVersion,
    provider,
    signer,
    _contracts,
    _multicall,
    deploymentDate: new Date(deploymentDate),
    ...deployment,
    ...optionalParams
  });
};

/** @internal */
export const _getContracts = (connection: EthersLiquityConnection): _LiquityContracts =>
  (connection as _InternalEthersLiquityConnection)._contracts;

const getMulticall = (connection: EthersLiquityConnection): _Multicall | undefined =>
  (connection as _InternalEthersLiquityConnection)._multicall;

const getTimestampFromBlock = ({ timestamp }: Block) => timestamp;

/** @internal */
export const _getBlockTimestamp = (
  connection: EthersLiquityConnection,
  blockTag: BlockTag = "latest"
): Promise<number> =>
  // Get the timestamp via a contract call whenever possible, to make it batchable with other calls
  getMulticall(connection)?.getCurrentBlockTimestamp({ blockTag }).then(numberify) ??
  _getProvider(connection).getBlock(blockTag).then(getTimestampFromBlock);

/** @internal */
export const _requireSigner = (connection: EthersLiquityConnection): EthersSigner =>
  connection.signer ?? panic(new Error("Must be connected through a Signer"));

/** @internal */
export const _getProvider = (connection: EthersLiquityConnection): EthersProvider =>
  connection.provider;

// TODO parameterize error message?
/** @internal */
export const _requireAddress = (
  connection: EthersLiquityConnection,
  overrides?: { from?: string }
): string =>
  overrides?.from ?? connection.userAddress ?? panic(new Error("A user address is required"));

/** @internal */
export const _usingStore = (
  connection: EthersLiquityConnection
): connection is EthersLiquityConnection & { useStore: EthersLiquityStoreOption } =>
  connection.useStore !== undefined;

/**
 * Thrown when trying to connect to a network where Liquity is not deployed.
 *
 * @remarks
 * Thrown by {@link ReadableEthersLiquity.(connect:2)} and {@link EthersLiquity.(connect:2)}.
 *
 * @public
 */
export class UnsupportedNetworkError extends Error {
  /** Chain ID of the unsupported network. */
  readonly chainId: number;

  /** @internal */
  constructor(chainId: number) {
    super(`Unsupported network (chainId = ${chainId})`);
    this.name = "UnsupportedNetworkError";
    this.chainId = chainId;
  }
}

export const getProviderAndSigner = (
  signerOrProvider: EthersSigner | EthersProvider
): [provider: EthersProvider, signer: EthersSigner | undefined] => {
  const provider: EthersProvider = Signer.isSigner(signerOrProvider)
    ? signerOrProvider.provider ?? panic(new Error("Signer must have a Provider"))
    : signerOrProvider;

  const signer = Signer.isSigner(signerOrProvider) ? signerOrProvider : undefined;

  return [provider, signer];
};

/** @internal */
export const _connectToDeployment = (
  version: string,
  deployment: _LiquityDeploymentJSON,
  signerOrProvider: EthersSigner | EthersProvider,
  optionalParams?: EthersLiquityConnectionOptionalParams
): EthersLiquityConnection =>
  connectionFrom(
    version,
    ...getProviderAndSigner(signerOrProvider),
    _connectToContracts(signerOrProvider, deployment),
    undefined,
    deployment,
    optionalParams
  );

/**
 * Possible values for the optional
 * {@link EthersLiquityConnectionOptionalParams.useStore | useStore}
 * connection parameter.
 *
 * @remarks
 * Currently, the only supported value is `"blockPolled"`, in which case a
 * {@link BlockPolledLiquityStore} will be created.
 *
 * @public
 */
export type EthersLiquityStoreOption = "blockPolled";

const validStoreOptions = ["blockPolled"];

/**
 * Optional parameters of {@link ReadableEthersLiquity.(connect:2)} and
 * {@link EthersLiquity.(connect:2)}.
 *
 * @public
 */
export interface EthersLiquityConnectionOptionalParams {
  /**
   * Address whose Trove, Stability Deposit and balances will be read by default.
   *
   * @remarks
   * For example {@link EthersLiquity.getTrove | getTrove(address?)} will return the Trove owned by
   * `userAddress` when the `address` parameter is omitted.
   *
   * Should be omitted when connecting through a {@link EthersSigner | Signer}. Instead `userAddress`
   * will be automatically determined from the `Signer`.
   */
  readonly userAddress?: string;

  /**
   * Create a {@link @liquity/lib-base#LiquityStore} and expose it as the `store` property.
   *
   * @remarks
   * When set to one of the available {@link EthersLiquityStoreOption | options},
   * {@link ReadableEthersLiquity.(connect:2) | ReadableEthersLiquity.connect()} will return a
   * {@link ReadableEthersLiquityWithStore}, while
   * {@link EthersLiquity.(connect:2) | EthersLiquity.connect()} will return an
   * {@link EthersLiquityWithStore}.
   *
   * Note that the store won't start monitoring the blockchain until its
   * {@link @liquity/lib-base#LiquityStore.start | start()} function is called.
   */
  readonly useStore?: EthersLiquityStoreOption;
}

/** @internal */
export function _connectByChainId<T>(
  version: string,
  deployment: _LiquityDeploymentJSON,
  provider: EthersProvider,
  signer: EthersSigner | undefined,
  chainId: number,
  optionalParams: EthersLiquityConnectionOptionalParams & { useStore: T }
): EthersLiquityConnection & { useStore: T };

/** @internal */
export function _connectByChainId(
  version: string,
  deployment: _LiquityDeploymentJSON,
  provider: EthersProvider,
  signer: EthersSigner | undefined,
  chainId: number,
  optionalParams?: EthersLiquityConnectionOptionalParams
): EthersLiquityConnection;

/** @internal */
export function _connectByChainId(
  version: string,
  deployment: _LiquityDeploymentJSON,
  provider: EthersProvider,
  signer: EthersSigner | undefined,
  chainId: number,
  optionalParams?: EthersLiquityConnectionOptionalParams
): EthersLiquityConnection {

  return connectionFrom(
    version,
    provider,
    signer,
    _connectToContracts(signer ?? provider, deployment),
    _connectToMulticall(signer ?? provider, chainId),
    deployment,
    optionalParams
  );
}

/** @internal */
export async function _getVersionedDeployments(network: string): Promise<_VersionedLiquityDeployments> {
  const versionedDeployments: _VersionedLiquityDeployments = {};

  for (let i = 1; i < 10; i++) {
    import(`../deployments/default/eth/v${i.toString()}/${network}.json`)
      .then((deployment) => {
        versionedDeployments['v'+i] = deployment;
      })
      .catch((err) => {
        return err
      })
  }
  return versionedDeployments
  ;
}

/** @internal */
export const _connect = async (
  version: string,
  deployment: _LiquityDeploymentJSON,
  provider: EthersProvider,
  signer?: EthersSigner,
  optionalParams?: EthersLiquityConnectionOptionalParams
): Promise<EthersLiquityConnection> => {

  if (signer) {
    if (optionalParams?.userAddress !== undefined) {
      throw new Error("Can't override userAddress when connecting through Signer");
    }

    optionalParams = {
      ...optionalParams,
      userAddress: await signer.getAddress()
    };
  }

  return _connectByChainId(version, deployment, provider, signer, (await provider.getNetwork()).chainId, optionalParams);
};
