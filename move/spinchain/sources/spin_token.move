/// Module: spin_token
/// Description: SPIN token for Sui (Option B - Independent deployment)
/// Part of dual-chain tokenomics: 50M supply on Sui, 50M on AVAX
module spinchain::spin_token {
    use sui::coin::{Self, Coin, TreasuryCap};
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};
    use sui::event;
    use sui::object::{Self, UID};
    use std::string::{String};
    use std::option;

    // === Constants ===
    const DECIMALS: u8 = 9;
    const SYMBOL: vector<u8> = b"SPIN";
    const NAME: vector<u8> = b"SpinChain Token";
    const DESCRIPTION: vector<u8> = b"Fitness rewards token for SpinChain";
    
    // Max supply: 50M SPIN on Sui (9 decimals)
    const MAX_SUPPLY: u64 = 50_000_000_000_000_000;
    
    // Buyback split: 20% burn, 80% rewards
    const BUYBACK_BURN_BPS: u64 = 2000;
    const BUYBACK_REWARD_BPS: u64 = 8000;
    const BPS_DENOMINATOR: u64 = 10_000;

    // === Errors ===
    const EInsufficientBalance: u64 = 0;
    const EInvalidAmount: u64 = 1;
    const EMaxSupplyExceeded: u64 = 2;
    const ENotAuthorized: u64 = 3;

    // === One-Time Witness ===
    public struct SPIN_TOKEN has drop {}

    // === Objects ===
    /// Treasury management object - stores buyback/burn stats
    public struct TreasuryManager has key, store {
        id: UID,
        total_minted: u64,
        total_burned: u64,
        total_buyback: u64,
        admin: address,
    }

    // === Events ===
    public struct RewardMinted has copy, drop {
        recipient: address,
        amount: u64,
        reason: String,
        session_id: address,
    }

    public struct RewardClaimed has copy, drop {
        recipient: address,
        amount: u64,
        evm_recipient: String,
    }

    public struct TreasuryDeposit has copy, drop {
        amount: u64,
        sender: address,
    }

    public struct BuybackBurned has copy, drop {
        buyback_amount: u64,
        burned_amount: u64,
        reward_amount: u64,
    }

    public struct SupplyUpdated has copy, drop {
        total_minted: u64,
        total_burned: u64,
        circulating_supply: u64,
    }

    // === Initialization ===
    fun init(witness: SPIN_TOKEN, ctx: &mut TxContext) {
        let (treasury_cap, metadata) = coin::create_currency<SPIN_TOKEN>(
            witness,
            DECIMALS,
            SYMBOL,
            NAME,
            DESCRIPTION,
            option::none(),
            ctx
        );
        
        let admin = tx_context::sender(ctx);
        
        // Create treasury manager
        let manager = TreasuryManager {
            id: object::new(ctx),
            total_minted: 0,
            total_burned: 0,
            total_buyback: 0,
            admin,
        };
        
        transfer::public_freeze_object(metadata);
        transfer::public_transfer(treasury_cap, admin);
        transfer::share_object(manager);
    }

    // === Entry Functions ===

    /// Mint reward tokens (treasury only)
    public entry fun mint_reward(
        treasury: &mut TreasuryCap<SPIN_TOKEN>,
        manager: &mut TreasuryManager,
        amount: u64,
        recipient: address,
        reason: String,
        session_id: address,
        ctx: &mut TxContext
    ) {
        assert!(amount > 0, EInvalidAmount);
        assert!(manager.total_minted + amount <= MAX_SUPPLY, EMaxSupplyExceeded);
        
        let coins = coin::mint(treasury, amount, ctx);
        transfer::public_transfer(coins, recipient);
        
        manager.total_minted = manager.total_minted + amount;
        
        event::emit(RewardMinted {
            recipient,
            amount,
            reason,
            session_id,
        });

        event::emit(SupplyUpdated {
            total_minted: manager.total_minted,
            total_burned: manager.total_burned,
            circulating_supply: manager.total_minted - manager.total_burned,
        });
    }

    /// Record buyback burn (20% burned, 80% to rewards)
    /// Called after treasury swaps USDC → SPIN via LI.FI
    public entry fun record_buyback_burn(
        treasury: &mut TreasuryCap<SPIN_TOKEN>,
        manager: &mut TreasuryManager,
        buyback_coins: Coin<SPIN_TOKEN>,
        ctx: &mut TxContext
    ) {
        let buyback_amount = coin::value(&buyback_coins);
        assert!(buyback_amount > 0, EInvalidAmount);
        assert!(tx_context::sender(ctx) == manager.admin, ENotAuthorized);
        
        let burn_amount = (buyback_amount * BUYBACK_BURN_BPS) / BPS_DENOMINATOR;
        let reward_amount = (buyback_amount * BUYBACK_REWARD_BPS) / BPS_DENOMINATOR;
        
        // Split the coins
        let burn_coins = coin::split(&mut buyback_coins, burn_amount, ctx);
        
        // Burn the 20%
        coin::burn(treasury, burn_coins);
        manager.total_burned = manager.total_burned + burn_amount;
        manager.total_buyback = manager.total_buyback + buyback_amount;
        
        // Return remaining 80% to sender (for rewards pool)
        transfer::public_transfer(buyback_coins, manager.admin);
        
        event::emit(BuybackBurned {
            buyback_amount,
            burned_amount: burn_amount,
            reward_amount,
        });

        event::emit(SupplyUpdated {
            total_minted: manager.total_minted,
            total_burned: manager.total_burned,
            circulating_supply: manager.total_minted - manager.total_burned,
        });
    }

    /// Burn tokens from user (for claiming/bridging - Option B: no bridging, just burn)
    public entry fun burn_for_claim(
        treasury: &mut TreasuryCap<SPIN_TOKEN>,
        manager: &mut TreasuryManager,
        coins: Coin<SPIN_TOKEN>,
        ctx: &mut TxContext
    ) {
        let amount = coin::value(&coins);
        assert!(amount > 0, EInsufficientBalance);
        
        let recipient = tx_context::sender(ctx);
        coin::burn(treasury, coins);
        
        manager.total_burned = manager.total_burned + amount;
        
        event::emit(SupplyUpdated {
            total_minted: manager.total_minted,
            total_burned: manager.total_burned,
            circulating_supply: manager.total_minted - manager.total_burned,
        });
    }

    /// Deposit to treasury (for buybacks)
    public entry fun deposit_to_treasury(
        manager: &mut TreasuryManager,
        coins: Coin<SPIN_TOKEN>,
        ctx: &mut TxContext
    ) {
        let amount = coin::value(&coins);
        assert!(amount > 0, EInvalidAmount);
        
        let sender = tx_context::sender(ctx);
        transfer::public_transfer(coins, manager.admin);
        
        event::emit(TreasuryDeposit {
            amount,
            sender,
        });
    }

    // === Admin Functions ===

    /// Update admin address
    public entry fun set_admin(
        manager: &mut TreasuryManager,
        new_admin: address,
        ctx: &mut TxContext
    ) {
        assert!(tx_context::sender(ctx) == manager.admin, ENotAuthorized);
        manager.admin = new_admin;
    }

    // === View Functions ===
    
    public fun decimals(): u8 { DECIMALS }
    public fun symbol(): vector<u8> { SYMBOL }
    public fun name(): vector<u8> { NAME }
    public fun max_supply(): u64 { MAX_SUPPLY }
    
    public fun get_treasury_stats(manager: &TreasuryManager): (u64, u64, u64, u64) {
        let circulating = if (manager.total_minted >= manager.total_burned) {
            manager.total_minted - manager.total_burned
        } else {
            0
        };
        (manager.total_minted, manager.total_burned, circulating, manager.total_buyback)
    }
    
    public fun remaining_supply(manager: &TreasuryManager): u64 {
        MAX_SUPPLY - manager.total_minted
    }
}
