// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title MultiSigWallet
 * @notice 多签钱包合约，要求 N-of-M 确认后才可执行交易。
 *         用于保护社区团购清算资金，防止单点作恶。
 */
contract MultiSigWallet {
    event Deposit(address indexed sender, uint amount, uint balance);
    event SubmitTransaction(
        address indexed owner,
        uint indexed txIndex,
        address indexed to,
        uint value,
        bytes data
    );
    event ConfirmTransaction(address indexed owner, uint indexed txIndex);
    event RevokeConfirmation(address indexed owner, uint indexed txIndex);
    event ExecuteTransaction(address indexed owner, uint indexed txIndex);

    address[] public owners;
    mapping(address => bool) public isOwner;
    uint public required;

    struct Transaction {
        address to;
        uint value;
        bytes data;
        bool executed;
        mapping(address => bool) isConfirmed;
        mapping(address => bool) allowedConfirmer;
        address[] allowedConfirmers;
        bool restricted;
        uint numConfirmations;
    }

    Transaction[] public transactions;

    modifier onlyOwner() {
        require(isOwner[msg.sender], "not owner");
        _;
    }

    modifier txExists(uint _txIndex) {
        require(_txIndex < transactions.length, "tx does not exist");
        _;
    }

    modifier notExecuted(uint _txIndex) {
        require(!transactions[_txIndex].executed, "tx already executed");
        _;
    }

    modifier notConfirmed(uint _txIndex) {
        require(!transactions[_txIndex].isConfirmed[msg.sender], "tx already confirmed");
        _;
    }

    constructor(address[] memory _owners, uint _required) {
        require(_owners.length > 0, "owners required");
        require(_required > 0 && _required <= _owners.length, "invalid required number of owners");

        for (uint i = 0; i < _owners.length; i++) {
            address owner = _owners[i];
            require(owner != address(0), "invalid owner");
            require(!isOwner[owner], "owner not unique");

            isOwner[owner] = true;
            owners.push(owner);
        }

        required = _required;
    }

    receive() external payable {
        emit Deposit(msg.sender, msg.value, address(this).balance);
    }

    /**
     * @notice 提交多签交易，仅 Owner 可调用
     * @param _to    收款地址
     * @param _value 转账金额（wei）
     * @param _data  附加调用数据
     */
    function submitTransaction(address _to, uint _value, bytes memory _data) public onlyOwner {
        uint txIndex = transactions.length;

        transactions.push();
        Transaction storage newTx = transactions[txIndex];
        newTx.to = _to;
        newTx.value = _value;
        newTx.data = _data;
        newTx.executed = false;
        newTx.restricted = false;
        newTx.numConfirmations = 0;

        emit SubmitTransaction(msg.sender, txIndex, _to, _value, _data);
    }

    function submitRestrictedTransaction(
        address _to,
        uint _value,
        bytes memory _data,
        address[] memory _allowedConfirmers
    ) public onlyOwner {
        require(_allowedConfirmers.length >= required, "not enough allowed confirmers");
        uint txIndex = transactions.length;

        transactions.push();
        Transaction storage newTx = transactions[txIndex];
        newTx.to = _to;
        newTx.value = _value;
        newTx.data = _data;
        newTx.executed = false;
        newTx.restricted = true;
        newTx.numConfirmations = 0;

        for (uint i = 0; i < _allowedConfirmers.length; i++) {
            address confirmer = _allowedConfirmers[i];
            require(isOwner[confirmer], "allowed confirmer not owner");
            if (!newTx.allowedConfirmer[confirmer]) {
                newTx.allowedConfirmer[confirmer] = true;
                newTx.allowedConfirmers.push(confirmer);
            }
        }

        require(newTx.allowedConfirmer[msg.sender], "submitter not allowed");
        emit SubmitTransaction(msg.sender, txIndex, _to, _value, _data);
    }

    /**
     * @notice 确认交易，仅 Owner 可调用
     * @param _txIndex 交易索引
     */
    function confirmTransaction(uint _txIndex) public onlyOwner txExists(_txIndex) notExecuted(_txIndex) notConfirmed(_txIndex) {
        Transaction storage txn = transactions[_txIndex];
        require(!txn.restricted || txn.allowedConfirmer[msg.sender], "not related confirmer");
        txn.isConfirmed[msg.sender] = true;
        txn.numConfirmations += 1;

        emit ConfirmTransaction(msg.sender, _txIndex);
    }

    /**
     * @notice 执行交易，达到 required 确认数后仅 Owner 可调用
     * @param _txIndex 交易索引
     */
    function executeTransaction(uint _txIndex) public onlyOwner txExists(_txIndex) notExecuted(_txIndex) {
        Transaction storage txn = transactions[_txIndex];

        require(txn.numConfirmations >= required, "not enough confirmations");

        txn.executed = true;

        (bool success, ) = txn.to.call{value: txn.value}(txn.data);
        require(success, "tx failed");

        emit ExecuteTransaction(msg.sender, _txIndex);
    }

    /**
     * @notice 撤回确认，仅 Owner 可调用
     * @param _txIndex 交易索引
     */
    function revokeConfirmation(uint _txIndex) public onlyOwner txExists(_txIndex) notExecuted(_txIndex) {
        Transaction storage txn = transactions[_txIndex];
        require(!txn.restricted || txn.allowedConfirmer[msg.sender], "not related confirmer");

        require(txn.isConfirmed[msg.sender], "tx not confirmed");

        txn.isConfirmed[msg.sender] = false;
        txn.numConfirmations -= 1;

        emit RevokeConfirmation(msg.sender, _txIndex);
    }

    function getOwners() public view returns (address[] memory) {
        return owners;
    }

    function getTransactionCount() public view returns (uint) {
        return transactions.length;
    }

    function getTransaction(uint _txIndex) public view returns (
        address to,
        uint value,
        bytes memory data,
        bool executed,
        uint numConfirmations
    ) {
        Transaction storage txn = transactions[_txIndex];

        return (
            txn.to,
            txn.value,
            txn.data,
            txn.executed,
            txn.numConfirmations
        );
    }

    function isConfirmed(uint _txIndex, address _owner) public view returns (bool) {
        Transaction storage txn = transactions[_txIndex];
        return txn.isConfirmed[_owner];
    }

    function isAllowedConfirmer(uint _txIndex, address _owner) public view returns (bool) {
        Transaction storage txn = transactions[_txIndex];
        return !txn.restricted || txn.allowedConfirmer[_owner];
    }

    function getAllowedConfirmers(uint _txIndex) public view returns (address[] memory) {
        Transaction storage txn = transactions[_txIndex];
        if (!txn.restricted) {
            return owners;
        }
        return txn.allowedConfirmers;
    }
}