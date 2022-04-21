// SPDX-License-Identifier: MIT

pragma solidity ^0.8.10;

import "./Dependencies/IERC20.sol";
import './Interfaces/IActivePool.sol';
import './Interfaces/ICollSurplusPool.sol';
import './Interfaces/IDefaultPool.sol';
import './Interfaces/IStabilityPool.sol';
import "./Dependencies/SafeMath.sol";
import "./Dependencies/Ownable.sol";
import "./Dependencies/CheckContract.sol";
import "./Dependencies/console.sol";

/*
 * The Active Pool holds the collateral and LUSD debt (but not LUSD tokens) for all active troves.
 *
 * When a trove is liquidated, it's collateral and LUSD debt are transferred from the Active Pool, to either the
 * Stability Pool, the Default Pool, or both, depending on the liquidation conditions.
 *
 */
contract ActivePool is Ownable, CheckContract, IActivePool {
    using SafeMath for uint256;

    string constant public NAME = "ActivePool";

    address public defaultPoolAddress;
    address public borrowerOperationsAddress;
    address public collateralAddress;
    address public collSurplusPoolAddress;
    address public stabilityPoolAddress;
    address public troveManagerAddress;
    uint256 internal collateral;  // deposited collateral tracker
    uint256 internal LUSDDebt;

    // --- Contract setters ---

    function setAddresses(
        address _borrowerOperationsAddress,
        address _troveManagerAddress,
        address _stabilityPoolAddress,
        address _defaultPoolAddress,
        address _collSurplusPoolAddress,
        address _collateralAddress
    )
        external
        onlyOwner
    {
        checkContract(_borrowerOperationsAddress);
        checkContract(_troveManagerAddress);
        checkContract(_stabilityPoolAddress);
        checkContract(_defaultPoolAddress);
        checkContract(_collSurplusPoolAddress);
        checkContract(_collateralAddress);


        borrowerOperationsAddress = _borrowerOperationsAddress;
        troveManagerAddress = _troveManagerAddress;
        stabilityPoolAddress = _stabilityPoolAddress;
        defaultPoolAddress = _defaultPoolAddress;
        collateralAddress = _collateralAddress;
        collSurplusPoolAddress = _collSurplusPoolAddress;

        emit BorrowerOperationsAddressChanged(_borrowerOperationsAddress);
        emit TroveManagerAddressChanged(_troveManagerAddress);
        emit StabilityPoolAddressChanged(_stabilityPoolAddress);
        emit DefaultPoolAddressChanged(_defaultPoolAddress);
        emit CollateralAddressChanged(_collateralAddress);
        emit CollSurplusPoolAddressChanged(_collSurplusPoolAddress);

        _renounceOwnership();
    }

    // --- Getters for public variables. Required by IPool interface ---

    /*
    * Returns the collateral state variable.
    *
    * Not necessarily equal to the the contract's raw collateral balance - collateral can be forcibly sent to contracts.
    */
    function getCollateralBalance() external view override returns (uint) {
        return collateral;
    }

    function getLUSDDebt() external view override returns (uint) {
        return LUSDDebt;
    }

    // --- Pool functionality ---

    function sendCollateral(address _account, uint _amount) external override {
        _requireCallerIsBOorTroveMorSP();
        collateral = collateral.sub(_amount);
        emit ActivePoolCollateralBalanceUpdated(collateral);
        emit CollateralSent(_account, _amount);

        if (collateralAddress == address(0)) {
            (bool success, ) = _account.call{ value: _amount }("");
            require(success, "ActivePool: sending collateral failed");
        } else {
            bool success = IERC20(collateralAddress).transfer(_account, _amount);
            require(success, "ActivePool: sending collateral failed");

            if (_account == defaultPoolAddress) {
                IDefaultPool(_account).updateCollateralBalance(_amount);
            }
            if (_account == collSurplusPoolAddress) {
                ICollSurplusPool(_account).updateCollateralBalance(_amount);
            }
            if (_account == stabilityPoolAddress) {
                IStabilityPool(_account).updateCollateralBalance(_amount);
            }
        }
    }

    function increaseLUSDDebt(uint _amount) external override {
        _requireCallerIsBOorTroveM();
        LUSDDebt  = LUSDDebt.add(_amount);
        emit ActivePoolLUSDDebtUpdated(LUSDDebt);
    }

    function decreaseLUSDDebt(uint _amount) external override {
        _requireCallerIsBOorTroveMorSP();
        LUSDDebt = LUSDDebt.sub(_amount);
        emit ActivePoolLUSDDebtUpdated(LUSDDebt);
    }

    // --- 'require' functions ---

    function _requireCallerIsBorrowerOperationsOrDefaultPool() internal view {
        require(
            msg.sender == borrowerOperationsAddress ||
            msg.sender == defaultPoolAddress,
            "ActivePool: Caller is neither BO nor Default Pool");
    }

    function _requireCallerIsBOorTroveMorSP() internal view {
        require(
            msg.sender == borrowerOperationsAddress ||
            msg.sender == troveManagerAddress ||
            msg.sender == stabilityPoolAddress,
            "ActivePool: Caller is neither BorrowerOperations nor TroveManager nor StabilityPool");
    }

    function _requireCallerIsBOorTroveM() internal view {
        require(
            msg.sender == borrowerOperationsAddress ||
            msg.sender == troveManagerAddress,
            "ActivePool: Caller is neither BorrowerOperations nor TroveManager");
    }

    // When ERC20 token collateral is received this function needs to be called
    function updateCollateralBalance(uint256 _amount) external override {
        _requireCallerIsBorrowerOperationsOrDefaultPool();
		    collateral = collateral.add(_amount);
        emit ActivePoolCollateralBalanceUpdated(collateral);
  	}

    // --- Fallback function ---

    // This executes when the contract recieves ETH
    receive() external payable {
        _requireCallerIsBorrowerOperationsOrDefaultPool();
        collateral = collateral.add(msg.value);
        emit ActivePoolCollateralBalanceUpdated(collateral);
    }
}
