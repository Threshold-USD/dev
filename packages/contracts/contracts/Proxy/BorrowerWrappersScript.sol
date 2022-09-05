// SPDX-License-Identifier: MIT

pragma solidity ^0.8.10;

import "../Dependencies/LiquityMath.sol";
import "../Dependencies/IERC20.sol";
import "../Interfaces/IBorrowerOperations.sol";
import "../Interfaces/ITroveManager.sol";
import "../Interfaces/IStabilityPool.sol";
import "../Interfaces/IPriceFeed.sol";
import "../Interfaces/IPCV.sol";
import "./BorrowerOperationsScript.sol";
import "./ETHTransferScript.sol";
import "./ERC20TransferScript.sol";
import "./PCVScript.sol";
import "../Dependencies/console.sol";

contract BorrowerWrappersScript is BorrowerOperationsScript, ETHTransferScript, ERC20TransferScript, PCVScript {

    string constant public NAME = "BorrowerWrappersScript";

    ITroveManager immutable troveManager;
    IStabilityPool immutable stabilityPool;
    IPriceFeed immutable priceFeed;
    IERC20 immutable thusdToken;
    IPCV immutable pcv;

    constructor(
        address _borrowerOperationsAddress,
        address _troveManagerAddress,
        address _pcvAddress
    )
        BorrowerOperationsScript(IBorrowerOperations(_borrowerOperationsAddress))
        PCVScript(_pcvAddress)
    {
        checkContract(_troveManagerAddress);
        ITroveManager troveManagerCached = ITroveManager(_troveManagerAddress);
        troveManager = troveManagerCached;

        IStabilityPool stabilityPoolCached = troveManagerCached.stabilityPool();
        checkContract(address(stabilityPoolCached));
        stabilityPool = stabilityPoolCached;

        IPriceFeed priceFeedCached = troveManagerCached.priceFeed();
        checkContract(address(priceFeedCached));
        priceFeed = priceFeedCached;

        address thusdTokenCached = address(troveManagerCached.thusdToken());
        checkContract(thusdTokenCached);
        thusdToken = IERC20(thusdTokenCached);

        IPCV pcvCached = troveManagerCached.pcv();
        require(_pcvAddress == address(pcvCached), "BorrowerWrappersScript: Wrong PCV address");
        pcv = pcvCached;
    }

    function claimCollateralAndOpenTrove(uint _maxFee, uint _THUSDAmount, address _upperHint, address _lowerHint) external payable {
        uint balanceBefore = address(this).balance;

        // Claim collateral
        borrowerOperations.claimCollateral();

        uint balanceAfter = address(this).balance;

        // already checked in CollSurplusPool
        assert(balanceAfter > balanceBefore);

        uint totalCollateral = balanceAfter - balanceBefore + msg.value;

        // Open trove with obtained collateral, plus collateral sent by user
        // if (borrowerOperations.collateralAddress() == address(0)) {
        //   borrowerOperations.openTrove{ value: totalCollateral }(_maxFee, _THUSDAmount, 0, _upperHint, _lowerHint);
        // } else {
          borrowerOperations.openTrove{ value: 0 }(_maxFee, _THUSDAmount, totalCollateral, _upperHint, _lowerHint);
        // }
    }

    function claimSPRewardsAndRecycle(uint _maxFee, address _upperHint, address _lowerHint) external {
        uint collBalanceBefore = address(this).balance;

        // Claim rewards
        stabilityPool.withdrawFromSP(0);

        uint collBalanceAfter = address(this).balance;
        uint claimedCollateral = collBalanceAfter - collBalanceBefore;

        // Add claimed ETH to trove, get more THUSD and stake it into the Stability Pool
        if (claimedCollateral > 0) {
            _requireUserHasTrove(address(this));
            uint THUSDAmount = _getNetTHUSDAmount(claimedCollateral);
            // if (borrowerOperations.collateralAddress() == address(0)) {
            //   borrowerOperations.adjustTrove{ value: claimedCollateral }(_maxFee, 0, THUSDAmount, true, 0, _upperHint, _lowerHint);
            // } else {
              borrowerOperations.adjustTrove{ value: 0 }(_maxFee, 0, THUSDAmount, true, claimedCollateral, _upperHint, _lowerHint);
            // }
            // Provide withdrawn THUSD to Stability Pool
            if (THUSDAmount > 0) {
                stabilityPool.provideToSP(THUSDAmount);
            }
        }
    }

    function claimStakingGainsAndRecycle(uint _maxFee, address _upperHint, address _lowerHint) external {
        uint collBalanceBefore = address(this).balance;
        uint thusdBalanceBefore = thusdToken.balanceOf(address(this));

        uint gainedCollateral = address(this).balance - collBalanceBefore; // stack too deep issues :'(
        uint gainedTHUSD = thusdToken.balanceOf(address(this)) - thusdBalanceBefore;

        uint netTHUSDAmount;
        // Top up trove and get more THUSD, keeping ICR constant
        if (gainedCollateral > 0) {
            _requireUserHasTrove(address(this));
            netTHUSDAmount = _getNetTHUSDAmount(gainedCollateral);
            // if (borrowerOperations.collateralAddress() == address(0)) {
            //   borrowerOperations.adjustTrove{ value: gainedCollateral }(_maxFee, 0, netTHUSDAmount, true, 0, _upperHint, _lowerHint);
            // } else {
              borrowerOperations.adjustTrove{ value: 0 }(_maxFee, 0, netTHUSDAmount, true, gainedCollateral, _upperHint, _lowerHint);
            // }
        }

        uint totalTHUSD = gainedTHUSD + netTHUSDAmount;
        if (totalTHUSD > 0) {
            stabilityPool.provideToSP(totalTHUSD);
        }

    }

    function _getNetTHUSDAmount(uint _collateral) internal returns (uint) {
        uint price = priceFeed.fetchPrice();
        uint ICR = troveManager.getCurrentICR(address(this), price);

        uint THUSDAmount = _collateral * price / ICR;
        uint borrowingRate = troveManager.getBorrowingRateWithDecay();
        uint netDebt = THUSDAmount * LiquityMath.DECIMAL_PRECISION / (LiquityMath.DECIMAL_PRECISION + borrowingRate);

        return netDebt;
    }

    function _requireUserHasTrove(address _depositor) internal view {
        require(troveManager.getTroveStatus(_depositor) == 1, "BorrowerWrappersScript: caller must have an active trove");
    }
}
