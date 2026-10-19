// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./OrderStorage.sol";
import "./AccessControl.sol";

contract Reconciliation is AccessControl {
    OrderStorage public orderStorage;

    event ReconciliationStarted(uint indexed batchId, uint indexed groupId, uint startTime);
    event BillSubmitted(uint indexed batchId, address indexed submitter, string role);
    event ReconciliationCompleted(uint indexed batchId, uint matchedCount, uint mismatchedCount);
    event OrderMatched(uint indexed batchId, uint indexed orderId, uint amount);
    event OrderMismatched(uint indexed batchId, uint indexed orderId, uint leaderAmount, uint sellerAmount);

    struct BillItem {
        uint orderId;
        uint amount;
    }

    struct ReconciliationBatch {
        uint batchId;
        uint groupId;
        uint startTime;
        uint endTime;
        bool leaderSubmitted;
        bool sellerSubmitted;
        bool completed;
        uint matchedCount;
        uint mismatchedCount;
        address leader;
        address seller;
    }

    uint public nextBatchId;
    mapping(uint => ReconciliationBatch) public batches;
    mapping(uint => mapping(address => BillItem[])) private bills;
    mapping(uint => mapping(uint => bool)) public orderMatchStatus;
    mapping(uint => uint[]) public batchOrderIds;

    constructor(address _orderStorage) {
        orderStorage = OrderStorage(_orderStorage);
    }

    function startReconciliation(uint _groupId) public onlyRole(GROUP_LEADER_ROLE) whenNotPaused nonReentrant returns (uint) {
        (,address leader,,, ,bool finalized) = orderStorage.getGroup(_groupId);
        require(finalized, "Group not finalized");
        require(leader == msg.sender, "Only group leader can start");

        uint batchId = nextBatchId;
        batches[batchId] = ReconciliationBatch({
            batchId: batchId,
            groupId: _groupId,
            startTime: block.timestamp,
            endTime: 0,
            leaderSubmitted: false,
            sellerSubmitted: false,
            completed: false,
            matchedCount: 0,
            mismatchedCount: 0,
            leader: msg.sender,
            seller: address(0)
        });
        nextBatchId++;
        emit ReconciliationStarted(batchId, _groupId, block.timestamp);
        return batchId;
    }

    function startReconciliationWithLeaderBill(uint _groupId, uint[] memory _orderIds, uint[] memory _amounts) public onlyRole(GROUP_LEADER_ROLE) whenNotPaused nonReentrant returns (uint) {
        (,address leader,,, ,bool finalized) = orderStorage.getGroup(_groupId);
        require(finalized, "Group not finalized");
        require(leader == msg.sender, "Only group leader can start");
        require(_orderIds.length == _amounts.length, "Arrays length mismatch");
        require(_orderIds.length > 0, "Empty bill");

        uint batchId = nextBatchId;
        batches[batchId] = ReconciliationBatch({
            batchId: batchId,
            groupId: _groupId,
            startTime: block.timestamp,
            endTime: 0,
            leaderSubmitted: true,
            sellerSubmitted: false,
            completed: false,
            matchedCount: 0,
            mismatchedCount: 0,
            leader: msg.sender,
            seller: address(0)
        });
        nextBatchId++;

        for (uint i = 0; i < _orderIds.length; i++) {
            OrderStorage.Order memory order = orderStorage.getOrder(_orderIds[i]);
            require(order.groupId == _groupId, "Order not in this group");
            bills[batchId][msg.sender].push(BillItem({
                orderId: _orderIds[i],
                amount: _amounts[i]
            }));
        }

        emit ReconciliationStarted(batchId, _groupId, block.timestamp);
        emit BillSubmitted(batchId, msg.sender, "leader");
        return batchId;
    }

    function submitLeaderBill(uint _batchId, uint[] memory _orderIds, uint[] memory _amounts) public onlyRole(GROUP_LEADER_ROLE) whenNotPaused nonReentrant {
        ReconciliationBatch storage batch = batches[_batchId];
        require(batch.leader == msg.sender, "Not the batch leader");
        require(!batch.leaderSubmitted, "Leader bill already submitted");
        require(_orderIds.length == _amounts.length, "Arrays length mismatch");
        require(_orderIds.length > 0, "Empty bill");

        for (uint i = 0; i < _orderIds.length; i++) {
            OrderStorage.Order memory order = orderStorage.getOrder(_orderIds[i]);
            require(order.groupId == batch.groupId, "Order not in this batch group");
            bills[_batchId][msg.sender].push(BillItem({
                orderId: _orderIds[i],
                amount: _amounts[i]
            }));
        }
        batch.leaderSubmitted = true;
        emit BillSubmitted(_batchId, msg.sender, "leader");

        if (batch.sellerSubmitted) {
            _executeReconciliation(_batchId);
        }
    }

    function submitSellerBill(uint _batchId, uint[] memory _orderIds, uint[] memory _amounts) public onlyRole(SELLER_ROLE) whenNotPaused nonReentrant {
        ReconciliationBatch storage batch = batches[_batchId];
        require(!batch.sellerSubmitted, "Seller bill already submitted");
        require(_orderIds.length == _amounts.length, "Arrays length mismatch");
        require(_orderIds.length > 0, "Empty bill");

        batch.seller = msg.sender;
        for (uint i = 0; i < _orderIds.length; i++) {
            OrderStorage.Order memory order = orderStorage.getOrder(_orderIds[i]);
            require(order.groupId == batch.groupId, "Order not in this batch group");
            require(order.seller == msg.sender, "Seller not related to order");
            bills[_batchId][msg.sender].push(BillItem({
                orderId: _orderIds[i],
                amount: _amounts[i]
            }));
        }
        batch.sellerSubmitted = true;
        emit BillSubmitted(_batchId, msg.sender, "seller");

        if (batch.leaderSubmitted) {
            _executeReconciliation(_batchId);
        }
    }

    function _executeReconciliation(uint _batchId) internal {
        ReconciliationBatch storage batch = batches[_batchId];
        require(!batch.completed, "Already completed");

        BillItem[] storage leaderBill = bills[_batchId][batch.leader];
        BillItem[] storage sellerBill = bills[_batchId][batch.seller];

        uint matched = 0;
        uint mismatched = 0;

        for (uint i = 0; i < leaderBill.length; i++) {
            uint orderId = leaderBill[i].orderId;
            uint leaderAmount = leaderBill[i].amount;
            batchOrderIds[_batchId].push(orderId);

            bool found = false;
            uint sellerAmount = 0;
            for (uint j = 0; j < sellerBill.length; j++) {
                if (sellerBill[j].orderId == orderId) {
                    found = true;
                    sellerAmount = sellerBill[j].amount;
                    break;
                }
            }

            if (found && leaderAmount == sellerAmount) {
                orderMatchStatus[_batchId][orderId] = true;
                orderStorage.markReconciled(orderId);
                matched++;
                emit OrderMatched(_batchId, orderId, leaderAmount);
            } else {
                orderStorage.markDisputed(orderId);
                mismatched++;
                emit OrderMismatched(_batchId, orderId, leaderAmount, found ? sellerAmount : 0);
            }
        }

        batch.matchedCount = matched;
        batch.mismatchedCount = mismatched;
        batch.endTime = block.timestamp;
        batch.completed = true;

        emit ReconciliationCompleted(_batchId, matched, mismatched);
    }

    function getBatch(uint _batchId) public view returns (ReconciliationBatch memory) {
        return batches[_batchId];
    }

    function getReconciledOrders(uint _batchId) public view returns (uint[] memory) {
        uint[] storage allOrders = batchOrderIds[_batchId];
        uint count = 0;
        for (uint i = 0; i < allOrders.length; i++) {
            if (orderMatchStatus[_batchId][allOrders[i]]) count++;
        }
        uint[] memory result = new uint[](count);
        uint index = 0;
        for (uint i = 0; i < allOrders.length; i++) {
            if (orderMatchStatus[_batchId][allOrders[i]]) {
                result[index] = allOrders[i];
                index++;
            }
        }
        return result;
    }

    function getMismatchedOrders(uint _batchId) public view returns (uint[] memory) {
        uint[] storage allOrders = batchOrderIds[_batchId];
        uint count = 0;
        for (uint i = 0; i < allOrders.length; i++) {
            if (!orderMatchStatus[_batchId][allOrders[i]]) count++;
        }
        uint[] memory result = new uint[](count);
        uint index = 0;
        for (uint i = 0; i < allOrders.length; i++) {
            if (!orderMatchStatus[_batchId][allOrders[i]]) {
                result[index] = allOrders[i];
                index++;
            }
        }
        return result;
    }

    function getBillBySubmitter(uint _batchId, address _submitter) public view returns (BillItem[] memory) {
        return bills[_batchId][_submitter];
    }
}
