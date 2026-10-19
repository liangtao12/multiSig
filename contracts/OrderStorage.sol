// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./AccessControl.sol";
import "./ProductRegistry.sol";

/**
 * @title OrderStorage
 * @notice 社区团购订单存储合约。买家选择商品下单，系统自动关联卖家和金额。
 *         团长可汇总订单为"团购批次"，用于后续对账和清算。
 */
contract OrderStorage is AccessControl {
    ProductRegistry public productRegistry;

    struct Order {
        uint orderId;
        uint productId;       // 关联商品
        address buyer;
        address seller;       // 自动从商品获取
        uint quantity;        // 购买数量
        uint amount;          // 总金额 = 单价 * 数量
        uint timestamp;
        uint groupId;         // 所属团购批次（0=未汇总）
        bool reconciled;
        bool disputed;
    }

    struct GroupBatch {
        uint groupId;
        address leader;       // 团长地址
        uint[] orderIds;
        uint totalAmount;
        uint createdAt;
        bool finalized;       // 团长已确认汇总
    }

    event OrderCreated(uint indexed orderId, address indexed buyer, address indexed seller, uint productId, uint quantity, uint amount);
    event OrderReconciled(uint indexed orderId);
    event OrderDisputed(uint indexed orderId);
    event GroupCreated(uint indexed groupId, address indexed leader);
    event GroupFinalized(uint indexed groupId, uint orderCount, uint totalAmount);

    uint public nextOrderId;
    uint public nextGroupId;
    mapping(uint => Order) public orders;
    mapping(uint => GroupBatch) public groups;

    constructor(address _productRegistry) {
        productRegistry = ProductRegistry(_productRegistry);
    }

    /**
     * @notice 买家下单：选择商品和数量，自动计算金额和关联卖家
     * @param _productId 商品ID
     * @param _quantity  购买数量
     * @return orderId 新订单ID
     */
    function placeOrder(uint _productId, uint _quantity) public whenNotPaused nonReentrant returns (uint) {
        require(_quantity > 0, "Quantity must be greater than 0");
        ProductRegistry.Product memory product = productRegistry.getProduct(_productId);
        require(product.active, "Product is not active");
        require(product.stock >= _quantity, "Insufficient stock");

        // 减少库存
        productRegistry.reduceStock(_productId, _quantity);

        uint totalAmount = product.price * _quantity;
        uint orderId = nextOrderId;
        orders[orderId] = Order({
            orderId: orderId,
            productId: _productId,
            buyer: msg.sender,
            seller: product.seller,
            quantity: _quantity,
            amount: totalAmount,
            timestamp: block.timestamp,
            groupId: 0,
            reconciled: false,
            disputed: false
        });
        nextOrderId++;
        emit OrderCreated(orderId, msg.sender, product.seller, _productId, _quantity, totalAmount);
        return orderId;
    }

    /**
     * @notice 团长批量提交订单（代替买家上链，减少交易次数）
     * @param _buyers     买家地址数组
     * @param _productIds 商品ID数组
     * @param _quantities 数量数组
     * @return startOrderId 第一个订单的ID
     */
    function batchCreateOrders(
        address[] memory _buyers,
        uint[] memory _productIds,
        uint[] memory _quantities
    ) public onlyRole(GROUP_LEADER_ROLE) whenNotPaused nonReentrant returns (uint startOrderId) {
        require(_buyers.length > 0, "Empty batch");
        require(_buyers.length == _productIds.length && _buyers.length == _quantities.length, "Array length mismatch");

        startOrderId = nextOrderId;
        for (uint i = 0; i < _buyers.length; i++) {
            require(_quantities[i] > 0, "Quantity must be greater than 0");
            ProductRegistry.Product memory product = productRegistry.getProduct(_productIds[i]);
            require(product.active, "Product is not active");
            require(product.stock >= _quantities[i], "Insufficient stock");

            productRegistry.reduceStock(_productIds[i], _quantities[i]);

            uint totalAmount = product.price * _quantities[i];
            uint orderId = nextOrderId;
            orders[orderId] = Order({
                orderId: orderId,
                productId: _productIds[i],
                buyer: _buyers[i],
                seller: product.seller,
                quantity: _quantities[i],
                amount: totalAmount,
                timestamp: block.timestamp,
                groupId: 0,
                reconciled: false,
                disputed: false
            });
            nextOrderId++;
            emit OrderCreated(orderId, _buyers[i], product.seller, _productIds[i], _quantities[i], totalAmount);
        }
    }

    /**
     * @notice 团长创建团购批次
     * @return groupId 新团购批次ID
     */
    function createGroup() public onlyRole(GROUP_LEADER_ROLE) whenNotPaused nonReentrant returns (uint) {
        uint groupId = nextGroupId;
        groups[groupId].groupId = groupId;
        groups[groupId].leader = msg.sender;
        groups[groupId].createdAt = block.timestamp;
        groups[groupId].finalized = false;
        nextGroupId++;
        emit GroupCreated(groupId, msg.sender);
        return groupId;
    }

    /**
     * @notice 团长将订单加入团购批次
     * @param _groupId  团购批次ID
     * @param _orderIds 要加入的订单ID数组
     */
    function addOrdersToGroup(uint _groupId, uint[] memory _orderIds) public onlyRole(GROUP_LEADER_ROLE) whenNotPaused nonReentrant {
        GroupBatch storage group = groups[_groupId];
        require(group.leader == msg.sender, "Only group leader can add orders");
        require(!group.finalized, "Group already finalized");

        for (uint i = 0; i < _orderIds.length; i++) {
            uint orderId = _orderIds[i];
            require(orders[orderId].orderId == orderId || orderId == 0, "Order does not exist");
            require(orders[orderId].groupId == 0, "Order already in a group");
            orders[orderId].groupId = _groupId;
            group.orderIds.push(orderId);
            group.totalAmount += orders[orderId].amount;
        }
    }

    /**
     * @notice 团长确认汇总完成，锁定批次
     * @param _groupId 团购批次ID
     */
    function finalizeGroup(uint _groupId) public onlyRole(GROUP_LEADER_ROLE) whenNotPaused nonReentrant {
        GroupBatch storage group = groups[_groupId];
        require(group.leader == msg.sender, "Only group leader can finalize");
        require(!group.finalized, "Group already finalized");
        require(group.orderIds.length > 0, "Group has no orders");

        group.finalized = true;
        emit GroupFinalized(_groupId, group.orderIds.length, group.totalAmount);
    }

    /**
     * @notice 一次性创建多个团购批次并锁定（减少交易次数）
     * @param _groupOrderIds 每组的订单ID数组（二维数组）
     * @return groupIds 创建的批次ID数组
     */
    function batchGroupAndFinalize(
        uint[][] memory _groupOrderIds
    ) public onlyRole(GROUP_LEADER_ROLE) whenNotPaused nonReentrant returns (uint[] memory groupIds) {
        require(_groupOrderIds.length > 0, "Empty batch");
        groupIds = new uint[](_groupOrderIds.length);

        for (uint g = 0; g < _groupOrderIds.length; g++) {
            require(_groupOrderIds[g].length > 0, "Empty group");

            // 创建批次
            uint groupId = nextGroupId;
            groups[groupId].groupId = groupId;
            groups[groupId].leader = msg.sender;
            groups[groupId].createdAt = block.timestamp;
            nextGroupId++;
            emit GroupCreated(groupId, msg.sender);

            // 加入订单
            for (uint i = 0; i < _groupOrderIds[g].length; i++) {
                uint orderId = _groupOrderIds[g][i];
                require(orders[orderId].groupId == 0, "Order already in a group");
                orders[orderId].groupId = groupId;
                groups[groupId].orderIds.push(orderId);
                groups[groupId].totalAmount += orders[orderId].amount;
            }

            // 锁定
            groups[groupId].finalized = true;
            emit GroupFinalized(groupId, groups[groupId].orderIds.length, groups[groupId].totalAmount);
            groupIds[g] = groupId;
        }
    }

    /**
     * @notice 一体化汇总：创建订单 + 按商家自动分组 + 锁定，仅需 1 笔交易
     * @param _buyers     买家地址数组
     * @param _productIds 商品ID数组
     * @param _quantities 数量数组
     */
    function batchCreateAndGroup(
        address[] memory _buyers,
        uint[] memory _productIds,
        uint[] memory _quantities
    ) public onlyRole(GROUP_LEADER_ROLE) whenNotPaused nonReentrant returns (uint startOrderId, uint[] memory groupIds) {
        require(_buyers.length > 0, "Empty batch");
        require(_buyers.length == _productIds.length && _buyers.length == _quantities.length, "Array length mismatch");

        startOrderId = nextOrderId;

        // Step 1: 创建所有订单
        for (uint i = 0; i < _buyers.length; i++) {
            require(_quantities[i] > 0, "Quantity must be greater than 0");
            ProductRegistry.Product memory product = productRegistry.getProduct(_productIds[i]);
            require(product.active, "Product is not active");
            require(product.stock >= _quantities[i], "Insufficient stock");

            productRegistry.reduceStock(_productIds[i], _quantities[i]);

            uint totalAmount = product.price * _quantities[i];
            uint orderId = nextOrderId;
            orders[orderId] = Order({
                orderId: orderId,
                productId: _productIds[i],
                buyer: _buyers[i],
                seller: product.seller,
                quantity: _quantities[i],
                amount: totalAmount,
                timestamp: block.timestamp,
                groupId: 0,
                reconciled: false,
                disputed: false
            });
            nextOrderId++;
            emit OrderCreated(orderId, _buyers[i], product.seller, _productIds[i], _quantities[i], totalAmount);
        }

        // Step 2: 按商家地址分组（链上分组）
        // 收集不重复的 seller 列表
        address[] memory sellerList = new address[](_buyers.length);
        uint sellerCount = 0;
        for (uint i = 0; i < _buyers.length; i++) {
            address seller = orders[startOrderId + i].seller;
            bool found = false;
            for (uint j = 0; j < sellerCount; j++) {
                if (sellerList[j] == seller) { found = true; break; }
            }
            if (!found) { sellerList[sellerCount] = seller; sellerCount++; }
        }

        // Step 3: 为每个商家创建批次 + 分配订单 + 锁定
        groupIds = new uint[](sellerCount);
        for (uint s = 0; s < sellerCount; s++) {
            uint groupId = nextGroupId;
            groups[groupId].groupId = groupId;
            groups[groupId].leader = msg.sender;
            groups[groupId].createdAt = block.timestamp;
            nextGroupId++;
            emit GroupCreated(groupId, msg.sender);

            for (uint i = 0; i < _buyers.length; i++) {
                uint orderId = startOrderId + i;
                if (orders[orderId].seller == sellerList[s]) {
                    orders[orderId].groupId = groupId;
                    groups[groupId].orderIds.push(orderId);
                    groups[groupId].totalAmount += orders[orderId].amount;
                }
            }

            groups[groupId].finalized = true;
            emit GroupFinalized(groupId, groups[groupId].orderIds.length, groups[groupId].totalAmount);
            groupIds[s] = groupId;
        }
    }

    function getOrder(uint _orderId) public view returns (Order memory) {
        return orders[_orderId];
    }

    function getGroup(uint _groupId) public view returns (uint groupId, address leader, uint[] memory orderIds, uint totalAmount, uint createdAt, bool finalized) {
        GroupBatch storage g = groups[_groupId];
        return (g.groupId, g.leader, g.orderIds, g.totalAmount, g.createdAt, g.finalized);
    }

    /**
     * @notice 标记订单为已对账，仅 OPERATOR_ROLE 可调用
     * @param _orderId 订单ID
     */
    function markReconciled(uint _orderId) public onlyRole(OPERATOR_ROLE) whenNotPaused nonReentrant {
        require(_orderId < nextOrderId, "Order does not exist");
        require(!orders[_orderId].reconciled, "Order already reconciled");
        orders[_orderId].reconciled = true;
        emit OrderReconciled(_orderId);
    }

    /**
     * @notice 标记订单为有争议，仅 OPERATOR_ROLE 可调用
     * @param _orderId 订单ID
     */
    function markDisputed(uint _orderId) public onlyRole(OPERATOR_ROLE) whenNotPaused nonReentrant {
        require(_orderId < nextOrderId, "Order does not exist");
        require(!orders[_orderId].disputed, "Order already disputed");
        orders[_orderId].disputed = true;
        emit OrderDisputed(_orderId);
    }

    function getOrdersByBuyer(address _buyer) public view returns (Order[] memory) {
        uint count = 0;
        for (uint i = 0; i < nextOrderId; i++) {
            if (orders[i].buyer == _buyer) count++;
        }
        Order[] memory result = new Order[](count);
        uint index = 0;
        for (uint i = 0; i < nextOrderId; i++) {
            if (orders[i].buyer == _buyer) {
                result[index] = orders[i];
                index++;
            }
        }
        return result;
    }

    function getOrdersBySeller(address _seller) public view returns (Order[] memory) {
        uint count = 0;
        for (uint i = 0; i < nextOrderId; i++) {
            if (orders[i].seller == _seller) count++;
        }
        Order[] memory result = new Order[](count);
        uint index = 0;
        for (uint i = 0; i < nextOrderId; i++) {
            if (orders[i].seller == _seller) {
                result[index] = orders[i];
                index++;
            }
        }
        return result;
    }

    function getGroupOrders(uint _groupId) public view returns (Order[] memory) {
        GroupBatch storage g = groups[_groupId];
        Order[] memory result = new Order[](g.orderIds.length);
        for (uint i = 0; i < g.orderIds.length; i++) {
            result[i] = orders[g.orderIds[i]];
        }
        return result;
    }
}