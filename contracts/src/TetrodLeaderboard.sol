// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract TetrodLeaderboard {
    address public owner;
    address public oracle;

    struct Player {
        uint256 points;
        uint256 gamesPlayed;
        uint256 gamesWon;
    }

    mapping(address => Player) public players;
    address[] public playerList;

    event WinRecorded(address indexed player, uint256 pointsAwarded, uint256 newTotal);
    event OracleUpdated(address indexed oldOracle, address indexed newOracle);

    error NotOracle();
    error NotOwner();
    error ZeroAddress();

    constructor(address _oracle) {
        owner = msg.sender;
        oracle = _oracle;
    }

    modifier onlyOracle() {
        if (msg.sender != oracle) revert NotOracle();
        _;
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    // Called by the server after a human wins a game
    function recordWin(address player, uint256 pointsAwarded) external onlyOracle {
        if (player == address(0)) revert ZeroAddress();

        if (players[player].gamesPlayed == 0) {
            playerList.push(player);
        }

        players[player].points += pointsAwarded;
        players[player].gamesPlayed += 1;
        players[player].gamesWon += 1;

        emit WinRecorded(player, pointsAwarded, players[player].points);
    }

    // Called by the server to record a game played (whether won or lost)
    function recordGame(address player) external onlyOracle {
        if (player == address(0)) revert ZeroAddress();

        if (players[player].gamesPlayed == 0) {
            playerList.push(player);
        }

        players[player].gamesPlayed += 1;
    }

    function getPlayer(address player) external view returns (uint256 points, uint256 gamesPlayed, uint256 gamesWon) {
        Player storage p = players[player];
        return (p.points, p.gamesPlayed, p.gamesWon);
    }

    function getLeaderboard() external view returns (address[] memory addresses, uint256[] memory points) {
        uint256 len = playerList.length;
        addresses = new address[](len);
        points = new uint256[](len);

        for (uint256 i = 0; i < len; i++) {
            addresses[i] = playerList[i];
            points[i] = players[playerList[i]].points;
        }
    }

    function playerCount() external view returns (uint256) {
        return playerList.length;
    }

    function setOracle(address newOracle) external onlyOwner {
        if (newOracle == address(0)) revert ZeroAddress();
        emit OracleUpdated(oracle, newOracle);
        oracle = newOracle;
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        owner = newOwner;
    }
}
