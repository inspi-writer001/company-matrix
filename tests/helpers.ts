import { X2Matrix } from "../target/types/x2_matrix";
import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import {
  getOrCreateAssociatedTokenAccount,
  TOKEN_PROGRAM_ID
} from "@solana/spl-token";
anchor.setProvider(anchor.AnchorProvider.env());

const company_Wallet = new anchor.web3.PublicKey(
  "4ibWj1JrU9UPvKGeHN1PCuWQs6wLCsA5DM7YkQ3WUzmy"
);

const token_mint = new anchor.web3.PublicKey(
  "6mWfrWzYf5ot4S8Bti5SCDRnZWA5ABPH1SNkSq4mNN1C"
);

const program = anchor.workspace.x2Matrix as Program<X2Matrix>;

const [global_state_pda, _bump_global_state] =
  anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("global_state")],
    program.programId
  );

// Method 1: Fetch all UserAccounts and filter by sponsor
const fetchDownlinesBySponsor = async (
  sponsorPublicKey: anchor.web3.PublicKey
) => {
  try {
    // Fetch all UserAccount PDAs
    const userAccounts = await program.account.userAccount.all();

    // Filter accounts where this user is the sponsor
    const downlines = userAccounts.filter((account) =>
      account.account.sponsor.equals(sponsorPublicKey)
    );

    console.log(
      `Found ${
        downlines.length
      } direct downlines for ${sponsorPublicKey.toString()}`
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
      positionsCount: account.account.positionsCount
    }));
  } catch (error) {
    console.error("Error fetching downlines:", error);
    return [];
  }
};

// Method 2: More efficient - use memcmp filter to only fetch relevant accounts
const fetchDownlinesOptimized = async (
  sponsorPublicKey: anchor.web3.PublicKey
) => {
  try {
    // Calculate the offset of the sponsor field in UserAccount
    // owner: Pubkey (32 bytes) + registered_at: i64 (8 bytes) + is_active: bool (1 byte) = 41 bytes offset
    const SPONSOR_OFFSET = 8 + 32 + 8 + 1; // 8 bytes for discriminator + account fields before sponsor

    const userAccounts = await program.account.userAccount.all([
      {
        memcmp: {
          offset: SPONSOR_OFFSET,
          bytes: sponsorPublicKey.toBase58()
        }
      }
    ]);

    console.log(`Found ${userAccounts.length} direct downlines (optimized)`);

    return userAccounts.map((account) => ({
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
      positionsCount: account.account.positionsCount
    }));
  } catch (error) {
    console.error("Error fetching downlines (optimized):", error);
    return [];
  }
};

// Method 3: Fetch downlines with their position information
const fetchDownlinesWithPositions = async (
  sponsorPublicKey: anchor.web3.PublicKey
) => {
  try {
    // First get the downlines
    const downlines = await fetchDownlinesBySponsor(sponsorPublicKey);

    // Then fetch position records for each downline
    const downlinesWithPositions = await Promise.all(
      downlines.map(async (downline) => {
        try {
          // Fetch all position records owned by this downline
          const positionRecords = await program.account.positionRecord.all([
            {
              memcmp: {
                offset: 8 + 1 + 8, // discriminator + level + position_number = offset to owner field
                bytes: downline.owner.toBase58()
              }
            }
          ]);

          return {
            ...downline,
            positions: positionRecords.map((pos) => ({
              level: pos.account.level,
              positionNumber: pos.account.positionNumber,
              publicKey: pos.publicKey
            }))
          };
        } catch (error) {
          console.error(
            `Error fetching positions for ${downline.owner.toString()}:`,
            error
          );
          return {
            ...downline,
            positions: []
          };
        }
      })
    );

    return downlinesWithPositions;
  } catch (error) {
    console.error("Error fetching downlines with positions:", error);
    return [];
  }
};

// Method 4: Get full team structure (multi-level downlines)
const fetchFullTeamStructure = async (
  sponsorPublicKey: anchor.web3.PublicKey,
  maxDepth = 5
) => {
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
          downlines: subDownlines
        };
      })
    );

    return teamStructure;
  };

  try {
    const fullTeam = await getDownlinesRecursive(sponsorPublicKey);

    // Calculate total team size
    const calculateTeamSize = (team: any[]): number => {
      return team.reduce((total, member) => {
        return total + 1 + calculateTeamSize(member.downlines || []);
      }, 0);
    };

    const totalTeamSize = calculateTeamSize(fullTeam);
    console.log(`Total team size: ${totalTeamSize} members`);

    return {
      team: fullTeam,
      totalSize: totalTeamSize
    };
  } catch (error) {
    console.error("Error fetching full team structure:", error);
    return { team: [], totalSize: 0 };
  }
};

// Method 5: Get team statistics
const getTeamStatistics = async (sponsorPublicKey: anchor.web3.PublicKey) => {
  try {
    const downlines = await fetchDownlinesWithPositions(sponsorPublicKey);

    const stats = {
      totalDirectDownlines: downlines.length,
      activeDownlines: downlines.filter((d) => d.isActive).length,
      inactiveDownlines: downlines.filter((d) => !d.isActive).length,
      totalTeamEarnings: downlines.reduce(
        (sum, d) => sum + d.totalEarnings.toNumber(),
        0
      ),
      totalTeamPifs: downlines.reduce((sum, d) => sum + d.pifCount, 0),
      positionsByLevel: [0, 0, 0, 0, 0, 0], // Initialize for 6 levels
      downlineDetails: downlines
    };

    // Calculate positions by level
    downlines.forEach((downline) => {
      downline.positionsCount.forEach((count, level) => {
        stats.positionsByLevel[level] += count;
      });
    });

    return stats;
  } catch (error) {
    console.error("Error calculating team statistics:", error);
    return null;
  }
};

const pifDownlineOpt = async (
  sponsor: anchor.web3.Keypair,
  downline: anchor.web3.PublicKey,
  targetLevel?: number // Optional: specify level, otherwise auto-detect
) => {
  try {
    const [downline_pda, _downline_bump] =
      anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("user"), downline.toBytes()],
        program.programId
      );

    const [user_pda, _user_bump] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("user"), sponsor.publicKey.toBytes()],
      program.programId
    );

    const [escrow_pda, _escrow_bump] =
      anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("escrow")],
        program.programId
      );

    const escrowATA = getOrCreateAssociatedTokenAccount(
      anchor.getProvider().connection,
      sponsor,
      token_mint,
      escrow_pda,
      true
    );

    const sponsorATA = await getOrCreateAssociatedTokenAccount(
      anchor.getProvider().connection,
      sponsor,
      token_mint,
      sponsor.publicKey
    );

    const companyATA = await getOrCreateAssociatedTokenAccount(
      anchor.getProvider().connection,
      sponsor,
      token_mint,
      company_Wallet
    );

    // 1. Get current positions from global state
    const globalState = await program.account.globalState.fetch(
      global_state_pda
    );
    const positions = globalState.totalPositions.map((p) => p.toNumber());

    // 2. Determine target level
    let level;
    if (targetLevel !== undefined) {
      // Use specified level
      level = targetLevel;
      console.log(`Using specified level: ${level}`);
    } else {
      // Auto-detect first available level
      level = positions.findIndex((count, levelIndex) => {
        // For 1x12 matrix: all levels have 12 positions
        // For current 1x6 matrix: levels 0-4 have 6, level 5 (Diamond) has 40
        const maxPositions = levelIndex === 5 ? 40 : 12; // Change to 12 for 1x12 matrix
        return count < maxPositions;
      });

      // Fallback to highest level if all are full
      if (level === -1) level = 5; // or 11 for 1x12 matrix

      console.log(`Auto-detected level: ${level}`);
    }

    // 3. Validate level
    if (level < 0 || level > 5) {
      // Change to > 11 for 1x12 matrix
      throw new Error(`Invalid level: ${level}. Must be 0-5`); // Change to 0-11
    }

    // 4. Get current positions for this level
    const currentPositions = positions[level];
    const positionNumber = currentPositions + 1;

    console.log(
      `Level ${level}: Current positions: ${currentPositions}, New position will be: ${positionNumber}`
    );

    // 5. Check if level is full
    const maxPositions = level === 5 ? 40 : 12; // Change to 12 for 1x12 matrix
    if (currentPositions >= maxPositions) {
      throw new Error(
        `Level ${level} is full! (${currentPositions}/${maxPositions})`
      );
    }

    // 6. Derive PDA using the target level
    const [position_record_pda, positionRecordBump] =
      anchor.web3.PublicKey.findProgramAddressSync(
        [
          Buffer.from("position"),
          new Uint8Array([level]), // Use target level
          new anchor.BN(currentPositions).toArrayLike(Buffer, "le", 8)
        ],
        program.programId
      );

    console.log(`Position record PDA: ${position_record_pda.toString()}`);

    // 7. Call the instruction with level parameter
    //.pifUser(level)
    const tx = await program.methods
      .pifUser() // Pass level parameter
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
        tokenProgram: TOKEN_PROGRAM_ID
      })
      .rpc();

    console.log(
      `Successfully placed user at level ${level}, position ${positionNumber}`
    );
    console.log("Transaction signature:", tx);

    return { level, positionNumber, txId: tx };
  } catch (error) {
    console.log("Error in pifDownline:", error);
    if (error.logs) {
      console.log("Program logs:", error.logs);
    }
    throw error;
  }
};

// Helper function to PIF at specific level
const pifDownlineAtLevel = async (
  sponsor: anchor.web3.Keypair,
  downline: anchor.web3.PublicKey,
  level: number
) => {
  return await pifDownlineOpt(sponsor, downline, level);
};

// Helper function to get level capacity info
const getLevelCapacity = async () => {
  const globalState = await program.account.globalState.fetch(global_state_pda);
  const positions = globalState.totalPositions.map((p) => p.toNumber());

  return positions.map((count, level) => {
    const maxPositions = level === 5 ? 40 : 12; // Change to 12 for 1x12 matrix
    return {
      level,
      current: count,
      max: maxPositions,
      available: maxPositions - count,
      isFull: count >= maxPositions
    };
  });
};

export {
  fetchDownlinesBySponsor,
  fetchDownlinesOptimized,
  fetchDownlinesWithPositions,
  getTeamStatistics,
  fetchFullTeamStructure,
  pifDownlineOpt
};
