// SPDX-License-Identifier: MIT

pragma solidity ^0.8.10;

contract PriceFormula {

    function getSumFixedPoint(uint x, uint y, uint A) public pure returns(uint) {
        if(x == 0 && y == 0) return 0;

        uint sum = x + y;

        for(uint i = 0 ; i < 255 ; i++) {
            uint dP = sum;
            dP = dP * sum / ((x * 2) + 1);
            dP = dP * sum / ((y * 2) + 1);

            uint prevSum = sum;

            uint n = (A * 2 * (x + y) + (dP * 2)) * sum;
            uint d = (A * 2 - 1) * sum;
            sum = n / (d + dP * 3);

            if(sum <= prevSum + 1 && prevSum <= sum + 1) break;
        }

        return sum;
    }

    function getReturn(uint xQty, uint xBalance, uint yBalance, uint A) public pure returns(uint) {
        uint sum = getSumFixedPoint(xBalance, yBalance, A);

        uint c = sum * sum / ((xQty + xBalance) * 2);
        c = c * sum / (A * 4);
        uint b = (xQty + xBalance) + (sum / (A * 2));
        uint yPrev = 0;
        uint y = sum;

        for(uint i = 0 ; i < 255 ; i++) {
            yPrev = y;
            uint n = y * y + c;
            uint d = y * 2 + b - sum; 
            y = n / d;

            if(y <= yPrev + 1 && yPrev <= y + 1) break;
        }

        return yBalance - y - 1;
    }
}
