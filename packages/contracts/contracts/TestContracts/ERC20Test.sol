// SPDX-License-Identifier: MIT

pragma solidity ^0.8.17;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract ERC20Test is ERC20 {
	constructor() ERC20("ERC Test", "TST") {}

	uint8 private DECIMALS = 18;

	function mint(address _addr, uint256 _amount) public {
		_mint(_addr, _amount);
	}

	function transferFrom(
		address sender,
		address recipient,
		uint256 amount
	) public override returns (bool) {
		_transfer(sender, recipient, amount);
		return true;
	}

	function decimals() public view virtual override returns (uint8) {
    	return DECIMALS;
	}

}
