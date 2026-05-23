// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console2} from "forge-std/Script.sol";
import {TetrodLeaderboard} from "../src/TetrodLeaderboard.sol";
import {TetrodePass} from "../src/TetrodePass.sol";

contract DeployScript is Script {
    function run() external {
        address oracle = vm.envAddress("ORACLE_ADDRESS");
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);

        vm.startBroadcast(deployerKey);

        TetrodLeaderboard leaderboard = new TetrodLeaderboard(oracle);
        TetrodePass pass = new TetrodePass(deployer);

        vm.stopBroadcast();

        console2.log("TetrodLeaderboard deployed at:", address(leaderboard));
        console2.log("TetrodePass deployed at:      ", address(pass));
        console2.log("Oracle set to:                ", oracle);
        console2.log("TetrodePass owner:            ", deployer);
    }
}
