// SPDX-License-Identifier: MIT

pragma solidity ^0.8.10;

import "./Dependencies/BaseMath.sol";
import "./Dependencies/SafeMath.sol";
import "./Dependencies/Ownable.sol";
import "./Dependencies/CheckContract.sol";
import "./Dependencies/console.sol";
import "./Interfaces/IPCV.sol";
import "./Dependencies/LiquityMath.sol";
import "./Interfaces/ILUSDToken.sol";
import "./Dependencies/IERC20.sol";

contract PCV is IPCV, Ownable, CheckContract, BaseMath {
    using SafeMath for uint;

    // --- Data ---
    string constant public NAME = "PCV";

    mapping( address => uint) public stakes;

    uint public F_ETH;  // Running sum of ETH fees
    uint public F_LUSD; // Running sum of LUSD fees

    ILUSDToken public lusdToken;

    address public troveManagerAddress;
    address public borrowerOperationsAddress;
    address public activePoolAddress;

    // --- Functions ---

    function setAddresses
    (
        address _lusdTokenAddress,
        address _troveManagerAddress,
        address _borrowerOperationsAddress,
        address _activePoolAddress
    )
        external
        onlyOwner
        override
    {
        checkContract(_lusdTokenAddress);
        checkContract(_troveManagerAddress);
        checkContract(_borrowerOperationsAddress);
        checkContract(_activePoolAddress);

        lusdToken = ILUSDToken(_lusdTokenAddress);
        troveManagerAddress = _troveManagerAddress;
        borrowerOperationsAddress = _borrowerOperationsAddress;
        activePoolAddress = _activePoolAddress;

        emit LUSDTokenAddressSet(_lusdTokenAddress);
        emit TroveManagerAddressSet(_troveManagerAddress);
        emit BorrowerOperationsAddressSet(_borrowerOperationsAddress);
        emit ActivePoolAddressSet(_activePoolAddress);

        _renounceOwnership();
    }

    // --- Reward-per-unit-staked increase functions. Called by Liquity core contracts ---

    function increaseF_ETH(uint _ETHFee) external override {
        _requireCallerIsTroveManager();

        F_ETH = F_ETH.add(_ETHFee);
        emit F_ETHUpdated(F_ETH);
    }

    function increaseF_LUSD(uint _LUSDFee) external override {
        _requireCallerIsBorrowerOperations();

        F_LUSD = F_LUSD.add(_LUSDFee);
        emit F_LUSDUpdated(F_LUSD);
    }

    // --- 'require' functions ---

    function _requireCallerIsTroveManager() internal view {
        require(msg.sender == troveManagerAddress, "PCV: caller is not TroveM");
    }

    function _requireCallerIsBorrowerOperations() internal view {
        require(msg.sender == borrowerOperationsAddress, "PCV: caller is not BorrowerOps");
    }

     function _requireCallerIsActivePool() internal view {
        require(msg.sender == activePoolAddress, "PCV: caller is not ActivePool");
    }

    receive() external payable {
        _requireCallerIsActivePool();
    }
}
