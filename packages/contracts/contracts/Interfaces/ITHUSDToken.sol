// SPDX-License-Identifier: MIT

pragma solidity ^0.8.17;

import "../Dependencies/IERC20.sol";
import "../Dependencies/IERC2612.sol";

interface ITHUSDToken is IERC20, IERC2612 {

    // --- Events ---

    event TroveManagerAddressAdded(address _troveManagerAddress);
    event StabilityPoolAddressAdded(address _newStabilityPoolAddress);
    event BorrowerOperationsAddressAdded(address _newBorrowerOperationsAddress);

    event THUSDTokenBalanceUpdated(address _user, uint256 _amount);

    // --- Functions ---
    function mintList(address contractAddress) external view returns (bool);
    function burnList(address contractAddress) external view returns (bool);

    function mint(address _account, uint256 _amount) external;

    function burn(address _account, uint256 _amount) external;
}
