import { AddressZero } from "@ethersproject/constants";

import {
  CollateralContract,
  Decimal,
  Fees,
  LiquityStoreState,
  LiquityStoreBaseState,
  Trove,
  TroveWithPendingRedistribution,
  StabilityDeposit,
  LiquityStore,
  MintList
} from "@liquity/lib-base";

import { decimalify, promiseAllValues } from "./_utils";
import { ReadableEthersLiquity } from "./ReadableEthersLiquity";
import { EthersLiquityConnection, _getProvider, _getContracts } from "./EthersLiquityConnection";
import { EthersCallOverrides, EthersProvider } from "./types";

import {
  _LiquityContracts,
} from "./contracts";

type feesFactory = (blockTimestamp: number, recoveryMode: boolean) => Fees

type blockTagObject = { blockTag: number | undefined };

type StorePromises = Promise<number | Decimal | Trove | TroveWithPendingRedistribution | feesFactory>

/**
 * Extra state added to {@link @liquity/lib-base#LiquityStoreState} by
 * {@link BlockPolledLiquityStore}.
 *
 * @public
 */
export interface BlockPolledLiquityStoreExtraState {
  
  /**
   * Number of block that the store state was fetched from.
   *
   * @remarks
   * May be undefined when the store state is fetched for the first time.
   */
  blockTag?: number;

  /**
   * Timestamp of latest block (number of seconds since epoch).
   */
   blockTimestamp: number;


  /** @internal */
  _feesFactory: (blockTimestamp: number, recoveryMode: boolean) => Fees;
}

export type IteratedCollateralContractStore = Record<string, CollateralContract | StorePromises>


/**
 * The type of {@link BlockPolledLiquityStore}'s
 * {@link @liquity/lib-base#LiquityStore.state | state}.
 *
 * @public
 */
export type BlockPolledLiquityStoreState = LiquityStoreState<BlockPolledLiquityStoreExtraState>;

/**
 * Ethers-based {@link @liquity/lib-base#LiquityStore} that updates state whenever there's a new
 * block.
 *
 * @public
 */
export class BlockPolledLiquityStore extends LiquityStore<BlockPolledLiquityStoreExtraState> {
  readonly connection: EthersLiquityConnection;

  private readonly _readable: ReadableEthersLiquity;
  private readonly _provider: EthersProvider;

  constructor(readable: ReadableEthersLiquity) {
    super();

    this.connection = readable.connection;
    this._readable = readable;
    this._provider = _getProvider(readable.connection);
  }

  private _getBorrowerOperationsContracts(): Promise<MintList> {
    const blockStore = new BlockPolledLiquityStore(this._readable);
    const mintList = blockStore._getMintList();
    return mintList;
  }

  private _getBorrowersOperationsContractsArray(): Promise<CollateralContract[]> {
    return this._getBorrowerOperationsContracts().then((result) => {
      return Object.values(result).map((contract) => contract)
    });
  }

  private async _getRiskiestTroveBeforeRedistribution(
    contract: CollateralContract,
    overrides?: EthersCallOverrides
  ): Promise<TroveWithPendingRedistribution> {
    const riskiestTroves = await this._readable.getTroves(
      contract, { first: 1, sortedBy: "ascendingCollateralRatio", beforeRedistribution: true },
      overrides
    );

    if (riskiestTroves.length === 0) {
      return new TroveWithPendingRedistribution(AddressZero, "nonExistent", contract.name);
    }

    return riskiestTroves[0];
  }

  private async _getMintList(
    overrides?: EthersCallOverrides
  ): Promise<MintList> {
    const contracts: _LiquityContracts = _getContracts(this.connection);
    let mintList = {};

    for (const contract in contracts) {
      const currentContract = contracts[contract as keyof _LiquityContracts];
      await this._readable.checkMintList(currentContract.address, overrides).then(
        (response)=> {
          if (response === true) {
            mintList = {
              ...mintList, 
              [contract]: {
                name: contract,
                collateralAddress: currentContract.address, 
                collateralSymbol: "TST", 
                usersBalance: 100
              }
            };
          }
        });
    }
    return mintList;
  }

  private async _iterateOverCollateralContracts (
      fn: (contract?: CollateralContract | undefined, { blockTag }?: blockTagObject) => StorePromises, 
      { blockTag }: blockTagObject
    ): Promise<IteratedCollateralContractStore[]>  {
    const collateralContractsArray = await this._getBorrowersOperationsContractsArray();
    const iteratedResult = collateralContractsArray.map(async contract => {
      const fnResult = fn(contract, { blockTag })
      return {[contract.name]: contract, [fn.name]: fnResult}
    })
    return Promise.all(iteratedResult);
  }

  private async _get(
    blockTag?: number
  ): Promise<[baseState: LiquityStoreBaseState, extraState: BlockPolledLiquityStoreExtraState]> {
    const { userAddress } = this.connection;
    const borrowerOperations  = await this._getBorrowersOperationsContractsArray()

    const {
      blockTimestamp,
      _feesFactory,
      _getFeesFactory,
      ...baseState
    } = await promiseAllValues({
      blockTimestamp: this._readable._getBlockTimestamp(blockTag),
      _feesFactory: this._iterateOverCollateralContracts(this._readable._getFeesFactory, { blockTag }),
      _getFeesFactory: this._readable._getFeesFactory,
      price: this._readable.getPrice({ blockTag }),
      numberOfTroves: this._readable.getNumberOfTroves({ blockTag }),
      totalRedistributed: this._readable.getTotalRedistributed({ blockTag }),
      total: this._readable.getTotal({ blockTag }),
      thusdInStabilityPool: this._readable.getTHUSDInStabilityPool({ blockTag }),
      pcvBalance: this._readable.getPCVBalance({ blockTag }),
      _riskiestTroveBeforeRedistribution: this._getRiskiestTroveBeforeRedistribution({ blockTag }),
      ...(borrowerOperations    
        ? {isAllowedToMint: this._readable.checkMintList(borrowerOperations.address ,{ blockTag })}
        : {isAllowedToMint: false}),
      mintList: this._getMintList({ blockTag }),
      ...(userAddress
        ? {
            accountBalance: this._provider.getBalance(userAddress, blockTag).then(decimalify),
            thusdBalance: this._readable.getTHUSDBalance(userAddress, { blockTag }),
            erc20TokenBalance: this._readable.getErc20TokenBalance(userAddress, { blockTag }),
            erc20TokenAllowance: this._readable.getErc20TokenAllowance(userAddress, { blockTag }),
            collateralSurplusBalance: this._readable.getCollateralSurplusBalance(userAddress, {
              blockTag
            }),
            troveBeforeRedistribution: this._readable.getTroveBeforeRedistribution(userAddress, {
              blockTag
            }),
            stabilityDeposit: this._readable.getStabilityDeposit(userAddress, { blockTag })
          }
        : {
            accountBalance: Decimal.ZERO,
            thusdBalance: Decimal.ZERO,
            erc20TokenBalance: Decimal.ZERO,
            erc20TokenAllowance: Decimal.ZERO,
            collateralSurplusBalance: Decimal.ZERO,
            troveBeforeRedistribution: new TroveWithPendingRedistribution(
              AddressZero,
              "nonExistent"
            ),
            stabilityDeposit: new StabilityDeposit(
              Decimal.ZERO,
              Decimal.ZERO,
              Decimal.ZERO
            )
          })
    });
    const normalFee = await this._readable._getFeesFactory({ blockTag })

    return [
      {
        ...baseState,
        _feesInNormalMode: normalFee(blockTimestamp, false),
      },
      {
        blockTag,
        blockTimestamp,
        _feesFactory
      }
    ];
  }

  /** @internal @override */
  protected _doStart(): () => void {
    this._get().then(state => {
      if (!this._loaded) {
        this._load(...state);
      }
    });

    const blockListener = async (blockTag: number) => {
      const state = await this._get(blockTag);

      if (this._loaded) {
        this._update(...state);
      } else {
        this._load(...state);
      }
    };

    this._provider.on("block", blockListener);

    return () => {
      this._provider.off("block", blockListener);
    };
  }

  /** @internal @override */
  protected _reduceExtra(
    oldState: BlockPolledLiquityStoreExtraState,
    stateUpdate: Partial<BlockPolledLiquityStoreExtraState>
  ): BlockPolledLiquityStoreExtraState {
    return {
      blockTag: stateUpdate.blockTag ?? oldState.blockTag,
      blockTimestamp: stateUpdate.blockTimestamp ?? oldState.blockTimestamp,
      _feesFactory: stateUpdate._feesFactory ?? oldState._feesFactory
    };
  }
}
