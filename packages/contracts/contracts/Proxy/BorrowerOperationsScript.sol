// SPDX-License-Identifier: MIT

pragma solidity ^0.8.10;

import "../Dependencies/CheckContract.sol";
import "../Interfaces/IBorrowerOperations.sol";


contract BorrowerOperationsScript is CheckContract {
    IBorrowerOperations immutable borrowerOperations;

    constructor(IBorrowerOperations _borrowerOperations) {
        checkContract(address(_borrowerOperations));
        borrowerOperations = _borrowerOperations;
    }

    function openTrove(uint _maxFee, uint _LUSDAmount, uint _assetAmount, address _upperHint, address _lowerHint) external payable {
        borrowerOperations.openTrove(_maxFee, _LUSDAmount, _assetAmount, _upperHint, _lowerHint);
    }

    function addColl(uint _assetAmount, address _upperHint, address _lowerHint) external payable {
        borrowerOperations.addColl(_assetAmount, _upperHint, _lowerHint);
    }

    function withdrawColl(uint _amount, address _upperHint, address _lowerHint) external {
        borrowerOperations.withdrawColl(_amount, _upperHint, _lowerHint);
    }

    function withdrawLUSD(uint _maxFee, uint _amount, address _upperHint, address _lowerHint) external {
        borrowerOperations.withdrawLUSD(_maxFee, _amount, _upperHint, _lowerHint);
    }

    function repayLUSD(uint _amount, address _upperHint, address _lowerHint) external {
        borrowerOperations.repayLUSD(_amount, _upperHint, _lowerHint);
    }

    function closeTrove() external {
        borrowerOperations.closeTrove();
    }

    function adjustTrove(uint _maxFee, uint _collWithdrawal, uint _debtChange, bool isDebtIncrease, uint _assetAmount, address _upperHint, address _lowerHint) external payable {
        borrowerOperations.adjustTrove(_maxFee, _collWithdrawal, _debtChange, isDebtIncrease, _assetAmount, _upperHint, _lowerHint);
    }

    function claimCollateral() external {
        borrowerOperations.claimCollateral();
    }
}
