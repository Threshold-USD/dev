// SPDX-License-Identifier: MIT

pragma solidity ^0.8.17;

import "./../TestContracts/PriceFeedTestnet.sol";

/*
* PriceFeed placeholder for testnet and development. The price is simply set manually and saved in a state 
* variable. The contract does not connect to a live Chainlink price feed. 
*/
contract ChainlinkTestnet {
    
    PriceFeedTestnet feed;
    uint256 price = 0;
    uint256 time = 0;

    constructor(PriceFeedTestnet _feed) {
        feed = _feed;
    }

    function decimals() external pure returns(uint256) {
        return 18;
    }

    function setTimestamp(uint256 _time) external {
        time = _time;
    }

    function setPrice(uint256 _price) external {
        price = _price;
    }

    function latestRoundData() external view returns
     (
        uint80 roundId,
        int256 answer,
        uint256 startedAt,
        uint256 timestamp,
        uint80 answeredInRound
    )
    {
        roundId = 0;
        startedAt = 0;
        answeredInRound = 0;

        if(price > 0) answer = int256(price);
        else answer = int256(feed.getPrice());
        
        if(time == 0 ) timestamp = block.timestamp;
        else timestamp = time;
    }
}
