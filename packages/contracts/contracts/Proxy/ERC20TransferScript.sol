// SPDX-License-Identifier: MIT

pragma solidity ^0.8.10;

import "../Dependencies/IERC20.sol";

contract ERC20TransferScript {
    function transferTokens(address token, address _recipient, uint256 _amount) external returns (bool) {
        // bool success = IERC20(token).transferFrom(msg.sender, address(_recipient), _amount);
        bool success = IERC20(token).transfer(_recipient, _amount);

        //(bool success, ) = _recipient.call{value: _amount}("");
        return success;
    }
}
