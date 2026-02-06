module spinchain::spin_token {
    use sui::coin::{Self, Coin, TreasuryCap};
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};
    use sui::event;
    use std::string::{String};
    use std::option;

    // === Constants ===
    const DECIMALS: u8 = 9;
    const SYMBOL: vector<u8> = b"SPIN";
    const NAME: vector<u8> = b"SpinChain Token";
    const DESCRIPTION: vector<u8> = b"Fitness rewards token for SpinChain";

    // === Errors ===
    const EInsufficientBalance: u64 = 0;
    const EInvalidAmount: u64 = 1;

    // === One-Time Witness ===
    struct SPIN_TOKEN has drop {}

    // === Events ===
    struct RewardMinted has copy, drop {
        recipient: address,
        amount: u64,
        reason: String,
        session_id: address,
    }

    struct RewardClaimed has copy, drop {
        recipient: address,
        amount: u64,
        evm_recipient: String,
    }

    struct TreasuryDeposit has copy, drop {
        amount: u64,
        sender: address,
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
        
        transfer::public_freeze_object(metadata);
        transfer::public_transfer(treasury_cap, tx_context::sender(ctx));
    }

    // === Entry Functions ===

    public entry fun mint_reward(
        treasury: &mut TreasuryCap<SPIN_TOKEN>,
        amount: u64,
        recipient: address,
        reason: String,
        session_id: address,
        ctx: &mut TxContext
    ) {
        assert!(amount > 0, EInvalidAmount);
        
        let coins = coin::mint(treasury, amount, ctx);
        transfer::public_transfer(coins, recipient);
        
        event::emit(RewardMinted {
            recipient,
            amount,
            reason,
            session_id,
        });
    }

    public entry fun claim_for_bridge(
        treasury: &mut TreasuryCap<SPIN_TOKEN>,
        coins: Coin<SPIN_TOKEN>,
        evm_recipient: String,
        ctx: &mut TxContext
    ) {
        let amount = coin::value(&coins);
        assert!(amount > 0, EInsufficientBalance);
        
        let recipient = tx_context::sender(ctx);
        coin::burn(treasury, coins);
        
        event::emit(RewardClaimed {
            recipient,
            amount,
            evm_recipient,
        });
    }

    // === View Functions ===
    public fun decimals(): u8 { DECIMALS }
    public fun symbol(): vector<u8> { SYMBOL }
    public fun name(): vector<u8> { NAME }
}
