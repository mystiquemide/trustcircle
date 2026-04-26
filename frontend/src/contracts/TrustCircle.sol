// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IReputationRegistry {
    function incrementScore(address wallet, uint256 amount) external;
    function decrementScore(address wallet, uint256 amount) external;
}

contract TrustCircle {
    uint256 public circleId;
    address public organizer;
    string public name;
    uint256 public memberCount;
    uint256 public contributionAmount;
    uint256 public cycleDuration;
    uint8 public payoutOrderMethod;
    address public usdcToken;
    address public reputationRegistry;
    address[] public members;
    address[] public payoutOrder;
    mapping(uint256 => mapping(address => bool)) public contributions;
    uint256 public currentCycle;
    uint256 public cycleStart;
    Status public status;
    enum Status { Pending, Active, Paused, Resolved, Dissolved }

    address public currentDefaulter;
    mapping(address => bool) public hasVoted;
    uint256 public continueVotes;
    uint256 public dissolveVotes;

    event MemberJoined(uint256 circleId, address member);
    event ContributionReceived(uint256 circleId, uint256 cycle, address member);
    event PayoutDistributed(uint256 circleId, uint256 cycle, address recipient, uint256 amount);
    event DefaultOccurred(uint256 circleId, uint256 cycle, address member);
    event CircleCompleted(uint256 circleId);

    constructor(
        uint256 _circleId,
        address _organizer,
        string memory _name,
        uint256 _memberCount,
        uint256 _contributionAmount,
        uint256 _cycleDuration,
        uint8 _payoutOrderMethod,
        address _usdcToken,
        address _reputationRegistry
    ) {
        circleId = _circleId;
        organizer = _organizer;
        name = _name;
        memberCount = _memberCount;
        contributionAmount = _contributionAmount;
        cycleDuration = _cycleDuration;
        payoutOrderMethod = _payoutOrderMethod;
        usdcToken = _usdcToken;
        reputationRegistry = _reputationRegistry;
        status = Status.Pending;
    }

    /// @notice Allows a user to join the circle if it's pending and not full.
    function joinCircle() external {
        require(status == Status.Pending, "Circle is not pending");
        require(members.length < memberCount, "Circle is full");
        require(!isMember(msg.sender), "Already a member");
        members.push(msg.sender);
        emit MemberJoined(circleId, msg.sender);
        if (members.length == memberCount) {
            status = Status.Active;
            cycleStart = block.timestamp;
            if (payoutOrderMethod == 0) {
                _setRandomPayoutOrder();
            }
            // For manual, organizer must call setPayoutOrderManual before contributions
        }
    }

    /// @notice Sets the payout order randomly for the members.
    function _setRandomPayoutOrder() internal {
        payoutOrder = members;
        for (uint i = payoutOrder.length - 1; i > 0; i--) {
            uint j = uint(keccak256(abi.encodePacked(block.timestamp, block.prevrandao, i))) % (i + 1);
            (payoutOrder[i], payoutOrder[j]) = (payoutOrder[j], payoutOrder[i]);
        }
    }

    /// @notice Allows the organizer to manually set the payout order.
    function setPayoutOrderManual(address[] memory _payoutOrder) external {
        require(msg.sender == organizer, "Only organizer can set payout order");
        require(status == Status.Active, "Circle is not active");
        require(payoutOrderMethod == 1, "Payout order method is not manual");
        require(_payoutOrder.length == memberCount, "Payout order length must match member count");
        for (uint i = 0; i < _payoutOrder.length; i++) {
            require(isMember(_payoutOrder[i]), "All addresses in payout order must be members");
        }
        payoutOrder = _payoutOrder;
    }

    /// @notice Allows a member to contribute USDC for the current cycle.
    function contribute() external {
        require(status == Status.Active, "Circle is not active");
        require(isMember(msg.sender), "Sender is not a member");
        require(!contributions[currentCycle][msg.sender], "Already contributed for this cycle");
        require(block.timestamp <= cycleStart + cycleDuration, "Contribution deadline has passed");
        require(payoutOrder.length == memberCount, "Payout order not set");
        IERC20(usdcToken).transferFrom(msg.sender, address(this), contributionAmount);
        _recordContribution();
    }

    /// @notice Records the contribution internally.
    function _recordContribution() internal {
        contributions[currentCycle][msg.sender] = true;
        emit ContributionReceived(circleId, currentCycle, msg.sender);
    }

    /// @notice Distributes the payout to the current recipient if all have contributed or cycle has ended.
    function distributePayout() external {
        require(status == Status.Active, "Circle is not active");
        require(payoutOrder.length == memberCount, "Payout order not set");
        bool allContributed = true;
        for (uint i = 0; i < members.length; i++) {
            if (!contributions[currentCycle][members[i]]) {
                allContributed = false;
                break;
            }
        }
        require(allContributed || block.timestamp > cycleStart + cycleDuration + 24 hours, "Not all members have contributed and grace period has not passed");
        address recipient = payoutOrder[currentCycle];
        uint256 amount = members.length * contributionAmount;
        IERC20(usdcToken).transfer(recipient, amount);
        
        // Reward recipient with reputation
        if (reputationRegistry != address(0)) {
            IReputationRegistry(reputationRegistry).incrementScore(recipient, 10);
        }

        emit PayoutDistributed(circleId, currentCycle, recipient, amount);
        currentCycle++;
        if (currentCycle >= memberCount) {
            status = Status.Resolved; // or Completed
            emit CircleCompleted(circleId);
        } else {
            cycleStart = block.timestamp;
        }
    }

    /// @notice Marks a member as defaulter if they haven't contributed and grace period has passed.
    function markDefaulter(address member) external {
        require(status == Status.Active, "Circle is not active");
        require(isMember(member), "Address is not a member");
        require(!contributions[currentCycle][member], "Member has already contributed");
        require(block.timestamp > cycleStart + cycleDuration + 24 hours, "Grace period has not passed");
        currentDefaulter = member;
        status = Status.Paused;
        // reset votes
        for (uint i = 0; i < members.length; i++) {
            hasVoted[members[i]] = false;
        }
        continueVotes = 0;
        dissolveVotes = 0;
        emit DefaultOccurred(circleId, currentCycle, member);
        
        if (reputationRegistry != address(0)) {
            IReputationRegistry(reputationRegistry).decrementScore(member, 50);
        }
    }

    /// @notice Allows members to vote on default resolution: continue circle or dissolve.
    function voteOnDefaultResolution(bool continueCircle) external {
        require(status == Status.Paused, "Circle is not paused");
        require(isMember(msg.sender), "Sender is not a member");
        require(!hasVoted[msg.sender], "Already voted");
        hasVoted[msg.sender] = true;
        if (continueCircle) {
            continueVotes++;
        } else {
            dissolveVotes++;
        }
        uint256 totalVotes = continueVotes + dissolveVotes;
        if (totalVotes > members.length / 2) {
            if (continueVotes > dissolveVotes) {
                _continueCircle();
            } else {
                _dissolveCircle();
            }
        }
    }

    /// @notice Continues the circle after default resolution vote.
    function _continueCircle() internal {
        // remove currentDefaulter from members
        for (uint i = 0; i < members.length; i++) {
            if (members[i] == currentDefaulter) {
                members[i] = members[members.length - 1];
                members.pop();
                break;
            }
        }
        // remove from payoutOrder
        address[] memory newPayoutOrder = new address[](payoutOrder.length - 1);
        uint idx = 0;
        for (uint i = 0; i < payoutOrder.length; i++) {
            if (payoutOrder[i] != currentDefaulter) {
                newPayoutOrder[idx] = payoutOrder[i];
                idx++;
            }
        }
        payoutOrder = newPayoutOrder;
        memberCount--;
        // refund the current pot proportionally to remaining members
        uint256 balance = IERC20(usdcToken).balanceOf(address(this));
        uint256 perMember = balance / members.length;
        for (uint i = 0; i < members.length; i++) {
            IERC20(usdcToken).transfer(members[i], perMember);
        }
        status = Status.Active;
        cycleStart = block.timestamp;
    }

    /// @notice Dissolves the circle and refunds contributions proportionally.
    function _dissolveCircle() internal {
        // refund all held USDC proportionally to contributors of the current cycle
        uint256 balance = IERC20(usdcToken).balanceOf(address(this));
        uint256 totalContributed = 0;
        address[] memory contributors = new address[](members.length);
        uint count = 0;
        for (uint i = 0; i < members.length; i++) {
            if (contributions[currentCycle][members[i]]) {
                contributors[count] = members[i];
                count++;
                totalContributed += contributionAmount;
            }
        }
        for (uint i = 0; i < count; i++) {
            uint256 amount = (balance * contributionAmount) / totalContributed;
            IERC20(usdcToken).transfer(contributors[i], amount);
        }
        status = Status.Dissolved;
    }

    /// @notice Checks if an address is a member of the circle.
    function isMember(address addr) internal view returns (bool) {
        for (uint i = 0; i < members.length; i++) {
            if (members[i] == addr) return true;
        }
        return false;
    }
}