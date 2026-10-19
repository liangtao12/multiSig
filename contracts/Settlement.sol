// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./OrderStorage.sol";
import "./Reconciliation.sol";
import "./AccessControl.sol";
import "./MultiSigWallet.sol";

/**
 * @title Settlement
 * @notice 净额清算合约。对账完成后，系统计算各方净额头寸，
 *         生成清算方案并提交多签审批。多签确认后自动执行支付。
 *         实现"对账→多签确认→净额清算"的完整资金控制链路。
 */
contract Settlement is AccessControl {
    OrderStorage public orderStorage;
    Reconciliation public reconciliation;
    MultiSigWallet public multiSigWallet;

    event SettlementProposed(uint indexed batchId, uint indexed reconBatchId, uint totalPayout);
    event SettlementApproved(uint indexed batchId);
    event SettlementExecuted(uint indexed batchId, uint settledCount, uint totalPaid);
    event PaymentExecuted(address indexed recipient, uint amount);
    event EscrowDeposited(address indexed depositor, uint amount, uint totalBalance);

    enum SettlementStatus { Proposed, Approved, Executed, Rejected }

    struct NetPosition {
        address participant;
        int256 netAmount;       // 正=应收, 负=应付
    }

    struct SettlementBatch {
        uint batchId;
        uint reconciliationBatchId;
        uint proposedAt;
        uint executedAt;
        SettlementStatus status;
        uint totalPayout;       // 需要支付的总金额
        uint settledCount;      // 已支付的参与方数
    }

    uint public nextBatchId;
    mapping(uint => SettlementBatch) public batches;
    mapping(uint => NetPosition[]) public batchPositions;  // batchId => net positions

    // Escrow
    uint public totalEscrow;
    mapping(address => uint) public escrowDeposits;

    constructor(address _orderStorage, address _reconciliation, address payable _multiSigWallet) {
        orderStorage = OrderStorage(_orderStorage);
        reconciliation = Reconciliation(_reconciliation);
        multiSigWallet = MultiSigWallet(_multiSigWallet);
    }

    /**
     * @notice 提出清算方案：基于对账结果计算净额，等待多签审批
     * @param _reconBatchId 已完成的对账批次ID
     * @return batchId 清算批次ID
     */
    function proposeSettlement(uint _reconBatchId) public onlyRole(OPERATOR_ROLE) whenNotPaused nonReentrant returns (uint) {
        Reconciliation.ReconciliationBatch memory reconBatch = reconciliation.getBatch(_reconBatchId);
        require(reconBatch.completed, "Reconciliation not completed");

        uint batchId = nextBatchId;

        // 计算净额头寸
        uint totalPayout = _calculateNetPositions(batchId, _reconBatchId);

        batches[batchId] = SettlementBatch({
            batchId: batchId,
            reconciliationBatchId: _reconBatchId,
            proposedAt: block.timestamp,
            executedAt: 0,
            status: SettlementStatus.Proposed,
            totalPayout: totalPayout,
            settledCount: 0
        });
        nextBatchId++;

        emit SettlementProposed(batchId, _reconBatchId, totalPayout);
        return batchId;
    }

    /**
     * @notice 多签审批通过后，标记清算为已批准（由多签钱包调用）
     * @param _batchId 清算批次ID
     */
    function approveSettlement(uint _batchId) public whenNotPaused nonReentrant {
        // 只允许多签钱包合约调用
        require(msg.sender == address(multiSigWallet), "Only multisig can approve");
        SettlementBatch storage batch = batches[_batchId];
        require(batch.status == SettlementStatus.Proposed, "Not in proposed state");

        batch.status = SettlementStatus.Approved;
        emit SettlementApproved(_batchId);
    }

    /**
     * @notice 执行已批准的清算，向净额为正的参与方支付
     *         资金来源：买家已预存 escrow 余额
     * @param _batchId 清算批次ID
     */
    function executeSettlement(uint _batchId) public payable onlyRole(OPERATOR_ROLE) whenNotPaused nonReentrant {
        SettlementBatch storage batch = batches[_batchId];
        require(batch.status == SettlementStatus.Approved, "Settlement not approved");

        // 将 msg.value 计入 escrow
        if (msg.value > 0) {
            totalEscrow += msg.value;
            escrowDeposits[msg.sender] += msg.value;
            emit EscrowDeposited(msg.sender, msg.value, totalEscrow);
        }

        NetPosition[] storage positions = batchPositions[_batchId];
        uint settledCount = 0;
        uint totalPaid = 0;
        uint totalCharged = 0;

        // 先从负头寸参与方（买家）的预存款中扣减，确保资金来源明确
        for (uint i = 0; i < positions.length; i++) {
            if (positions[i].netAmount < 0) {
                uint charge = uint256(-positions[i].netAmount);
                require(escrowDeposits[positions[i].participant] >= charge, "Insufficient buyer prepaid balance");
                escrowDeposits[positions[i].participant] -= charge;
                totalCharged += charge;
            }
        }

        for (uint i = 0; i < positions.length; i++) {
            if (positions[i].netAmount > 0) {
                uint payout = uint256(positions[i].netAmount);
                require(address(this).balance >= payout, "Insufficient escrow balance");
                (bool success, ) = payable(positions[i].participant).call{value: payout}("");
                require(success, "Transfer failed");
                emit PaymentExecuted(positions[i].participant, payout);
                totalPaid += payout;
                settledCount++;
            }
        }

        require(totalCharged >= totalPaid, "Charged amount less than payout");
        totalEscrow -= totalPaid;
        batch.executedAt = block.timestamp;
        batch.status = SettlementStatus.Executed;
        batch.settledCount = settledCount;

        emit SettlementExecuted(_batchId, settledCount, totalPaid);
    }

    /**
     * @notice 计算净额头寸（内部函数）
     */
    function _calculateNetPositions(uint _batchId, uint _reconBatchId) internal returns (uint totalPayout) {
        uint[] memory reconciledOrders = reconciliation.getReconciledOrders(_reconBatchId);

        // 收集所有参与方
        address[] memory participants = new address[](reconciledOrders.length * 2);
        int256[] memory nets = new int256[](reconciledOrders.length * 2);
        uint participantCount = 0;

        for (uint i = 0; i < reconciledOrders.length; i++) {
            OrderStorage.Order memory order = orderStorage.getOrder(reconciledOrders[i]);

            // 买家: 应付（净额减少）
            uint buyerIdx = _findOrAdd(participants, participantCount, order.buyer);
            if (buyerIdx == participantCount) participantCount++;
            nets[buyerIdx] -= int256(order.amount);

            // 卖家: 应收（净额增加）
            uint sellerIdx = _findOrAdd(participants, participantCount, order.seller);
            if (sellerIdx == participantCount) participantCount++;
            nets[sellerIdx] += int256(order.amount);
        }

        // 存储净额头寸
        totalPayout = 0;
        for (uint i = 0; i < participantCount; i++) {
            batchPositions[_batchId].push(NetPosition({
                participant: participants[i],
                netAmount: nets[i]
            }));
            if (nets[i] > 0) {
                totalPayout += uint256(nets[i]);
            }
        }
    }

    function _findOrAdd(address[] memory arr, uint count, address target) internal pure returns (uint) {
        for (uint i = 0; i < count; i++) {
            if (arr[i] == target) return i;
        }
        arr[count] = target;
        return count;
    }

    function getBatch(uint _batchId) public view returns (SettlementBatch memory) {
        return batches[_batchId];
    }

    function getNetPositions(uint _batchId) public view returns (NetPosition[] memory) {
        return batchPositions[_batchId];
    }

    function getSettlementDetails(uint _batchId) public view returns (
        uint[] memory orderIds, address[] memory buyers, address[] memory sellers, uint[] memory amounts
    ) {
        SettlementBatch storage batch = batches[_batchId];
        uint[] memory reconciledOrders = reconciliation.getReconciledOrders(batch.reconciliationBatchId);

        orderIds = new uint[](reconciledOrders.length);
        buyers = new address[](reconciledOrders.length);
        sellers = new address[](reconciledOrders.length);
        amounts = new uint[](reconciledOrders.length);

        for (uint i = 0; i < reconciledOrders.length; i++) {
            OrderStorage.Order memory order = orderStorage.getOrder(reconciledOrders[i]);
            orderIds[i] = reconciledOrders[i];
            buyers[i] = order.buyer;
            sellers[i] = order.seller;
            amounts[i] = order.amount;
        }
    }

    receive() external payable {
        totalEscrow += msg.value;
        escrowDeposits[msg.sender] += msg.value;
        emit EscrowDeposited(msg.sender, msg.value, totalEscrow);
    }

    function depositEscrow() external payable whenNotPaused nonReentrant {
        require(msg.value > 0, "Must deposit ETH");
        totalEscrow += msg.value;
        escrowDeposits[msg.sender] += msg.value;
        emit EscrowDeposited(msg.sender, msg.value, totalEscrow);
    }

    /**
     * @notice 为指定账户增加预存余额（例如争议裁决退款原路退回到买家预存）
     *         仅 OPERATOR_ROLE 可调用
     * @param beneficiary 预存余额被记入的账户地址
     */
    function depositEscrowFor(address beneficiary) external payable onlyRole(OPERATOR_ROLE) whenNotPaused nonReentrant {
        require(beneficiary != address(0), "Invalid beneficiary");
        require(msg.value > 0, "Must deposit ETH");
        totalEscrow += msg.value;
        escrowDeposits[beneficiary] += msg.value;
        // 复用 EscrowDeposited 事件，将 beneficiary 作为 depositor 记录，便于前端统一处理
        emit EscrowDeposited(beneficiary, msg.value, totalEscrow);
    }

    function getEscrowInfo() external view returns (uint _totalEscrow, uint _contractBalance) {
        return (totalEscrow, address(this).balance);
    }
}