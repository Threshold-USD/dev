
/// OracleRelayer.sol

// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program.  If not, see <https://www.gnu.org/licenses/>.

pragma solidity ^0.8.10;

abstract contract OracleLike {
    function getResultWithValidity() virtual public view returns (uint256, bool);
}

contract OracleRelayer {
    // --- Auth ---
    mapping (address => uint256) public authorizedAccounts;
    /**
     * @notice Add auth to an account
     * @param account Account to add auth to
     */
    function addAuthorization(address account) external isAuthorized {
        authorizedAccounts[account] = 1;
        emit AddAuthorization(account);
    }
    /**
     * @notice Remove auth from an account
     * @param account Account to remove auth from
     */
    function removeAuthorization(address account) external isAuthorized {
        authorizedAccounts[account] = 0;
        emit RemoveAuthorization(account);
    }
    /**
    * @notice Checks whether msg.sender can call an authed function
    **/
    modifier isAuthorized {
        require(authorizedAccounts[msg.sender] == 1, "OracleRelayer/account-not-authorized");
        _;
    }

    // Whether this contract is enabled
    uint256 public contractEnabled;
    // Virtual deviation factor (not the most updated value)
    uint256 internal _deviationFactor;                                                        // [ray]
    // The force that changes the system users' incentives by changing the redemption price
    uint256 public redemptionRate;                                                            // [ray]
    // Last time when the redemption price was changed
    uint256 public redemptionPriceUpdateTime;                                                 // [unix epoch time]
    // Upper bound for the per-second redemption rate
    uint256 public redemptionRateUpperBound;                                                  // [ray]
    // Lower bound for the per-second redemption rate
    uint256 public redemptionRateLowerBound;                                                  // [ray]

    // --- Events ---
    event AddAuthorization(address account);
    event RemoveAuthorization(address account);
    event DisableContract();
    event ModifyParameters(
        bytes32 collateralType,
        bytes32 parameter,
        address addr
    );
    event ModifyParameters(bytes32 parameter, uint256 data);
    event ModifyParameters(
        bytes32 collateralType,
        bytes32 parameter,
        uint256 data
    );
    event UpdateDeviationFactor(uint256 redemptionPrice);

    // --- Init ---
    constructor() public {
        authorizedAccounts[msg.sender] = 1;

        _deviationFactor               = RAY;
        redemptionRate                 = RAY;
        redemptionPriceUpdateTime      = block.timestamp;
        redemptionRateUpperBound       = RAY * WAD;
        redemptionRateLowerBound       = 1;
        contractEnabled                = 1;

        emit AddAuthorization(msg.sender);
    }

    // --- Math ---
    uint256 constant WAD = 10 ** 18;
    uint256 constant RAY = 10 ** 27;

    function subtract(uint256 x, uint256 y) internal pure returns (uint256 z) {
        z = x - y;
        require(z <= x, "OracleRelayer/sub-underflow");
    }
    function multiply(uint256 x, uint256 y) internal pure returns (uint256 z) {
        require(y == 0 || (z = x * y) / y == x, "OracleRelayer/mul-overflow");
    }
    function rmultiply(uint256 x, uint256 y) internal pure returns (uint256 z) {
        // always rounds down
        z = multiply(x, y) / RAY;
    }
    function rdivide(uint256 x, uint256 y) internal pure returns (uint256 z) {
        require(y > 0, "OracleRelayer/rdiv-by-zero");
        z = multiply(x, RAY) / y;
    }
    function rpower(uint256 x, uint256 n, uint256 base) internal pure returns (uint256 z) {
        assembly {
            switch x case 0 {switch n case 0 {z := base} default {z := 0}}
            default {
                switch mod(n, 2) case 0 { z := base } default { z := x }
                let half := div(base, 2)  // for rounding.
                for { n := div(n, 2) } n { n := div(n,2) } {
                    let xx := mul(x, x)
                    if iszero(eq(div(xx, x), x)) { revert(0,0) }
                    let xxRound := add(xx, half)
                    if lt(xxRound, xx) { revert(0,0) }
                    x := div(xxRound, base)
                    if mod(n,2) {
                        let zx := mul(z, x)
                        if and(iszero(iszero(x)), iszero(eq(div(zx, x), z))) { revert(0,0) }
                        let zxRound := add(zx, half)
                        if lt(zxRound, zx) { revert(0,0) }
                        z := div(zxRound, base)
                    }
                }
            }
        }
    }

    // --- Administration ---
    /**
     * @notice Modify redemption rate/price related parameters
     * @param parameter Name of the parameter
     * @param data New param value
     */
    function modifyParameters(bytes32 parameter, uint256 data) external isAuthorized {
        require(contractEnabled == 1, "OracleRelayer/contract-not-enabled");
        require(data > 0, "OracleRelayer/null-data");
        if (parameter == "deviationFactor") {
          _deviationFactor = data;
        }
        else if (parameter == "redemptionRate") {
          require(block.timestamp == redemptionPriceUpdateTime, "OracleRelayer/redemption-price-not-updated");
          uint256 adjustedRate = data;
          if (data > redemptionRateUpperBound) {
            adjustedRate = redemptionRateUpperBound;
          } else if (data < redemptionRateLowerBound) {
            adjustedRate = redemptionRateLowerBound;
          }
          redemptionRate = adjustedRate;
        }
        else if (parameter == "redemptionRateUpperBound") {
          require(data > RAY, "OracleRelayer/invalid-redemption-rate-upper-bound");
          redemptionRateUpperBound = data;
        }
        else if (parameter == "redemptionRateLowerBound") {
          require(data < RAY, "OracleRelayer/invalid-redemption-rate-lower-bound");
          redemptionRateLowerBound = data;
        }
        else revert("OracleRelayer/modify-unrecognized-param");
        emit ModifyParameters(
            parameter,
            data
        );
    }

    // --- Redemption Price Update ---
    /**
     * @notice Update the redemption price using the current redemption rate
     */
    function updateRedemptionPrice() internal returns (uint256) {
        // Update redemption price
        _deviationFactor = rmultiply(
          rpower(redemptionRate, subtract(block.timestamp, redemptionPriceUpdateTime), RAY),
          _deviationFactor
        );
        if (_deviationFactor == 0) _deviationFactor = 1;
        redemptionPriceUpdateTime = block.timestamp;
        emit UpdateDeviationFactor(_deviationFactor);
        // Return updated redemption price
        return _deviationFactor;
    }
    /**
     * @notice Fetch the latest redemption price by first updating it
     */
    function redemptionPrice() public returns (uint256) {
        if (block.timestamp > redemptionPriceUpdateTime) return updateRedemptionPrice();
        return _deviationFactor;
    }

    /**
     * @notice Disable this contract (normally called by GlobalSettlement)
     */
    function disableContract() external isAuthorized {
        contractEnabled = 0;
        redemptionRate = RAY;
        emit DisableContract();
    }
}
