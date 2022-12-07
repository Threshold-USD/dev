// SPDX-License-Identifier: MIT

pragma solidity ^0.8.10;

import "./crop.sol";
import "./../StabilityPool.sol";

// NOTE! - this is not an ERC20 token. transfer is not supported.
contract CropJoinAdapter is CropJoin {
    string constant public name = "B.AMM THUSD-ETH";
    string constant public symbol = "THUSDETH";
    uint256 constant public decimals = 18;

    event Transfer(address indexed _from, address indexed _to, uint256 _value);

    constructor()  
        CropJoin(address(new Dummy()), "B.AMM", address(new DummyGem()), address(new DummyGem()))
    {
    }

    // adapter to cropjoin
    function nav() public view override returns (uint256) {
        return total;
    }
    
    function totalSupply() public view returns (uint256) {
        return total;
    }

    function balanceOf(address owner) public view returns (uint256 balance) {
        balance = stake[owner];
    }

    function mint(address to, uint256 value) virtual internal {
        join(to, value);
        emit Transfer(address(0), to, value);
    }

    function burn(address owner, uint256 value) virtual internal {
        exit(owner, value);
        emit Transfer(owner, address(0), value);        
    }
}

contract Dummy {
    fallback() external {}
}

contract DummyGem is Dummy {
    function transfer(address, uint256) external pure returns(bool) {
        return true;
    }

    function transferFrom(address, address, uint256) external pure returns(bool) {
        return true;
    }

    function decimals() external pure returns(uint256) {
        return 18;
    }  

    function balanceOf(address) public pure returns (uint256 balance) {
        balance = 0;
    }
}