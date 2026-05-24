// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console2} from "forge-std/Script.sol";
import {TetrodePass} from "../src/TetrodePass.sol";

contract MintPass is Script {
    address constant PASS_CONTRACT = 0xAD3DadDD4380D5c542DA0F5EfAC3ac168A1cDf00;

    function run(address to, uint256 amount) external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerKey);
        TetrodePass(PASS_CONTRACT).mint(to, amount);
        vm.stopBroadcast();
        console2.log("Minted", amount, "pass(es) to", to);
        console2.log("New balance:", TetrodePass(PASS_CONTRACT).balanceOf(to));
    }
}
