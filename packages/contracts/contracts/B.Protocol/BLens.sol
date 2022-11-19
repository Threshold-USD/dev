// SPDX-License-Identifier: MIT

pragma solidity ^0.8.10;

import "./BAMM.sol";


contract BLens {
    function divup(uint256 x, uint256 y) internal pure returns (uint256 z) {
        z = (x + (y - 1)) / y;
    }
    uint256 constant WAD  = 10 ** 18;
    function wmul(uint256 x, uint256 y) public pure returns (uint256 z) {
        z = x * y / WAD;
    }
    function wdiv(uint256 x, uint256 y) public pure returns (uint256 z) {
        z = x * WAD / y;
    }
    function wdivup(uint256 x, uint256 y) public pure returns (uint256 z) {
        z = divup(x * WAD, y);
    }
    uint256 constant RAY  = 10 ** 27;
    function rmul(uint256 x, uint256 y) public pure returns (uint256 z) {
        z = x * y / RAY;
    }
    function rmulup(uint256 x, uint256 y) public pure returns (uint256 z) {
        z = divup(x * y, RAY);
    }
    function rdiv(uint256 x, uint256 y) public pure returns (uint256 z) {
        z = x * RAY / y;
    }

    function getUnclaimedLqty(address user, BAMM bamm, ERC20 token) public returns(uint) {
        // trigger bamm (p)lqty claim
        bamm.withdraw(0);

        if(bamm.total() == 0) return 0;

        // duplicate harvest logic
        uint crop = token.balanceOf(address(bamm)) - bamm.stock();
        uint share = bamm.share() + rdiv(crop, bamm.total());

        uint last = bamm.crops(user);
        uint curr = rmul(bamm.stake(user), share);
        if(curr > last) return curr - last;
        return 0;
    }

    struct UserInfo {
        uint unclaimedLqty;

        uint bammUserBalance;
        uint bammTotalSupply;

        uint thusdUserBalance;
        uint ethUserBalance;

        uint thusdTotal;
        uint ethTotal;
    }

    function getUserInfo(address user, BAMM bamm, ERC20 lqty) external returns(UserInfo memory info) {
        info.unclaimedLqty = getUnclaimedLqty(user, bamm, lqty);
        info.bammUserBalance = bamm.balanceOf(user);
        info.bammTotalSupply = bamm.totalSupply();
        
        StabilityPool sp = bamm.SP();
        info.thusdTotal = sp.getCompoundedTHUSDDeposit(address(bamm));
        info.ethTotal = sp.getDepositorCollateralGain(address(bamm)) + address(bamm).balance;

        info.thusdUserBalance = info.thusdTotal * info.bammUserBalance / info.bammTotalSupply;
        info.ethUserBalance = info.ethTotal * info.bammUserBalance / info.bammTotalSupply;        
    }
}
