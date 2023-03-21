// SPDX-License-Identifier: MIT

pragma solidity ^0.8.17;

import "../Interfaces/ITellorCaller.sol";
import "usingtellor/contracts/interface/ITellor.sol";
/*
* This contract has a single external function that calls Tellor: getTellorCurrentValue().
*
* The function is called by the thUSD contract PriceFeed.sol. If any of its inner calls to Tellor revert,
* this function will revert, and PriceFeed will catch the failure and handle it accordingly.
*
* The function comes from Tellor's own wrapper contract, 'UsingTellor.sol':
* https://github.com/tellor-io/usingtellor/blob/master/contracts/UsingTellor.sol
*
*/
contract TellorCaller is ITellorCaller {

    ITellor public immutable tellor;
    bytes32 public immutable queryId;

    /**
     * @param _tellorMasterAddress Address of Tellor contract
     * @param _queryId Pre-calculated hash of query. See https://queryidbuilder.herokuapp.com/spotprice
     */
    constructor (address _tellorMasterAddress, bytes32 _queryId) {
        tellor = ITellor(_tellorMasterAddress);
        queryId = _queryId;
    }

    /*
    * @dev Allows the user to get the latest value for the requestId specified
    * @return ifRetrieve bool true if it is able to retrieve a value, the value, and the value's timestamp
    * @return value the value retrieved
    * @return _timestampRetrieved the value's timestamp
    */
    function getTellorCurrentValue()
        external
        view
        override
        returns (
            bool ifRetrieve,
            uint256 value,
            uint256 _timestampRetrieved
        )
    {
        (, bytes memory _value, uint256 _time) =
            tellor.getDataBefore(queryId, block.timestamp - 15 minutes);
        // If timestampRetrieved is 0, no data was found
        if(_time > 0) {
            // Check that the data is not too old
            if(block.timestamp - _time < 24 hours) {
                // Use the helper function _sliceUint to parse the bytes to uint256
                return(true, _sliceUint(_value), _time);
            }
        }
        return (false, 0, _time);
    }

    // Internal functions
    /**
     * @dev Convert bytes to uint256. Copy from `UsingTellor.sol`
     * @param _b bytes value to convert to uint256
     * @return _number uint256 converted from bytes
     */
    function _sliceUint(bytes memory _b)
        internal
        pure
        returns (uint256 _number)
    {
        for (uint256 _i = 0; _i < _b.length; _i++) {
            _number = _number * 256 + uint8(_b[_i]);
        }
    }
}
