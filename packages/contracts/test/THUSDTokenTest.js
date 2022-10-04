const deploymentHelper = require("../utils/deploymentHelpers.js")
const testHelpers = require("../utils/testHelpers.js")

const StabilityPoolTester = artifacts.require("./StabilityPoolTester.sol")
const BorrowerOperationsTester = artifacts.require("./BorrowerOperationsTester.sol")
const TroveManagerTester = artifacts.require("./TroveManagerTester.sol")

const { keccak256 } = require('@ethersproject/keccak256');
const { defaultAbiCoder } = require('@ethersproject/abi');
const { toUtf8Bytes } = require('@ethersproject/strings');
const { pack } = require('@ethersproject/solidity');
const { hexlify } = require("@ethersproject/bytes");
const { ecsign } = require('ethereumjs-util');

const { 
  toBN, 
  assertRevert, 
  dec, 
  ZERO_ADDRESS, 
  getLatestBlockTimestamp,
  fastForwardTime,
  getEventArgByIndex
} = testHelpers.TestHelper

const sign = (digest, privateKey) => {
  return ecsign(Buffer.from(digest.slice(2), 'hex'), Buffer.from(privateKey.slice(2), 'hex'))
}

const PERMIT_TYPEHASH = keccak256(
  toUtf8Bytes('Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)')
)

// Gets the EIP712 domain separator
const getDomainSeparator = (name, contractAddress, chainId, version)  => {
  return keccak256(defaultAbiCoder.encode(['bytes32', 'bytes32', 'bytes32', 'uint256', 'address'],
  [
    keccak256(toUtf8Bytes('EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)')),
    keccak256(toUtf8Bytes(name)),
    keccak256(toUtf8Bytes(version)),
    parseInt(chainId), contractAddress.toLowerCase()
  ]))
}

// Returns the EIP712 hash which should be signed by the user
// in order to make a call to `permit`
const getPermitDigest = ( name, address, chainId, version,
                          owner, spender, value ,
                          nonce, deadline ) => {

  const DOMAIN_SEPARATOR = getDomainSeparator(name, address, chainId, version)
  return keccak256(pack(['bytes1', 'bytes1', 'bytes32', 'bytes32'],
    ['0x19', '0x01', DOMAIN_SEPARATOR,
      keccak256(defaultAbiCoder.encode(
        ['bytes32', 'address', 'address', 'uint256', 'uint256', 'uint256'],
        [PERMIT_TYPEHASH, owner, spender, value, nonce, deadline])),
    ]))
}

contract('THUSDToken', async accounts => {
  const [owner, alice, bob, carol, dennis] = accounts;

  // the second account our hardhatenv creates (for Alice)
  // from https://github.com/liquity/dev/blob/main/packages/contracts/hardhatAccountsList2k.js#L3
  const alicePrivateKey = '0xeaa445c85f7b438dEd6e831d06a4eD0CEBDc2f8527f84Fcda6EBB5fCfAd4C0e9'

  let chainId
  let thusdTokenOriginal
  let thusdTokenTester
  let stabilityPool
  let troveManager
  let borrowerOperations

  let tokenName
  let tokenVersion
  
  let delay

  const testCorpus = ({ withProxy = false }) => {
    beforeEach(async () => {

      const contracts = await deploymentHelper.deployTesterContractsHardhat()
      await deploymentHelper.connectCoreContracts(contracts)

      thusdTokenOriginal = contracts.thusdToken
      if (withProxy) {
        const users = [ alice, bob, carol, dennis ]
        await deploymentHelper.deployProxyScripts(contracts, owner, users)
      }

      thusdTokenTester = contracts.thusdToken
      // for some reason this doesn’t work with coverage network
      //chainId = await web3.eth.getChainId()
      chainId = await thusdTokenOriginal.getChainId()

      stabilityPool = contracts.stabilityPool
      troveManager = contracts.troveManager
      borrowerOperations = contracts.borrowerOperations

      tokenVersion = await thusdTokenOriginal.version()
      tokenName = await thusdTokenOriginal.name()
      
      delay = (await thusdTokenOriginal.governanceTimeDelay()).toNumber()

      // mint some tokens
      if (withProxy) {
        await thusdTokenOriginal.unprotectedMint(thusdTokenTester.getProxyAddressFromUser(alice), 150)
        await thusdTokenOriginal.unprotectedMint(thusdTokenTester.getProxyAddressFromUser(bob), 100)
        await thusdTokenOriginal.unprotectedMint(thusdTokenTester.getProxyAddressFromUser(carol), 50)
      } else {
        await thusdTokenOriginal.unprotectedMint(alice, 150)
        await thusdTokenOriginal.unprotectedMint(bob, 100)
        await thusdTokenOriginal.unprotectedMint(carol, 50)
      }
    })
    
    if (!withProxy) {
      it('Initial set of contracts was set correctly', async () => {
        assert.isTrue(await thusdTokenTester.isTroveManager(troveManager.address))
        assert.isFalse(await thusdTokenTester.isTroveManager(stabilityPool.address))
        assert.isFalse(await thusdTokenTester.isTroveManager(borrowerOperations.address))
        assert.isFalse(await thusdTokenTester.isTroveManager(owner))
        
        assert.isFalse(await thusdTokenTester.isStabilityPools(troveManager.address))
        assert.isTrue(await thusdTokenTester.isStabilityPools(stabilityPool.address))
        assert.isFalse(await thusdTokenTester.isStabilityPools(borrowerOperations.address))
        assert.isFalse(await thusdTokenTester.isStabilityPools(owner))
        
        assert.isFalse(await thusdTokenTester.isBorrowerOperations(troveManager.address))
        assert.isFalse(await thusdTokenTester.isBorrowerOperations(stabilityPool.address))
        assert.isTrue(await thusdTokenTester.isBorrowerOperations(borrowerOperations.address))
        assert.isFalse(await thusdTokenTester.isBorrowerOperations(owner))
        
        assert.isFalse(await thusdTokenTester.mintList(troveManager.address))
        assert.isFalse(await thusdTokenTester.mintList(stabilityPool.address))
        assert.isTrue(await thusdTokenTester.mintList(borrowerOperations.address))
        assert.isFalse(await thusdTokenTester.mintList(owner))
      })
    }

    it('balanceOf(): gets the balance of the account', async () => {
      const aliceBalance = (await thusdTokenTester.balanceOf(alice)).toNumber()
      const bobBalance = (await thusdTokenTester.balanceOf(bob)).toNumber()
      const carolBalance = (await thusdTokenTester.balanceOf(carol)).toNumber()

      assert.equal(aliceBalance, 150)
      assert.equal(bobBalance, 100)
      assert.equal(carolBalance, 50)
    })

    it('totalSupply(): gets the total supply', async () => {
      const total = (await thusdTokenTester.totalSupply()).toString()
      assert.equal(total, '300') // 300
    })

    it("name(): returns the token's name", async () => {
      const name = await thusdTokenTester.name()
      assert.equal(name, "thUSD Stablecoin")
    })

    it("symbol(): returns the token's symbol", async () => {
      const symbol = await thusdTokenTester.symbol()
      assert.equal(symbol, "thUSD")
    })

    it("decimal(): returns the number of decimal digits used", async () => {
      const decimals = await thusdTokenTester.decimals()
      assert.equal(decimals, "18")
    })

    it("allowance(): returns an account's spending allowance for another account's balance", async () => {
      await thusdTokenTester.approve(alice, 100, {from: bob})

      const allowance_A = await thusdTokenTester.allowance(bob, alice)
      const allowance_D = await thusdTokenTester.allowance(bob, dennis)

      assert.equal(allowance_A, 100)
      assert.equal(allowance_D, '0')
    })

    it("approve(): approves an account to spend the specified amount", async () => {
      const allowance_A_before = await thusdTokenTester.allowance(bob, alice)
      assert.equal(allowance_A_before, '0')

      await thusdTokenTester.approve(alice, 100, {from: bob})

      const allowance_A_after = await thusdTokenTester.allowance(bob, alice)
      assert.equal(allowance_A_after, 100)
    })

    if (!withProxy) {
      it("approve(): reverts when spender param is address(0)", async () => {
        const txPromise = thusdTokenTester.approve(ZERO_ADDRESS, 100, {from: bob})
        await assertRevert(txPromise)
      })

      it("approve(): reverts when owner param is address(0)", async () => {
        const txPromise = thusdTokenTester.callInternalApprove(ZERO_ADDRESS, alice, dec(1000, 18), {from: bob})
        await assertRevert(txPromise)
      })
    }

    it("transferFrom(): successfully transfers from an account which is it approved to transfer from", async () => {
      const allowance_A_0 = await thusdTokenTester.allowance(bob, alice)
      assert.equal(allowance_A_0, '0')

      await thusdTokenTester.approve(alice, 50, {from: bob})

      // Check A's allowance of Bob's funds has increased
      const allowance_A_1= await thusdTokenTester.allowance(bob, alice)
      assert.equal(allowance_A_1, 50)


      assert.equal(await thusdTokenTester.balanceOf(carol), 50)

      // Alice transfers from bob to Carol, using up her allowance
      await thusdTokenTester.transferFrom(bob, carol, 50, {from: alice})
      assert.equal(await thusdTokenTester.balanceOf(carol), 100)

       // Check A's allowance of Bob's funds has decreased
      const allowance_A_2 = await thusdTokenTester.allowance(bob, alice)
      assert.equal(allowance_A_2, '0')

      // Check bob's balance has decreased
      assert.equal(await thusdTokenTester.balanceOf(bob), 50)

      // Alice tries to transfer more tokens from bob's account to carol than she's allowed
      const txPromise = thusdTokenTester.transferFrom(bob, carol, 50, {from: alice})
      await assertRevert(txPromise)
    })

    it("transfer(): increases the recipient's balance by the correct amount", async () => {
      assert.equal(await thusdTokenTester.balanceOf(alice), 150)

      await thusdTokenTester.transfer(alice, 37, {from: bob})

      assert.equal(await thusdTokenTester.balanceOf(alice), 187)
    })

    it("transfer(): reverts if amount exceeds sender's balance", async () => {
      assert.equal(await thusdTokenTester.balanceOf(bob), 100)

      const txPromise = thusdTokenTester.transfer(alice, 101, {from: bob})
      await assertRevert(txPromise)
    })

    it('transfer(): transferring to a blacklisted address reverts', async () => {
      await assertRevert(thusdTokenTester.transfer(thusdTokenTester.address, 1, { from: alice }))
      await assertRevert(thusdTokenTester.transfer(ZERO_ADDRESS, 1, { from: alice }))
    })

    it("increaseAllowance(): increases an account's allowance by the correct amount", async () => {
      const allowance_A_Before = await thusdTokenTester.allowance(bob, alice)
      assert.equal(allowance_A_Before, '0')

      await thusdTokenTester.increaseAllowance(alice, 100, {from: bob} )

      const allowance_A_After = await thusdTokenTester.allowance(bob, alice)
      assert.equal(allowance_A_After, 100)
    })

    if (!withProxy) {
      it('mint(): issues correct amount of tokens to the given address', async () => {
        const alice_balanceBefore = await thusdTokenTester.balanceOf(alice)
        assert.equal(alice_balanceBefore, 150)

        await thusdTokenTester.unprotectedMint(alice, 100)

        const alice_BalanceAfter = await thusdTokenTester.balanceOf(alice)
        assert.equal(alice_BalanceAfter, 250)
      })

      it('burn(): burns correct amount of tokens from the given address', async () => {
        const alice_balanceBefore = await thusdTokenTester.balanceOf(alice)
        assert.equal(alice_balanceBefore, 150)

        await thusdTokenTester.unprotectedBurn(alice, 70)

        const alice_BalanceAfter = await thusdTokenTester.balanceOf(alice)
        assert.equal(alice_BalanceAfter, 80)
      })

      // TODO: Rewrite this test - it should check the actual thusdTokenTester's balance.
      it('sendToPool(): changes balances of Stability pool and user by the correct amounts', async () => {
        const stabilityPool_BalanceBefore = await thusdTokenTester.balanceOf(stabilityPool.address)
        const bob_BalanceBefore = await thusdTokenTester.balanceOf(bob)
        assert.equal(stabilityPool_BalanceBefore, 0)
        assert.equal(bob_BalanceBefore, 100)

        await thusdTokenTester.unprotectedSendToPool(bob, stabilityPool.address, 75)

        const stabilityPool_BalanceAfter = await thusdTokenTester.balanceOf(stabilityPool.address)
        const bob_BalanceAfter = await thusdTokenTester.balanceOf(bob)
        assert.equal(stabilityPool_BalanceAfter, 75)
        assert.equal(bob_BalanceAfter, 25)
      })

      it('returnFromPool(): changes balances of Stability pool and user by the correct amounts', async () => {
        /// --- SETUP --- give pool 100 THUSD
        await thusdTokenTester.unprotectedMint(stabilityPool.address, 100)

        /// --- TEST ---
        const stabilityPool_BalanceBefore = await thusdTokenTester.balanceOf(stabilityPool.address)
        const  bob_BalanceBefore = await thusdTokenTester.balanceOf(bob)
        assert.equal(stabilityPool_BalanceBefore, 100)
        assert.equal(bob_BalanceBefore, 100)

        await thusdTokenTester.unprotectedReturnFromPool(stabilityPool.address, bob, 75)

        const stabilityPool_BalanceAfter = await thusdTokenTester.balanceOf(stabilityPool.address)
        const bob_BalanceAfter = await thusdTokenTester.balanceOf(bob)
        assert.equal(stabilityPool_BalanceAfter, 25)
        assert.equal(bob_BalanceAfter, 175)
      })
    }

    it('transfer(): transferring to a blacklisted address reverts', async () => {
      await assertRevert(thusdTokenTester.transfer(thusdTokenTester.address, 1, { from: alice }))
      await assertRevert(thusdTokenTester.transfer(ZERO_ADDRESS, 1, { from: alice }))
    })

    it('decreaseAllowance(): decreases allowance by the expected amount', async () => {
      await thusdTokenTester.approve(bob, dec(3, 18), { from: alice })
      assert.equal((await thusdTokenTester.allowance(alice, bob)).toString(), dec(3, 18))
      await thusdTokenTester.decreaseAllowance(bob, dec(1, 18), { from: alice })
      assert.equal((await thusdTokenTester.allowance(alice, bob)).toString(), dec(2, 18))
    })

    it('decreaseAllowance(): fails trying to decrease more than previously allowed', async () => {
      await thusdTokenTester.approve(bob, dec(3, 18), { from: alice })
      assert.equal((await thusdTokenTester.allowance(alice, bob)).toString(), dec(3, 18))
      await assertRevert(thusdTokenTester.decreaseAllowance(bob, dec(4, 18), { from: alice }), 'ERC20: decreased allowance below zero')
      assert.equal((await thusdTokenTester.allowance(alice, bob)).toString(), dec(3, 18))
    })

    // EIP2612 tests

    if (!withProxy) {
      it("version(): returns the token contract's version", async () => {
        const version = await thusdTokenTester.version()
        assert.equal(version, "1")
      })

      it('Initializes PERMIT_TYPEHASH correctly', async () => {
        assert.equal(await thusdTokenTester.permitTypeHash(), PERMIT_TYPEHASH)
      })

      it('Initializes DOMAIN_SEPARATOR correctly', async () => {
        assert.equal(await thusdTokenTester.domainSeparator(),
                     getDomainSeparator(tokenName, thusdTokenTester.address, chainId, tokenVersion))
      })

      it('Initial nonce for a given address is 0', async function () {
        assert.equal(toBN(await thusdTokenTester.nonces(alice)).toString(), '0');
      });

      // Create the approval tx data
      const approve = {
        owner: alice,
        spender: bob,
        value: 1,
      }

      const buildPermitTx = async (deadline) => {
        const nonce = (await thusdTokenTester.nonces(approve.owner)).toString()

        // Get the EIP712 digest
        const digest = getPermitDigest(
          tokenName, thusdTokenTester.address,
          chainId, tokenVersion,
          approve.owner, approve.spender,
          approve.value, nonce, deadline
        )

        const { v, r, s } = sign(digest, alicePrivateKey)

        const tx = thusdTokenTester.permit(
          approve.owner, approve.spender, approve.value,
          deadline, v, hexlify(r), hexlify(s)
        )

        return { v, r, s, tx }
      }

      it('permits and emits an Approval event (replay protected)', async () => {
        const deadline = 100000000000000

        // Approve it
        const { v, r, s, tx } = await buildPermitTx(deadline)
        const receipt = await tx
        const event = receipt.logs[0]

        // Check that approval was successful
        assert.equal(event.event, 'Approval')
        assert.equal(await thusdTokenTester.nonces(approve.owner), 1)
        assert.equal(await thusdTokenTester.allowance(approve.owner, approve.spender), approve.value)

        // Check that we can not use re-use the same signature, since the user's nonce has been incremented (replay protection)
        await assertRevert(thusdTokenTester.permit(
          approve.owner, approve.spender, approve.value,
          deadline, v, r, s), 'THUSD: invalid signature')

        // Check that the zero address fails
        await assertRevert(thusdTokenTester.permit('0x0000000000000000000000000000000000000000',
                                                  approve.spender, approve.value, deadline, '0x99', r, s))
      })

      it('permits(): fails with expired deadline', async () => {
        const deadline = 1

        const { v, r, s, tx } = await buildPermitTx(deadline)
        await assertRevert(tx, 'THUSD: expired deadline')
      })

      it('permits(): fails with the wrong signature', async () => {
        const deadline = 100000000000000

        const { v, r, s } = await buildPermitTx(deadline)

        const tx = thusdTokenTester.permit(
          carol, approve.spender, approve.value,
          deadline, v, hexlify(r), hexlify(s)
        )

        await assertRevert(tx, 'THUSD: invalid signature')
      })
    }

    // Roles tests

    if (!withProxy) {

      context("new set of system contracts is ready", () => {
        let newStabilityPool
        let newTroveManager
        let newBorrowerOperations

        beforeEach(async () => {
          newTroveManager = await TroveManagerTester.new()
          newStabilityPool = await StabilityPoolTester.new()
          newBorrowerOperations = await BorrowerOperationsTester.new()
        })

        it('startAddContracts(): reverts when caller is not owner', async () => {
          await assertRevert(
            thusdTokenTester.startAddContracts(
              newTroveManager.address, newStabilityPool.address, newBorrowerOperations.address, 
              { from: alice }),
              "Ownable: caller is not the owner")
        })
        
        it('startAddContracts(): reverts when provided addresses are not contracts', async () => {
          await assertRevert(
            thusdTokenTester.startAddContracts(
              newTroveManager.address, newStabilityPool.address, alice, 
              { from: owner }),
              "Account code size cannot be zero")
          await assertRevert(
            thusdTokenTester.startAddContracts(
              newTroveManager.address, alice, newBorrowerOperations.address, 
              { from: owner }),
              "Account code size cannot be zero")
          await assertRevert(
            thusdTokenTester.startAddContracts(
              alice, newStabilityPool.address, newBorrowerOperations.address, 
              { from: owner }),
              "Account code size cannot be zero")
              
          await assertRevert(
            thusdTokenTester.startAddContracts(
              newTroveManager.address, newStabilityPool.address, ZERO_ADDRESS, 
              { from: owner }),
              "Account cannot be zero address")
          await assertRevert(
            thusdTokenTester.startAddContracts(
              newTroveManager.address, ZERO_ADDRESS, newBorrowerOperations.address, 
              { from: owner }),
              "Account cannot be zero address")
          await assertRevert(
            thusdTokenTester.startAddContracts(
              ZERO_ADDRESS, newStabilityPool.address, newBorrowerOperations.address, 
              { from: owner }),
              "Account cannot be zero address")
        })
        
        it('startAddContracts(): puts new set of contracts to pending list', async () => {
          await thusdTokenTester.startAddContracts(
              newTroveManager.address, newStabilityPool.address, newBorrowerOperations.address, 
              { from: owner }
            )
          const timeNow = await getLatestBlockTimestamp(web3)
          assert.equal(await thusdTokenTester.pendingTroveManager(), newTroveManager.address)
          assert.equal(await thusdTokenTester.pendingStabilityPool(), newStabilityPool.address)
          assert.equal(await thusdTokenTester.pendingBorrowerOperations(), newBorrowerOperations.address)
          assert.equal(await thusdTokenTester.addContractsInitiated(), timeNow)
          
          assert.isFalse(await thusdTokenTester.isTroveManager(newTroveManager.address))
          assert.isFalse(await thusdTokenTester.isStabilityPools(newStabilityPool.address))
          assert.isFalse(await thusdTokenTester.isBorrowerOperations(newBorrowerOperations.address))
          assert.isFalse(await thusdTokenTester.mintList(newBorrowerOperations.address))
        })
        
        it('finalizeAddContracts(): reverts when caller is not owner', async () => {
          await assertRevert(
            thusdTokenTester.finalizeAddContracts(
              newTroveManager.address, newStabilityPool.address, newBorrowerOperations.address, 
              { from: alice }),
              "Ownable: caller is not the owner")
        })

        it('finalizeAddContracts(): reverts when change is not initiated', async () => {
          await assertRevert(
            thusdTokenTester.finalizeAddContracts(
              newTroveManager.address, newStabilityPool.address, newBorrowerOperations.address, 
              { from: owner }),
              "Change not initiated")
        })

        it('finalizeAddContracts(): reverts when passed not enough time', async () => {
          await thusdTokenTester.startAddContracts(
              newTroveManager.address, newStabilityPool.address, newBorrowerOperations.address, 
              { from: owner }
            )
          await assertRevert(
            thusdTokenTester.finalizeAddContracts(
              newTroveManager.address, newStabilityPool.address, newBorrowerOperations.address, 
              { from: owner }),
              "Governance delay has not elapsed")
        })
        
        it('finalizeAddContracts(): reverts when provided wrong addresses', async () => {
          await thusdTokenTester.startAddContracts(
              newTroveManager.address, newStabilityPool.address, newBorrowerOperations.address, 
              { from: owner }
            )
          await fastForwardTime(delay, web3.currentProvider)

          await assertRevert(
            thusdTokenTester.finalizeAddContracts(
              troveManager.address, newStabilityPool.address, newBorrowerOperations.address, 
              { from: owner }),
          )
          await assertRevert(
            thusdTokenTester.finalizeAddContracts(
              newTroveManager.address, stabilityPool.address, newBorrowerOperations.address, 
              { from: owner }),
          )
          await assertRevert(
            thusdTokenTester.finalizeAddContracts(
              newTroveManager.address, newStabilityPool.address, borrowerOperations.address, 
              { from: owner }),
          )
        })

        it('finalizeAddContracts(): enables new system contracts roles', async () => {
          await thusdTokenTester.startAddContracts(
              newTroveManager.address, newStabilityPool.address, newBorrowerOperations.address, 
              { from: owner }
            )
          await fastForwardTime(delay, web3.currentProvider)
          
          let tx = await thusdTokenTester.finalizeAddContracts(
            newTroveManager.address, newStabilityPool.address, newBorrowerOperations.address, 
            { from: owner })

          assert.equal(await thusdTokenTester.pendingTroveManager(), ZERO_ADDRESS)
          assert.equal(await thusdTokenTester.pendingStabilityPool(), ZERO_ADDRESS)
          assert.equal(await thusdTokenTester.pendingBorrowerOperations(), ZERO_ADDRESS)
          assert.equal(await thusdTokenTester.addContractsInitiated(), 0)
          
          assert.isTrue(await thusdTokenTester.isTroveManager(troveManager.address))
          assert.isTrue(await thusdTokenTester.isTroveManager(newTroveManager.address))
          assert.isFalse(await thusdTokenTester.isTroveManager(newStabilityPool.address))
          assert.isFalse(await thusdTokenTester.isTroveManager(newBorrowerOperations.address))
          
          assert.isFalse(await thusdTokenTester.isStabilityPools(newTroveManager.address))
          assert.isTrue(await thusdTokenTester.isStabilityPools(stabilityPool.address))
          assert.isTrue(await thusdTokenTester.isStabilityPools(newStabilityPool.address))
          assert.isFalse(await thusdTokenTester.isStabilityPools(newBorrowerOperations.address))
          
          assert.isFalse(await thusdTokenTester.isBorrowerOperations(newTroveManager.address))
          assert.isFalse(await thusdTokenTester.isBorrowerOperations(newStabilityPool.address))
          assert.isTrue(await thusdTokenTester.isBorrowerOperations(newBorrowerOperations.address))
          assert.isTrue(await thusdTokenTester.isBorrowerOperations(borrowerOperations.address))
          
          assert.isFalse(await thusdTokenTester.mintList(newTroveManager.address))
          assert.isFalse(await thusdTokenTester.mintList(newStabilityPool.address))
          assert.isTrue(await thusdTokenTester.mintList(newBorrowerOperations.address))
          assert.isTrue(await thusdTokenTester.mintList(borrowerOperations.address))
          
          assert.equal(getEventArgByIndex(tx, "TroveManagerAddressChanged", 0), newTroveManager.address)
          assert.equal(getEventArgByIndex(tx, "StabilityPoolAddressChanged", 0), newStabilityPool.address)
          assert.equal(getEventArgByIndex(tx, "BorrowerOperationsAddressChanged", 0), newBorrowerOperations.address)
        })
      })

      it('startRevokeMintList(): reverts when caller is not owner', async () => {
        await assertRevert(
          thusdTokenTester.startRevokeMintList(
            borrowerOperations.address, 
            { from: alice }),
            "Ownable: caller is not the owner")
      })

      it('startRevokeMintList(): reverts when account has no minting role', async () => {
        await assertRevert(
          thusdTokenTester.startRevokeMintList(
            alice, 
            { from: owner }),
            "Incorrect address to revoke")
      })

      it('startRevokeMintList(): puts account to pending list', async () => {
        await thusdTokenTester.startRevokeMintList(borrowerOperations.address, { from: owner })
        
        const timeNow = await getLatestBlockTimestamp(web3)
        assert.equal(await thusdTokenTester.pendingRevokedMintAddress(), borrowerOperations.address)
        assert.equal(await thusdTokenTester.revokeMintListInitiated(), timeNow)
        
        assert.isTrue(await thusdTokenTester.mintList(borrowerOperations.address))
      })

      it('finalizeRevokeMintList(): reverts when caller is not owner', async () => {
        await assertRevert(
          thusdTokenTester.finalizeRevokeMintList(
            borrowerOperations.address,
            { from: alice }),
            "Ownable: caller is not the owner")
      })

      it('finalizeRevokeMintList(): reverts when change is not initiated', async () => {
        await assertRevert(
          thusdTokenTester.finalizeRevokeMintList(
            borrowerOperations.address, 
            { from: owner }),
            "Change not initiated")
      })

      it('finalizeRevokeMintList(): reverts when passed not enough time', async () => {
        await thusdTokenTester.startRevokeMintList(
            borrowerOperations.address, 
            { from: owner }
          )
        await assertRevert(
          thusdTokenTester.finalizeRevokeMintList(
            borrowerOperations.address, 
            { from: owner }),
            "Governance delay has not elapsed")
      })
      
      it('finalizeRevokeMintList(): reverts when provided wrong address', async () => {
        await thusdTokenTester.startRevokeMintList(
            borrowerOperations.address, 
            { from: owner }
          )
        await fastForwardTime(delay, web3.currentProvider)

        await assertRevert(
          thusdTokenTester.finalizeRevokeMintList(
            alice, 
            { from: owner }),
            "Incorrect address to finalize"
        )
      })

      it('finalizeRevokeMintList(): removes account from minting list', async () => {
        await thusdTokenTester.startRevokeMintList(
            borrowerOperations.address, 
            { from: owner }
          )
        await fastForwardTime(delay, web3.currentProvider)
        
        let tx = await thusdTokenTester.finalizeRevokeMintList(
          borrowerOperations.address, 
          { from: owner })

        assert.equal(await thusdTokenTester.pendingRevokedMintAddress(), ZERO_ADDRESS)
        assert.equal(await thusdTokenTester.revokeMintListInitiated(), 0)
        
        assert.isFalse(await thusdTokenTester.mintList(borrowerOperations.address))
      })
    }
  }
  describe('Basic token functions, without Proxy', async () => {
    testCorpus({ withProxy: false })
  })

  describe('Basic token functions, with Proxy', async () => {
    testCorpus({ withProxy: true })
  })
})



contract('Reset chain state', async accounts => {})
