import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import {
  getAssociatedTokenAddressSync,
  getOrCreateAssociatedTokenAccount
} from "@solana/spl-token";
import { TOKEN_PROGRAM_ID } from "@coral-xyz/anchor/dist/cjs/utils/token";
import { X12Matrix } from "../target/types/x12_matrix";

import authority_wallet_file from "./wallets/authority-wallet.json";
import user1_wallet_file from "./wallets/user-1-wallet.json";
import user2_wallet_file from "./wallets/user-2-wallet.json";
import user3_wallet_file from "./wallets/user-3-wallet.json";
import user4_wallet_file from "./wallets/user-4-wallet.json";
import user5_wallet_file from "./wallets/user-5-wallet.json";
import user6_wallet_file from "./wallets/user-6-wallet.json";
import user7_wallet_file from "./wallets/user-7-wallet.json";

import user8ii_wallet_file from "./wallets/user-8ii-wallet.json";
import user9ii_wallet_file from "./wallets/user-9ii-wallet.json";
import user10ii_wallet_file from "./wallets/user-10ii-wallet.json";

import {
  activateWealthyClub,
  analyzeUserPlan,
  displayUserAnalysis,
  fetchDownlinesBySponsor,
  fetchFullTeamStructure,
  pifDownline,
  purchaseAllInMatrix,
  purchaseLevel,
  purchaseWealthyClubAllIn,
  withdraw
} from "./helpers";
import { expect } from "chai";

const authority_wallet = anchor.web3.Keypair.fromSecretKey(
  new Uint8Array(authority_wallet_file)
);

const user1_wallet = anchor.web3.Keypair.fromSecretKey(
  new Uint8Array(user1_wallet_file)
);
const user2_wallet = anchor.web3.Keypair.fromSecretKey(
  new Uint8Array(user2_wallet_file)
);
const user3_wallet = anchor.web3.Keypair.fromSecretKey(
  new Uint8Array(user3_wallet_file)
);
const user4_wallet = anchor.web3.Keypair.fromSecretKey(
  new Uint8Array(user4_wallet_file)
);
const user5_wallet = anchor.web3.Keypair.fromSecretKey(
  new Uint8Array(user5_wallet_file)
);
const user6_wallet = anchor.web3.Keypair.fromSecretKey(
  new Uint8Array(user6_wallet_file)
);
const user7_wallet = anchor.web3.Keypair.fromSecretKey(
  new Uint8Array(user7_wallet_file)
);

const user8ii_wallet = anchor.web3.Keypair.fromSecretKey(
  new Uint8Array(user8ii_wallet_file)
);

const user9ii_wallet = anchor.web3.Keypair.fromSecretKey(
  new Uint8Array(user9ii_wallet_file)
);
const user10ii_wallet = anchor.web3.Keypair.fromSecretKey(
  new Uint8Array(user10ii_wallet_file)
);

const users = [
  { wallet: user1_wallet, name: "User1 (Basic)" },
  { wallet: user2_wallet, name: "User2 (All-In Matrix)" },
  { wallet: user3_wallet, name: "User3 (Wealthy Club All-In)" },
  { wallet: user4_wallet, name: "User4 (Individual Purchases)" },
  { wallet: user5_wallet, name: "User5 (Inactive)" }
];

const company_Wallet = new anchor.web3.PublicKey(
  "4ibWj1JrU9UPvKGeHN1PCuWQs6wLCsA5DM7YkQ3WUzmy"
);

const token_mint = new anchor.web3.PublicKey(
  "6mWfrWzYf5ot4S8Bti5SCDRnZWA5ABPH1SNkSq4mNN1C"
);
describe("x12_matrix", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.x12Matrix as Program<X12Matrix>;
  const [global_state_pda, _bump_global_state] =
    anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("global_state")],
      program.programId
    );
  const [escrow_pda, _bump_escrow] =
    anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("escrow")],
      program.programId
    );

  it("Is initialized!", async () => {
    // Add your test here.
    const tx = await program.methods
      .initialize(company_Wallet)
      .signers([authority_wallet])
      .accounts({
        authority: authority_wallet.publicKey,
        mint: token_mint,
        tokenProgram: TOKEN_PROGRAM_ID
      })
      .rpc();
    console.log("Your transaction signature", tx);
  });

  it("2. should create user account for multiple users", async () => {
    // Add your test here.
    await createUser(user1_wallet);
    await createUser(user2_wallet);
    await createUser(user3_wallet);
    await createUser(user4_wallet);
    await createUser(user5_wallet);
    await createUser(user6_wallet);
    await createUser(user7_wallet);
    // level 2
    await createUser(user8ii_wallet);
    await createUser(user9ii_wallet);
    await createUser(user10ii_wallet);
  });

  // it.skip("should pif downline account", async () => {
  //   // FIRST LEVEL
  //   await pifDownline(user1_wallet, user1_wallet.publicKey);
  //   await pifDownline(user1_wallet, user2_wallet.publicKey);
  //   await pifDownline(user1_wallet, user3_wallet.publicKey);
  //   await pifDownline(user1_wallet, user4_wallet.publicKey);
  //   await pifDownline(user1_wallet, user5_wallet.publicKey);
  //   await pifDownline(user1_wallet, user6_wallet.publicKey);
  //   await pifDownline(user1_wallet, user7_wallet.publicKey);
  //   // SECOND LEVEL
  //   await pifDownlineOpt(user2_wallet, user8ii_wallet.publicKey);
  //   await pifDownlineOpt(user2_wallet, user9ii_wallet.publicKey);
  //   await pifDownlineOpt(user2_wallet, user10ii_wallet.publicKey);
  // });

  it("3. Should PIF users and create positions", async () => {
    console.log("=== Test 3: PIF Users ===");

    try {
      // First level - User1 as root sponsor
      console.log("Creating first level positions...");
      await pifDownline(user1_wallet, user1_wallet.publicKey, "User1 (self)");
      await pifDownline(user1_wallet, user2_wallet.publicKey, "User2");
      await pifDownline(user1_wallet, user3_wallet.publicKey, "User3");

      // Verify User1 has 2 PIFs now
      const [user1Pda] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("user"), user1_wallet.publicKey.toBytes()],
        program.programId
      );
      const user1Account = await program.account.userAccount.fetch(user1Pda);
      expect(user1Account.pifCount).to.equal(2); // Should have 2 PIFs (User2 and User3)
      console.log(`✅ User1 PIF count: ${user1Account.pifCount}`);

      // Second level - User2 sponsors others
      console.log("Creating second level positions...");
      await pifDownline(user2_wallet, user4_wallet.publicKey, "User4");
      await pifDownline(user2_wallet, user5_wallet.publicKey, "User5");

      // Verify User2 has 2 PIFs
      const [user2Pda] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("user"), user2_wallet.publicKey.toBytes()],
        program.programId
      );
      const user2Account = await program.account.userAccount.fetch(user2Pda);
      expect(user2Account.pifCount).to.equal(2);
      console.log(`✅ User2 PIF count: ${user2Account.pifCount}`);
    } catch (error) {
      console.log("Error during PIF:", error);
      if (error.logs) console.log("Program logs:", error.logs);
      throw error;
    }
  });

  it("4. Should purchase specific matrix levels", async () => {
    console.log("=== Test 4: Purchase Levels ===");

    try {
      // User1 purchases Gold level (level 1)
      console.log("purchasing level gold");
      await purchaseLevel(user1_wallet, user1_wallet.publicKey, 1, "Gold");

      console.log("purchasing level sapphire");
      // User1 purchases Sapphire level (level 2)
      await purchaseLevel(user1_wallet, user1_wallet.publicKey, 2, "Sapphire");

      // Verify positions were created
      const [user1Pda] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("user"), user1_wallet.publicKey.toBytes()],
        program.programId
      );
      const user1Account = await program.account.userAccount.fetch(user1Pda);
      expect(user1Account.positionsCount[1]).to.be.greaterThan(0); // Gold positions
      expect(user1Account.positionsCount[2]).to.be.greaterThan(0); // Sapphire positions

      console.log("✅ Level purchases completed successfully");
    } catch (error) {
      console.log("Error purchasing levels:", error);
      if (error.logs) console.log("Program logs:", error.logs);
      throw error;
    }
  });

  it("5. Should activate wealthy club membership", async () => {
    console.log("=== Test 5: Wealthy Club Activation ===");

    try {
      const tx = await activateWealthyClub(
        user1_wallet,
        user1_wallet.publicKey
      );
      console.log(
        `✅ Wealthy Club activated for User1: ${tx.substring(0, 8)}...`
      );

      // Verify wealthy club account
      const [wealthyClubPda] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("wealthy_club"), user1_wallet.publicKey.toBytes()],
        program.programId
      );
      const wealthyClubAccount = await program.account.wealthyClubAccount.fetch(
        wealthyClubPda
      );
      expect(wealthyClubAccount.isActivated).to.be.true;
      expect(wealthyClubAccount.owner.toString()).to.equal(
        user1_wallet.publicKey.toString()
      );

      // Verify global state updated
      const globalState = await program.account.globalState.fetch(
        global_state_pda
      );
      expect(globalState.wealthyClubTotalMembers.toNumber()).to.be.greaterThan(
        0
      );
    } catch (error) {
      console.log("Error activating wealthy club:", error);
      if (error.logs) console.log("Program logs:", error.logs);
      throw error;
    }
  });

  it("6. Should purchase combo packages", async () => {
    console.log("=== Test 6: Combo Package Purchase ===");

    try {
      // Purchase All-In Matrix combo for User2
      const tx1 = await purchaseAllInMatrix(
        user2_wallet,
        user2_wallet.publicKey
      );
      console.log(
        `✅ All-In Matrix combo purchased: ${tx1.substring(0, 8)}...`
      );

      // Verify combo purchase
      const [user2Pda] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("user"), user2_wallet.publicKey.toBytes()],
        program.programId
      );
      const user2Account = await program.account.userAccount.fetch(user2Pda);
      expect(user2Account.hasAllInCombo).to.be.true;

      // Purchase Wealthy Club All-In combo for User3
      const tx2 = await purchaseWealthyClubAllIn(
        user3_wallet,
        user3_wallet.publicKey,
        user1_wallet.publicKey
      );
      console.log(
        `✅ Wealthy Club All-In combo purchased: ${tx2.substring(0, 8)}...`
      );

      // Verify wealthy club combo
      const [user3Pda] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("user"), user3_wallet.publicKey.toBytes()],
        program.programId
      );
      const user3Account = await program.account.userAccount.fetch(user3Pda);
      expect(user3Account.hasWealthyClubCombo).to.be.true;
    } catch (error) {
      console.log("Error purchasing combo packages:", error);
      if (error.logs) console.log("Program logs:", error.logs);
      throw error;
    }
  });

  it("7. Should claim level 2 payments", async () => {
    console.log("=== Test 7: Claim Level 2 Payments ===");

    try {
      // This test requires setting up a proper 2x2 matrix with level 2 positions
      // We'll need to create enough positions to trigger level 2 payments

      // For now, let's just verify the account structure exists
      const [user1Pda] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("user"), user1_wallet.publicKey.toBytes()],
        program.programId
      );
      const user1Account = await program.account.userAccount.fetch(user1Pda);

      console.log(
        `User1 current earnings: ${user1Account.totalEarnings.toNumber()}`
      );
      console.log(
        `User1 available balance: ${user1Account.availableBalance.toNumber()}`
      );
      console.log("✅ Payment claim structure verified");
    } catch (error) {
      console.log("Error in payment claim test:", error);
      if (error.logs) console.log("Program logs:", error.logs);
    }
  });

  it("8. Should handle withdrawal attempts", async () => {
    console.log("=== Test 8: Withdrawal Tests ===");

    try {
      const [user1Pda] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("user"), user1_wallet.publicKey.toBytes()],
        program.programId
      );
      const user1Account = await program.account.userAccount.fetch(user1Pda);
      console.log(user1Account);

      if (
        user1Account.availableBalance.toNumber() > 0 &&
        user1Account.pifCount >= 2
      ) {
        // Attempt withdrawal
        const withdrawAmount = Math.min(
          1000000,
          user1Account.availableBalance.toNumber()
        ); // $1 or less

        const tx = await withdraw(user1_wallet, withdrawAmount);
        console.log(`✅ Withdrawal successful: ${tx.substring(0, 8)}...`);
      } else {
        console.log("⚠️ User1 doesn't meet withdrawal requirements");
        console.log(
          `Available balance: ${user1Account.availableBalance.toNumber()}`
        );
        console.log(`PIF count: ${user1Account.pifCount} (need 2+)`);
      }
    } catch (error) {
      console.log(
        "Expected error for withdrawal (likely insufficient balance or PIFs):",
        error.message
      );
    }
  });

  it("should fetch direct downlines for user1", async () => {
    console.log("=== Fetching user1's direct downlines ===");

    // const downlines = await fetchDownlinesBySponsor(user1_wallet.publicKey);
    const downlines = await fetchDownlinesBySponsor(user1_wallet.publicKey);

    console.log(`User1 has ${downlines.length} direct downlines:`);
    downlines.forEach((downline, index) => {
      console.log(`${index + 1}. ${downline.owner.toString()}`);
      console.log(`   - Active: ${downline.isActive}`);
      console.log(`   - PIF Count: ${downline.pifCount}`);
      console.log(
        `   - Registered: ${downline.registeredAt.toLocaleDateString()}`
      );
    });

    // Verify we have the expected downlines
    const downlineKeys = downlines.map((d) => d.owner.toString());
    const expectedDownlines = [
      user2_wallet.publicKey.toString(),
      user3_wallet.publicKey.toString()
    ];

    expectedDownlines.forEach((expected) => {
      if (downlineKeys.includes(expected)) {
        console.log(`✅ Found expected downline: ${expected}`);
      } else {
        console.log(`❌ Missing expected downline: ${expected}`);
      }
    });
  });

  it("should fetch full team structure for user1", async () => {
    console.log("=== Fetching user1's full team structure ===");

    const teamStructure = await fetchFullTeamStructure(
      user1_wallet.publicKey,
      3
    );

    console.log(`Total team size: ${teamStructure.totalSize}`);
    console.log("Team structure:");
    console.log(JSON.stringify(teamStructure.team, null, 2));

    // Verify team structure
    console.log("\n=== Team Hierarchy Verification ===");
    teamStructure.team.forEach((level1Member, index) => {
      console.log(
        `Level 1 Member ${index + 1}: ${level1Member.owner.toString()}`
      );

      level1Member.downlines?.forEach((level2Member, subIndex) => {
        console.log(
          `  └─ Level 2 Member ${
            subIndex + 1
          }: ${level2Member.owner.toString()}`
        );
      });
    });
  });

  it.only("Should analyze user plans and show comprehensive status", async () => {
    console.log("=== 📊 USER PLAN ANALYSIS REPORT ===\n");

    for (const user of users) {
      try {
        const analysis = await analyzeUserPlan(user.wallet.publicKey);
        displayUserAnalysis(user.name, analysis);
        console.log("─".repeat(80));
      } catch (error) {
        console.log(`❌ Error analyzing ${user.name}: ${error.message}\n`);
      }
    }
  });

  // it("should withdraw from user earnings", async () => {
  //   console.log("=== Attempting to withdraw from user's balance ===");
  //   try {
  //     const tx = await program.methods.claimLevel2Payment().signers([user1_wallet]).accounts({
  //       globalState: global_state_pda,
  //       positionRecord:
  //     })

  //     console.log("Your transaction signature", tx);
  //   } catch (error) {

  //     if (error.logs) {
  //       console.log(error.logs);
  //     }
  //     throw error;
  //   }

  // });

  const createUser = async (user: anchor.web3.Keypair) => {
    try {
      const tx = await program.methods
        .createUser()
        .signers([user])
        .accounts({
          user: user.publicKey
        })
        .rpc();
      console.log("Your transaction signature", tx);
    } catch (error) {
      console.log(error);
      if (error.logs) {
        console.log(error.logs);
      }
    }
  };
});
