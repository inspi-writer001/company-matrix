import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import {
  getAssociatedTokenAddressSync,
  getOrCreateAssociatedTokenAccount
} from "@solana/spl-token";
import { TOKEN_PROGRAM_ID } from "@coral-xyz/anchor/dist/cjs/utils/token";
import { X2Matrix } from "../target/types/x2_matrix";

import authority_wallet_file from "./wallets/authority-wallet.json";
import user1_wallet_file from "./wallets/user-1-wallet.json";
import user2_wallet_file from "./wallets/user-2-wallet.json";
import user3_wallet_file from "./wallets/user-3-wallet.json";
import user4_wallet_file from "./wallets/user-4-wallet.json";
import user5_wallet_file from "./wallets/user-5-wallet.json";
import user6_wallet_file from "./wallets/user-6-wallet.json";
import user7_wallet_file from "./wallets/user-7-wallet.json";

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

const company_Wallet = new anchor.web3.PublicKey(
  "4ibWj1JrU9UPvKGeHN1PCuWQs6wLCsA5DM7YkQ3WUzmy"
);

const token_mint = new anchor.web3.PublicKey(
  "6mWfrWzYf5ot4S8Bti5SCDRnZWA5ABPH1SNkSq4mNN1C"
);
describe("x2_matrix", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.x2Matrix as Program<X2Matrix>;
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

  // it("Is initialized!", async () => {
  //   // Add your test here.
  //   const tx = await program.methods
  //     .initialize(company_Wallet)
  //     .signers([authority_wallet])
  //     .accounts({
  //       authority: authority_wallet.publicKey,
  //       mint: token_mint,
  //       tokenProgram: TOKEN_PROGRAM_ID
  //     })
  //     .rpc();
  //   console.log("Your transaction signature", tx);
  // });

  // it("shhould create user account for multiple users", async () => {
  //   // Add your test here.
  //   await createUser(user3_wallet);
  //   await createUser(user4_wallet);
  //   await createUser(user5_wallet);
  //   await createUser(user6_wallet);
  //   await createUser(user7_wallet);
  // });

  // it("shhould creatte user account 2", async () => {
  //   // Add your test here.
  //   const tx = await program.methods
  //     .createUser()
  //     .signers([user2_wallet])
  //     .accounts({
  //       user: user2_wallet.publicKey
  //     })
  //     .rpc();
  //   console.log("Your transaction signature", tx);
  // });

  it("should pif downline account", async () => {
    await pifDownline(user1_wallet, user3_wallet.publicKey);
    await pifDownline(user1_wallet, user4_wallet.publicKey);
    await pifDownline(user1_wallet, user5_wallet.publicKey);
    await pifDownline(user1_wallet, user6_wallet.publicKey);
    await pifDownline(user1_wallet, user7_wallet.publicKey);
  });

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

  const pifDownline = async (
    sponsor: anchor.web3.Keypair,
    downline: anchor.web3.PublicKey
  ) => {
    try {
      const [downline_pda, _downline_bump] =
        anchor.web3.PublicKey.findProgramAddressSync(
          [Buffer.from("user"), downline.toBytes()],
          program.programId
        );

      const [user_pda, _user_bump] =
        anchor.web3.PublicKey.findProgramAddressSync(
          [Buffer.from("user"), sponsor.publicKey.toBytes()],
          program.programId
        );

      const [escrow_pda, _escrow_bump] =
        anchor.web3.PublicKey.findProgramAddressSync(
          [Buffer.from("escrow")],
          program.programId
        );

      const escrowATA = getAssociatedTokenAddressSync(
        token_mint,
        escrow_pda,
        true
      );

      const sponsorATA = anchor.utils.token.associatedAddress({
        mint: token_mint,
        owner: sponsor.publicKey
      });

      const companyATA = await getOrCreateAssociatedTokenAccount(
        anchor.getProvider().connection,
        authority_wallet,
        token_mint,
        company_Wallet
      );

      console.log("sponsor ata: ", sponsorATA);
      console.log("escrow ata: ", escrowATA);
      console.log("escrow pda: ", escrow_pda);

      // 1. Get current positions from global state
      const globalState = await program.account.globalState.fetch(
        global_state_pda
      );
      const positions = globalState.totalPositions.map((p) => p.toNumber());

      // 2. Find first available level (0-5)
      let targetLevel = positions.findIndex((count, levelIndex) => {
        // Diamond level (5) has 40 positions, others have 6
        const maxPositions = levelIndex === 5 ? 40 : 6;
        return count < maxPositions;
      });

      // 3. Fallback to Diamond if all levels are full
      if (targetLevel === -1) targetLevel = 5;

      // 4. Calculate new position number
      const positionNumber = positions[targetLevel] + 1;

      // Derive the PDA for PositionRecord
      const [position__record_pda, positionRecordBump] =
        anchor.web3.PublicKey.findProgramAddressSync(
          [
            Buffer.from("position"), // b"position"
            new Uint8Array([targetLevel]), // &[0] (u8 level)
            new anchor.BN(positionNumber).toArrayLike(Buffer, "le", 8)
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
          sponsorToken: sponsorATA,
          positionRecord: position__record_pda,
          sponsor: sponsor.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID
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
