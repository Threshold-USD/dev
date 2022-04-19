// SPDX-License-Identifier: MIT

pragma solidity 0.8.10;

import "./IPool.sol";


interface IDefaultPool is IPool {
    // --- Events ---
    event TroveManagerAddressChanged(address _newTroveManagerAddress);
    event DefaultPoolLUSDDebtUpdated(uint _LUSDDebt);
    event DefaultPoolCollateralBalanceUpdated(uint _collateral);

    // --- Functions ---
    function sendCollateralToActivePool(uint _amount) external;
}
