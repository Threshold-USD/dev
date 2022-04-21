// SPDX-License-Identifier: MIT

pragma solidity ^0.8.10;

import "../Dependencies/CheckContract.sol";
import "../Interfaces/IPCV.sol";


contract PCVScript is CheckContract {
    IPCV immutable PCV;

    constructor(address _pcvAddress) {
        checkContract(_pcvAddress);
        PCV = IPCV(_pcvAddress);
    }

}
