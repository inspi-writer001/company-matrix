use anchor_lang::prelude::*;
use anchor_spl::token_interface::{self, Mint, TokenAccount, TokenInterface, TransferChecked};

declare_id!("652Yr5RgLD7Akm1THNdsfT3VD2i4wBuiUyqhXPk1Ty3j");

#[program]
pub mod x12_matrix {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>, company_wallet: Pubkey) -> Result<()> {
        let state = &mut ctx.accounts.global_state;
        state.company_wallet = company_wallet;
        state.authority = ctx.accounts.authority.key();
        state.total_positions = [0; 6];
        state.escrow_bump = ctx.bumps.escrow;
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

        require!(!ctx.accounts.downline_account.is_active, MatrixError::AlreadyActive);
        require!(ctx.accounts.downline.key() != ctx.accounts.sponsor.key(), MatrixError::SelfRegister);

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

        // Find next available position in forced matrix
        let position_number = find_next_available_position(&ctx.accounts.global_state, 0)?;
        ctx.accounts.global_state.total_positions[0] = position_number;
        ctx.accounts.downline_account.positions_count[0] += 1;

        // Create position record
        let position_record = &mut ctx.accounts.position_record;
        position_record.level = 0;
        position_record.position_number = position_number;
        position_record.owner = ctx.accounts.downline.key();

        // Calculate parent and distribute payments
        let parent_number = get_parent_position_2x2(position_number);
        let grandparent_number = if parent_number > 1 {
            get_parent_position_2x2(parent_number)
        } else {
            0
        };

        // Distribute payments
        if grandparent_number > 0 {
            // Level 2 gets 50% (500_000)
            // This would need the grandparent's user account in remaining_accounts
            msg!("Level 2 position {} earns $0.50", grandparent_number);
            
            // Send 50% to company
            transfer_to_company(
                &ctx.accounts.escrow,
                &ctx.accounts.company_token,
                &ctx.accounts.token_program,
                &ctx.accounts.mint,
                500_000,
                ctx.accounts.global_state.escrow_bump,
            )?;
        } else {
            // No Level 2, company gets all
            transfer_to_company(
                &ctx.accounts.escrow,
                &ctx.accounts.company_token,
                &ctx.accounts.token_program,
                &ctx.accounts.mint,
                1_000_000,
                ctx.accounts.global_state.escrow_bump,
            )?;
        }

        // Check for matrix completion
        if is_matrix_complete_for_grandparent(position_number) {
            handle_matrix_completion(
                &mut ctx.accounts.global_state,
                &mut ctx.accounts.sponsor_account,
                grandparent_number,
                0,
            )?;
        }

        emit!(PositionCreated {
            owner: ctx.accounts.downline.key(),
            level: 0,
            position_number,
            parent_number,
        });

        Ok(())
    }

    pub fn purchase_level_with_distribution<'info>(
        ctx: Context<'_, '_, '_, 'info, PurchaseLevelWithDistribution<'info>>,
        level: u8,
        downline: Pubkey,
    ) -> Result<()> {
        require!(level <= 5, MatrixError::InvalidLevel);
        
        let prices = [
            1_000_000, 2_000_000, 4_000_000, 8_000_000, 16_000_000, 32_000_000,
        ];
        
        let entry_cost = prices[level as usize];
        let mut payment_needed = true;

        // Check if user has combo packages that cover this level
        if level > 0 && level <= 5 {
            if ctx.accounts.downline_account.has_all_in_combo 
                && !ctx.accounts.downline_account.combo_levels_used[level as usize] {
                payment_needed = false;
                ctx.accounts.downline_account.combo_levels_used[level as usize] = true;
            } else if ctx.accounts.downline_account.has_wealthy_club_combo 
                && !ctx.accounts.downline_account.combo_levels_used[level as usize] {
                payment_needed = false;
                ctx.accounts.downline_account.combo_levels_used[level as usize] = true;
            }
        }
        
        // Only collect payment if not covered by combo
        if payment_needed {
            transfer_tokens(
                &ctx.accounts.sponsor,
                &ctx.accounts.sponsor_token,
                &ctx.accounts.escrow,
                &ctx.accounts.token_program,
                &ctx.accounts.mint,
                entry_cost,
            )?;
        }

        // For higher levels, user must already be active
        if level > 0 {
            require!(ctx.accounts.downline_account.is_active, MatrixError::NotActive);
        } else {
            // Silver level activates user
            require!(!ctx.accounts.downline_account.is_active, MatrixError::AlreadyActive);
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

        // Find next available position in forced matrix
        let position_number = find_next_available_position(&ctx.accounts.global_state, level)?;
        ctx.accounts.global_state.total_positions[level as usize] = position_number;
        ctx.accounts.downline_account.positions_count[level as usize] += 1;

        // Create position record
        let position_record = &mut ctx.accounts.position_record;
        position_record.level = level;
        position_record.position_number = position_number;
        position_record.owner = downline;

        // Calculate parent for payment distribution
        let parent_number = get_parent_position_2x2(position_number);
        let grandparent_number = if parent_number > 1 {
            get_parent_position_2x2(parent_number)
        } else {
            0
        };

        // Distribute payments through the matrix
        if grandparent_number > 0 && payment_needed {
            // Level 2 gets 50% of entry cost
            let level2_earnings = entry_cost / 2;
            
            // Load grandparent position owner's account (passed in remaining_accounts[0])
            if ctx.remaining_accounts.len() > 0 {
                let grandparent_user_account_info = &ctx.remaining_accounts[0];
                msg!("Paying {} to Level 2 position {}", level2_earnings, grandparent_number);
                
                // In real implementation, you'd deserialize and update the account
                // For now, just send to company the other 50%
                transfer_to_company(
                    &ctx.accounts.escrow,
                    &ctx.accounts.company_token,
                    &ctx.accounts.token_program,
                    &ctx.accounts.mint,
                    entry_cost / 2,
                    ctx.accounts.global_state.escrow_bump,
                )?;
            }
            
            // Check if matrix is complete
            if is_matrix_complete_for_grandparent(position_number) {
                handle_matrix_completion(
                    &mut ctx.accounts.global_state,
                    &mut ctx.accounts.sponsor_account,
                    grandparent_number,
                    level,
                )?;
            }
        } else if payment_needed {
            // No grandparent, company gets full payment
            transfer_to_company(
                &ctx.accounts.escrow,
                &ctx.accounts.company_token,
                &ctx.accounts.token_program,
                &ctx.accounts.mint,
                entry_cost,
                ctx.accounts.global_state.escrow_bump,
            )?;
        }

        emit!(PositionCreated {
            owner: downline,
            level,
            position_number,
            parent_number,
        });

        Ok(())
    }

    pub fn purchase_multiple_positions<'info>(
        ctx: Context<'_, '_, '_, 'info, PurchaseMultiplePositions<'info>>,
        level: u8,
        quantity: u8,
        downline: Pubkey,
    ) -> Result<()> {
        require!(level <= 5, MatrixError::InvalidLevel);
        require!(quantity > 0 && quantity <= 10, MatrixError::InvalidQuantity);
        
        let prices = [
            1_000_000, 2_000_000, 4_000_000, 8_000_000, 16_000_000, 32_000_000,
        ];
        
        let entry_cost = prices[level as usize];
        
        // Check if user has combo credits available
        let mut combo_credits_available = 0u8;
        if ctx.accounts.downline_account.has_all_in_combo && level > 0 {
            for _ in 0..quantity {
                if !ctx.accounts.downline_account.combo_levels_used[level as usize] {
                    combo_credits_available += 1;
                    ctx.accounts.downline_account.combo_levels_used[level as usize] = true;
                    break; // Can only use one combo credit per level
                }
            }
        }
        
        let positions_to_pay = quantity.saturating_sub(combo_credits_available);
        let amount_to_pay = entry_cost * positions_to_pay as u64;
        
        // Transfer payment if needed
        if amount_to_pay > 0 {
            transfer_tokens(
                &ctx.accounts.sponsor,
                &ctx.accounts.sponsor_token,
                &ctx.accounts.escrow,
                &ctx.accounts.token_program,
                &ctx.accounts.mint,
                amount_to_pay,
            )?;
        }
        
        // Create multiple positions
        for i in 0..quantity {
            let position_number = find_next_available_position(&ctx.accounts.global_state, level)?;
            ctx.accounts.global_state.total_positions[level as usize] = position_number;
            ctx.accounts.downline_account.positions_count[level as usize] += 1;
            
            // Calculate parent positions
            let parent_number = get_parent_position_2x2(position_number);
            let grandparent_number = if parent_number > 1 {
                get_parent_position_2x2(parent_number)
            } else {
                0
            };
            
            // Distribute payments for paid positions
            if i < positions_to_pay && grandparent_number > 0 {
                msg!("Position {} pays {} to Level 2 position {}", 
                    position_number, entry_cost / 2, grandparent_number);
                    
                // Send 50% to company
                transfer_to_company(
                    &ctx.accounts.escrow,
                    &ctx.accounts.company_token,
                    &ctx.accounts.token_program,
                    &ctx.accounts.mint,
                    entry_cost / 2,
                    ctx.accounts.global_state.escrow_bump,
                )?;
            }
            
            emit!(PositionCreated {
                owner: downline,
                level,
                position_number,
                parent_number,
            });
            
            // Check for matrix completion
            if is_matrix_complete_for_grandparent(position_number) {
                handle_matrix_completion(
                    &mut ctx.accounts.global_state,
                    &mut ctx.accounts.downline_account,
                    grandparent_number,
                    level,
                )?;
            }
        }
        
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

        // Check if matrix complete
        if is_matrix_complete_for_grandparent(child_position) {
            handle_matrix_completion(&mut ctx.accounts.global_state, user, parent_num, level)?;
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
        wealthy_club.activated_sponsor = sponsor.unwrap_or_default();

        state.wealthy_club_total_members += 1;
        state.wealthy_club_active_members += 1;

        emit!(WealthyClubActivated {
            user: ctx.accounts.user.key(),
            position_number: wealthy_club.position_number,
            activated_sponsor: wealthy_club.activated_sponsor,
        });

        Ok(())
    }

    pub fn process_diamond_completion_with_chain<'info>(
        ctx: Context<'_, '_, '_, 'info, ProcessDiamondCompletion<'info>>,
    ) -> Result<()> {
        let state = &mut ctx.accounts.global_state;
        let user = &mut ctx.accounts.user_account;
        
        // Create 40 re-entries
        state.total_positions[0] += 40;
        user.positions_count[0] += 40;
        
        // Verify user is activated in Wealthy Club
        require!(
            ctx.accounts.user_wealthy_club.is_activated, 
            MatrixError::WealthyClubNotActivated
        );
        
        let per_level_payment = 1_000_000; // $1 per level
        let mut total_paid = 0u64;
        
        // Traverse sponsor chain using remaining_accounts
        // Pattern: [sponsor_token_account] for each level
        let max_levels = ctx.remaining_accounts.len().min(12);
        
        for level in 0..max_levels {
            let sponsor_token_account = &ctx.remaining_accounts[level];
            
            // Transfer $1 to this level sponsor
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
            
            token_interface::transfer_checked(
                cpi_ctx, 
                per_level_payment, 
                ctx.accounts.mint.decimals
            )?;
            
            total_paid += per_level_payment;
            
            emit!(WealthyClubPayment {
                recipient: sponsor_token_account.key(),
                amount: per_level_payment,
                level: (level + 1) as u8,
                from_user: ctx.accounts.user.key(),
            });
        }
        
        // Send remaining to company
        let remaining = 12_000_000 - total_paid;
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

    pub fn purchase_all_in_matrix_simple(ctx: Context<PurchaseComboSimple>) -> Result<()> {
        require!(ctx.accounts.downline_account.is_active, MatrixError::NotActive);
        require!(!ctx.accounts.downline_account.has_all_in_combo, MatrixError::AlreadyPurchased);

        // Pay $62 upfront
        transfer_tokens(
            &ctx.accounts.sponsor,
            &ctx.accounts.sponsor_token,
            &ctx.accounts.escrow,
            &ctx.accounts.token_program,
            &ctx.accounts.mint,
            62_000_000,
        )?;

        // Send 50% to company ($31)
        transfer_to_company(
            &ctx.accounts.escrow,
            &ctx.accounts.company_token,
            &ctx.accounts.token_program,
            &ctx.accounts.mint,
            31_000_000,
            ctx.accounts.global_state.escrow_bump,
        )?;

        // Mark user as having purchased combo
        ctx.accounts.downline_account.has_all_in_combo = true;
        ctx.accounts.downline_account.combo_levels_used = [false, false, false, false, false, false];

        emit!(ComboPackagePurchased {
            owner: ctx.accounts.downline.key(),
            package_type: "AllInMatrix".to_string(),
            total_cost: 62_000_000,
            levels_purchased: vec![1, 2, 3, 4, 5],
        });

        Ok(())
    }

    pub fn purchase_wealthy_club_all_in_simple(ctx: Context<PurchaseWealthyClubCombo>) -> Result<()> {
        require!(ctx.accounts.downline_account.is_active, MatrixError::NotActive);
        require!(!ctx.accounts.downline_account.has_wealthy_club_combo, MatrixError::AlreadyPurchased);

        // Pay $74 upfront
        transfer_tokens(
            &ctx.accounts.sponsor,
            &ctx.accounts.sponsor_token,
            &ctx.accounts.escrow,
            &ctx.accounts.token_program,
            &ctx.accounts.mint,
            74_000_000,
        )?;

        // Send 50% of matrix portion to company ($31)
        transfer_to_company(
            &ctx.accounts.escrow,
            &ctx.accounts.company_token,
            &ctx.accounts.token_program,
            &ctx.accounts.mint,
            31_000_000,
            ctx.accounts.global_state.escrow_bump,
        )?;

        // Mark user as having purchased combo
        ctx.accounts.downline_account.has_wealthy_club_combo = true;
        ctx.accounts.downline_account.combo_levels_used = [false, false, false, false, false, false];

        // Activate Wealthy Club
        let wealthy_club = &mut ctx.accounts.wealthy_club_account;
        require!(!wealthy_club.is_activated, MatrixError::AlreadyActivated);

        let clock = Clock::get()?;
        let state = &mut ctx.accounts.global_state;
        
        wealthy_club.owner = ctx.accounts.downline.key();
        wealthy_club.sponsor = ctx.accounts.sponsor.key();
        wealthy_club.is_activated = true;
        wealthy_club.position_number = state.wealthy_club_total_members + 1;
        wealthy_club.total_earned = 0;
        wealthy_club.joined_at = clock.unix_timestamp;
        wealthy_club.activated_sponsor = ctx.accounts.sponsor.key();

        state.wealthy_club_total_members += 1;
        state.wealthy_club_active_members += 1;

        emit!(ComboPackagePurchased {
            owner: ctx.accounts.downline.key(),
            package_type: "WealthyClubAllIn".to_string(),
            total_cost: 74_000_000,
            levels_purchased: vec![1, 2, 3, 4, 5],
        });

        emit!(WealthyClubActivated {
            user: ctx.accounts.downline.key(),
            position_number: wealthy_club.position_number,
            activated_sponsor: wealthy_club.activated_sponsor,
        });

        Ok(())
    }

    // Query functions for matrix visualization
    pub fn get_matrix_structure(
        ctx: Context<ViewMatrix>,
        level: u8,
        start_position: u64,
        count: u8,
    ) -> Result<Vec<PositionInfo>> {
        let mut positions = Vec::new();
        let total = ctx.accounts.global_state.total_positions[level as usize];
        
        let end_position = (start_position + count as u64).min(total);
        
        for pos in start_position..=end_position {
            let parent = get_parent_position_2x2(pos);
            let left_child = (pos - 1) * 2 + 2;
            let right_child = (pos - 1) * 2 + 3;
            
            positions.push(PositionInfo {
                position_number: pos,
                parent_position: parent,
                left_child: if left_child <= total { Some(left_child) } else { None },
                right_child: if right_child <= total { Some(right_child) } else { None },
                is_complete: left_child <= total && right_child <= total,
            });
        }
        
        Ok(positions)
    }

    pub fn get_user_positions(
        ctx: Context<ViewUserPositions>,
        user: Pubkey,
    ) -> Result<UserPositionsSummary> {
        let user_account = &ctx.accounts.user_account;
        
        Ok(UserPositionsSummary {
            owner: user,
            silver_positions: user_account.positions_count[0],
            gold_positions: user_account.positions_count[1],
            sapphire_positions: user_account.positions_count[2],
            emerald_positions: user_account.positions_count[3],
            platinum_positions: user_account.positions_count[4],
            diamond_positions: user_account.positions_count[5],
            total_earnings: user_account.total_earnings,
            available_balance: user_account.available_balance,
            is_wealthy_club_active: false, // Would need wealthy_club_account to check
        })
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

fn find_next_available_position(global_state: &GlobalState, level: u8) -> Result<u64> {
    let total_positions = global_state.total_positions[level as usize];
    
    if total_positions == 0 {
        return Ok(1); // First position
    }
    
    // In 2x2 forced matrix, find first incomplete parent
    for parent_pos in 1..=total_positions {
        let left_child = (parent_pos - 1) * 2 + 2;
        let right_child = (parent_pos - 1) * 2 + 3;
        
        // Check if left position is empty
        if left_child > total_positions {
            return Ok(left_child);
        }
        // Check if right position is empty
        if right_child > total_positions {
            return Ok(right_child);
        }
    }
    
    // Should not reach here in proper forced matrix
    Err(MatrixError::MatrixFull.into())
}

fn is_matrix_complete_for_grandparent(position: u64) -> bool {
    // Check if this is the 7th position (completes a 2x2 matrix)
    // Positions 4,5,6,7 complete the matrix for position 1
    // Positions 8,9,10,11 complete for position 2, etc.
    
    if position < 4 {
        return false;
    }
    
    // Find which set of 4 this position belongs to
    let set_start = ((position - 4) / 4) * 4 + 4;
    let set_end = set_start + 3;
    
    // If it's the last position in the set, matrix is complete
    position == set_end
}

fn handle_matrix_completion(
    state: &mut Account<GlobalState>,
    user: &mut Account<UserAccount>,
    _grandparent_position: u64,
    level: u8,
) -> Result<()> {
    if level == 5 {
        // Diamond: create 40 re-entries
        state.total_positions[0] += 40;
        user.positions_count[0] += 40;
        msg!("Diamond completed! Creating 40 re-entries and triggering Wealthy Club distribution");
    } else {
        // Auto-upgrade to next level
        let next_level = level + 1;
        let next_position = find_next_available_position(state, next_level)?;
        state.total_positions[next_level as usize] = next_position;
        user.positions_count[next_level as usize] += 1;
        msg!("Auto-upgrading to {} level, position {}", get_level_name(next_level), next_position);
    }
    Ok(())
}

// Account structures
#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + GlobalState::INIT_SPACE,
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
        seeds = [b"position".as_ref(), &[0], global_state.total_positions[0].saturating_add(1).to_le_bytes().as_ref()],
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
pub struct PurchaseLevelWithDistribution<'info> {
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
#[instruction(level: u8, quantity: u8)]
pub struct PurchaseMultiplePositions<'info> {
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
pub struct PurchaseComboSimple<'info> {
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

    #[account(mut)]
    pub escrow: InterfaceAccount<'info, TokenAccount>,

    #[account(mut)]
    pub company_token: InterfaceAccount<'info, TokenAccount>,

    pub mint: InterfaceAccount<'info, Mint>,
    pub token_program: Interface<'info, TokenInterface>,
}

#[derive(Accounts)]
pub struct PurchaseWealthyClubCombo<'info> {
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
        init_if_needed,
        payer = sponsor,
        space = 8 + WealthyClubAccount::INIT_SPACE,
        seeds = [b"wealthy_club", downline.key().as_ref()],
        bump
    )]
    pub wealthy_club_account: Account<'info, WealthyClubAccount>,

    #[account(mut)]
    pub escrow: InterfaceAccount<'info, TokenAccount>,

    #[account(mut)]
    pub company_token: InterfaceAccount<'info, TokenAccount>,

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

#[derive(Accounts)]
pub struct ViewMatrix<'info> {
    pub global_state: Account<'info, GlobalState>,
}

#[derive(Accounts)]
pub struct ViewUserPositions<'info> {
    pub user_account: Account<'info, UserAccount>,
}

// Data structures
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
    pub has_all_in_combo: bool,
    pub has_wealthy_club_combo: bool,
    pub combo_levels_used: [bool; 6],
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

// View structures
#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct PositionInfo {
    pub position_number: u64,
    pub parent_position: u64,
    pub left_child: Option<u64>,
    pub right_child: Option<u64>,
    pub is_complete: bool,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct UserPositionsSummary {
    pub owner: Pubkey,
    pub silver_positions: u32,
    pub gold_positions: u32,
    pub sapphire_positions: u32,
    pub emerald_positions: u32,
    pub platinum_positions: u32,
    pub diamond_positions: u32,
    pub total_earnings: u64,
    pub available_balance: u64,
    pub is_wealthy_club_active: bool,
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

#[event]
pub struct ComboPackagePurchased {
    pub owner: Pubkey,
    pub package_type: String,
    pub total_cost: u64,
    pub levels_purchased: Vec<u8>,
}

// Errors
#[error_code]
pub enum MatrixError {
    #[msg("Invalid level")]
    InvalidLevel,
    #[msg("Not active")]
    NotActive,
    #[msg("Already active")]
    AlreadyActive,
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
    #[msg("Combo package already purchased")]
    AlreadyPurchased,
    #[msg("Invalid quantity")]
    InvalidQuantity,
    #[msg("Matrix is full")]
    MatrixFull,
    #[msg("Cannot register yourself")]
    SelfRegister,
}