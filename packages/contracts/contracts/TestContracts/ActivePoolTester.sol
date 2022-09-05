// SPDX-License-Identifier: MIT

pragma solidity ^0.8.10;

import "../ActivePool.sol";

contract ActivePoolTester is ActivePool {

    function unprotectedIncreaseTHUSDDebt(uint _amount) external {
        THUSDDebt += _amount;
    }

    function unprotectedPayable() external payable {
        collateral += msg.value;
    }
}
