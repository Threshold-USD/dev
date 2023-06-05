// SPDX-License-Identifier: MIT

pragma solidity ^0.8.10;

import "./Interfaces/IPriceFeed.sol";
import "./Interfaces/IUniswapV2Pair.sol";
import "./Dependencies/SafeMath.sol";
import "./Dependencies/Ownable.sol";
import "./Dependencies/CheckContract.sol";
import "./Dependencies/BaseMath.sol";
import "./Dependencies/LiquityMath.sol";
import "./Dependencies/IERC20.sol";
import "./rai/GebMath.sol";

/*
* PriceFeed for LED prototype
* All Liquity functions call the "fetchPrice" function
* There are also three maintenance functions that need to be called
* on a regular basis:
* - updateRate
* - updateLEDPrice
* - updateDeviationFactor
*/

abstract contract LEDLike {
    function getUSDPerLED() virtual external returns (uint256);
}

abstract contract PIDCalculator {
    function computeRate(uint256, uint256, uint256) virtual external returns (uint256);
    function rt(uint256, uint256, uint256) virtual external view returns (uint256);
    function pscl() virtual external view returns (uint256);
    function tlv() virtual external view returns (uint256);
}

contract PriceFeed is GebMath, Ownable, BaseMath {
    using SafeMath for uint256;

    address public _owner;
    string constant public NAME = "PriceFeed";

    LEDLike public led;
    PIDCalculator public pidCalculator;
    IUniswapV2Pair public uniV2Pair;

    uint256 public deviationFactor;
    uint256 public deviationFactorUpdateTime;

    uint256 public redemptionRate;
    uint256 public redemptionRateUpdateTime;

    uint256 public LEDPrice;
    uint256 public LEDPriceUpdateTime;

    // --- Events ---
    event UpdateRedemptionRate(
        uint marketPrice,
        uint redemptionPrice,
        uint redemptionRate
    );

    event UpdateDeviationFactor(
        uint deviationFactor
    );

    event UpdateLEDPrice(
        uint ledPrice
    );

    constructor(
        address _led,
        address _pidCalculator,
        address _uniV2Pair
    ) Ownable() public {
        // Assign addresses
        led = LEDLike(_led);
        pidCalculator = PIDCalculator(_pidCalculator);
        uniV2Pair = IUniswapV2Pair(_uniV2Pair);

        // 1 = 10 ** 27
        redemptionRate = RAY;
        redemptionRateUpdateTime = block.timestamp;

        // 1 = 10 ** 18
        deviationFactor = WAD;
        deviationFactorUpdateTime = block.timestamp;

        // 1 = 10 ** 18
        LEDPrice = WAD;
        LEDPriceUpdateTime = block.timestamp;
    }

    function fetchPrice() public returns (uint) {
        return wmultiply(LEDPrice, deviationFactor);
    }

    function setAddresses(
        address _ledAddress,
        address _pidCalculatorAddress,
        address _uniV2Pair
    )
        external
        onlyOwner
    {
        led = LEDLike(_ledAddress);
        pidCalculator = PIDCalculator(_pidCalculatorAddress);
        uniV2Pair = IUniswapV2Pair(_uniV2Pair);
    }

    // calculate price based on pair reserves
    function getTokenPrice(uint amount) internal view returns(uint)
    {
        IERC20 token1 = IERC20(uniV2Pair.token1());
        (uint Res0, uint Res1,) = uniV2Pair.getReserves();

        // decimals
        uint res0 = Res0*(10**token1.decimals());
        return((amount*res0)/Res1); // return amount of token0 needed to buy token1
    }

    function updateRate() external {
        // Get price feed updates
        uint256 marketPrice = getTokenPrice(1);
        // If the price is non-zero
        require(marketPrice > 0, "PriceFeed/null-uniswap-price");

        uint256 redemptionPrice = fetchPrice();
        // Calculate the rate
        redemptionRate = pidCalculator.computeRate(
            marketPrice,
            redemptionPrice,
            RAY
        );
        // Store the timestamp of the update
        redemptionRateUpdateTime = block.timestamp;
        // Emit success event
        emit UpdateRedemptionRate(
            ray(marketPrice),
            redemptionPrice,
            redemptionRate
        );
    }

    function updateLEDPrice() external {
        // Get price feed updates
        uint256 _LEDPrice = led.getUSDPerLED();
        // If the price is non-zero
        require(_LEDPrice > 0, "PriceFeed/null-led-price");
        LEDPrice = _LEDPrice;

        LEDPriceUpdateTime = block.timestamp;
    }

    function updateDeviationFactor() external {
        // Update deviation factor
        deviationFactor = rmultiply(
          rpower(redemptionRate, subtract(block.timestamp, deviationFactorUpdateTime), RAY),
          deviationFactor
        );
        deviationFactorUpdateTime = block.timestamp;
        emit UpdateDeviationFactor(deviationFactor);
    }
}
