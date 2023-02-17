// SPDX-License-Identifier: MIT

pragma solidity ^0.8.17;

import "../TroveManager.sol";
import "../BorrowerOperations.sol";
import "../StabilityPool.sol";
import "../THUSDToken.sol";

contract EchidnaProxy {
    TroveManager troveManager;
    BorrowerOperations borrowerOperations;
    StabilityPool stabilityPool;
    THUSDToken thusdToken;

    constructor(
        TroveManager _troveManager,
        BorrowerOperations _borrowerOperations,
        StabilityPool _stabilityPool,
        THUSDToken _thusdToken
    ) {
        troveManager = _troveManager;
        borrowerOperations = _borrowerOperations;
        stabilityPool = _stabilityPool;
        thusdToken = _thusdToken;
    }

    receive() external payable {
        // do nothing
    }

    // TroveManager

    function liquidatePrx(address _user) external {
        troveManager.liquidate(_user);
    }

    function liquidateTrovesPrx(uint256 _n) external {
        troveManager.liquidateTroves(_n);
    }

    function batchLiquidateTrovesPrx(address[] calldata _troveArray) external {
        troveManager.batchLiquidateTroves(_troveArray);
    }

    function redeemCollateralPrx(
        uint256 _THUSDAmount,
        address _firstRedemptionHint,
        address _upperPartialRedemptionHint,
        address _lowerPartialRedemptionHint,
        uint256 _partialRedemptionHintNICR,
        uint256 _maxIterations,
        uint256 _maxFee
    ) external {
        troveManager.redeemCollateral(_THUSDAmount, _firstRedemptionHint, _upperPartialRedemptionHint, _lowerPartialRedemptionHint, _partialRedemptionHintNICR, _maxIterations, _maxFee);
    }

    // Borrower Operations
    function openTrovePrx(uint256 _collateral, uint256 _THUSDAmount, address _upperHint, address _lowerHint, uint256 _maxFee) external payable {
        if (borrowerOperations.collateralAddress() == address(0)) {
          borrowerOperations.openTrove{value: _collateral}(_maxFee, _THUSDAmount, 0, _upperHint, _lowerHint);
        } else {
          borrowerOperations.openTrove{value: 0}(_maxFee, _THUSDAmount, _collateral, _upperHint, _lowerHint);
        }
    }

    function addCollPrx(uint256 _collateral, address _upperHint, address _lowerHint) external payable {
        if (borrowerOperations.collateralAddress() == address(0)) {
            borrowerOperations.addColl{value: _collateral}(0, _upperHint, _lowerHint);
        } else {
            borrowerOperations.addColl{value: 0}(_collateral, _upperHint, _lowerHint);
        }
    }

    function withdrawCollPrx(uint256 _amount, address _upperHint, address _lowerHint) external {
        borrowerOperations.withdrawColl(_amount, _upperHint, _lowerHint);
    }

    function withdrawTHUSDPrx(uint256 _amount, address _upperHint, address _lowerHint, uint256 _maxFee) external {
        borrowerOperations.withdrawTHUSD(_maxFee, _amount, _upperHint, _lowerHint);
    }

    function repayTHUSDPrx(uint256 _amount, address _upperHint, address _lowerHint) external {
        borrowerOperations.repayTHUSD(_amount, _upperHint, _lowerHint);
    }

    function closeTrovePrx() external {
        borrowerOperations.closeTrove();
    }

    function adjustTrovePrx(uint256 _collateral, uint256 _collWithdrawal, uint256 _debtChange, bool _isDebtIncrease, address _upperHint, address _lowerHint, uint256 _maxFee) external payable {
        if (borrowerOperations.collateralAddress() == address(0)) {
          borrowerOperations.adjustTrove{value: _collateral}(_maxFee, _collWithdrawal, _debtChange, _isDebtIncrease, 0, _upperHint, _lowerHint);
        } else {
          borrowerOperations.adjustTrove{value: 0}(_maxFee, _collWithdrawal, _debtChange, _isDebtIncrease, _collateral, _upperHint, _lowerHint);
        }
    }

    // Pool Manager
    function provideToSPPrx(uint256 _amount) external {
        stabilityPool.provideToSP(_amount);
    }

    function withdrawFromSPPrx(uint256 _amount) external {
        stabilityPool.withdrawFromSP(_amount);
    }

    // THUSD Token

    function transferPrx(address recipient, uint256 amount) external returns (bool) {
        return thusdToken.transfer(recipient, amount);
    }

    function approvePrx(address spender, uint256 amount) external returns (bool) {
        return thusdToken.approve(spender, amount);
    }

    function transferFromPrx(address sender, address recipient, uint256 amount) external returns (bool) {
        return thusdToken.transferFrom(sender, recipient, amount);
    }

    function increaseAllowancePrx(address spender, uint256 addedValue) external returns (bool) {
        return thusdToken.increaseAllowance(spender, addedValue);
    }

    function decreaseAllowancePrx(address spender, uint256 subtractedValue) external returns (bool) {
        return thusdToken.decreaseAllowance(spender, subtractedValue);
    }
}
