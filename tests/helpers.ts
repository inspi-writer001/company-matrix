import { X12Matrix } from "../target/types/x12_matrix";
import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import {
  getOrCreateAssociatedTokenAccount,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";

anchor.setProvider(anchor.AnchorProvider.env());
import authority_wallet_file from "./wallets/authority-wallet.json";

const company_Wallet = new anchor.web3.PublicKey(
  "4ibWj1JrU9UPvKGeHN1PCuWQs6wLCsA5DM7YkQ3WUzmy"
);

const token_mint = new anchor.web3.PublicKey(
  "6mWfrWzYf5ot4S8Bti5SCDRnZWA5ABPH1SNkSq4mNN1C"
);

const authority_wallet = anchor.web3.Keypair.fromSecretKey(
  new Uint8Array(authority_wallet_file)
);

const program = anchor.workspace.x12Matrix as Program<X12Matrix>;

const [global_state_pda, _bump_global_state] =
  anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("global_state")],
    program.programId
  );

const [escrow_pda, _bump_escrow] = anchor.web3.PublicKey.findProgramAddressSync(
  [Buffer.from("escrow")],
  program.programId
);

// ============= UPDATED HELPER FUNCTIONS =============

/**
 * PIF a downline - Creates a Silver position and activates the user
 * Now uses automatic forced matrix placement
 */
async function pifDownline(
  sponsor: anchor.web3.Keypair,
  downline: anchor.web3.PublicKey,
  name: string
) {
  const [downline_pda] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("user"), downline.toBytes()],
    program.programId
  );

  const [user_pda] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("user"), sponsor.publicKey.toBytes()],
    program.programId
  );

  const sponsorATA = await getOrCreateAssociatedTokenAccount(
    anchor.getProvider().connection,
    sponsor,
    token_mint,
    sponsor.publicKey
  );

  const companyATA = await getOrCreateAssociatedTokenAccount(
    anchor.getProvider().connection,
    authority_wallet,
    token_mint,
    company_Wallet
  );

  // Get current state to calculate next position
  const globalState = await program.account.globalState.fetch(global_state_pda);
  const currentPositions = globalState.totalPositions[0].toNumber();

  // The contract will automatically find the next available position
  // We just need to calculate the PDA for the position that will be created
  const nextPosition = await findNextAvailablePosition(0); // Silver level

  const [position_record_pda] = anchor.web3.PublicKey.findProgramAddressSync(
    [
      Buffer.from("position"),
      new Uint8Array([0]), // Silver level
      new anchor.BN(nextPosition).toArrayLike(Buffer, "le", 8),
    ],
    program.programId
  );

  const tx = await program.methods
    .pifUser()
    .signers([sponsor])
    .accounts({
      companyToken: companyATA.address,
      downline: downline,
      downlineAccount: downline_pda,
      sponsorAccount: user_pda,
      escrow: escrow_pda,
      globalState: global_state_pda,
      mint: token_mint,
      sponsorToken: sponsorATA.address,
      positionRecord: position_record_pda,
      sponsor: sponsor.publicKey,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .rpc();

  console.log(
    `✅ ${name} PIF completed at position ${nextPosition}: ${tx.substring(
      0,
      8
    )}...`
  );

  // Log matrix placement info
  const parent = getParentPosition(nextPosition);
  console.log(
    `   └─ Placed in matrix: Position ${nextPosition}, Parent: ${parent}`
  );

  return tx;
}

/**
 * Purchase a specific level with automatic payment distribution
 * Now includes remaining_accounts for grandparent payment distribution
 */
async function purchaseLevelWithDistribution(
  sponsor: anchor.web3.Keypair,
  downline: anchor.web3.PublicKey,
  level: number,
  levelName: string
) {
  const [downline_pda] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("user"), downline.toBytes()],
    program.programId
  );

  const [user_pda] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("user"), sponsor.publicKey.toBytes()],
    program.programId
  );

  const sponsorATA = await getOrCreateAssociatedTokenAccount(
    anchor.getProvider().connection,
    sponsor,
    token_mint,
    sponsor.publicKey
  );

  const companyATA = await getOrCreateAssociatedTokenAccount(
    anchor.getProvider().connection,
    authority_wallet,
    token_mint,
    company_Wallet
  );

  // Find next available position
  const nextPosition = await findNextAvailablePosition(level);

  const [position_record_pda] = anchor.web3.PublicKey.findProgramAddressSync(
    [
      Buffer.from("position"),
      new Uint8Array([level]),
      new anchor.BN(nextPosition).toArrayLike(Buffer, "le", 8),
    ],
    program.programId
  );

  // Calculate grandparent for payment distribution
  const parent = getParentPosition(nextPosition);
  const grandparent = parent > 1 ? getParentPosition(parent) : 0;

  // Prepare remaining accounts for payment distribution
  const remainingAccounts = [];

  if (grandparent > 0) {
    // Find grandparent position owner
    const grandparentOwner = await getPositionOwner(level, grandparent);
    if (grandparentOwner) {
      const [grandparentUserPda] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("user"), grandparentOwner.toBytes()],
        program.programId
      );
      remainingAccounts.push({
        pubkey: grandparentUserPda,
        isWritable: true,
        isSigner: false,
      });
    }
  }

  const tx = await program.methods
    .purchaseLevelWithDistribution(level, downline)
    .signers([sponsor])
    .accounts({
      companyToken: companyATA.address,
      downline: downline,
      downlineAccount: downline_pda,
      sponsorAccount: user_pda,
      escrow: escrow_pda,
      globalState: global_state_pda,
      mint: token_mint,
      sponsorToken: sponsorATA.address,
      positionRecord: position_record_pda,
      sponsor: sponsor.publicKey,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .remainingAccounts(remainingAccounts)
    .rpc();

  console.log(
    `✅ ${levelName} level purchased at position ${nextPosition}: ${tx.substring(
      0,
      8
    )}...`
  );

  if (grandparent > 0) {
    console.log(
      `   └─ Payment distributed to Level 2 (Position ${grandparent})`
    );
  }

  return tx;
}

/**
 * Purchase multiple positions at once
 */
async function purchaseMultiplePositions(
  sponsor: anchor.web3.Keypair,
  downline: anchor.web3.PublicKey,
  level: number,
  quantity: number,
  levelName: string
) {
  const [downline_pda] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("user"), downline.toBytes()],
    program.programId
  );

  const [user_pda] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("user"), sponsor.publicKey.toBytes()],
    program.programId
  );

  const sponsorATA = await getOrCreateAssociatedTokenAccount(
    anchor.getProvider().connection,
    sponsor,
    token_mint,
    sponsor.publicKey
  );

  const companyATA = await getOrCreateAssociatedTokenAccount(
    anchor.getProvider().connection,
    authority_wallet,
    token_mint,
    company_Wallet
  );

  const tx = await program.methods
    .purchaseMultiplePositions(level, quantity, downline)
    .signers([sponsor])
    .accounts({
      companyToken: companyATA.address,
      downline: downline,
      downlineAccount: downline_pda,
      sponsorAccount: user_pda,
      escrow: escrow_pda,
      globalState: global_state_pda,
      mint: token_mint,
      sponsorToken: sponsorATA.address,
      sponsor: sponsor.publicKey,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .rpc();

  console.log(
    `✅ ${quantity} ${levelName} positions purchased: ${tx.substring(0, 8)}...`
  );
  return tx;
}

/**
 * Get matrix structure for visualization
 */
async function getMatrixStructure(
  level: number,
  startPosition: number,
  count: number
) {
  try {
    const result = await program.methods
      .getMatrixStructure(level, new anchor.BN(startPosition), count)
      .accounts({
        globalState: global_state_pda,
      })
      .view();

    return result;
  } catch (error) {
    console.error("Error fetching matrix structure:", error);
    return [];
  }
}

/**
 * Get user positions summary
 */
async function getUserPositions(userPublicKey: anchor.web3.PublicKey) {
  const [user_pda] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("user"), userPublicKey.toBytes()],
    program.programId
  );

  try {
    const result = await program.methods
      .getUserPositions(userPublicKey)
      .accounts({
        userAccount: user_pda,
      })
      .view();

    return result;
  } catch (error) {
    console.error("Error fetching user positions:", error);
    return null;
  }
}

/**
 * Display matrix tree structure
 */
async function displayMatrixTree(level: number) {
  const globalState = await program.account.globalState.fetch(global_state_pda);
  const totalPositions = globalState.totalPositions[level].toNumber();

  console.log(`\n=== ${getLevelName(level)} Matrix Structure ===`);
  console.log(`Total Positions: ${totalPositions}\n`);

  if (totalPositions === 0) {
    console.log("No positions created yet");
    return;
  }

  // Display in tree format
  console.log("Position 1 (Root)");

  for (let pos = 2; pos <= Math.min(totalPositions, 7); pos++) {
    const parent = getParentPosition(pos);
    const prefix = pos <= 3 ? "├── " : "    ├── ";
    const level = pos <= 3 ? "Level 1" : "Level 2";

    console.log(`${prefix}Position ${pos} (${level}, Parent: ${parent})`);

    if (pos === 7 && totalPositions > 7) {
      console.log("\n... and more positions");
    }
  }
}

// ============= UTILITY FUNCTIONS =============

/**
 * Find next available position in forced matrix
 */
async function findNextAvailablePosition(level: number): Promise<number> {
  const globalState = await program.account.globalState.fetch(global_state_pda);
  const totalPositions = globalState.totalPositions[level].toNumber();

  if (totalPositions === 0) {
    return 1; // First position
  }

  // In 2x2 forced matrix, find first incomplete parent
  for (let parentPos = 1; parentPos <= totalPositions; parentPos++) {
    const leftChild = (parentPos - 1) * 2 + 2;
    const rightChild = (parentPos - 1) * 2 + 3;

    if (leftChild > totalPositions) {
      return leftChild;
    }
    if (rightChild > totalPositions) {
      return rightChild;
    }
  }

  // This shouldn't happen in proper forced matrix
  throw new Error("Matrix calculation error");
}

/**
 * Get parent position in 2x2 matrix
 */
function getParentPosition(position: number): number {
  if (position === 1) {
    return 0; // Root has no parent
  }
  return Math.floor((position - 2) / 2) + 1;
}

/**
 * Get position owner (simplified - would need actual implementation)
 */
async function getPositionOwner(
  level: number,
  positionNumber: number
): Promise<anchor.web3.PublicKey | null> {
  try {
    // Try to fetch the position record
    const [position_pda] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("position"),
        new Uint8Array([level]),
        new anchor.BN(positionNumber).toArrayLike(Buffer, "le", 8),
      ],
      program.programId
    );

    const positionRecord = await program.account.positionRecord.fetch(
      position_pda
    );
    return positionRecord.owner;
  } catch (error) {
    return null;
  }
}

/**
 * Get level name
 */
function getLevelName(level: number): string {
  const names = [
    "Silver",
    "Gold",
    "Sapphire",
    "Emerald",
    "Platinum",
    "Diamond",
  ];
  return names[level] || "Unknown";
}

/**
 * Check if position completes a matrix
 */
function isMatrixComplete(position: number): boolean {
  // Positions 4,5,6,7 complete matrix for position 1
  // Positions 8,9,10,11 complete for position 2, etc.
  if (position < 4) return false;

  const setStart = Math.floor((position - 4) / 4) * 4 + 4;
  const setEnd = setStart + 3;

  return position === setEnd;
}

// ============= EXISTING FUNCTIONS (Updated) =============

async function activateWealthyClub(
  user: anchor.web3.Keypair,
  sponsor?: anchor.web3.PublicKey
) {
  const userATA = await getOrCreateAssociatedTokenAccount(
    anchor.getProvider().connection,
    user,
    token_mint,
    user.publicKey
  );

  const tx = await program.methods
    .activateWealthyClub(sponsor || null)
    .signers([user])
    .accounts({
      user: user.publicKey,
      userToken: userATA.address,
      escrow: escrow_pda,
      mint: token_mint,
      tokenProgram: TOKEN_PROGRAM_ID,
      globalState: global_state_pda,
    })
    .rpc();

  return tx;
}

async function purchaseAllInMatrix(
  sponsor: anchor.web3.Keypair,
  downline: anchor.web3.PublicKey
) {
  const [downline_pda] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("user"), downline.toBytes()],
    program.programId
  );

  const [user_pda] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("user"), sponsor.publicKey.toBytes()],
    program.programId
  );

  const sponsorATA = await getOrCreateAssociatedTokenAccount(
    anchor.getProvider().connection,
    sponsor,
    token_mint,
    sponsor.publicKey
  );

  const companyATA = await getOrCreateAssociatedTokenAccount(
    anchor.getProvider().connection,
    authority_wallet,
    token_mint,
    company_Wallet
  );

  const tx = await program.methods
    .purchaseAllInMatrixSimple()
    .signers([sponsor])
    .accounts({
      sponsor: sponsor.publicKey,
      downline: downline,
      downlineAccount: downline_pda,
      sponsorAccount: user_pda,
      sponsorToken: sponsorATA.address,
      escrow: escrow_pda,
      companyToken: companyATA.address,
      mint: token_mint,
      tokenProgram: TOKEN_PROGRAM_ID,
      globalState: global_state_pda,
    })
    .rpc();

  return tx;
}

async function purchaseWealthyClubAllIn(
  sponsor: anchor.web3.Keypair,
  downline: anchor.web3.PublicKey,
  wealthySponsor: anchor.web3.PublicKey
) {
  const [downline_pda] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("user"), downline.toBytes()],
    program.programId
  );

  const [user_pda] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("user"), sponsor.publicKey.toBytes()],
    program.programId
  );

  const sponsorATA = await getOrCreateAssociatedTokenAccount(
    anchor.getProvider().connection,
    sponsor,
    token_mint,
    sponsor.publicKey
  );

  const companyATA = await getOrCreateAssociatedTokenAccount(
    anchor.getProvider().connection,
    authority_wallet,
    token_mint,
    company_Wallet
  );

  const tx = await program.methods
    .purchaseWealthyClubAllInSimple()
    .signers([sponsor])
    .accounts({
      sponsor: sponsor.publicKey,
      downline: downline,
      downlineAccount: downline_pda,
      sponsorAccount: user_pda,
      sponsorToken: sponsorATA.address,
      escrow: escrow_pda,
      companyToken: companyATA.address,
      mint: token_mint,
      tokenProgram: TOKEN_PROGRAM_ID,
      globalState: global_state_pda,
    })
    .rpc();

  return tx;
}

async function withdraw(user: anchor.web3.Keypair, amount: number) {
  const [user_pda] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("user"), user.publicKey.toBytes()],
    program.programId
  );

  const userATA = await getOrCreateAssociatedTokenAccount(
    anchor.getProvider().connection,
    user,
    token_mint,
    user.publicKey
  );

  const tx = await program.methods
    .withdraw(new anchor.BN(amount))
    .signers([user])
    .accounts({
      user: user.publicKey,
      userAccount: user_pda,
      userToken: userATA.address,
      escrow: escrow_pda,
      mint: token_mint,
      tokenProgram: TOKEN_PROGRAM_ID,
      globalState: global_state_pda,
    })
    .rpc();

  return tx;
}

// Keep all the existing fetch functions as they are
async function fetchDownlinesBySponsor(
  sponsorPublicKey: anchor.web3.PublicKey
) {
  try {
    const userAccounts = await program.account.userAccount.all();
    const downlines = userAccounts.filter((account) =>
      account.account.sponsor.equals(sponsorPublicKey)
    );

    return downlines.map((account) => ({
      publicKey: account.publicKey,
      owner: account.account.owner,
      registeredAt: new Date(
        account.account.registeredAt.mul(new anchor.BN(1000)).toNumber()
      ),
      isActive: account.account.isActive,
      pifCount: account.account.pifCount,
      totalEarnings: account.account.totalEarnings,
      availableBalance: account.account.availableBalance,
      reserveBalance: account.account.reserveBalance,
      positionsCount: account.account.positionsCount,
    }));
  } catch (error) {
    console.error("Error fetching downlines:", error);
    return [];
  }
}

async function fetchFullTeamStructure(
  sponsorPublicKey: anchor.web3.PublicKey,
  maxDepth = 5
) {
  const getDownlinesRecursive = async (
    userKey: anchor.web3.PublicKey,
    currentDepth = 0
  ) => {
    if (currentDepth >= maxDepth) return [];

    const directDownlines = await fetchDownlinesBySponsor(userKey);

    const teamStructure = await Promise.all(
      directDownlines.map(async (downline) => {
        const subDownlines = await getDownlinesRecursive(
          downline.owner,
          currentDepth + 1
        );
        return {
          ...downline,
          level: currentDepth + 1,
          downlines: subDownlines,
        };
      })
    );

    return teamStructure;
  };

  try {
    const fullTeam = await getDownlinesRecursive(sponsorPublicKey);

    const calculateTeamSize = (team: any[]): number => {
      return team.reduce((total, member) => {
        return total + 1 + calculateTeamSize(member.downlines || []);
      }, 0);
    };

    const totalTeamSize = calculateTeamSize(fullTeam);

    return {
      team: fullTeam,
      totalSize: totalTeamSize,
    };
  } catch (error) {
    console.error("Error fetching full team structure:", error);
    return { team: [], totalSize: 0 };
  }
}

async function analyzeUserPlan(
  userPublicKey: anchor.web3.PublicKey
): Promise<UserPlanAnalysis> {
  const [userPda] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("user"), userPublicKey.toBytes()],
    program.programId
  );

  let userAccount;
  try {
    userAccount = await program.account.userAccount.fetch(userPda);
  } catch (error) {
    throw new Error("User account not found - user never registered");
  }

  const [wealthyClubPda] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("wealthy_club"), userPublicKey.toBytes()],
    program.programId
  );

  let wealthyClubAccount = null;
  try {
    wealthyClubAccount = await program.account.wealthyClubAccount.fetch(
      wealthyClubPda
    );
  } catch (error) {
    // Wealthy club account doesn't exist
  }

  return {
    isRegistered: true,
    isActive: userAccount.isActive,
    registeredAt: new Date(userAccount.registeredAt.toNumber() * 1000),
    sponsor: userAccount.sponsor,
    totalEarnings: userAccount.totalEarnings.toNumber() / 1_000_000,
    availableBalance: userAccount.availableBalance.toNumber() / 1_000_000,
    reserveBalance: userAccount.reserveBalance.toNumber() / 1_000_000,
    pifCount: userAccount.pifCount,
    canWithdraw:
      userAccount.pifCount >= 2 && userAccount.availableBalance.toNumber() > 0,
    positionsCount: Array.from(userAccount.positionsCount).map((pos) => pos),
    activeLevels: Array.from(userAccount.positionsCount)
      .map((count, level) => ({ level, count }))
      .filter(({ count }) => count > 0),
    hasAllInCombo: userAccount.hasAllInCombo,
    hasWealthyClubCombo: userAccount.hasWealthyClubCombo,
    comboLevelsUsed: Array.from(userAccount.comboLevelsUsed),
    wealthyClubActivated: wealthyClubAccount?.isActivated || false,
    wealthyClubPosition: wealthyClubAccount?.positionNumber.toNumber() || 0,
    wealthyClubEarnings:
      wealthyClubAccount?.totalEarned.toNumber() / 1_000_000 || 0,
    wealthyClubSponsor: wealthyClubAccount?.sponsor || null,
    planType: classifyUserPlan(userAccount, wealthyClubAccount),
    totalInvestment: calculateTotalInvestment(userAccount, wealthyClubAccount),
    potentialEarnings: calculatePotentialEarnings(userAccount),
  };
}

function classifyUserPlan(userAccount: any, wealthyClubAccount: any): string {
  if (!userAccount.isActive) return "Inactive (Not PIF'd)";
  if (userAccount.hasWealthyClubCombo) return "Wealthy Club All-In ($74)";
  if (userAccount.hasAllInCombo) return "All-In Matrix ($62)";

  const activeLevels = userAccount.positionsCount.filter(
    (count: number) => count > 0
  ).length;
  const hasWealthyClub = wealthyClubAccount?.isActivated || false;

  if (activeLevels === 1 && !hasWealthyClub) return "Basic Silver ($1)";
  if (activeLevels > 1 && hasWealthyClub)
    return `Individual Levels + Wealthy Club`;
  if (activeLevels > 1) return `Individual Levels (${activeLevels} levels)`;
  if (hasWealthyClub) return "Silver + Wealthy Club";

  return "Custom Plan";
}

function calculateTotalInvestment(
  userAccount: any,
  wealthyClubAccount: any
): number {
  let total = 0;

  if (userAccount.hasWealthyClubCombo) return 74;
  if (userAccount.hasAllInCombo) return 62;

  const levelCosts = [1, 2, 4, 8, 16, 32];
  userAccount.positionsCount.forEach((count: number, level: number) => {
    if (count > 0) {
      total += levelCosts[level] * count; // Multiply by count for multiple positions
    }
  });

  if (wealthyClubAccount?.isActivated) {
    total += 12;
  }

  return total;
}

function calculatePotentialEarnings(userAccount: any): number {
  const levelEarnings = [2, 4, 8, 16, 32, 64];
  let potential = 0;

  userAccount.positionsCount.forEach((count: number, level: number) => {
    potential += count * levelEarnings[level];
  });

  return potential;
}

function displayUserAnalysis(userName: string, analysis: UserPlanAnalysis) {
  console.log(`👤 ${userName.toUpperCase()}`);
  console.log(`📅 Registered: ${analysis.registeredAt.toLocaleDateString()}`);
  console.log(`🎯 Plan Type: ${analysis.planType}`);
  console.log(`💰 Total Investment: $${analysis.totalInvestment}`);
  console.log(`📈 Status: ${analysis.isActive ? "✅ Active" : "❌ Inactive"}`);

  if (analysis.isActive) {
    console.log(
      `👥 PIF Count: ${analysis.pifCount} (${
        analysis.canWithdraw ? "✅ Can Withdraw" : "❌ Cannot Withdraw"
      })`
    );
    console.log(
      `💵 Available Balance: $${analysis.availableBalance.toFixed(2)}`
    );
    console.log(`🏦 Reserve Balance: $${analysis.reserveBalance.toFixed(2)}`);
    console.log(`📊 Total Earnings: $${analysis.totalEarnings.toFixed(2)}`);

    if (analysis.activeLevels.length > 0) {
      console.log(`🎮 Active Levels:`);
      const levelNames = [
        "Silver",
        "Gold",
        "Sapphire",
        "Emerald",
        "Platinum",
        "Diamond",
      ];
      analysis.activeLevels.forEach(({ level, count }) => {
        console.log(`   ${levelNames[level]}: ${count} positions`);
      });
    }

    if (analysis.hasAllInCombo || analysis.hasWealthyClubCombo) {
      console.log(`🎁 Combo Packages:`);
      if (analysis.hasWealthyClubCombo)
        console.log(`   ✅ Wealthy Club All-In ($74)`);
      else if (analysis.hasAllInCombo) console.log(`   ✅ All-In Matrix ($62)`);

      const unusedLevels = analysis.comboLevelsUsed
        .map((used, index) => ({ index, used }))
        .filter(({ used }) => !used)
        .map(
          ({ index }) =>
            ["Silver", "Gold", "Sapphire", "Emerald", "Platinum", "Diamond"][
              index
            ]
        );

      if (unusedLevels.length > 0) {
        console.log(`   🎯 Unused Levels: ${unusedLevels.join(", ")}`);
      }
    }

    if (analysis.wealthyClubActivated) {
      console.log(
        `🏆 Wealthy Club: Position #${
          analysis.wealthyClubPosition
        } (Earned: $${analysis.wealthyClubEarnings.toFixed(2)})`
      );
    }

    console.log(
      `🎲 Potential Earnings: $${analysis.potentialEarnings} (if all matrices complete)`
    );
  }

  console.log();
}

export {
  // Core functions
  pifDownline,
  purchaseLevelWithDistribution,
  purchaseMultiplePositions,

  // Query functions
  getMatrixStructure,
  getUserPositions,
  displayMatrixTree,

  // Combo packages
  purchaseAllInMatrix,
  purchaseWealthyClubAllIn,

  // Other functions
  activateWealthyClub,
  withdraw,

  // Fetch functions
  fetchDownlinesBySponsor,
  fetchFullTeamStructure,
  analyzeUserPlan,
  displayUserAnalysis,

  // Utility functions
  findNextAvailablePosition,
  getParentPosition,
  isMatrixComplete,
  getLevelName,
};

interface UserPlanAnalysis {
  isRegistered: boolean;
  isActive: boolean;
  registeredAt: Date;
  sponsor: anchor.web3.PublicKey;
  totalEarnings: number;
  availableBalance: number;
  reserveBalance: number;
  pifCount: number;
  canWithdraw: boolean;
  positionsCount: number[];
  activeLevels: { level: number; count: number }[];
  hasAllInCombo: boolean;
  hasWealthyClubCombo: boolean;
  comboLevelsUsed: boolean[];
  wealthyClubActivated: boolean;
  wealthyClubPosition: number;
  wealthyClubEarnings: number;
  wealthyClubSponsor: anchor.web3.PublicKey | null;
  planType: string;
  totalInvestment: number;
  potentialEarnings: number;
}
