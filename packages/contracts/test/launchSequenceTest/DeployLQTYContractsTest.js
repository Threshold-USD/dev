const deploymentHelper = require("../../utils/deploymentHelpers.js")
const testHelpers = require("../../utils/testHelpers.js")

const th = testHelpers.TestHelper
const timeValues = testHelpers.TimeValues
const assertRevert = th.assertRevert
const toBN = th.toBN
const dec = th.dec

contract('Deploying the LQTY contracts: LCF, CI, LQTYStaking, and LQTYToken ', async accounts => {
  const [liquityAG, A, B] = accounts;
  const [bountyAddress, lpRewardsAddress, multisig] = accounts.slice(997, 1000)

  let LQTYContracts

  const oneMillion = toBN(1000000)
  const digits = toBN(1e18)
  const thirtyTwo = toBN(32)
  const expectedCISupplyCap = thirtyTwo.mul(oneMillion).mul(digits)

  beforeEach(async () => {
    // Deploy all contracts from the first account
    LQTYContracts = await deploymentHelper.deployLQTYContracts(bountyAddress, lpRewardsAddress, multisig)
    await deploymentHelper.connectLQTYContracts(LQTYContracts)

    lqtyStaking = LQTYContracts.lqtyStaking
    lqtyToken = LQTYContracts.lqtyToken
    lockupContractFactory = LQTYContracts.lockupContractFactory

    //LQTY Staking has not yet had their setters called, so are not yet
    // connected to the rest of the system
  })

  describe('LQTYStaking deployment', async accounts => {
    it("Stores the deployer's address", async () => {
      const storedDeployerAddress = await lqtyStaking.owner()

      assert.equal(liquityAG, storedDeployerAddress)
    })
  })

  describe('LQTYToken deployment', async accounts => {
    it("Stores the multisig's address", async () => {
      const storedMultisigAddress = await lqtyToken.multisigAddress()

      assert.equal(multisig, storedMultisigAddress)
    })

    it("Stores the LockupContractFactory address", async () => {
      const storedLCFAddress = await lqtyToken.lockupContractFactory()

      assert.equal(lockupContractFactory.address, storedLCFAddress)
    })

    it("Mints the correct LQTY amount to the multisig's address: (64.66 million)", async () => {
      const multisigLQTYEntitlement = await lqtyToken.balanceOf(multisig)

     const twentyThreeSixes = "6".repeat(23)
      const expectedMultisigEntitlement = "64".concat(twentyThreeSixes).concat("7")
      assert.equal(multisigLQTYEntitlement, expectedMultisigEntitlement)
    })

    it("Mints the correct LQTY amount to the bountyAddress EOA: 2 million", async () => {
      const bountyAddressBal = await lqtyToken.balanceOf(bountyAddress)
      // 2 million as 18-digit decimal
      const _2Million = dec(2, 24)

      assert.equal(bountyAddressBal, _2Million)
    })

    it("Mints the correct LQTY amount to the lpRewardsAddress EOA: 1.33 million", async () => {
      const lpRewardsAddressBal = await lqtyToken.balanceOf(lpRewardsAddress)
      // 1.3 million as 18-digit decimal
      const _1pt33Million = "1".concat("3".repeat(24))

      assert.equal(lpRewardsAddressBal, _1pt33Million)
    })
  })

  describe('Connecting LQTYToken to LCF, CI and LQTYStaking', async accounts => {
    it('sets the correct LQTYToken address in LQTYStaking', async () => {
      // Deploy core contracts and set the LQTYToken address in the CI and LQTYStaking
      const coreContracts = await deploymentHelper.deployLiquityCore()
      await deploymentHelper.connectLQTYContractsToCore(LQTYContracts, coreContracts)

      const lqtyTokenAddress = lqtyToken.address

      const recordedLQTYTokenAddress = await lqtyStaking.lqtyToken()
      assert.equal(lqtyTokenAddress, recordedLQTYTokenAddress)
    })

    it('sets the correct LQTYToken address in LockupContractFactory', async () => {
      const lqtyTokenAddress = lqtyToken.address

      const recordedLQTYTokenAddress = await lockupContractFactory.lqtyTokenAddress()
      assert.equal(lqtyTokenAddress, recordedLQTYTokenAddress)
    })

  })
})
