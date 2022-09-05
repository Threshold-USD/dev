// SPDX-License-Identifier: MIT

pragma solidity ^0.8.10;

import "../DefaultPool.sol";

contract DefaultPoolTester is DefaultPool {

    function unprotectedIncreaseTHUSDDebt(uint256 _amount) external {
        THUSDDebt  += _amount;
    }

    function unprotectedPayable() external payable {
        collateral += msg.value;
    }
}
