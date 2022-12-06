import { AddressZero } from "@ethersproject/constants";

import {
  BlockTagObject,
  IteratedCollateralContractStore,
  StorePromises,
  CollateralContract,
  Decimal,
  FeeFactoryFunction,
  LiquityStoreState,
  LiquityStoreBaseState,
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
  _feesFactory: IteratedCollateralContractStore[] | FeeFactoryFunction
}

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

  private _getBorrowersOperationsContractsArray(): Promise<CollateralContract[]> {
    return this._getMintList().then((result) => {
      return Object.values(result).map((contract) => contract)
    });
  }

  private async _getRiskiestTroveBeforeRedistribution(
    contract: CollateralContract,
    overrides?: EthersCallOverrides
  ): Promise<TroveWithPendingRedistribution | IteratedCollateralContractStore[]> {
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

  private async _iterateMintList (
      { blockTag }: BlockTagObject,
      storeName: string,
      readableFunction?: (contract: CollateralContract, { blockTag }: BlockTagObject) => StorePromises,
      readableUserFunction?: (contract: CollateralContract, userAddress: string | undefined, { blockTag }: BlockTagObject) => StorePromises,
      userAddress?: string 
    ): Promise<IteratedCollateralContractStore[]> {
    const collateralContractsArray = await this._getBorrowersOperationsContractsArray();
    const iteratedResult = collateralContractsArray.map(async contract => {
      let fnResult = undefined;
      if (readableUserFunction) {
        fnResult = readableUserFunction(contract, userAddress && userAddress, { blockTag })
      }
      if (readableFunction) {
        fnResult = readableFunction(contract, { blockTag })
      }
      return {[contract.name]: contract, [storeName]: fnResult ? fnResult : Decimal.ZERO}     
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
      ...baseState
    } = await promiseAllValues({
      blockTimestamp: this._readable._getBlockTimestamp(blockTag),
      _feesFactory: this._iterateMintList({ blockTag }, '_feesFactory', this._readable._getFeesFactory),
      price: this._iterateMintList({ blockTag }, 'price', this._readable.getPrice),
      numberOfTroves: this._iterateMintList({ blockTag }, 'numberOfTroves', this._readable.getNumberOfTroves),
      totalRedistributed: this._iterateMintList({ blockTag }, 'totalRedistributed', this._readable.getTotalRedistributed),
      total: this._iterateMintList({ blockTag }, 'total', this._readable.getTotal),
      thusdInStabilityPool: this._iterateMintList({ blockTag }, 'thusdInStabilityPool', this._readable.getTHUSDInStabilityPool),
      pcvBalance: this._iterateMintList({ blockTag }, 'pcvBalance', this._readable.getPCVBalance),
      _riskiestTroveBeforeRedistribution: this._iterateMintList({ blockTag }, '_riskiestTroveBeforeRedistribution', this._getRiskiestTroveBeforeRedistribution),
      ...(borrowerOperations    
        ? {isAllowedToMint: this._readable.checkMintList(borrowerOperations.address ,{ blockTag })}
        : {isAllowedToMint: false}),
      mintList: this._getMintList({ blockTag }),
      ...(userAddress
        ? {
            accountBalance: this._provider.getBalance(userAddress, blockTag).then(decimalify),
            thusdBalance: this._readable.getTHUSDBalance(userAddress, { blockTag }),
            erc20TokenBalance: this._iterateMintList({ blockTag }, 'erc20TokenBalance', undefined, this._readable.getErc20TokenBalance, userAddress),
            erc20TokenAllowance: this._iterateMintList({ blockTag }, 'erc20TokenAllowance', undefined,  this._readable.getErc20TokenAllowance, userAddress),
            collateralSurplusBalance: this._readable.getCollateralSurplusBalance(userAddress, {
              blockTag
            }),
            troveBeforeRedistribution: this._iterateMintList({ blockTag }, 'troveBeforeRedistribution', undefined, this._readable.getTroveBeforeRedistribution, userAddress), 
            stabilityDeposit: this._readable.getStabilityDeposit(userAddress, { blockTag })
          }
        : {
            accountBalance: this._iterateMintList({ blockTag }, 'accountBalance'),
            thusdBalance: this._iterateMintList({ blockTag }, 'thusdBalance'),
            erc20TokenBalance: this._iterateMintList({ blockTag }, 'erc20TokenBalance'),
            erc20TokenAllowance: this._iterateMintList({ blockTag }, 'erc20TokenAllowance'),
            collateralSurplusBalance: this._iterateMintList({ blockTag }, 'collateralSurplusBalance'),
            troveBeforeRedistribution: this._getBorrowersOperationsContractsArray().then((collateralContractArray) => {
              return collateralContractArray.map((collateralContract) => {
                return {
                  [collateralContract.name]: collateralContract,
                  troveBeforeRedistribution:
                  new TroveWithPendingRedistribution(
                  AddressZero,
                  "nonExistent",
                  collateralContract.name
                )}
              })
            }),
            stabilityDeposit: this._getBorrowersOperationsContractsArray().then((collateralContractArray) => {
              return collateralContractArray.map((collateralContract) => {
                return {
                  [collateralContract.name]: collateralContract,
                  troveBeforeRedistribution:
                  new StabilityDeposit(
                    collateralContract.name,
                    Decimal.ZERO,
                    Decimal.ZERO,
                    Decimal.ZERO
                )}
              })
            }),
          })
    });

    return [
      {
        ...baseState,
        _feesInNormalMode: this._readable._getFeesFactory(undefined, {blockTag})
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
