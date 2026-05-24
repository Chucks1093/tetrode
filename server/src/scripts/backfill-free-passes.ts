import { createWalletClient, createPublicClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { celo } from 'viem/chains';
import { parseAbi } from 'viem';
import { prisma } from '../utils/prisma.utils';
import dotenv from 'dotenv';

dotenv.config({ path: process.env.ENV_FILE || '.env' });

const PASS_CONTRACT = process.env.TETRODE_PASS_CONTRACT_ADDRESS as `0x${string}`;
const PRIVATE_KEY = process.env.ORACLE_PRIVATE_KEY as `0x${string}`;
const RPC = 'https://rpc.ankr.com/celo';

const ABI = parseAbi([
   'function mint(address to, uint256 amount) external',
   'function balanceOf(address account) external view returns (uint256)',
]);

async function main() {
   if (!PASS_CONTRACT || !PRIVATE_KEY) {
      console.error('TETRODE_PASS_CONTRACT_ADDRESS or ORACLE_PRIVATE_KEY not set');
      process.exit(1);
   }

   const account = privateKeyToAccount(PRIVATE_KEY);
   const walletClient = createWalletClient({ account, chain: celo, transport: http(RPC) });
   const publicClient = createPublicClient({ chain: celo, transport: http(RPC) });

   const profiles = await prisma.profile.findMany({
      where: { walletAddress: { not: null } },
      select: { id: true, name: true, walletAddress: true },
   });

   console.log(`Found ${profiles.length} users with wallets\n`);

   let success = 0;
   let failed = 0;

   for (const profile of profiles) {
      const wallet = profile.walletAddress!;
      process.stdout.write(`  ${profile.name ?? profile.id} (${wallet}) → `);

      try {
         const balance = await publicClient.readContract({
            address: PASS_CONTRACT,
            abi: ABI,
            functionName: 'balanceOf',
            args: [wallet as `0x${string}`],
         });
         if (Number(balance) > 0) {
            console.log(`skipped (already has ${balance} pass)`);
            continue;
         }

         await walletClient.writeContract({
            address: PASS_CONTRACT,
            abi: ABI,
            functionName: 'mint',
            args: [wallet as `0x${string}`, BigInt(1)],
         });
         console.log('✓');
         success++;
         await new Promise(r => setTimeout(r, 1500));
      } catch (err) {
         console.log(`FAILED — ${err instanceof Error ? err.message : err}`);
         failed++;
      }
   }

   console.log(`\nDone. ${success} minted, ${failed} failed.`);
}

main()
   .catch(err => { console.error(err); process.exit(1); })
   .finally(() => prisma.$disconnect());
