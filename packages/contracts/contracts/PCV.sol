// SPDX-License-Identifier: MIT

pragma solidity ^0.8.10;

import "./Dependencies/BaseMath.sol";
import "./Dependencies/Ownable.sol";
import "./Dependencies/CheckContract.sol";
import "./Dependencies/console.sol";
import "./Interfaces/IPCV.sol";
import "./Dependencies/LiquityMath.sol";
import "./Interfaces/ITHUSDToken.sol";
import "./Dependencies/IERC20.sol";

contract PCV is IPCV, Ownable, CheckContract, BaseMath {

    // --- Data ---
    string constant public NAME = "PCV";

    mapping( address => uint) public stakes;

    uint256 public F_ETH;  // Running sum of ETH fees
    uint256 public F_THUSD; // Running sum of THUSD fees

    ITHUSDToken public thusdToken;

    address public troveManagerAddress;
    address public borrowerOperationsAddress;
    address public activePoolAddress;

    // --- Functions ---

    function setAddresses
    (
        address _thusdTokenAddress,
        address _troveManagerAddress,
        address _borrowerOperationsAddress,
        address _activePoolAddress
    )
        external
        onlyOwner
        override
    {
        checkContract(_thusdTokenAddress);
        checkContract(_troveManagerAddress);
        checkContract(_borrowerOperationsAddress);
        checkContract(_activePoolAddress);

        thusdToken = ITHUSDToken(_thusdTokenAddress);
        troveManagerAddress = _troveManagerAddress;
        borrowerOperationsAddress = _borrowerOperationsAddress;
        activePoolAddress = _activePoolAddress;

        emit THUSDTokenAddressSet(_thusdTokenAddress);
        emit TroveManagerAddressSet(_troveManagerAddress);
        emit BorrowerOperationsAddressSet(_borrowerOperationsAddress);
        emit ActivePoolAddressSet(_activePoolAddress);

        _renounceOwnership();
    }

    // --- Reward-per-unit-staked increase functions. Called by Liquity core contracts ---

    function increaseF_ETH(uint256 _ETHFee) external override {
        _requireCallerIsTroveManager();

        F_ETH += _ETHFee;
        emit F_ETHUpdated(F_ETH);
    }

    function increaseF_THUSD(uint256 _THUSDFee) external override {
        _requireCallerIsBorrowerOperations();

        F_THUSD += _THUSDFee;
        emit F_THUSDUpdated(F_THUSD);
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
