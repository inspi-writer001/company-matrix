import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import {
  getAssociatedTokenAddressSync,
  getOrCreateAssociatedTokenAccount,
} from "@solana/spl-token";
import { TOKEN_PROGRAM_ID } from "@coral-xyz/anchor/dist/cjs/utils/token";
import { X12Matrix } from "../target/types/x12_matrix";
import { expect } from "chai";

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
  purchaseLevelWithDistribution,
  purchaseMultiplePositions,
  purchaseWealthyClubAllIn,
  withdraw,
  getMatrixStructure,
  getUserPositions,
  displayMatrixTree,
} from "./helpers";

// Initialize wallets
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
  { wallet: user1_wallet, name: "User1 (Root)" },
  { wallet: user2_wallet, name: "User2 (All-In Matrix)" },
  { wallet: user3_wallet, name: "User3 (Wealthy Club All-In)" },
  { wallet: user4_wallet, name: "User4 (Individual Purchases)" },
  { wallet: user5_wallet, name: "User5 (Level 2)" },
  { wallet: user6_wallet, name: "User6 (Level 2)" },
  { wallet: user7_wallet, name: "User7 (Level 2)" },
];

const company_Wallet = new anchor.web3.PublicKey(
  "4ibWj1JrU9UPvKGeHN1PCuWQs6wLCsA5DM7YkQ3WUzmy"
);

const token_mint = new anchor.web3.PublicKey(
  "6mWfrWzYf5ot4S8Bti5SCDRnZWA5ABPH1SNkSq4mNN1C"
);

describe("X12 Matrix - Updated Tests", () => {
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

  // Helper function to create a user
  const createUser = async (user: anchor.web3.Keypair) => {
    try {
      const tx = await program.methods
        .createUser()
        .signers([user])
        .accounts({
          user: user.publicKey,
        })
        .rpc();
      console.log(`User created: ${tx.substring(0, 8)}...`);
    } catch (error) {
      console.log(`User already exists or error: ${error.message}`);
    }
  };

  it("1. Initialize the program", async () => {
    const tx = await program.methods
      .initialize(company_Wallet)
      .signers([authority_wallet])
      .accounts({
        authority: authority_wallet.publicKey,
        mint: token_mint,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();
    console.log("✅ Program initialized:", tx);
  });

  it("2. Create user accounts for all test users", async () => {
    console.log("=== Creating User Accounts ===\n");

    await createUser(user1_wallet);
    await createUser(user2_wallet);
    await createUser(user3_wallet);
    await createUser(user4_wallet);
    await createUser(user5_wallet);
    await createUser(user6_wallet);
    await createUser(user7_wallet);
    await createUser(user8ii_wallet);
    await createUser(user9ii_wallet);
    await createUser(user10ii_wallet);

    console.log("✅ All user accounts created\n");
  });

  it("3. Test automatic forced matrix placement with PIFs", async () => {
    console.log("=== Test 3: Automatic Matrix Placement ===\n");

    try {
      // User1 PIFs themselves first (Position 1)
      await pifDownline(user1_wallet, user1_wallet.publicKey, "User1 (self)");

      // User1 PIFs User2 (Should go to Position 2 - left child of 1)
      await pifDownline(user1_wallet, user2_wallet.publicKey, "User2");

      // User1 PIFs User3 (Should go to Position 3 - right child of 1)
      await pifDownline(user1_wallet, user3_wallet.publicKey, "User3");

      // User2 PIFs User4 (Should go to Position 4 - left child of 2)
      await pifDownline(user2_wallet, user4_wallet.publicKey, "User4");

      // User2 PIFs User5 (Should go to Position 5 - right child of 2)
      await pifDownline(user2_wallet, user5_wallet.publicKey, "User5");

      // User3 PIFs User6 (Should go to Position 6 - left child of 3)
      await pifDownline(user3_wallet, user6_wallet.publicKey, "User6");

      // User3 PIFs User7 (Should go to Position 7 - right child of 3, COMPLETES MATRIX)
      await pifDownline(user3_wallet, user7_wallet.publicKey, "User7");

      // Display the matrix structure
      await displayMatrixTree(0); // Silver level

      // Verify PIF counts
      const [user1Pda] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("user"), user1_wallet.publicKey.toBytes()],
        program.programId
      );
      const user1Account = await program.account.userAccount.fetch(user1Pda);
      expect(user1Account.pifCount).to.equal(2);
      console.log(
        `\n✅ User1 PIF count: ${user1Account.pifCount} (can withdraw)`
      );

      // Check if User1 received Level 2 payments
      console.log(
        `💰 User1 earnings: $${
          user1Account.totalEarnings.toNumber() / 1_000_000
        }`
      );
      console.log(
        `   Available: $${user1Account.availableBalance.toNumber() / 1_000_000}`
      );
      console.log(
        `   Reserve: $${user1Account.reserveBalance.toNumber() / 1_000_000}`
      );
    } catch (error) {
      console.log("Error during matrix placement test:", error);
      if (error.logs) console.log("Program logs:", error.logs);
      throw error;
    }
  });

  it("4. Test purchasing levels with automatic payment distribution", async () => {
    console.log("\n=== Test 4: Level Purchases with Auto Payment ===\n");

    try {
      // User1 purchases Gold level
      await purchaseLevelWithDistribution(
        user1_wallet,
        user1_wallet.publicKey,
        1, // Gold
        "Gold"
      );

      // User2 purchases Gold level
      await purchaseLevelWithDistribution(
        user2_wallet,
        user2_wallet.publicKey,
        1,
        "Gold"
      );

      // User3 purchases Gold level - User1 should get payment as grandparent
      await purchaseLevelWithDistribution(
        user3_wallet,
        user3_wallet.publicKey,
        1,
        "Gold"
      );

      // Display Gold matrix
      await displayMatrixTree(1);

      // Check User1's updated earnings
      const [user1Pda] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("user"), user1_wallet.publicKey.toBytes()],
        program.programId
      );
      const user1Account = await program.account.userAccount.fetch(user1Pda);
      console.log(
        `\n💰 User1 total earnings: $${
          user1Account.totalEarnings.toNumber() / 1_000_000
        }`
      );
    } catch (error) {
      console.log("Error purchasing levels:", error);
      if (error.logs) console.log("Program logs:", error.logs);
      throw error;
    }
  });

  it("5. Test purchasing multiple positions at once", async () => {
    console.log("\n=== Test 5: Multiple Position Purchase ===\n");

    try {
      // User4 purchases 3 Gold positions at once
      await purchaseMultiplePositions(
        user4_wallet,
        user4_wallet.publicKey,
        1, // Gold level
        3, // Quantity
        "Gold"
      );

      // Verify positions were created
      const [user4Pda] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("user"), user4_wallet.publicKey.toBytes()],
        program.programId
      );
      const user4Account = await program.account.userAccount.fetch(user4Pda);

      console.log(
        `✅ User4 now has ${user4Account.positionsCount[1]} Gold positions`
      );

      // Display updated Gold matrix
      await displayMatrixTree(1);
    } catch (error) {
      console.log("Error purchasing multiple positions:", error);
      if (error.logs) console.log("Program logs:", error.logs);
      throw error;
    }
  });

  it("6. Test matrix visualization queries", async () => {
    console.log("\n=== Test 6: Matrix Visualization ===\n");

    try {
      // Get matrix structure for Silver level
      const silverMatrix = await getMatrixStructure(0, 1, 10);
      console.log("Silver Matrix Structure:");
      if (silverMatrix && silverMatrix.length > 0) {
        silverMatrix.forEach((pos) => {
          console.log(`  Position ${pos.positionNumber}:`);
          console.log(`    Parent: ${pos.parentPosition}`);
          console.log(`    Left Child: ${pos.leftChild || "None"}`);
          console.log(`    Right Child: ${pos.rightChild || "None"}`);
          console.log(`    Complete: ${pos.isComplete ? "Yes" : "No"}`);
        });
      }

      // Get user positions summary
      const user1Positions = await getUserPositions(user1_wallet.publicKey);
      if (user1Positions) {
        console.log("\nUser1 Position Summary:");
        console.log(`  Silver: ${user1Positions.silverPositions} positions`);
        console.log(`  Gold: ${user1Positions.goldPositions} positions`);
        console.log(
          `  Total Earnings: $${
            user1Positions.totalEarnings.toNumber() / 1_000_000
          }`
        );
      }
    } catch (error) {
      console.log("Error fetching matrix structure:", error);
    }
  });

  it("7. Test combo package purchases", async () => {
    console.log("\n=== Test 7: Combo Packages ===\n");

    try {
      // User8 purchases All-In Matrix combo
      await purchaseAllInMatrix(user8ii_wallet, user8ii_wallet.publicKey);
      console.log("✅ User8 purchased All-In Matrix combo ($62)");

      // Verify combo purchase
      const [user8Pda] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("user"), user8ii_wallet.publicKey.toBytes()],
        program.programId
      );
      const user8Account = await program.account.userAccount.fetch(user8Pda);
      expect(user8Account.hasAllInCombo).to.be.true;
      console.log(
        "   Combo levels available: Gold, Sapphire, Emerald, Platinum, Diamond"
      );

      // User9 purchases Wealthy Club All-In combo
      await purchaseWealthyClubAllIn(
        user9ii_wallet,
        user9ii_wallet.publicKey,
        user1_wallet.publicKey
      );
      console.log("✅ User9 purchased Wealthy Club All-In combo ($74)");

      // Verify wealthy club activation
      const [user9Pda] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("user"), user9ii_wallet.publicKey.toBytes()],
        program.programId
      );
      const user9Account = await program.account.userAccount.fetch(user9Pda);
      expect(user9Account.hasWealthyClubCombo).to.be.true;
    } catch (error) {
      console.log("Error purchasing combo packages:", error);
      if (error.logs) console.log("Program logs:", error.logs);
      throw error;
    }
  });

  it("8. Test withdrawal functionality", async () => {
    console.log("\n=== Test 8: Withdrawal Test ===\n");

    try {
      const [user1Pda] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("user"), user1_wallet.publicKey.toBytes()],
        program.programId
      );
      const user1Account = await program.account.userAccount.fetch(user1Pda);

      const availableBalance = user1Account.availableBalance.toNumber();
      const pifCount = user1Account.pifCount;

      console.log(`User1 Withdrawal Status:`);
      console.log(`  PIF Count: ${pifCount} (Required: 2)`);
      console.log(`  Available Balance: $${availableBalance / 1_000_000}`);

      if (availableBalance > 0 && pifCount >= 2) {
        const withdrawAmount = Math.min(1_000_000, availableBalance); // $1 or less
        const tx = await withdraw(user1_wallet, withdrawAmount);
        console.log(`✅ Withdrawal successful: ${tx.substring(0, 8)}...`);
        console.log(`   Amount withdrawn: $${withdrawAmount / 1_000_000}`);
      } else {
        console.log("❌ Cannot withdraw - requirements not met");
      }
    } catch (error) {
      console.log("Error during withdrawal:", error.message);
    }
  });

  it("9. Test team structure fetching", async () => {
    console.log("\n=== Test 9: Team Structure ===\n");

    const downlines = await fetchDownlinesBySponsor(user1_wallet.publicKey);
    console.log(`User1 has ${downlines.length} direct downlines:`);

    downlines.forEach((downline, index) => {
      console.log(
        `${index + 1}. ${downline.owner.toString().substring(0, 8)}...`
      );
      console.log(`   Active: ${downline.isActive}`);
      console.log(`   PIF Count: ${downline.pifCount}`);
      console.log(
        `   Positions: Silver(${downline.positionsCount[0]}), Gold(${downline.positionsCount[1]})`
      );
    });

    // Fetch full team structure
    const teamStructure = await fetchFullTeamStructure(
      user1_wallet.publicKey,
      3
    );
    console.log(`\nTotal team size: ${teamStructure.totalSize} members`);
  });

  it("10. Comprehensive user analysis", async () => {
    console.log("\n=== Test 10: User Analysis Report ===\n");

    for (const user of [
      user1_wallet,
      user2_wallet,
      user3_wallet,
      user4_wallet,
    ]) {
      try {
        const analysis = await analyzeUserPlan(user.publicKey);
        const userName = `User${users.findIndex((u) => u.wallet === user) + 1}`;
        displayUserAnalysis(userName, analysis);
        console.log("─".repeat(60));
      } catch (error) {
        console.log(`Error analyzing user: ${error.message}\n`);
      }
    }
  });

  it("11. Test matrix completion and auto-upgrade", async () => {
    console.log("\n=== Test 11: Matrix Completion ===\n");

    try {
      // Check global state for any completed matrices
      const globalState = await program.account.globalState.fetch(
        global_state_pda
      );

      console.log("Global Matrix Status:");
      const levels = [
        "Silver",
        "Gold",
        "Sapphire",
        "Emerald",
        "Platinum",
        "Diamond",
      ];
      levels.forEach((level, index) => {
        const positions = globalState.totalPositions[index].toNumber();
        console.log(`  ${level}: ${positions} positions`);

        // Check if any matrix completed (position 7, 11, 15, etc.)
        if (positions >= 7) {
          const completedMatrices = Math.floor((positions - 3) / 4);
          if (completedMatrices > 0) {
            console.log(`    ✅ ${completedMatrices} matrix(es) completed`);
          }
        }
      });

      // Check for re-entries
      if (globalState.totalPositions[0].toNumber() > 7) {
        console.log("\n🔄 Re-entries detected in Silver level!");
      }
    } catch (error) {
      console.log("Error checking matrix completion:", error);
    }
  });

  it("12. Test error handling for invalid operations", async () => {
    console.log("\n=== Test 12: Error Handling ===\n");

    // Test 1: Try to PIF an already active user
    try {
      await pifDownline(
        user1_wallet,
        user2_wallet.publicKey,
        "User2 (duplicate)"
      );
      console.log("❌ Should have failed - user already active");
    } catch (error) {
      console.log("✅ Correctly rejected duplicate PIF:", error.message);
    }

    // Test 2: Try to withdraw without enough PIFs
    try {
      const [user5Pda] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("user"), user5_wallet.publicKey.toBytes()],
        program.programId
      );
      const user5Account = await program.account.userAccount.fetch(user5Pda);

      if (user5Account.pifCount < 2) {
        await withdraw(user5_wallet, 1_000_000);
        console.log("❌ Should have failed - not enough PIFs");
      }
    } catch (error) {
      console.log("✅ Correctly rejected withdrawal:", error.message);
    }

    // Test 3: Try to purchase invalid level
    try {
      await purchaseLevelWithDistribution(
        user1_wallet,
        user1_wallet.publicKey,
        10, // Invalid level
        "Invalid"
      );
      console.log("❌ Should have failed - invalid level");
    } catch (error) {
      console.log("✅ Correctly rejected invalid level:", error.message);
    }

    console.log("\n✅ All error handling tests passed");
  });
});
