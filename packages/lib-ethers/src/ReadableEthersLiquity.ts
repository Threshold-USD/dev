import { BlockTag } from "@ethersproject/abstract-provider";

import {
  Decimal,
  Decimalish,
  Fees,
  LiquityStore,
  ReadableLiquity,
  StabilityDeposit,
  BammDeposit,
  Trove,
  TroveListingParams,
  TroveWithPendingRedistribution,
  UserTrove,
  UserTroveStatus
} from "@liquity/lib-base";

import { MultiTroveGetter } from "../types";

import { decimalify, DEFAULT_COLLATERAL_FOR_TESTING, DEFAULT_VERSION_FOR_TESTING, panic, supportedNetworks } from "./_utils";
import { EthersCallOverrides, EthersProvider, EthersSigner } from "./types";

import {
  _LiquityDeploymentJSON
} from "./contracts"
import {
  getCollateralsDeployments,
  EthersLiquityConnection,
  EthersLiquityConnectionOptionalParams,
  EthersLiquityStoreOption,
  getProviderAndSigner,
  UnsupportedNetworkError,
  _connect,
  _getBlockTimestamp,
  _getContracts,
  _requireAddress
} from "./EthersLiquityConnection";

import { BlockPolledLiquityStore } from "./BlockPolledLiquityStore";
import { BigNumber } from "@ethersproject/bignumber";
import { ZERO_ADDRESS } from "../utils/constants";

// TODO: these are constant in the contracts, so it doesn't make sense to make a call for them,
// but to avoid having to update them here when we change them in the contracts, we could read
// them once after deployment and save them to LiquityDeployment.
const MINUTE_DECAY_FACTOR = Decimal.from("0.999037758833783000");
const BETA = Decimal.from(2);

enum BackendTroveStatus {
  nonExistent,
  active,
  closedByOwner,
  closedByLiquidation,
  closedByRedemption
}

const userTroveStatusFrom = (backendStatus: BackendTroveStatus): UserTroveStatus =>
  backendStatus === BackendTroveStatus.nonExistent
    ? "nonExistent"
    : backendStatus === BackendTroveStatus.active
    ? "open"
    : backendStatus === BackendTroveStatus.closedByOwner
    ? "closedByOwner"
    : backendStatus === BackendTroveStatus.closedByLiquidation
    ? "closedByLiquidation"
    : backendStatus === BackendTroveStatus.closedByRedemption
    ? "closedByRedemption"
    : panic(new Error(`invalid backendStatus ${backendStatus}`));

const convertToDate = (timestamp: number) => new Date(timestamp * 1000);

const validSortingOptions = ["ascendingCollateralRatio", "descendingCollateralRatio"];

const expectPositiveInt = <K extends string>(obj: { [P in K]?: number }, key: K) => {
  if (obj[key] !== undefined) {
    if (!Number.isInteger(obj[key])) {
      throw new Error(`${key} must be an integer`);
    }

    if (obj[key] < 0) {
      throw new Error(`${key} must not be negative`);
    }
  }
};

/**
 * Ethers-based implementation of {@link @liquity/lib-base#ReadableLiquity}.
 *
 * @public
 */
export class ReadableEthersLiquity implements ReadableLiquity {
  readonly connection: EthersLiquityConnection;

  /** @internal */
  constructor(connection: EthersLiquityConnection) {
    this.connection = connection;
  }

  /** @internal */
  static _from(
    connection: EthersLiquityConnection & { useStore: "blockPolled" }
  ): ReadableEthersLiquityWithStore<BlockPolledLiquityStore>;

  /** @internal */
  static _from(connection: EthersLiquityConnection): ReadableEthersLiquity;

  /** @internal */
  static _from(connection: EthersLiquityConnection): ReadableEthersLiquity {
    const readable = new ReadableEthersLiquity(connection);

    return connection.useStore === "blockPolled"
      ? new _BlockPolledReadableEthersLiquity(readable)
      : readable;
  }

  /** @internal */
  static connect(
    signerOrProvider: EthersSigner | EthersProvider,
    optionalParams: EthersLiquityConnectionOptionalParams & { useStore: "blockPolled" }
  ): Promise<ReadableEthersLiquityWithStore<BlockPolledLiquityStore>>;

  static connect(
    signerOrProvider: EthersSigner | EthersProvider,
    optionalParams?: EthersLiquityConnectionOptionalParams
  ): Promise<ReadableEthersLiquity>;

  /**
   * Connect to the Liquity protocol and create a `ReadableEthersLiquity` object.
   *
   * @param signerOrProvider - Ethers `Signer` or `Provider` to use for connecting to the Ethereum
   *                           network.
   * @param optionalParams - Optional parameters that can be used to customize the connection.
   */
  static async connect(
    signerOrProvider: EthersSigner | EthersProvider,
    optionalParams?: EthersLiquityConnectionOptionalParams
  ): Promise<ReadableEthersLiquity> {
    const [provider, signer] = getProviderAndSigner(signerOrProvider);
    const chainId = (await provider.getNetwork()).chainId
    const versionedDeployments = await getCollateralsDeployments(supportedNetworks[chainId])
    const importedDeployment: _LiquityDeploymentJSON =
    versionedDeployments.v1.deployment ?? panic(new UnsupportedNetworkError(chainId));

    return ReadableEthersLiquity._from(await _connect(DEFAULT_COLLATERAL_FOR_TESTING, DEFAULT_VERSION_FOR_TESTING, importedDeployment, provider, signer, optionalParams));
  }

  /**
   * Check whether this `ReadableEthersLiquity` is a {@link ReadableEthersLiquityWithStore}.
   */
  hasStore(): this is ReadableEthersLiquityWithStore;

  /**
   * Check whether this `ReadableEthersLiquity` is a
   * {@link ReadableEthersLiquityWithStore}\<{@link BlockPolledLiquityStore}\>.
   */
  hasStore(store: "blockPolled"): this is ReadableEthersLiquityWithStore<BlockPolledLiquityStore>;

  hasStore(): boolean {
    return false;
  }

  /** {@inheritDoc @liquity/lib-base#ReadableLiquity.getTotalRedistributed} */
  async getTotalRedistributed(overrides?: EthersCallOverrides): Promise<Trove> {
    const { troveManager } = _getContracts(this.connection);

    const [collateral, debt] = await Promise.all([
      troveManager.L_Collateral({ ...overrides }).then(decimalify),
      troveManager.L_THUSDDebt({ ...overrides }).then(decimalify)
    ]);

    return new Trove(collateral, debt);
  }

  /** {@inheritDoc @liquity/lib-base#ReadableLiquity.getTroveBeforeRedistribution} */
  async getTroveBeforeRedistribution(
    address?: string,
    overrides?: EthersCallOverrides
  ): Promise<TroveWithPendingRedistribution> {
    address ??= _requireAddress(this.connection);
    const { troveManager } = _getContracts(this.connection);

    const [trove, snapshot] = await Promise.all([
      troveManager.Troves(address, { ...overrides }),
      troveManager.rewardSnapshots(address, { ...overrides })
    ]);

    if (trove.status === BackendTroveStatus.active) {
      return new TroveWithPendingRedistribution(
        address,
        userTroveStatusFrom(trove.status),
        decimalify(trove.coll),
        decimalify(trove.debt),
        decimalify(trove.stake),
        new Trove(decimalify(snapshot.collateral), decimalify(snapshot.THUSDDebt))
      );
    } else {
      return new TroveWithPendingRedistribution(address, userTroveStatusFrom(trove.status));
    }
  }

  /** {@inheritDoc @liquity/lib-base#ReadableLiquity.getTrove} */
  async getTrove(address?: string, overrides?: EthersCallOverrides): Promise<UserTrove> {
    const [trove, totalRedistributed] = await Promise.all([
      this.getTroveBeforeRedistribution(address, overrides),
      this.getTotalRedistributed(overrides)
    ]);

    return trove.applyRedistribution(totalRedistributed);
  }

  /** {@inheritDoc @liquity/lib-base#ReadableLiquity.getNumberOfTroves} */
  async getNumberOfTroves(overrides?: EthersCallOverrides): Promise<number> {
    const { troveManager } = _getContracts(this.connection);

    return (await troveManager.getTroveOwnersCount({ ...overrides })).toNumber();
  }

  /** {@inheritDoc @liquity/lib-base#ReadableLiquity.getPrice} */
  getPrice(overrides?: EthersCallOverrides): Promise<Decimal> {
    const { priceFeed } = _getContracts(this.connection);

    return priceFeed.callStatic.fetchPrice({ ...overrides }).then(decimalify);
  }

  /** @internal */
  async _getActivePool(overrides?: EthersCallOverrides): Promise<Trove> {
    const { activePool } = _getContracts(this.connection);

    const [activeCollateral, activeDebt] = await Promise.all(
      [
        activePool.getCollateralBalance({ ...overrides }),
        activePool.getTHUSDDebt({ ...overrides })
      ].map(getBigNumber => getBigNumber.then(decimalify))
    );

    return new Trove(activeCollateral, activeDebt);
  }

  /** @internal */
  async _getDefaultPool(overrides?: EthersCallOverrides): Promise<Trove> {
    const { defaultPool } = _getContracts(this.connection);

    const [liquidatedCollateral, closedDebt] = await Promise.all(
      [
        defaultPool.getCollateralBalance({ ...overrides }),
        defaultPool.getTHUSDDebt({ ...overrides })
      ].map(getBigNumber => getBigNumber.then(decimalify))
    );

    return new Trove(liquidatedCollateral, closedDebt);
  }

  /** {@inheritDoc @liquity/lib-base#ReadableLiquity.getTotal} */
  async getTotal(overrides?: EthersCallOverrides): Promise<Trove> {
    const [activePool, defaultPool] = await Promise.all([
      this._getActivePool(overrides),
      this._getDefaultPool(overrides)
    ]);

    return activePool.add(defaultPool);
  }

  /** {@inheritDoc @liquity/lib-base#ReadableLiquity.getWithdrawsSpShare} */
  async getWithdrawsSpShare(
    withdrawAmount: Decimalish,
    overrides?: EthersCallOverrides
  ): Promise<string> {
    const address = _requireAddress(this.connection);
    const { bamm } = _getContracts(this.connection);

    const [
      stake, // users share in the bamm
      {currentUSD}
    ] = await Promise.all([
      bamm.stake(address),
      this.getBammDeposit(address, overrides)
    ]);

    // amount * stake / currentUSD
    const spShare = currentUSD 
      ? decimalify(stake).mul(Decimal.from(withdrawAmount)).div(currentUSD).toString() 
      : Decimal.from(0).toString() 

    return spShare
  }

  /** {@inheritDoc @liquity/lib-base#ReadableLiquity.getSymbol} */
  async getSymbol(overrides?: EthersCallOverrides): Promise<string> {
    const { erc20, borrowerOperations } = _getContracts(this.connection);
    const collateralAddress = await borrowerOperations.collateralAddress();

    if (collateralAddress === ZERO_ADDRESS) {
      return "ETH"
    }

    return erc20.symbol({ ...overrides });
  }

  /** {@inheritDoc @liquity/lib-base#ReadableLiquity.getCollateralAddress} */
  getCollateralAddress(overrides?: EthersCallOverrides): Promise<string> {
    const { borrowerOperations } = _getContracts(this.connection);

    return borrowerOperations.collateralAddress({ ...overrides });
  }

  /** {@inheritDoc @liquity/lib-base#ReadableLiquity.getBammDeposit} */
  async getBammDeposit(
    address?: string,
    overrides?: EthersCallOverrides
  ): Promise<BammDeposit> {
    const _1e18 = BigNumber.from(10).pow(18)

    address ??= _requireAddress(this.connection);
    const { stabilityPool, bamm, priceFeed } = _getContracts(this.connection);

    const [
      initialValue,
      currentBammTHUSD,
      bammPendingCollateral,
      total,
      stake,
      totalThusdInSp,
    ] = await Promise.all([
      stabilityPool.deposits(address, { ...overrides }),
      stabilityPool.getCompoundedTHUSDDeposit(bamm.address, { ...overrides }),
      stabilityPool.getDepositorCollateralGain(bamm.address, { ...overrides }),
      bamm.total({ ...overrides }),
      bamm.stake(address, { ...overrides}),
      stabilityPool.getTotalTHUSDDeposits({ ...overrides }),
    ]);
    const isTotalGreaterThanZero = total.gt(BigNumber.from(0))
    const isTotalThusdInSpGreaterThanZero = totalThusdInSp.gt(BigNumber.from(0))
    
    // stake times thUSD divided by total
    const currentTHUSD = isTotalGreaterThanZero 
      ? stake.mul(currentBammTHUSD).div(total) 
      : BigNumber.from(0)

    // bammDeposit.currentLUSD.mulDiv(100, thusdInBammPool);
    const bammShare = isTotalThusdInSpGreaterThanZero 
      ? Decimal.fromBigNumber(currentBammTHUSD).mul(100).div(Decimal.fromBigNumber(totalThusdInSp)) 
      : Decimal.from(0)

    // bamm share in SP times stake div by total
    const poolShare = isTotalGreaterThanZero 
      ? bammShare.mul(Decimal.fromBigNumber(stake)).div(Decimal.fromBigNumber(total)) 
      : Decimal.from(0)

    const bammCollateralBalance = (await bamm.provider.getBalance(bamm.address)).add(bammPendingCollateral)
    const currentCollateral = isTotalGreaterThanZero 
      ? stake.mul(bammCollateralBalance).div(total) 
      : BigNumber.from(0)
    
    const price = await priceFeed.callStatic.fetchPrice({ ...overrides })

    const currentUSD = currentTHUSD.add(currentCollateral.mul(price).div(_1e18))

    const bammPoolShare = isTotalGreaterThanZero 
      ? Decimal.fromBigNumber(stake).mulDiv(100, Decimal.fromBigNumber(total)) 
      : Decimal.from(0)
    
    return new BammDeposit(
      bammPoolShare,
      poolShare,
      decimalify(initialValue),
      Decimal.fromBigNumber(currentUSD),
      Decimal.fromBigNumber(currentTHUSD),
      Decimal.fromBigNumber(currentCollateral),
      Decimal.fromBigNumber(bammCollateralBalance),
      Decimal.fromBigNumber(currentBammTHUSD)
    );
  }

  /** {@inheritDoc @liquity/lib-base#ReadableLiquity.getStabilityDeposit} */
  async getStabilityDeposit(
    address?: string,
    overrides?: EthersCallOverrides
  ): Promise<StabilityDeposit> {
    address ??= _requireAddress(this.connection);
    const { stabilityPool } = _getContracts(this.connection);

    const [
      initialValue,
      currentTHUSD,
      collateralGain
    ] = await Promise.all([
      stabilityPool.deposits(address, { ...overrides }),
      stabilityPool.getCompoundedTHUSDDeposit(address, { ...overrides }),
      stabilityPool.getDepositorCollateralGain(address, { ...overrides })
    ]);

    return new StabilityDeposit(
      decimalify(initialValue),
      decimalify(currentTHUSD),
      decimalify(collateralGain)
    );
  }

  /** {@inheritDoc @liquity/lib-base#ReadableLiquity.getTHUSDInStabilityPool} */
  getTHUSDInStabilityPool(overrides?: EthersCallOverrides): Promise<Decimal> {
    const { stabilityPool } = _getContracts(this.connection);

    return stabilityPool.getTotalTHUSDDeposits({ ...overrides }).then(decimalify);
  }

  /** {@inheritDoc @liquity/lib-base#ReadableLiquity.getPCVBalance} */
  getPCVBalance(overrides?: EthersCallOverrides): Promise<Decimal> {
    const { pcv } = _getContracts(this.connection);
    const { thusdToken } = _getContracts(this.connection);

    return thusdToken.balanceOf(pcv.address, { ...overrides }).then(decimalify);
  }

  /** {@inheritDoc @liquity/lib-base#ReadableLiquity.getTHUSDBalance} */
  getTHUSDBalance(address?: string, overrides?: EthersCallOverrides): Promise<Decimal> {
    address ??= _requireAddress(this.connection);
    const { thusdToken } = _getContracts(this.connection);

    return thusdToken.balanceOf(address, { ...overrides }).then(decimalify);
  }

  /** {@inheritDoc @liquity/lib-base#ReadableLiquity.getErc20TokenBalance} */
  async getErc20TokenBalance(address?: string, overrides?: EthersCallOverrides): Promise<Decimal> {
    address ??= _requireAddress(this.connection);
    const { borrowerOperations } = _getContracts(this.connection);
    const collateralAddress = await borrowerOperations.collateralAddress();

    if (collateralAddress === ZERO_ADDRESS) {
      return this.connection.provider.getBalance(address).then(decimalify)
    }

    const { erc20 } = _getContracts(this.connection);
    return erc20.balanceOf(address, { ...overrides }).then(decimalify);
  }

  /** {@inheritDoc @liquity/lib-base#ReadableLiquity.getErc20TokenAllowance} */
  async getErc20TokenAllowance(address?: string, overrides?: EthersCallOverrides): Promise<Decimal> {
    address ??= _requireAddress(this.connection);
    const largeAllowanceBigNumber = BigNumber.from("0x8888888888888888888888888888888888888888888888888888888888888888");
    const largeAllowanceDecimal = decimalify(largeAllowanceBigNumber);

    const { erc20, borrowerOperations } = _getContracts(this.connection);
    const collateralAddress = await borrowerOperations.collateralAddress();

    if (collateralAddress === ZERO_ADDRESS) {
      return largeAllowanceDecimal;
    }

    return erc20.allowance(address, borrowerOperations.address, { ...overrides }).then(decimalify);
  }

  /** {@inheritDoc @liquity/lib-base#ReadableLiquity.isStabilityPools} */
  isStabilityPools(overrides?: EthersCallOverrides): Promise<boolean> {
    const { stabilityPool, thusdToken } = _getContracts(this.connection);

    return thusdToken.isStabilityPools(stabilityPool.address, { ...overrides });
  }
  
  /** {@inheritDoc @liquity/lib-base#ReadableLiquity.isBorrowerOperations} */
  isBorrowerOperations(overrides?: EthersCallOverrides): Promise<boolean> {
    const { borrowerOperations, thusdToken } = _getContracts(this.connection);

    return thusdToken.isBorrowerOperations(borrowerOperations.address, { ...overrides });
  }

  /** {@inheritDoc @liquity/lib-base#ReadableLiquity.isTroveManager} */
  isTroveManager(overrides?: EthersCallOverrides): Promise<boolean> {
    const { troveManager, thusdToken } = _getContracts(this.connection);

    return thusdToken.isTroveManager(troveManager.address, { ...overrides });
  }

  /** {@inheritDoc @liquity/lib-base#ReadableLiquity.checkMintList} */
  checkMintList(overrides?: EthersCallOverrides): Promise<boolean> {
    const { thusdToken, borrowerOperations } = _getContracts(this.connection);

    return thusdToken.mintList(borrowerOperations.address, { ...overrides });
  }

  /** {@inheritDoc @liquity/lib-base#ReadableLiquity.getCollateralSurplusBalance} */
  getCollateralSurplusBalance(address?: string, overrides?: EthersCallOverrides): Promise<Decimal> {
    address ??= _requireAddress(this.connection);
    const { collSurplusPool } = _getContracts(this.connection);

    return collSurplusPool.getCollateral(address, { ...overrides }).then(decimalify);
  }

  /** @internal */
  getTroves(
    params: TroveListingParams & { beforeRedistribution: true },
    overrides?: EthersCallOverrides
  ): Promise<TroveWithPendingRedistribution[]>;

  /** {@inheritDoc @liquity/lib-base#ReadableLiquity.(getTroves:2)} */
  getTroves(params: TroveListingParams, overrides?: EthersCallOverrides): Promise<UserTrove[]>;

  async getTroves(
    params: TroveListingParams,
    overrides?: EthersCallOverrides
  ): Promise<UserTrove[]> {
    const { multiTroveGetter } = _getContracts(this.connection);

    expectPositiveInt(params, "first");
    expectPositiveInt(params, "startingAt");

    if (!validSortingOptions.includes(params.sortedBy)) {
      throw new Error(
        `sortedBy must be one of: ${validSortingOptions.map(x => `"${x}"`).join(", ")}`
      );
    }

    const [totalRedistributed, backendTroves] = await Promise.all([
      params.beforeRedistribution ? undefined : this.getTotalRedistributed({ ...overrides }),
      multiTroveGetter.getMultipleSortedTroves(
        params.sortedBy === "descendingCollateralRatio"
          ? params.startingAt ?? 0
          : -((params.startingAt ?? 0) + 1),
        params.first,
        { ...overrides }
      )
    ]);

    const troves = mapBackendTroves(backendTroves);

    if (totalRedistributed) {
      return troves.map(trove => trove.applyRedistribution(totalRedistributed));
    } else {
      return troves;
    }
  }

  /** @internal */
  _getBlockTimestamp(blockTag?: BlockTag): Promise<number> {
    return _getBlockTimestamp(this.connection, blockTag);
  }

  /** @internal */
  async _getFeesFactory(
    overrides?: EthersCallOverrides
  ): Promise<(blockTimestamp: number, recoveryMode: boolean) => Fees> {
    const { troveManager } = _getContracts(this.connection);

    const [lastFeeOperationTime, baseRateWithoutDecay] = await Promise.all([
      troveManager.lastFeeOperationTime({ ...overrides }),
      troveManager.baseRate({ ...overrides }).then(decimalify)
    ]);

    return (blockTimestamp, recoveryMode) =>
      new Fees(
        baseRateWithoutDecay,
        MINUTE_DECAY_FACTOR,
        BETA,
        convertToDate(lastFeeOperationTime.toNumber()),
        convertToDate(blockTimestamp),
        recoveryMode
      );
  }

  /** {@inheritDoc @liquity/lib-base#ReadableLiquity.getFees} */
  async getFees(overrides?: EthersCallOverrides): Promise<Fees> {
    const [createFees, total, price, blockTimestamp] = await Promise.all([
      this._getFeesFactory(overrides),
      this.getTotal(overrides),
      this.getPrice(overrides),
      this._getBlockTimestamp(overrides?.blockTag)
    ]);

    return createFees(blockTimestamp, total.collateralRatioIsBelowCritical(price));
  }

  async getBammAllowance(overrides?: EthersCallOverrides): Promise<Decimal> {
    const { thusdToken, bamm } = _getContracts(this.connection);
    const address = _requireAddress(this.connection);

    const allowance = await thusdToken.allowance(address, bamm.address, { ...overrides }).then(decimalify);
    return allowance;
  }
}

type Resolved<T> = T extends Promise<infer U> ? U : T;
type BackendTroves = Resolved<ReturnType<MultiTroveGetter["getMultipleSortedTroves"]>>;

const mapBackendTroves = (troves: BackendTroves): TroveWithPendingRedistribution[] =>
  troves.map(
    trove =>
      new TroveWithPendingRedistribution(
        trove.owner,
        "open", // These Troves are coming from the SortedTroves list, so they must be open
        decimalify(trove.coll),
        decimalify(trove.debt),
        decimalify(trove.stake),
        new Trove(decimalify(trove.snapshotCollateral), decimalify(trove.snapshotTHUSDDebt))
      )
  );

/**
 * Variant of {@link ReadableEthersLiquity} that exposes a {@link @liquity/lib-base#LiquityStore}.
 *
 * @public
 */
export interface ReadableEthersLiquityWithStore<T extends LiquityStore = LiquityStore>
  extends ReadableEthersLiquity {
  /** An object that implements LiquityStore. */
  readonly store: T;
}

class _BlockPolledReadableEthersLiquity
  implements ReadableEthersLiquityWithStore<BlockPolledLiquityStore> {
  readonly connection: EthersLiquityConnection;
  readonly store: BlockPolledLiquityStore;

  private readonly _readable: ReadableEthersLiquity;

  constructor(readable: ReadableEthersLiquity) {
    const store = new BlockPolledLiquityStore(readable);

    this.store = store;
    this.connection = readable.connection;
    this._readable = readable;
  }

  private _blockHit(overrides?: EthersCallOverrides): boolean {
    return (
      !overrides ||
      overrides.blockTag === undefined ||
      overrides.blockTag === this.store.state.blockTag
    );
  }

  private _userHit(address?: string, overrides?: EthersCallOverrides): boolean {
    return (
      this._blockHit(overrides) &&
      (address === undefined || address === this.store.connection.userAddress)
    );
  }

  hasStore(store?: EthersLiquityStoreOption): boolean {
    return store === undefined || store === "blockPolled";
  }

  async getTotalRedistributed(overrides?: EthersCallOverrides): Promise<Trove> {
    return this._blockHit(overrides)
      ? this.store.state.totalRedistributed
      : this._readable.getTotalRedistributed(overrides);
  }

  async getTroveBeforeRedistribution(
    address?: string,
    overrides?: EthersCallOverrides
  ): Promise<TroveWithPendingRedistribution> {
    return this._userHit(address, overrides)
      ? this.store.state.troveBeforeRedistribution
      : this._readable.getTroveBeforeRedistribution(address, overrides);
  }

  async getTrove(address?: string, overrides?: EthersCallOverrides): Promise<UserTrove> {
    return this._userHit(address, overrides)
      ? this.store.state.trove
      : this._readable.getTrove(address, overrides);
  }

  async getNumberOfTroves(overrides?: EthersCallOverrides): Promise<number> {
    return this._blockHit(overrides)
      ? this.store.state.numberOfTroves
      : this._readable.getNumberOfTroves(overrides);
  }

  async getPrice(overrides?: EthersCallOverrides): Promise<Decimal> {
    return this._blockHit(overrides) ? this.store.state.price : this._readable.getPrice(overrides);
  }

  async getTotal(overrides?: EthersCallOverrides): Promise<Trove> {
    return this._blockHit(overrides) ? this.store.state.total : this._readable.getTotal(overrides);
  }

  async getWithdrawsSpShare(withdrawAmount: Decimalish, overrides?: EthersCallOverrides): Promise<string> {
    return this._readable.getWithdrawsSpShare(withdrawAmount, overrides)
  }

  async getSymbol(
    overrides?: EthersCallOverrides
  ): Promise<string> {
    return this._blockHit(overrides)
      ? this.store.state.symbol
      : this._readable.getSymbol(overrides);
  }

  async getCollateralAddress(
    overrides?: EthersCallOverrides
  ): Promise<string> {
    return this._blockHit(overrides)
      ? this.store.state.collateralAddress
      : this._readable.getCollateralAddress(overrides);
  }

  async getStabilityDeposit(
    address?: string,
    overrides?: EthersCallOverrides
  ): Promise<StabilityDeposit> {
    return this._userHit(address, overrides)
      ? this.store.state.stabilityDeposit
      : this._readable.getStabilityDeposit(address, overrides);
  }

  async getBammDeposit(
    address?: string,
    overrides?: EthersCallOverrides
  ): Promise<BammDeposit> {
    return this._userHit(address, overrides)
      ? this.store.state.bammDeposit
      : this._readable.getBammDeposit(address, overrides);
    }

  async getTHUSDInStabilityPool(overrides?: EthersCallOverrides): Promise<Decimal> {
    return this._blockHit(overrides)
      ? this.store.state.thusdInStabilityPool
      : this._readable.getTHUSDInStabilityPool(overrides);
  }

  async getPCVBalance(overrides?: EthersCallOverrides): Promise<Decimal> {
    return this._blockHit(overrides)
      ? this.store.state.pcvBalance
      : this._readable.getPCVBalance(overrides);
  }

  async getTHUSDBalance(address?: string, overrides?: EthersCallOverrides): Promise<Decimal> {
    return this._userHit(address, overrides)
      ? this.store.state.thusdBalance
      : this._readable.getTHUSDBalance(address, overrides);
  }

  async getErc20TokenBalance(address?: string, overrides?: EthersCallOverrides): Promise<Decimal> {
    return this._userHit(address, overrides)
      ? this.store.state.erc20TokenBalance
      : this._readable.getErc20TokenBalance(address, overrides);
  }

  async getErc20TokenAllowance(address?: string, overrides?: EthersCallOverrides): Promise<Decimal> {
    return this._userHit(address, overrides)
      ? this.store.state.erc20TokenAllowance
      : this._readable.getErc20TokenAllowance(address, overrides);
  }

  async isStabilityPools(overrides?: EthersCallOverrides): Promise<boolean> {
    return this._blockHit(overrides)
      ? this.store.state.isStabilityPools
      : this._readable.isStabilityPools(overrides);
  }

  async isBorrowerOperations(overrides?: EthersCallOverrides): Promise<boolean> {
    return this._blockHit(overrides)
      ? this.store.state.isBorrowerOperations
      : this._readable.isBorrowerOperations(overrides);
  }

  async isTroveManager(overrides?: EthersCallOverrides): Promise<boolean> {
    return this._blockHit(overrides)
      ? this.store.state.isTroveManager
      : this._readable.isTroveManager(overrides);
  }

  async checkMintList(overrides?: EthersCallOverrides): Promise<boolean> {
    return this._blockHit(overrides)
      ? this.store.state.mintList
      : this._readable.checkMintList(overrides);
  }

  async getCollateralSurplusBalance(
    address?: string,
    overrides?: EthersCallOverrides
  ): Promise<Decimal> {
    return this._userHit(address, overrides)
      ? this.store.state.collateralSurplusBalance
      : this._readable.getCollateralSurplusBalance(address, overrides);
  }

  async _getBlockTimestamp(blockTag?: BlockTag): Promise<number> {
    return this._blockHit({ blockTag })
      ? this.store.state.blockTimestamp
      : this._readable._getBlockTimestamp(blockTag);
  }

  async _getFeesFactory(
    overrides?: EthersCallOverrides
  ): Promise<(blockTimestamp: number, recoveryMode: boolean) => Fees> {
    return this._blockHit(overrides)
      ? this.store.state._feesFactory
      : this._readable._getFeesFactory(overrides);
  }

  async getFees(overrides?: EthersCallOverrides): Promise<Fees> {
    return this._blockHit(overrides) ? this.store.state.fees : this._readable.getFees(overrides);
  }

  getTroves(
    params: TroveListingParams & { beforeRedistribution: true },
    overrides?: EthersCallOverrides
  ): Promise<TroveWithPendingRedistribution[]>;

  getTroves(params: TroveListingParams, overrides?: EthersCallOverrides): Promise<UserTrove[]>;

  getTroves(params: TroveListingParams, overrides?: EthersCallOverrides): Promise<UserTrove[]> {
    return this._readable.getTroves(params, overrides);
  }

  _getActivePool(): Promise<Trove> {
    throw new Error("Method not implemented.");
  }

  _getDefaultPool(): Promise<Trove> {
    throw new Error("Method not implemented.");
  }

  async getBammAllowance(overrides?: EthersCallOverrides): Promise<Decimal> {
    return this._blockHit(overrides)
      ? this.store.state.bammAllowance
      : this._readable.getBammAllowance(overrides);
  }
}
