#!/bin/bash

# Define wallet file paths
WALLETS=(
    "./tests/wallets/authority-wallet.json"
    "./tests/wallets/user-1-wallet.json"
    "./tests/wallets/user-2-wallet.json"
    "./tests/wallets/user-3-wallet.json"
    "./tests/wallets/user-4-wallet.json"
    "./tests/wallets/user-5-wallet.json"
    "./tests/wallets/user-6-wallet.json"
    "./tests/wallets/user-7-wallet.json"
    "./tests/wallets/user-8ii-wallet.json"
    "./tests/wallets/user-9ii-wallet.json"
    "./tests/wallets/user-10ii-wallet.json"
)

TOKEN_MINT="6mWfrWzYf5ot4S8Bti5SCDRnZWA5ABPH1SNkSq4mNN1C"
SOL_AMOUNT="0.5"
TOKEN_AMOUNT="20"
DELAY="0.5"

echo "Starting SOL transfers..."

# Transfer SOL to each wallet
for wallet in "${WALLETS[@]}"; do
    if [ -f "$wallet" ]; then
        address=$(solana address -k "$wallet")
        echo "Transferring $SOL_AMOUNT SOL to $address"
        solana transfer "$address" "$SOL_AMOUNT"
        if [ $? -eq 0 ]; then
            echo "✅ SOL transfer successful to $address"
        else
            echo "❌ SOL transfer failed to $address"
        fi
        sleep "$DELAY"
    else
        echo "⚠️  Wallet file not found: $wallet"
    fi
done

echo ""
echo "Starting token transfers..."

# Transfer tokens to each wallet
for wallet in "${WALLETS[@]}"; do
    if [ -f "$wallet" ]; then
        address=$(solana address -k "$wallet")
        echo "Transferring $TOKEN_AMOUNT tokens to $address"
        spl-token transfer "$TOKEN_MINT" "$TOKEN_AMOUNT" "$address" --fund-recipient --allow-unfunded-recipient
        if [ $? -eq 0 ]; then
            echo "✅ Token transfer successful to $address"
        else
            echo "❌ Token transfer failed to $address"
        fi
        sleep "$DELAY"
    else
        echo "⚠️  Wallet file not found: $wallet"
    fi
done

echo ""
echo "🎉 Prepped all wallets, airdropped $SOL_AMOUNT SOL and $TOKEN_AMOUNT tokens to ${#WALLETS[@]} accounts"