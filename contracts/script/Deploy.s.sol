// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console2} from "forge-std/Script.sol";
import {TetrodLeaderboard} from "../src/TetrodLeaderboard.sol";

contract DeployScript is Script {
    function run() external {
        address oracle = vm.envAddress("ORACLE_ADDRESS");
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(deployerKey);
        TetrodLeaderboard leaderboard = new TetrodLeaderboard(oracle);
        vm.stopBroadcast();

        // Log for copy-pasting into .env
        // solhint-disable-next-line no-console
        console2.log("TetrodLeaderboard deployed at:", address(leaderboard));
        console2.log("Oracle set to:", oracle);
    }
}
