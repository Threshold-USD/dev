// SPDX-License-Identifier: MIT

pragma solidity ^0.8.10;

import "./BAMM.sol";


contract BLens {
    struct UserInfo {
        uint bammUserBalance;
        uint bammTotalSupply;

        uint thusdUserBalance;
        uint collateralUserBalance;

        uint thusdTotal;
        uint collateralTotal;
    }

    function getUserInfo(address user, BAMM bamm) external view returns(UserInfo memory info) {
        info.bammUserBalance = bamm.balanceOf(user);
        info.bammTotalSupply = bamm.totalSupply();
        
        StabilityPool sp = bamm.SP();
        info.thusdTotal = sp.getCompoundedTHUSDDeposit(address(bamm));
        info.collateralTotal = bamm.getCollateralBalance();

        info.thusdUserBalance = info.thusdTotal * info.bammUserBalance / info.bammTotalSupply;
        info.collateralUserBalance = info.collateralTotal * info.bammUserBalance / info.bammTotalSupply;        
    }
}
