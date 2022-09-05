// SPDX-License-Identifier: MIT

pragma solidity ^0.8.10;

import "../StabilityPool.sol";

contract StabilityPoolTester is StabilityPool {

    function unprotectedPayable() external payable {
        collateral += msg.value;
    }

    function setCurrentScale(uint128 _currentScale) external {
        currentScale = _currentScale;
    }

    function setTotalDeposits(uint256 _totalTHUSDDeposits) external {
        totalTHUSDDeposits = _totalTHUSDDeposits;
    }
}
