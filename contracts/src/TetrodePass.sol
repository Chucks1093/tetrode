// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC20} from "openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "openzeppelin-contracts/contracts/access/Ownable.sol";

/**
 * TetrodePass — soulbound free-pass token for Tetrode.
 *
 * - decimals = 0 (whole passes only: 1, 2, 3 …)
 * - Only owner can mint (issue a pass to a player)
 * - Only owner can adminBurn (consume a pass when player enters a game)
 * - Transfers between players are disabled (non-transferable / soulbound)
 */
contract TetrodePass is ERC20, Ownable {
    event PassIssued(address indexed to, uint256 amount);
    event PassUsed(address indexed from, uint256 amount);

    error TransfersDisabled();

    constructor(address _owner) ERC20("TetrodePass", "TPASS") Ownable(_owner) {}

    function decimals() public pure override returns (uint8) {
        return 0;
    }

    // Issue free passes to a player — only callable by owner (treasury wallet)
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
        emit PassIssued(to, amount);
    }

    // Consume a free pass when a player enters a game — only callable by owner
    function adminBurn(address from, uint256 amount) external onlyOwner {
        _burn(from, amount);
        emit PassUsed(from, amount);
    }

    // Block all player-to-player transfers — passes are soulbound
    function transfer(address, uint256) public pure override returns (bool) {
        revert TransfersDisabled();
    }

    function transferFrom(address, address, uint256) public pure override returns (bool) {
        revert TransfersDisabled();
    }
}
