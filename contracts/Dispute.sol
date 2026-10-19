// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./OrderStorage.sol";
import "./AccessControl.sol";
import "./Settlement.sol";

/**
 * @title Dispute
 * @notice 争议解决合约，实现 Open → UnderReview → Resolved → Executed 四阶段状态机。
 *         ARBITRATOR_ROLE 角色可认领审查并裁决，ADMIN_ROLE 可覆盖裁决。
 *         OPERATOR_ROLE 执行裁决后的资金支付。
 */
contract Dispute is AccessControl {
    OrderStorage public orderStorage;
    Settlement public settlement;

    bytes32 public constant ARBITRATOR_ROLE = keccak256("ARBITRATOR_ROLE");

    // State machine: 0=Open, 1=UnderReview, 2=Resolved, 3=Executed
    enum DisputeState { Open, UnderReview, Resolved, Executed }

    event DisputeCreated(uint indexed disputeId, uint indexed orderId, address indexed initiator, string reason);
    event DisputeUnderReview(uint indexed disputeId, address indexed arbitrator);
    event DisputeResolved(uint indexed disputeId, uint indexed orderId, bool sellerAtFault, uint settlementAmount);
    event DisputeExecuted(uint indexed disputeId, uint indexed orderId, address recipient, uint amount);
    event EvidenceSubmitted(uint indexed disputeId, address submitter, string evidence);

    struct DisputeCase {
        uint disputeId;
        uint orderId;
        address initiator;
        string reason;
        DisputeState state;
        bool sellerAtFault;
        uint settlementAmount;
        address arbitrator;
        uint createdAt;
        uint resolvedAt;
        uint executedAt;
    }

    uint public nextDisputeId;
    mapping(uint => DisputeCase) public disputes;
    mapping(uint => string[]) public evidence;
    mapping(uint => address[]) public evidenceSubmitters;  // parallel array for submitter addresses

    constructor(address _orderStorage, address payable _settlement) {
        orderStorage = OrderStorage(_orderStorage);
        settlement = Settlement(_settlement);
    }

    /**
     * @notice 创建争议，仅订单买卖双方或管理员可发起
     * @param _orderId 订单ID
     * @param _reason  争议原因
     * @return disputeId 新创建的争议ID
     */
    function createDispute(uint _orderId, string memory _reason) public nonReentrant returns (uint) {
        OrderStorage.Order memory order = orderStorage.getOrder(_orderId);
        require(order.orderId == _orderId, "Order does not exist");
        require(!order.reconciled, "Order already reconciled");
        require(!order.disputed, "Order already disputed");
        require(
            msg.sender == order.buyer || msg.sender == order.seller || hasRole(ADMIN_ROLE, msg.sender),
            "Only buyer/seller/admin can dispute"
        );

        uint disputeId = nextDisputeId;
        disputes[disputeId] = DisputeCase({
            disputeId: disputeId,
            orderId: _orderId,
            initiator: msg.sender,
            reason: _reason,
            state: DisputeState.Open,
            sellerAtFault: false,
            settlementAmount: 0,
            arbitrator: address(0),
            createdAt: block.timestamp,
            resolvedAt: 0,
            executedAt: 0
        });
        nextDisputeId++;

        orderStorage.markDisputed(_orderId);
        emit DisputeCreated(disputeId, _orderId, msg.sender, _reason);
        return disputeId;
    }

    /**
     * @notice 提交证据，Open 或 UnderReview 状态下均可提交
     * @param _disputeId 争议ID
     * @param _evidence  证据内容
     */
    function submitEvidence(uint _disputeId, string memory _evidence) public nonReentrant {
        DisputeCase storage dispute = disputes[_disputeId];
        require(dispute.disputeId == _disputeId, "Dispute does not exist");
        require(dispute.state == DisputeState.Open || dispute.state == DisputeState.UnderReview, "Dispute not accepting evidence");

        evidence[_disputeId].push(_evidence);
        evidenceSubmitters[_disputeId].push(msg.sender);
        emit EvidenceSubmitted(_disputeId, msg.sender, _evidence);
    }

    /**
     * @notice 仲裁员认领审查，将状态从 Open 转为 UnderReview
     * @param _disputeId 争议ID
     */
    function assignArbitrator(uint _disputeId) public onlyRole(ARBITRATOR_ROLE) nonReentrant {
        DisputeCase storage dispute = disputes[_disputeId];
        require(dispute.disputeId == _disputeId, "Dispute does not exist");
        require(dispute.state == DisputeState.Open, "Dispute not in Open state");

        dispute.state = DisputeState.UnderReview;
        dispute.arbitrator = msg.sender;
        emit DisputeUnderReview(_disputeId, msg.sender);
    }

    /**
     * @notice 裁决争议，仅指派仲裁员或管理员可调用
     * @param _disputeId        争议ID
     * @param _sellerAtFault    是否卖方责任
     * @param _settlementAmount 裁决金额（wei）
     */
    function resolveDispute(uint _disputeId, bool _sellerAtFault, uint _settlementAmount) public nonReentrant {
        DisputeCase storage dispute = disputes[_disputeId];
        require(dispute.disputeId == _disputeId, "Dispute does not exist");
        require(dispute.state == DisputeState.UnderReview, "Dispute not under review");
        require(
            hasRole(ARBITRATOR_ROLE, msg.sender) || hasRole(ADMIN_ROLE, msg.sender),
            "Must be arbitrator or admin"
        );
        require(msg.sender == dispute.arbitrator || hasRole(ADMIN_ROLE, msg.sender),
            "Only assigned arbitrator or admin can resolve"
        );

        dispute.state = DisputeState.Resolved;
        dispute.sellerAtFault = _sellerAtFault;
        dispute.settlementAmount = _settlementAmount;
        dispute.resolvedAt = block.timestamp;

        emit DisputeResolved(_disputeId, dispute.orderId, _sellerAtFault, _settlementAmount);
    }

    /**
     * @notice 执行裁决，向胜诉方支付裁决金额，仅 OPERATOR_ROLE 可调用
     * @param _disputeId 争议ID
     */
    function executeDispute(uint _disputeId) external onlyRole(OPERATOR_ROLE) whenNotPaused nonReentrant {
        DisputeCase storage dispute = disputes[_disputeId];
        require(dispute.disputeId == _disputeId, "Dispute does not exist");
        require(dispute.state == DisputeState.Resolved, "Dispute not resolved");
        require(dispute.settlementAmount > 0, "No settlement amount");

        OrderStorage.Order memory order = orderStorage.getOrder(dispute.orderId);
        if (dispute.sellerAtFault) {
            // 原路退回到买家预存余额（Settlement escrow）
            require(address(settlement) != address(0), "Settlement not set");
            (bool ok, ) = address(settlement).call{value: dispute.settlementAmount}(
                abi.encodeWithSelector(Settlement.depositEscrowFor.selector, order.buyer)
            );
            require(ok, "Refund to escrow failed");
        } else {
            // 买家责任：仍直接赔付给卖家
            (bool success, ) = payable(order.seller).call{value: dispute.settlementAmount}("");
            require(success, "Payment failed");
        }

        dispute.state = DisputeState.Executed;
        dispute.executedAt = block.timestamp;
        address finalRecipient = dispute.sellerAtFault ? order.buyer : order.seller;
        emit DisputeExecuted(_disputeId, dispute.orderId, finalRecipient, dispute.settlementAmount);
    }

    function getEvidenceSubmitters(uint _disputeId) external view returns (address[] memory) {
        return evidenceSubmitters[_disputeId];
    }

    receive() external payable {}

    function getDispute(uint _disputeId) public view returns (DisputeCase memory) {
        return disputes[_disputeId];
    }

    function getEvidence(uint _disputeId) public view returns (string[] memory) {
        return evidence[_disputeId];
    }

    function getDisputesByOrder(uint _orderId) public view returns (DisputeCase[] memory) {
        uint count = 0;
        for (uint i = 0; i < nextDisputeId; i++) {
            if (disputes[i].orderId == _orderId) {
                count++;
            }
        }
        DisputeCase[] memory result = new DisputeCase[](count);
        uint index = 0;
        for (uint i = 0; i < nextDisputeId; i++) {
            if (disputes[i].orderId == _orderId) {
                result[index] = disputes[i];
                index++;
            }
        }
        return result;
    }

    function getDisputesByInitiator(address _initiator) public view returns (DisputeCase[] memory) {
        uint count = 0;
        for (uint i = 0; i < nextDisputeId; i++) {
            if (disputes[i].initiator == _initiator) {
                count++;
            }
        }
        DisputeCase[] memory result = new DisputeCase[](count);
        uint index = 0;
        for (uint i = 0; i < nextDisputeId; i++) {
            if (disputes[i].initiator == _initiator) {
                result[index] = disputes[i];
                index++;
            }
        }
        return result;
    }

    function getActiveDisputes() public view returns (DisputeCase[] memory) {
        uint count = 0;
        for (uint i = 0; i < nextDisputeId; i++) {
            if (disputes[i].state != DisputeState.Executed) {
                count++;
            }
        }
        DisputeCase[] memory result = new DisputeCase[](count);
        uint index = 0;
        for (uint i = 0; i < nextDisputeId; i++) {
            if (disputes[i].state != DisputeState.Executed) {
                result[index] = disputes[i];
                index++;
            }
        }
        return result;
    }

    function getResolvedDisputes() public view returns (DisputeCase[] memory) {
        uint count = 0;
        for (uint i = 0; i < nextDisputeId; i++) {
            if (disputes[i].state == DisputeState.Resolved || disputes[i].state == DisputeState.Executed) {
                count++;
            }
        }
        DisputeCase[] memory result = new DisputeCase[](count);
        uint index = 0;
        for (uint i = 0; i < nextDisputeId; i++) {
            if (disputes[i].state == DisputeState.Resolved || disputes[i].state == DisputeState.Executed) {
                result[index] = disputes[i];
                index++;
            }
        }
        return result;
    }
}