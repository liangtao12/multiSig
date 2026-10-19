// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./AccessControl.sol";

/**
 * @title ProductRegistry
 * @notice 商品注册合约，商家可发布商品（名称、单价、库存），
 *         买家下单时引用商品ID自动关联卖家和价格。
 */
contract ProductRegistry is AccessControl {
    struct Product {
        uint productId;
        string name;
        uint price;           // 单价（wei）
        address seller;       // 商家地址
        uint stock;           // 库存数量
        bool active;          // 是否上架
        uint createdAt;
    }

    event ProductCreated(uint indexed productId, string name, uint price, address indexed seller);
    event ProductUpdated(uint indexed productId, uint newPrice, uint newStock);
    event ProductDeactivated(uint indexed productId);

    uint public nextProductId;
    mapping(uint => Product) public products;

    /**
     * @notice 商家发布商品，仅 SELLER_ROLE 可调用
     * @param _name   商品名称
     * @param _price  商品单价（wei）
     * @param _stock  初始库存
     * @return productId 新商品ID
     */
    function createProduct(string memory _name, uint _price, uint _stock) public onlyRole(SELLER_ROLE) whenNotPaused nonReentrant returns (uint) {
        require(_price > 0, "Price must be greater than 0");
        require(_stock > 0, "Stock must be greater than 0");
        require(bytes(_name).length > 0, "Name cannot be empty");

        uint productId = nextProductId;
        products[productId] = Product({
            productId: productId,
            name: _name,
            price: _price,
            seller: msg.sender,
            stock: _stock,
            active: true,
            createdAt: block.timestamp
        });
        nextProductId++;
        emit ProductCreated(productId, _name, _price, msg.sender);
        return productId;
    }

    /**
     * @notice 商家更新商品价格和库存
     * @param _productId 商品ID
     * @param _newPrice  新单价
     * @param _newStock  新库存
     */
    function updateProduct(uint _productId, uint _newPrice, uint _newStock) public whenNotPaused nonReentrant {
        Product storage product = products[_productId];
        require(product.seller == msg.sender, "Only seller can update");
        require(product.active, "Product is not active");
        require(_newPrice > 0, "Price must be greater than 0");

        product.price = _newPrice;
        product.stock = _newStock;
        emit ProductUpdated(_productId, _newPrice, _newStock);
    }

    /**
     * @notice 商家下架商品
     * @param _productId 商品ID
     */
    function deactivateProduct(uint _productId) public whenNotPaused nonReentrant {
        Product storage product = products[_productId];
        require(product.seller == msg.sender, "Only seller can deactivate");
        product.active = false;
        emit ProductDeactivated(_productId);
    }

    /**
     * @notice 减少库存（由订单合约调用）
     * @param _productId 商品ID
     * @param _quantity  数量
     */
    function reduceStock(uint _productId, uint _quantity) public onlyRole(OPERATOR_ROLE) {
        Product storage product = products[_productId];
        require(product.active, "Product is not active");
        require(product.stock >= _quantity, "Insufficient stock");
        product.stock -= _quantity;
    }

    function getProduct(uint _productId) public view returns (Product memory) {
        return products[_productId];
    }

    function getActiveProducts() public view returns (Product[] memory) {
        uint count = 0;
        for (uint i = 0; i < nextProductId; i++) {
            if (products[i].active) count++;
        }
        Product[] memory result = new Product[](count);
        uint index = 0;
        for (uint i = 0; i < nextProductId; i++) {
            if (products[i].active) {
                result[index] = products[i];
                index++;
            }
        }
        return result;
    }

    function getProductsBySeller(address _seller) public view returns (Product[] memory) {
        uint count = 0;
        for (uint i = 0; i < nextProductId; i++) {
            if (products[i].seller == _seller) count++;
        }
        Product[] memory result = new Product[](count);
        uint index = 0;
        for (uint i = 0; i < nextProductId; i++) {
            if (products[i].seller == _seller) {
                result[index] = products[i];
                index++;
            }
        }
        return result;
    }
}
