// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title AccessControl
 * @notice 基于角色的访问控制基类，提供 ADMIN / OPERATOR / PAUSER 三种角色
 *         以及紧急暂停机制和重入锁。
 */
contract AccessControl {
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant GROUP_LEADER_ROLE = keccak256("GROUP_LEADER_ROLE");
    bytes32 public constant SELLER_ROLE = keccak256("SELLER_ROLE");

    mapping(bytes32 => mapping(address => bool)) private _roles;
    bool private _paused;
    uint256 private _status;  // 重入锁: 1=未锁定, 2=已锁定
    
    event RoleGranted(bytes32 indexed role, address indexed account, address indexed sender);
    event RoleRevoked(bytes32 indexed role, address indexed account, address indexed sender);
    event Paused(address account);
    event Unpaused(address account);

    uint256 private constant _NOT_ENTERED = 1;
    uint256 private constant _ENTERED = 2;
    
    constructor() {
        _grantRole(ADMIN_ROLE, msg.sender);
        _grantRole(PAUSER_ROLE, msg.sender);
        _status = _NOT_ENTERED;
    }
    
    modifier onlyRole(bytes32 role) {
        require(hasRole(role, msg.sender), "AccessControl: account missing role");
        _;
    }
    
    modifier onlyAdmin() {
        require(hasRole(ADMIN_ROLE, msg.sender), "AccessControl: caller is not admin");
        _;
    }
    
    modifier whenNotPaused() {
        require(!_paused, "AccessControl: contract is paused");
        _;
    }
    
    modifier whenPaused() {
        require(_paused, "AccessControl: contract is not paused");
        _;
    }
    
    function hasRole(bytes32 role, address account) public view returns (bool) {
        return _roles[role][account];
    }
    
    function paused() public view returns (bool) {
        return _paused;
    }
    
    function grantRole(bytes32 role, address account) public onlyRole(ADMIN_ROLE) {
        _grantRole(role, account);
    }
    
    function revokeRole(bytes32 role, address account) public onlyRole(ADMIN_ROLE) {
        require(hasRole(role, account), "AccessControl: account does not have role");
        _roles[role][account] = false;
        emit RoleRevoked(role, account, msg.sender);
    }
    
    function pause() public onlyRole(PAUSER_ROLE) {
        _pause();
    }
    
    function unpause() public onlyRole(PAUSER_ROLE) {
        _unpause();
    }
    
    function _grantRole(bytes32 role, address account) internal {
        if (!hasRole(role, account)) {
            _roles[role][account] = true;
            emit RoleGranted(role, account, msg.sender);
        }
    }
    
    function _pause() internal whenNotPaused {
        _paused = true;
        emit Paused(msg.sender);
    }
    
    function _unpause() internal whenPaused {
        _paused = false;
        emit Unpaused(msg.sender);
    }

    // ---- Reentrancy Guard ----

    /**
     * @notice 防止重入修饰符，状态检查模式（OpenZeppelin 风格）
     */
    modifier nonReentrant() {
        require(_status != _ENTERED, "ReentrancyGuard: reentrant call");
        _status = _ENTERED;
        _;
        _status = _NOT_ENTERED;
    }
}
