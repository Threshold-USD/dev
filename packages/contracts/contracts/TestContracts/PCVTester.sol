// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import "../PCV.sol";


contract PCVTester is PCV {
    function requireCallerIsTroveManager() external view {
        _requireCallerIsTroveManager();
    }
}
