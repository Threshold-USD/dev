// SPDX-License-Identifier: MIT

pragma solidity ^0.8.10;

import "./Interfaces/ITHUSDToken.sol";
import "./Dependencies/CheckContract.sol";
import "./Dependencies/Ownable.sol";
import "./Dependencies/console.sol";
import "./Dependencies/Bits.sol";

/*
*
* Based upon OpenZeppelin's ERC20 contract:
* https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/token/ERC20/ERC20.sol
*
* and their EIP2612 (ERC20Permit / ERC712) functionality:
* https://github.com/OpenZeppelin/openzeppelin-contracts/blob/53516bc555a454862470e7860a9b5254db4d00f5/contracts/token/ERC20/ERC20Permit.sol
*
*
* --- Functionality added specific to the THUSDToken ---
*
* 1) Transfer protection: blacklist of addresses that are invalid recipients (i.e. core Liquity contracts) in external
* transfer() and transferFrom() calls. The purpose is to protect users from losing tokens by mistakenly sending THUSD directly to a Liquity
* core contract, when they should rather call the right function.
*
* 2) sendToPool() and returnFromPool(): functions callable only Liquity core contracts, which move THUSD tokens between Liquity <-> user.
*/

contract THUSDToken is Ownable, CheckContract, ITHUSDToken {

    using Bits for uint256;

    uint256 private _totalSupply;
    string constant internal _NAME = "thUSD Stablecoin";
    string constant internal _SYMBOL = "thUSD";
    string constant internal _VERSION = "1";
    uint8 constant internal _DECIMALS = 18;

    // --- Data for EIP2612 ---

    // keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)");
    bytes32 private constant _PERMIT_TYPEHASH = 0x6e71edae12b1b97f4d1f60370fef10105fa2faae0126114a169c64845d6126c9;
    // keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");
    bytes32 private constant _TYPE_HASH = 0x8b73c3c69bb8fe3d512ecc4cf759cc79239f7b179b0ffacaa9a75d522b39400f;

    // Cache the domain separator as an immutable value, but also store the chain id that it corresponds to, in order to
    // invalidate the cached domain separator if the chain id changes.
    bytes32 private immutable _CACHED_DOMAIN_SEPARATOR;
    uint256 private immutable _CACHED_CHAIN_ID;

    bytes32 private immutable _HASHED_NAME;
    bytes32 private immutable _HASHED_VERSION;

    mapping (address => uint256) private _nonces;

    // User data for THUSD token
    mapping (address => uint256) private _balances;
    mapping (address => mapping (address => uint256)) private _allowances;

    // --- Addresses ---
    mapping(address => uint256) public serviceContracts;

    uint8 internal constant MINT_ROLE_INDEX = 0;
    uint8 internal constant BURN_ROLE_INDEX = 1;
    uint8 internal constant SEND_TO_POOL_ROLE_INDEX = 2;
    uint8 internal constant RETURN_FROM_POOL_ROLE_INDEX = 3;

    uint256 public constant GOVERNANCE_TIME_DELAY = 90 days;

    address public pendingTroveManager;
    address public pendingStabilityPool;
    address public pendingBorrowerOperations;
    address public pendingRevokedMintAddress;
    uint256 public revokeMintListInitiated;
    uint256 public addContractsInitiated;

    constructor
    (
        address _troveManagerAddress,
        address _stabilityPoolAddress,
        address _borrowerOperationsAddress
    )
    {
        // when created its linked to one set of contracts and collateral, other collateral types can be added via governance
        _addSystemContracts(_troveManagerAddress, _stabilityPoolAddress, _borrowerOperationsAddress);
        bytes32 hashedName = keccak256(bytes(_NAME));
        bytes32 hashedVersion = keccak256(bytes(_VERSION));

        _HASHED_NAME = hashedName;
        _HASHED_VERSION = hashedVersion;
        _CACHED_CHAIN_ID = _chainID();
        _CACHED_DOMAIN_SEPARATOR = _buildDomainSeparator(_TYPE_HASH, hashedName, hashedVersion);
    }

    modifier onlyAfterGovernanceDelay(
        uint256 _changeInitializedTimestamp,
        uint256 _delay
    ) {
        require(_changeInitializedTimestamp > 0, "Change not initiated");
        require(
            block.timestamp >= _changeInitializedTimestamp + _delay,
            "Governance delay has not elapsed"
        );
        _;
    }

    // --- Governance ---

    function startRevokeMintList(address _account)
        external
        onlyOwner
    {
        require(serviceContracts[_account].bitSet(MINT_ROLE_INDEX), "Incorrect address to revoke");

        revokeMintListInitiated = block.timestamp;
        pendingRevokedMintAddress = _account;
    }

    function finalizeRevokeMintList(address _account)
        external
        onlyOwner
        onlyAfterGovernanceDelay(
            revokeMintListInitiated,
            GOVERNANCE_TIME_DELAY
        )
    {
        require(pendingRevokedMintAddress == _account, "Incorrect address to finalize");

        serviceContracts[_account] = serviceContracts[_account].toggleBit(MINT_ROLE_INDEX);
        revokeMintListInitiated = 0;
    }

    function startAddContracts(address _troveManagerAddress, address _stabilityPoolAddress, address _borrowerOperationsAddress)
        external
        onlyOwner
    {
        checkContract(_troveManagerAddress);
        checkContract(_stabilityPoolAddress);
        checkContract(_borrowerOperationsAddress);

        // save as provisional contracts to add
        pendingTroveManager = _troveManagerAddress;
        pendingStabilityPool = _stabilityPoolAddress;
        pendingBorrowerOperations = _borrowerOperationsAddress;

        // save block number
        addContractsInitiated = block.timestamp;
    }

    function finalizeAddContracts(address _troveManagerAddress, address _stabilityPoolAddress, address _borrowerOperationsAddress)
        external
        onlyOwner
        onlyAfterGovernanceDelay(
            addContractsInitiated,
            GOVERNANCE_TIME_DELAY
        )
    {
        // check contracts are the same
        require(
          pendingTroveManager == _troveManagerAddress &&
          pendingStabilityPool == _stabilityPoolAddress &&
          pendingBorrowerOperations == _borrowerOperationsAddress
        );
        // make sure minimum blocks has passed
        _addSystemContracts(_troveManagerAddress, _stabilityPoolAddress, _borrowerOperationsAddress);
        addContractsInitiated = 0;
    }

    // --- Functions for intra-Liquity calls ---

    function mint(address _account, uint256 _amount) external override {
        require(serviceContracts[msg.sender].bitSet(MINT_ROLE_INDEX), "THUSDToken: Caller not allowed to mint");
        _mint(_account, _amount);
    }

    function burn(address _account, uint256 _amount) external override {
        require(serviceContracts[msg.sender].bitSet(BURN_ROLE_INDEX), "THUSD: Caller is neither BorrowerOperations nor TroveManager nor StabilityPool");
        _burn(_account, _amount);
    }

    function sendToPool(address _sender,  address _poolAddress, uint256 _amount) external override {
        require(serviceContracts[msg.sender].bitSet(SEND_TO_POOL_ROLE_INDEX), "THUSD: Caller is not the StabilityPool");
        _transfer(_sender, _poolAddress, _amount);
    }

    function returnFromPool(address _poolAddress, address _receiver, uint256 _amount) external override {
        require(serviceContracts[msg.sender].bitSet(RETURN_FROM_POOL_ROLE_INDEX), "THUSD: Caller is neither TroveManager nor StabilityPool");
        _transfer(_poolAddress, _receiver, _amount);
    }

    // --- External functions ---

    function totalSupply() external view override returns (uint256) {
        return _totalSupply;
    }

    function balanceOf(address account) external view override returns (uint256) {
        return _balances[account];
    }

    function transfer(address recipient, uint256 amount) external override returns (bool) {
        _requireValidRecipient(recipient);
        _transfer(msg.sender, recipient, amount);
        return true;
    }

    function allowance(address owner, address spender) external view override returns (uint256) {
        return _allowances[owner][spender];
    }

    function approve(address spender, uint256 amount) external override returns (bool) {
        _approve(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(address sender, address recipient, uint256 amount) external override returns (bool) {
        _requireValidRecipient(recipient);
        _transfer(sender, recipient, amount);
        uint256 currentAllowance = _allowances[sender][msg.sender];
        require(currentAllowance >= amount, "ERC20: transfer amount exceeds allowance");
        _approve(sender, msg.sender, currentAllowance - amount);
        return true;
    }

    function increaseAllowance(address spender, uint256 addedValue) external override returns (bool) {
        _approve(msg.sender, spender, _allowances[msg.sender][spender] + addedValue);
        return true;
    }

    function decreaseAllowance(address spender, uint256 subtractedValue) external override returns (bool) {
        uint256 currentAllowance = _allowances[msg.sender][spender];
        require(currentAllowance >= subtractedValue, "ERC20: decreased allowance below zero");
        _approve(msg.sender, spender, currentAllowance - subtractedValue);
        return true;
    }

    // --- EIP 2612 Functionality ---

    function domainSeparator() public view override returns (bytes32) {
        if (_chainID() == _CACHED_CHAIN_ID) {
            return _CACHED_DOMAIN_SEPARATOR;
        } else {
            return _buildDomainSeparator(_TYPE_HASH, _HASHED_NAME, _HASHED_VERSION);
        }
    }

    function permit
    (
        address owner,
        address spender,
        uint256 amount,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    )
        external
        override
    {
        require(deadline >= block.timestamp, 'THUSD: expired deadline');
        bytes32 digest = keccak256(abi.encodePacked('\x19\x01',
                         domainSeparator(), keccak256(abi.encode(
                         _PERMIT_TYPEHASH, owner, spender, amount,
                         _nonces[owner]++, deadline))));
        address recoveredAddress = ecrecover(digest, v, r, s);
        require(recoveredAddress == owner, 'THUSD: invalid signature');
        _approve(owner, spender, amount);
    }

    function nonces(address owner) external view override returns (uint256) { // FOR EIP 2612
        return _nonces[owner];
    }

    function mintList(address contractAddress) external view returns (bool) {
        return serviceContracts[contractAddress].bitSet(MINT_ROLE_INDEX);
    }

    function getRoles(address contractAddress) external view returns (
        bool mintRole, 
        bool burnRole, 
        bool sendToPoolRole, 
        bool returnFromPoolRole
    ) {
        mintRole = serviceContracts[contractAddress].bitSet(MINT_ROLE_INDEX);
        burnRole = serviceContracts[contractAddress].bitSet(BURN_ROLE_INDEX);
        sendToPoolRole = serviceContracts[contractAddress].bitSet(SEND_TO_POOL_ROLE_INDEX);
        returnFromPoolRole = serviceContracts[contractAddress].bitSet(RETURN_FROM_POOL_ROLE_INDEX);
    }

    // --- Internal operations ---

    function _chainID() private view returns (uint256 chainID) {
        assembly {
            chainID := chainid()
        }
    }

    function _buildDomainSeparator(bytes32 typeHash, bytes32 hashedName, bytes32 hashedVersion) private view returns (bytes32) {
        return keccak256(abi.encode(typeHash, hashedName, hashedVersion, _chainID(), address(this)));
    }

    // --- Internal operations ---

    function _addSystemContracts(address _troveManagerAddress, address _stabilityPoolAddress, address _borrowerOperationsAddress) internal {
        checkContract(_troveManagerAddress);
        checkContract(_stabilityPoolAddress);
        checkContract(_borrowerOperationsAddress);

        serviceContracts[_troveManagerAddress] = serviceContracts[_troveManagerAddress]
            .toggleBit(BURN_ROLE_INDEX)
            .toggleBit(RETURN_FROM_POOL_ROLE_INDEX);

        emit TroveManagerAddressChanged(_troveManagerAddress);

        serviceContracts[_stabilityPoolAddress] = serviceContracts[_stabilityPoolAddress]
            .toggleBit(BURN_ROLE_INDEX)
            .toggleBit(SEND_TO_POOL_ROLE_INDEX)
            .toggleBit(RETURN_FROM_POOL_ROLE_INDEX);
        emit StabilityPoolAddressChanged(_stabilityPoolAddress);

        serviceContracts[_borrowerOperationsAddress] = serviceContracts[_borrowerOperationsAddress]
            .toggleBit(BURN_ROLE_INDEX)
            .toggleBit(MINT_ROLE_INDEX);
        emit BorrowerOperationsAddressChanged(_borrowerOperationsAddress);
    }

    // Warning: sanity checks (for sender and recipient) should have been done before calling these internal functions

    function _transfer(address sender, address recipient, uint256 amount) internal {
        assert(sender != address(0));
        assert(recipient != address(0));

        require(_balances[sender] >= amount, "ERC20: transfer amount exceeds balance");
        _balances[sender] -= amount;
        _balances[recipient] += amount;
        emit Transfer(sender, recipient, amount);
    }

    function _mint(address account, uint256 amount) internal {
        assert(account != address(0));

        _totalSupply = _totalSupply + amount;
        _balances[account] = _balances[account] + amount;
        emit Transfer(address(0), account, amount);
    }

    function _burn(address account, uint256 amount) internal {
        assert(account != address(0));

        require(_balances[account] >= amount, "ERC20: burn amount exceeds balance");
        _balances[account] -= amount;
        _totalSupply -= amount;
        emit Transfer(account, address(0), amount);
    }

    function _approve(address owner, address spender, uint256 amount) internal {
        assert(owner != address(0));
        assert(spender != address(0));

        _allowances[owner][spender] = amount;
        emit Approval(owner, spender, amount);
    }

    // --- 'require' functions ---

    function _requireValidRecipient(address _recipient) internal view {
        require(
            _recipient != address(0) &&
            _recipient != address(this),
            "THUSD: Cannot transfer tokens directly to the THUSD token contract or the zero address"
        );
    }

    // --- Optional functions ---

    function name() external pure override returns (string memory) {
        return _NAME;
    }

    function symbol() external pure override returns (string memory) {
        return _SYMBOL;
    }

    function decimals() external pure override returns (uint8) {
        return _DECIMALS;
    }

    function version() external pure override returns (string memory) {
        return _VERSION;
    }

    function permitTypeHash() external pure override returns (bytes32) {
        return _PERMIT_TYPEHASH;
    }
}
