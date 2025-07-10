
use anchor_lang::prelude::*;
use anchor_spl::token_interface::{self, Mint, TokenAccount, TokenInterface, TransferChecked};

declare_id!("qbgCJXMfnpSHfAkgGmuz5qGmrFX9C1a4Xs7BCtk4bPu");

#[program]
pub mod x2_matrix {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>, company_wallet: Pubkey) -> Result<()> {
        let state = &mut ctx.accounts.global_state;
        state.company_wallet = company_wallet;
        state.authority = ctx.accounts.authority.key();
        state.total_positions = [0; 6];
        state.escrow_bump = ctx.bumps.escrow;
        Ok(())
    }

    pub fn create_user(ctx: Context<CreateUser>) -> Result<()> {
        let user = &mut ctx.accounts.user_account;
        let clock = Clock::get()?;

        user.owner = ctx.accounts.user.key();
        user.registered_at = clock.unix_timestamp;
        user.is_active = false;
        user.sponsor = Pubkey::default();
        user.pif_count = 0;
        user.total_earnings = 0;
        user.available_balance = 0;
        user.reserve_balance = 0;
        user.positions_count = [0; 6];

        Ok(())
    }

    pub fn pif_user(ctx: Context<PifUser>) -> Result<()> {
        // Pay $1 for Silver
        transfer_tokens(
            &ctx.accounts.sponsor,
            &ctx.accounts.sponsor_token,
            &ctx.accounts.escrow,
            &ctx.accounts.token_program,
            &ctx.accounts.mint,
            1_000_000,
        )?;

        // Activate user
        ctx.accounts.downline_account.is_active = true;
        ctx.accounts.downline_account.sponsor = ctx.accounts.sponsor.key();

        // Update sponsor stats
        ctx.accounts.sponsor_account.pif_count += 1;
        if ctx.accounts.sponsor_account.pif_count == 2 {
            // Enable auto-withdraw after 2 PIFs
            let reserve = ctx.accounts.sponsor_account.reserve_balance;
            ctx.accounts.sponsor_account.available_balance += reserve;
            ctx.accounts.sponsor_account.reserve_balance = 0;
        }

        // Create position
        let position_number = ctx.accounts.global_state.total_positions[0] + 1;
        ctx.accounts.global_state.total_positions[0] = position_number;
        ctx.accounts.downline_account.positions_count[0] += 1;

        // Create position record
        let position_record = &mut ctx.accounts.position_record;
        position_record.level = 0;
        position_record.position_number = position_number;
        position_record.owner = ctx.accounts.downline.key();

        // Calculate parent
        let parent_number = if position_number == 1 {
            0
        } else {
            ((position_number - 1) / 6) + 1
        };

        // Send 50% to company
        transfer_to_company(
            &ctx.accounts.escrow,
            &ctx.accounts.company_token,
            &ctx.accounts.token_program,
            &ctx.accounts.mint,
            500_000,
            ctx.accounts.global_state.escrow_bump,
        )?;

        emit!(PositionCreated {
            owner: ctx.accounts.downline.key(),
            level: 0,
            position_number,
            parent_number,
        });

        Ok(())
    }

    pub fn claim_level2_payment(
        ctx: Context<ClaimPayment>,
        child_position: u64,
        level: u8,
    ) -> Result<()> {
        // Verify caller owns the parent position
        let parent_num = ((child_position - 1) / 6) + 1;
        require!(
            ctx.accounts.position_record.position_number == parent_num,
            MatrixError::NotParent
        );
        require!(
            ctx.accounts.position_record.owner == ctx.accounts.user.key(),
            MatrixError::NotOwner
        );

        // Verify it's a Level 2 placement
        let spot = (child_position - 1) % 6;
        require!(spot >= 2, MatrixError::NotLevel2);

        // Process payment
        let prices = [
            1_000_000, 2_000_000, 4_000_000, 8_000_000, 16_000_000, 32_000_000,
        ];
        let earnings = prices[level as usize] / 2;

        let user = &mut ctx.accounts.user_account;
        user.total_earnings += earnings;

        if user.pif_count >= 2 {
            user.available_balance += earnings;
        } else {
            user.reserve_balance += earnings;
        }

        // Check if matrix complete
        if spot == 5 {
            handle_completion(&mut ctx.accounts.global_state, user, level)?;
        }

        emit!(PaymentClaimed {
            position: parent_num,
            from_child: child_position,
            amount: earnings,
        });

        Ok(())
    }

    pub fn withdraw(ctx: Context<Withdraw>, amount: u64) -> Result<()> {
        let user = &mut ctx.accounts.user_account;

        require!(
            amount <= user.available_balance,
            MatrixError::InsufficientBalance
        );
        require!(user.pif_count >= 2, MatrixError::NeedTwoPifs);

        // Transfer from escrow
        let seeds = &[b"escrow".as_ref(), &[ctx.accounts.global_state.escrow_bump]];
        let signer = &[&seeds[..]];

        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            TransferChecked {
                mint: ctx.accounts.mint.to_account_info(),
                from: ctx.accounts.escrow.to_account_info(),
                to: ctx.accounts.user_token.to_account_info(),
                authority: ctx.accounts.escrow.to_account_info(),
            },
            signer,
        );

        token_interface::transfer_checked(cpi_ctx, amount, ctx.accounts.mint.decimals)?;

        user.available_balance -= amount;

        Ok(())
    }
}

// Helper functions
fn transfer_tokens<'info>(
    from_authority: &Signer<'info>,
    from: &InterfaceAccount<'info, TokenAccount>,
    to: &InterfaceAccount<'info, TokenAccount>,
    token_program: &Interface<'info, TokenInterface>,
    mint: &InterfaceAccount<'info, Mint>,
    amount: u64,
) -> Result<()> {
    let cpi_ctx = CpiContext::new(
        token_program.to_account_info(),
        TransferChecked {
            mint: mint.to_account_info(),
            from: from.to_account_info(),
            to: to.to_account_info(),
            authority: from_authority.to_account_info(),
        },
    );
    token_interface::transfer_checked(cpi_ctx, amount, mint.decimals)?;
    Ok(())
}

fn transfer_to_company<'info>(
    from: &InterfaceAccount<'info, TokenAccount>,
    to: &InterfaceAccount<'info, TokenAccount>,
    token_program: &Interface<'info, TokenInterface>,
    mint: &InterfaceAccount<'info, Mint>,
    amount: u64,
    bump: u8,
) -> Result<()> {
    let seeds = &[b"escrow".as_ref(), &[bump]];
    let signer = &[&seeds[..]];

    let cpi_ctx = CpiContext::new_with_signer(
        token_program.to_account_info(),
        TransferChecked {
            mint: mint.to_account_info(),
            from: from.to_account_info(),
            to: to.to_account_info(),
            authority: from.to_account_info(),
        },
        signer,
    );
    token_interface::transfer_checked(cpi_ctx, amount, mint.decimals)?;
    Ok(())
}

fn handle_completion(
    state: &mut Account<GlobalState>,
    user: &mut Account<UserAccount>,
    level: u8,
) -> Result<()> {
    if level == 5 {
        // Diamond: create 40 re-entries
        state.total_positions[0] += 40;
        user.positions_count[0] += 40;
        // Wealthy Club payment handled separately
    } else {
        // Auto-upgrade
        state.total_positions[(level + 1) as usize] += 1;
        user.positions_count[(level + 1) as usize] += 1;
    }
    Ok(())
}

// Account structures
#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + GlobalState::INIT_SPACE, // 120 bytes
        seeds = [b"global_state"],
        bump
    )]
    pub global_state: Account<'info, GlobalState>,

    #[account(
        init,
        payer = authority,
        seeds = [b"escrow"],
        bump,
        token::mint = mint,
        token::authority = escrow,
    )]
    pub escrow: InterfaceAccount<'info, TokenAccount>,

    pub mint: InterfaceAccount<'info, Mint>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct CreateUser<'info> {
    #[account(
        init,
        payer = user,
        space = 8 + UserAccount::INIT_SPACE,
        seeds = [b"user", user.key().as_ref()],
        bump
    )]
    pub user_account: Account<'info, UserAccount>,

    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct PifUser<'info> {
    #[account(mut)]
    pub global_state: Account<'info, GlobalState>,

    #[account(mut)]
    pub sponsor: Signer<'info>,

    #[account(mut)]
    pub sponsor_account: Account<'info, UserAccount>,

    #[account(mut)]
    pub sponsor_token: InterfaceAccount<'info, TokenAccount>,

    /// CHECK: Downline
    pub downline: UncheckedAccount<'info>,

    #[account(mut)]
    pub downline_account: Account<'info, UserAccount>,

    #[account(
        init,
        payer = sponsor,
        space = 8 + PositionRecord::INIT_SPACE, 
        seeds = [b"position".as_ref(), &[0], global_state.total_positions[0].to_le_bytes().as_ref()],
        bump
    )]
    pub position_record: Account<'info, PositionRecord>,

    #[account(mut)]
    pub escrow: InterfaceAccount<'info, TokenAccount>,

    #[account(mut)]
    pub company_token: InterfaceAccount<'info, TokenAccount>,

    pub mint: InterfaceAccount<'info, Mint>,
    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ClaimPayment<'info> {
    #[account(mut)]
    pub global_state: Account<'info, GlobalState>,

    #[account(mut)]
    pub user: Signer<'info>,

    #[account(mut)]
    pub user_account: Account<'info, UserAccount>,

    pub position_record: Account<'info, PositionRecord>,
}

#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(mut)]
    pub user_account: Account<'info, UserAccount>,

    #[account()]
    pub global_state: Account<'info, GlobalState>,

    #[account(mut)]
    pub user_token: InterfaceAccount<'info, TokenAccount>,

    #[account(mut)]
    pub escrow: InterfaceAccount<'info, TokenAccount>,

    pub mint: InterfaceAccount<'info, Mint>,
    pub token_program: Interface<'info, TokenInterface>,
}

#[derive(InitSpace)]
#[account]
pub struct GlobalState {
    pub company_wallet: Pubkey,
    pub authority: Pubkey,
    pub total_positions: [u64; 6],
    pub escrow_bump: u8,
}


#[derive(InitSpace)]
#[account]
pub struct UserAccount {
    pub owner: Pubkey,
    pub registered_at: i64,
    pub is_active: bool,
    pub sponsor: Pubkey,
    pub pif_count: u8,
    pub total_earnings: u64,
    pub available_balance: u64,
    pub reserve_balance: u64,
    pub positions_count: [u32; 6],
}

#[derive(InitSpace)]
#[account]
pub struct PositionRecord {
    pub level: u8,
    pub position_number: u64,
    pub owner: Pubkey,
}

// Events
#[event]
pub struct PositionCreated {
    pub owner: Pubkey,
    pub level: u8,
    pub position_number: u64,
    pub parent_number: u64,
}

#[event]
pub struct PaymentClaimed {
    pub position: u64,
    pub from_child: u64,
    pub amount: u64,
}

// Errors
#[error_code]
pub enum MatrixError {
    #[msg("Invalid level")]
    InvalidLevel,
    #[msg("Not active")]
    NotActive,
    #[msg("Insufficient balance")]
    InsufficientBalance,
    #[msg("Need 2 PIFs to withdraw")]
    NeedTwoPifs,
    #[msg("Not the parent position")]
    NotParent,
    #[msg("Not the owner")]
    NotOwner,
    #[msg("Not a Level 2 placement")]
    NotLevel2,
}
