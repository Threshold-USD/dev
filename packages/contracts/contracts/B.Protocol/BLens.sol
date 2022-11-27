// SPDX-License-Identifier: MIT

pragma solidity ^0.8.10;

import "./BAMM.sol";


contract BLens {
    struct UserInfo {
        uint bammUserBalance;
        uint bammTotalSupply;

        uint thusdUserBalance;
        uint ethUserBalance;

        uint thusdTotal;
        uint ethTotal;
    }

    function getUserInfo(address user, BAMM bamm) external view returns(UserInfo memory info) {
        info.bammUserBalance = bamm.balanceOf(user);
        info.bammTotalSupply = bamm.totalSupply();
        
        StabilityPool sp = bamm.SP();
        info.thusdTotal = sp.getCompoundedTHUSDDeposit(address(bamm));
        info.ethTotal = sp.getDepositorCollateralGain(address(bamm)) + address(bamm).balance;

        info.thusdUserBalance = info.thusdTotal * info.bammUserBalance / info.bammTotalSupply;
        info.ethUserBalance = info.ethTotal * info.bammUserBalance / info.bammTotalSupply;        
    }
}
