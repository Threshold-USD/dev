// SPDX-License-Identifier: MIT

pragma solidity ^0.8.17;

import "../Interfaces/ITHUSDToken.sol";

contract THUSDTokenCaller {
    ITHUSDToken THUSD;

    function setTHUSD(ITHUSDToken _THUSD) external {
        THUSD = _THUSD;
    }

    function thusdMint(address _account, uint256 _amount) external {
        THUSD.mint(_account, _amount);
    }

    function thusdBurn(address _account, uint256 _amount) external {
        THUSD.burn(_account, _amount);
    }

    function thusdSendToPool(address _sender,  address _poolAddress, uint256 _amount) external {
        THUSD.sendToPool(_sender, _poolAddress, _amount);
    }

    function thusdReturnFromPool(address _poolAddress, address _receiver, uint256 _amount ) external {
        THUSD.returnFromPool(_poolAddress, _receiver, _amount);
    }
}
