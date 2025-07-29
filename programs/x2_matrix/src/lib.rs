
use anchor_lang::prelude::*;
use anchor_spl::token_interface::{self, Mint, TokenAccount, TokenInterface, TransferChecked};

declare_id!("HdAGWMfX7Y5ykkh815A464NQffNKfXj1papBwJyMLzbw");

#[program]
pub mod x12_matrix {
    use super::*;

   pub fn initialize(ctx: Context<Initialize>, company_wallet: Pubkey) -> Result<()> {
    let state = &mut ctx.accounts.global_state;
    state.company_wallet = company_wallet;
    state.authority = ctx.accounts.authority.key();
    state.total_positions = [0; 6];
    state.escrow_bump = ctx.bumps.escrow;
    // ADD THESE LINES:
    state.wealthy_club_total_members = 0;
    state.wealthy_club_active_members = 0;
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

        assert!(!ctx.accounts.downline_account.is_active, "User already belongs to a team");

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

       let parent_number = get_parent_position_2x2(position_number);
        // let parent_number = if position_number == 1 {
        //     0
        // } else {
        //     ((position_number - 1) / 6) + 1
        // };

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
    let parent_num = get_parent_position_2x2(child_position);
    require!(
        ctx.accounts.position_record.position_number == parent_num,
        MatrixError::NotParent
    );
    require!(
        ctx.accounts.position_record.owner == ctx.accounts.user.key(),
        MatrixError::NotOwner
    );

    // Verify it's a Level 2 placement
    require!(is_level2_position(child_position), MatrixError::NotLevel2);

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

    // Check if matrix complete (position 7 is the last in 2x2)
    if is_matrix_complete_2x2(child_position) {
        handle_completion(&mut ctx.accounts.global_state, user, level)?;
    }

    emit!(PaymentClaimed {
        position: parent_num,
        from_child: child_position,
        amount: earnings,
    });

    Ok(())
}

pub fn purchase_level(
    ctx: Context<PurchaseLevel>, 
    level: u8,
    downline: Pubkey,
) -> Result<()> {
    // Validate level
    require!(level <= 5, MatrixError::InvalidLevel);
    
    let prices = [
        1_000_000, 2_000_000, 4_000_000, 8_000_000, 16_000_000, 32_000_000,
    ];
    
    let entry_cost = prices[level as usize];
    
    // Pay full entry cost
    transfer_tokens(
        &ctx.accounts.sponsor,
        &ctx.accounts.sponsor_token,
        &ctx.accounts.escrow,
        &ctx.accounts.token_program,
        &ctx.accounts.mint,
        entry_cost,
    )?;

    // For higher levels, user must already be active
    if level > 0 {
        require!(ctx.accounts.downline_account.is_active, MatrixError::NotActive);
    } else {
        // Silver level activates user
        assert!(!ctx.accounts.downline_account.is_active, "User already belongs to a team");
        ctx.accounts.downline_account.is_active = true;
        ctx.accounts.downline_account.sponsor = ctx.accounts.sponsor.key();
        
        // Update sponsor PIF count for Silver only
        ctx.accounts.sponsor_account.pif_count += 1;
        if ctx.accounts.sponsor_account.pif_count == 2 {
            let reserve = ctx.accounts.sponsor_account.reserve_balance;
            ctx.accounts.sponsor_account.available_balance += reserve;
            ctx.accounts.sponsor_account.reserve_balance = 0;
        }
    }

    // Create position at the specified level
    let position_number = ctx.accounts.global_state.total_positions[level as usize] + 1;
    ctx.accounts.global_state.total_positions[level as usize] = position_number;
    ctx.accounts.downline_account.positions_count[level as usize] += 1;

    // Create position record
    let position_record = &mut ctx.accounts.position_record;
    position_record.level = level;
    position_record.position_number = position_number;
    position_record.owner = downline;

    // Calculate parent for 2x2 matrix
    let parent_number = get_parent_position_2x2(position_number);

    // Send 50% to company
    transfer_to_company(
        &ctx.accounts.escrow,
        &ctx.accounts.company_token,
        &ctx.accounts.token_program,
        &ctx.accounts.mint,
        entry_cost / 2,
        ctx.accounts.global_state.escrow_bump,
    )?;

    emit!(PositionCreated {
        owner: downline,
        level,
        position_number,
        parent_number,
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

    pub fn activate_wealthy_club(ctx: Context<ActivateWealthyClub>, sponsor: Option<Pubkey>) -> Result<()> {
    let wealthy_club = &mut ctx.accounts.wealthy_club_account;
    
    require!(!wealthy_club.is_activated, MatrixError::AlreadyActivated);

    // Pay $12 to activate
    transfer_tokens(
        &ctx.accounts.user,
        &ctx.accounts.user_token,
        &ctx.accounts.escrow,
        &ctx.accounts.token_program,
        &ctx.accounts.mint,
        12_000_000,
    )?;

    let clock = Clock::get()?;
    let state = &mut ctx.accounts.global_state;
    
    wealthy_club.owner = ctx.accounts.user.key();
    wealthy_club.sponsor = sponsor.unwrap_or_default();
    wealthy_club.is_activated = true;
    wealthy_club.position_number = state.wealthy_club_total_members + 1;
    wealthy_club.total_earned = 0;
    wealthy_club.joined_at = clock.unix_timestamp;
    if let Some(sponsor_pubkey) = sponsor {
    // Could add validation here that sponsor exists and is activated
    // For now, trust the client
    wealthy_club.activated_sponsor = sponsor_pubkey;
} else {
    wealthy_club.activated_sponsor = Pubkey::default();
}

    state.wealthy_club_total_members += 1;
    state.wealthy_club_active_members += 1;

    emit!(WealthyClubActivated {
        user: ctx.accounts.user.key(),
        position_number: wealthy_club.position_number,
        activated_sponsor: wealthy_club.activated_sponsor,
    });

    Ok(())
}

pub fn process_diamond_completion<'info>(
     ctx: Context<'_, '_, '_, 'info, ProcessDiamondCompletion<'info>>,
    sponsor_chain: Vec<Pubkey>,
) -> Result<()> {
    let state = &mut ctx.accounts.global_state;
    let user = &mut ctx.accounts.user_account;
    
    // Create 40 re-entries
    state.total_positions[0] += 40;
    user.positions_count[0] += 40;

    // Verify user is activated in Wealthy Club
    require!(ctx.accounts.user_wealthy_club.is_activated, MatrixError::WealthyClubNotActivated);

    // Distribute $12 to sponsor chain (passed via remaining_accounts)
    let per_level_payment = 1_000_000; // $1 per level
    let sponsors_paid = sponsor_chain.len().min(12);
    
    for (level, _sponsor_pubkey) in sponsor_chain.iter().take(12).enumerate() {
    // Get sponsor token account from remaining_accounts
    let sponsor_token_account = &ctx.remaining_accounts[level];
    
    // Inline transfer logic to avoid lifetime issues
    let seeds = &[b"escrow".as_ref(), &[ctx.accounts.global_state.escrow_bump]];
    let signer = &[&seeds[..]];

    let cpi_ctx = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        TransferChecked {
            mint: ctx.accounts.mint.to_account_info(),
            from: ctx.accounts.escrow.to_account_info(),
            to: sponsor_token_account.to_account_info(),
            authority: ctx.accounts.escrow.to_account_info(),
        },
        signer,
    );

    token_interface::transfer_checked(cpi_ctx, per_level_payment, ctx.accounts.mint.decimals)?;

    emit!(WealthyClubPayment {
        recipient: *_sponsor_pubkey,
        amount: per_level_payment,
        level: (level + 1) as u8,
        from_user: ctx.accounts.user.key(),
    });
}
    
    // Send remaining to company
    let remaining = 12_000_000 - (sponsors_paid as u64 * per_level_payment);
    if remaining > 0 {
        transfer_to_company(
            &ctx.accounts.escrow,
            &ctx.accounts.company_token,
            &ctx.accounts.token_program,
            &ctx.accounts.mint,
            remaining,
            ctx.accounts.global_state.escrow_bump,
        )?;
    }

    emit!(DiamondCompleted {
        user: ctx.accounts.user.key(),
        re_entries_created: 40,
        wealthy_club_payment: 12_000_000,
    });

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

fn get_level_name(level: u8) -> &'static str {
    match level {
        0 => "Silver",
        1 => "Gold", 
        2 => "Sapphire",
        3 => "Emerald",
        4 => "Platinum",
        5 => "Diamond",
        _ => "Unknown"
    }
}

fn get_parent_position_2x2(position: u64) -> u64 {
    if position == 1 {
        0  // Root has no parent
    } else {
        ((position - 2) / 2) + 1
    }
}

fn is_level2_position(position: u64) -> bool {
    position >= 4 && position <= 7
}

fn is_matrix_complete_2x2(position: u64) -> bool {
    position == 7  // Last position in 2x2 matrix
}

fn get_level_in_matrix(position: u64) -> u8 {
    match position {
        1 => 0,           // Root
        2..=3 => 1,       // Level 1
        4..=7 => 2,       // Level 2
        _ => 3,           // This shouldn't happen in 2x2, but safe default
    }
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
        // NOTE: Diamond completion should trigger process_diamond_completion instruction separately
        msg!("Diamond completed - trigger Wealthy Club distribution");
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
#[instruction(level: u8)]
pub struct PurchaseLevel<'info> {
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
        seeds = [
            b"position".as_ref(), 
            &[level], 
            global_state.total_positions[level as usize].checked_add(1).unwrap().to_le_bytes().as_ref()
        ],
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

#[derive(Accounts)]
pub struct ActivateWealthyClub<'info> {
    #[account(mut)]
    pub global_state: Account<'info, GlobalState>,

    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        init_if_needed,
        payer = user,
        space = 8 + WealthyClubAccount::INIT_SPACE,
        seeds = [b"wealthy_club", user.key().as_ref()],
        bump
    )]
    pub wealthy_club_account: Account<'info, WealthyClubAccount>,

    #[account(mut)]
    pub user_token: InterfaceAccount<'info, TokenAccount>,

    #[account(mut)]
    pub escrow: InterfaceAccount<'info, TokenAccount>,

    pub mint: InterfaceAccount<'info, Mint>,
    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ProcessDiamondCompletion<'info> {
    #[account(mut)]
    pub global_state: Account<'info, GlobalState>,

    #[account(mut)]
    pub user: Signer<'info>,

    #[account(mut)]
    pub user_account: Account<'info, UserAccount>,

    pub user_wealthy_club: Account<'info, WealthyClubAccount>,

    #[account(mut)]
    pub escrow: InterfaceAccount<'info, TokenAccount>,

    #[account(mut)]
    pub company_token: InterfaceAccount<'info, TokenAccount>,

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
    pub wealthy_club_total_members: u64,
    pub wealthy_club_active_members: u64,
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
pub struct WealthyClubAccount {
    pub owner: Pubkey,
    pub sponsor: Pubkey,           
    pub activated_sponsor: Pubkey,  
    pub is_activated: bool,
    pub position_number: u64,
    pub total_earned: u64,
    pub joined_at: i64,
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
     #[msg("Already activated")]
    AlreadyActivated,
    #[msg("Wealthy Club not activated")]
    WealthyClubNotActivated,
}


#[event]
pub struct WealthyClubActivated {
    pub user: Pubkey,
    pub position_number: u64,
    pub activated_sponsor: Pubkey,
}

#[event]
pub struct DiamondCompleted {
    pub user: Pubkey,
    pub re_entries_created: u32,
    pub wealthy_club_payment: u64,
}

#[event]
pub struct WealthyClubPayment {
    pub recipient: Pubkey,
    pub amount: u64,
    pub level: u8,
    pub from_user: Pubkey,
}