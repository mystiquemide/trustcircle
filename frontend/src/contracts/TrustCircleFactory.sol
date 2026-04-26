// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "./TrustCircle.sol";

contract TrustCircleFactory {
    address public usdcToken;
    address public reputationRegistry;
    uint256 public circleIdCounter;
    mapping(uint256 => address) public circles;

    event CircleCreated(uint256 circleId, address organizer);

    constructor(address _usdcToken, address _reputationRegistry) {
        usdcToken = _usdcToken;
        reputationRegistry = _reputationRegistry;
    }

    /// @notice Creates a new TrustCircle contract with the specified parameters.
    function createCircle(
        string memory name,
        uint256 memberCount,
        uint256 contributionAmount,
        uint256 cycleDuration,
        uint8 payoutOrderMethod,
        uint256 requiredCollateral
    ) external returns (uint256) {
        uint256 circleId = circleIdCounter++;
        address newCircle = address(new TrustCircle(
            circleId,
            msg.sender,
            name,
            memberCount,
            contributionAmount,
            cycleDuration,
            payoutOrderMethod,
            requiredCollateral,
            usdcToken,
            reputationRegistry
        ));
        circles[circleId] = newCircle;
        emit CircleCreated(circleId, msg.sender);
        return circleId;
    }

    /// @notice Retrieves the contract address of a circle by its ID.
    function getCircle(uint256 circleId) external view returns (address) {
        return circles[circleId];
    }
}