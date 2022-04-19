// SPDX-License-Identifier: MIT

pragma solidity 0.8.10;

import "./IPool.sol";


interface IActivePool is IPool {
    // --- Events ---
    event BorrowerOperationsAddressChanged(address _newBorrowerOperationsAddress);
    event TroveManagerAddressChanged(address _newTroveManagerAddress);
    event ActivePoolLUSDDebtUpdated(uint _LUSDDebt);
    event ActivePoolCollateralBalanceUpdated(uint _collateral);

    // --- Functions ---
    function sendCollateral(address _account, uint _amount) external;
}
