import { BigNumber } from "@ethersproject/bignumber";
import { Contract } from "@ethersproject/contracts";
import { Signer } from "@ethersproject/abstract-signer";
import { ethers } from "hardhat";
import { _LiquityDeploymentJSON } from "../src/contracts";
import erc20Abi from "../abi/ERC20Test.json";
import lusdAbi from "../abi/LUSDToken.json";

export const printBalances = async(deployment: _LiquityDeploymentJSON, deployer: Signer, users: Signer[]) => {
  let erc20: Contract;
  let lusd: Contract;
  let contractAddresses: Record<string, string> = {
    activePool: deployment.addresses.activePool,
    borrowerOperations: deployment.addresses.borrowerOperations,
    troveManager: deployment.addresses.troveManager,
    collSurplusPool: deployment.addresses.collSurplusPool,
    defaultPool: deployment.addresses.defaultPool,
    hintHelpers: deployment.addresses.hintHelpers,
    pcv: deployment.addresses.pcv,
    priceFeed: deployment.addresses.priceFeed,
    sortedTroves: deployment.addresses.sortedTroves,
    stabilityPool: deployment.addresses.stabilityPool,
    gasPool: deployment.addresses.gasPool,
  };

  erc20 = new ethers.Contract(deployment.addresses.erc20, erc20Abi, deployer);
  lusd = new ethers.Contract(deployment.addresses.lusdToken, lusdAbi, deployer);
  let scale = 1000000000000000000;

  if (users.length >0) {
    console.log("==================================================================")
    console.log("USER BALANCES");
    console.log("------------------------------------------------------------------")
    for(var i = 0; i < users.length; i++)
    {
      let userAddress = await users[i].getAddress();
      const erc20Balance = await erc20.balanceOf(userAddress);
      const lusdBalance = await lusd.balanceOf(userAddress);
      const ethBalance = await users[i].getBalance();
      if (erc20Balance.gt(0) || lusdBalance.gt(0) || ethBalance.gt(0)) {
        console.log(userAddress);
        console.log("\tERC20 : \t", erc20Balance / scale);
        console.log("\tLUSD : \t\t", lusdBalance / scale);
        console.log("\tETH : \t\t", ethers.utils.formatEther(ethBalance));
        console.log("")
      }
    }
    console.log("");
  }
  console.log("==================================================================")
  console.log("CONTRACT BALANCES");
  console.log("------------------------------------------------------------------")

  for (const name in contractAddresses) {
    if (contractAddresses.hasOwnProperty(name)) {
      let address = contractAddresses[name];
      const erc20Balance = await erc20.balanceOf(address);
      const lusdBalance = await lusd.balanceOf(address);
      const ethBalance = await ethers.provider.getBalance(address);
      if (erc20Balance.gt(0) || lusdBalance.gt(0) || ethBalance.gt(0)) {
        console.log(address, " : ", name);
        console.log("\tERC20 : \t", erc20Balance / scale);
        console.log("\tLUSD : \t\t", lusdBalance / scale);
        console.log("\tETH : \t\t", ethers.utils.formatEther(ethBalance));
        console.log("")
      }
    }
  }

};
