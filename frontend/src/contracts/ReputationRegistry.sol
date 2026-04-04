// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/// @title ReputationRegistry
/// @notice Manages reputation scores for wallet addresses in the TrustCircle ecosystem.
/// @dev Scores range from 0 to 1000, initialized to 500 on first interaction. Scores are tied to wallet addresses and cannot be transferred.
contract ReputationRegistry {
    mapping(address => uint256) private scores;
    mapping(address => bool) private hasInteracted;

    event ScoreUpdated(address indexed wallet, uint256 newScore, int256 change);

    /// @notice Gets the reputation score of a wallet. Returns 500 if no prior interactions.
    /// @param wallet The wallet address to query.
    /// @return The current reputation score (0-1000).
    function getScore(address wallet) external view returns (uint256) {
        if (!hasInteracted[wallet]) {
            return 500;
        }
        return scores[wallet];
    }

    /// @notice Increments the score of a wallet by the specified amount, clamping to 1000.
    /// @param wallet The wallet address to update.
    /// @param amount The amount to increment (positive).
    function incrementScore(address wallet, uint256 amount) external {
        _initScore(wallet);
        _updateScore(wallet, int256(amount));
    }

    /// @notice Decrements the score of a wallet by the specified amount, clamping to 0.
    /// @param wallet The wallet address to update.
    /// @param amount The amount to decrement (positive).
    function decrementScore(address wallet, uint256 amount) external {
        _initScore(wallet);
        _updateScore(wallet, -int256(amount));
    }

    /// @notice Initializes the score for a wallet if not already done.
    /// @param wallet The wallet address to initialize.
    function _initScore(address wallet) internal {
        if (!hasInteracted[wallet]) {
            scores[wallet] = 500;
            hasInteracted[wallet] = true;
        }
    }

    /// @notice Updates the score by the given delta, clamping between 0 and 1000.
    /// @param wallet The wallet address.
    /// @param delta The change in score (can be negative).
    function _updateScore(address wallet, int256 delta) internal {
        uint256 currentScore = scores[wallet];
        int256 newScore = int256(currentScore) + delta;
        if (newScore < 0) {
            newScore = 0;
        } else if (newScore > 1000) {
            newScore = 1000;
        }
        scores[wallet] = uint256(newScore);
        emit ScoreUpdated(wallet, uint256(newScore), delta);
    }
}