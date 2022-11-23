// SPDX-License-Identifier: MIT

pragma solidity ^0.8.10;

import "./../StabilityPool.sol";
import "./CropJoinAdapter.sol";
import "./PriceFormula.sol";
import "./../Interfaces/IPriceFeed.sol";
import "./../Dependencies/IERC20.sol";
import "./../Dependencies/Ownable.sol";
import "./../Dependencies/AggregatorV3Interface.sol";


contract BAMM is CropJoinAdapter, PriceFormula, Ownable {

    AggregatorV3Interface public immutable priceAggregator;
    AggregatorV3Interface public immutable thusd2UsdPriceAggregator;    
    IERC20 public immutable thusdToken;
    StabilityPool immutable public SP;

    address payable public immutable feePool;
    uint public constant MAX_FEE = 100; // 1%
    uint public fee = 0; // fee in bps
    uint public A = 20;
    uint public constant MIN_A = 20;
    uint public constant MAX_A = 200;    

    uint public immutable maxDiscount; // max discount in bips

    uint constant public PRECISION = 1e18;

    event ParamsSet(uint A, uint fee);
    event UserDeposit(address indexed user, uint thusdAmount, uint numShares);
    event UserWithdraw(address indexed user, uint thusdAmount, uint ethAmount, uint numShares);
    event RebalanceSwap(address indexed user, uint thusdAmount, uint ethAmount, uint timestamp);

    constructor(
        address _priceAggregator,
        address _thusd2UsdPriceAggregator,
        address payable _SP,
        address _thusdToken,
        uint _maxDiscount,
        address payable _feePool
    )
        CropJoinAdapter()
    {
        priceAggregator = AggregatorV3Interface(_priceAggregator);
        thusd2UsdPriceAggregator = AggregatorV3Interface(_thusd2UsdPriceAggregator);
        thusdToken = IERC20(_thusdToken);
        SP = StabilityPool(_SP);

        feePool = _feePool;
        maxDiscount = _maxDiscount;
    }

    function setParams(uint _A, uint _fee) external onlyOwner {
        require(_fee <= MAX_FEE, "setParams: fee is too big");
        require(_A >= MIN_A, "setParams: A too small");
        require(_A <= MAX_A, "setParams: A too big");

        fee = _fee;
        A = _A;

        emit ParamsSet(_A, _fee);
    }

    function fetchPrice() public view returns(uint) {
        uint chainlinkDecimals;
        uint chainlinkLatestAnswer;
        uint chainlinkTimestamp;

        // First, try to get current decimal precision:
        try priceAggregator.decimals() returns (uint8 decimals) {
            // If call to Chainlink succeeds, record the current decimal precision
            chainlinkDecimals = decimals;
        } catch {
            // If call to Chainlink aggregator reverts, return a zero response with success = false
            return 0;
        }

        // Secondly, try to get latest price data:
        try priceAggregator.latestRoundData() returns
        (
            uint80 /* roundId */,
            int256 answer,
            uint256 /* startedAt */,
            uint256 timestamp,
            uint80 /* answeredInRound */
        )
        {
            // If call to Chainlink succeeds, return the response and success = true
            chainlinkLatestAnswer = uint(answer);
            chainlinkTimestamp = timestamp;
        } catch {
            // If call to Chainlink aggregator reverts, return a zero response with success = false
            return 0;
        }

        if(chainlinkTimestamp + 1 hours < block.timestamp) return 0; // price is down

        uint chainlinkFactor = 10 ** chainlinkDecimals;
        return chainlinkLatestAnswer * PRECISION / chainlinkFactor;
    }

    function deposit(uint thusdAmount) external {        
        // update share
        uint thusdValue = SP.getCompoundedTHUSDDeposit(address(this));
        uint ethValue = SP.getDepositorCollateralGain(address(this)) + address(this).balance;

        uint price = fetchPrice();
        require(ethValue == 0 || price > 0, "deposit: chainlink is down");

        uint totalValue = thusdValue + ethValue * price / PRECISION;

        // this is in theory not reachable. if it is, better halt deposits
        // the condition is equivalent to: (totalValue = 0) ==> (total = 0)
        require(totalValue > 0 || total == 0, "deposit: system is rekt");

        uint newShare = PRECISION;
        if(total > 0) newShare = total * thusdAmount / totalValue;

        // deposit
        require(thusdToken.transferFrom(msg.sender, address(this), thusdAmount), "deposit: transferFrom failed");
        SP.provideToSP(thusdAmount);

        // update LP token
        mint(msg.sender, newShare);

        emit UserDeposit(msg.sender, thusdAmount, newShare);        
    }

    function withdraw(uint numShares) external {
        uint thusdValue = SP.getCompoundedTHUSDDeposit(address(this));
        uint ethValue = SP.getDepositorCollateralGain(address(this)) + address(this).balance;

        uint thusdAmount = thusdValue * numShares / total;
        uint ethAmount = ethValue * numShares / total;

        // this withdraws thusdn and eth
        SP.withdrawFromSP(thusdAmount);

        // update LP token
        burn(msg.sender, numShares);

        // send thusd and eth
        if(thusdAmount > 0) thusdToken.transfer(msg.sender, thusdAmount);
        if(ethAmount > 0) {
            (bool success, ) = msg.sender.call{ value: ethAmount }(""); // re-entry is fine here
            require(success, "withdraw: sending ETH failed");
        }

        emit UserWithdraw(msg.sender, thusdAmount, ethAmount, numShares);            
    }

    function addBps(uint n, int bps) internal pure returns(uint) {
        require(bps <= 10000, "reduceBps: bps exceeds max");
        require(bps >= -10000, "reduceBps: bps exceeds min");

        return n * uint(10000 + bps) / 10000;
    }

    function compensateForTHusdDeviation(uint ethAmount) public view returns(uint newEthAmount) {
        uint chainlinkDecimals;
        uint chainlinkLatestAnswer;

        // get current decimal precision:
        chainlinkDecimals = thusd2UsdPriceAggregator.decimals();

        // Secondly, try to get latest price data:
        (,int256 answer,,,) = thusd2UsdPriceAggregator.latestRoundData();
        chainlinkLatestAnswer = uint(answer);

        // adjust only if 1 thUSD > 1 USDC. If thUSD < USD, then we give a discount, and rebalance will happen anw
        if(chainlinkLatestAnswer > 10 ** chainlinkDecimals ) {
            newEthAmount = ethAmount * chainlinkLatestAnswer / (10 ** chainlinkDecimals);
        }
        else newEthAmount = ethAmount;
    }

    function getSwapEthAmount(uint thusdQty) public view returns(uint ethAmount, uint feeTHusdAmount) {
        uint thusdBalance = SP.getCompoundedTHUSDDeposit(address(this));
        uint ethBalance  = SP.getDepositorCollateralGain(address(this)) + address(this).balance;

        uint eth2usdPrice = fetchPrice();
        if(eth2usdPrice == 0) return (0, 0); // chainlink is down

        uint ethUsdValue = ethBalance * eth2usdPrice / PRECISION;
        uint maxReturn = addBps(thusdQty * PRECISION / eth2usdPrice, int(maxDiscount));

        uint xQty = thusdQty;
        uint xBalance = thusdBalance;
        uint yBalance = thusdBalance + (ethUsdValue * 2);
        
        uint usdReturn = getReturn(xQty, xBalance, yBalance, A);
        uint basicEthReturn = usdReturn * PRECISION / eth2usdPrice;

        basicEthReturn = compensateForTHusdDeviation(basicEthReturn);

        if(ethBalance < basicEthReturn) basicEthReturn = ethBalance; // cannot give more than balance 
        if(maxReturn < basicEthReturn) basicEthReturn = maxReturn;

        ethAmount = basicEthReturn;
        feeTHusdAmount = addBps(thusdQty, int(fee)) - thusdQty;
    }

    // get ETH in return to THUSD
    function swap(uint thusdAmount, uint minEthReturn, address payable dest) public returns(uint) {
        (uint ethAmount, uint feeAmount) = getSwapEthAmount(thusdAmount);

        require(ethAmount >= minEthReturn, "swap: low return");

        thusdToken.transferFrom(msg.sender, address(this), thusdAmount);
        SP.provideToSP(thusdAmount - feeAmount);

        if(feeAmount > 0) thusdToken.transfer(feePool, feeAmount);
        (bool success, ) = dest.call{ value: ethAmount }(""); // re-entry is fine here
        require(success, "swap: sending ETH failed");

        emit RebalanceSwap(msg.sender, thusdAmount, ethAmount, block.timestamp);

        return ethAmount;
    }

    // kyber network reserve compatible function
    function trade(
        IERC20 /* srcToken */,
        uint256 srcAmount,
        IERC20 /* destToken */,
        address payable destAddress,
        uint256 /* conversionRate */,
        bool /* validate */
    ) external payable returns (bool) {
        return swap(srcAmount, 0, destAddress) > 0;
    }

    function getConversionRate(
        IERC20 /* src */,
        IERC20 /* dest */,
        uint256 srcQty,
        uint256 /* blockNumber */
    ) external view returns (uint256) {
        (uint ethQty, ) = getSwapEthAmount(srcQty);
        return ethQty * PRECISION / srcQty;
    }

    receive() external payable {}
}
