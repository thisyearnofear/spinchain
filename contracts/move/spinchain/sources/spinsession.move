module spinchain::spinsession {
    use sui::object::{Self, UID, ID};
    use sui::tx_context::{Self, TxContext};
    use sui::transfer;
    use sui::event;
    use std::string::{String};

    // --- Errors ---
    const ENotOwner: u64 = 0;
    const EInvalidBoundaries: u64 = 1;
    const EValueOutOfBounds: u64 = 2;
    const ESessionNotActive: u64 = 3;
    const ENotInstructor: u64 = 4;

    // --- Core Objects ---

    /// Represents a live fitness session on Sui.
    public struct Session has key, store {
        id: UID,
        class_id: ID, // Reference to the Base class ID (e.g. on EVM or another Sui object)
        instructor: address,
        duration: u64,
        is_active: bool,
    }

    /// The AI Coach Agent living on Sui.
    /// Enhanced with Strategy, Boundary, and Cognitive configurations to define its autonomous behavior.
    public struct Coach has key, store {
        id: UID,
        owner: address,
        name: String,
        personality: u8, // 0 = Zen, 1 = Drill Sergeant, 2 = Quant

        // Operational State
        current_tempo: u64, // BPM driving the music
        resistance_level: u8, // 0-100% global resistance offset
        session_active: bool,

        // Boundaries (Guardrails for the AI)
        min_bpm: u64,
        max_bpm: u64,
        max_resistance: u8,

        // Strategy Mandate
        // 0 = Recovery, 1 = Balanced, 2 = HIIT, 3 = Yield-Optimized (Revenue focus)
        strategy_type: u8,

        // Cognitive Layer (AI Inference Link)
        inference_model: String, // e.g. "venice::llama-3-70b" or "gemini::flash"
        system_prompt_cid: String, // IPFS/Walrus link to the agent's behavioral logic
        last_thought_epoch: u64, // Tracking when the agent last processed biometric state

        // DeepBook Liquidity Layer
        balance_manager_id: Option<ID>,
    }

    /// High-frequency telemetry for a rider.
    public struct RiderStats has key, store {
        id: UID,
        session_id: ID,
        rider: address,
        hr: u32,
        power: u32,
        cadence: u32,
        last_update: u64,
    }

    /// Durable on-chain pointer to a rider's telemetry blob stored on Walrus.
    /// "Walrus-as-memory": the ride's full time-series lives off-chain on Walrus,
    /// while this owned object anchors the blob ID + storage epoch on Sui.
    public struct TelemetryAnchor has key, store {
        id: UID,
        rider: address,
        class_id: String,
        blob_id: String,
        epoch: u64,
        point_count: u64,
        anchored_at: u64,
    }

    // --- Events ---

    /// Event emitted when a telemetry update happens.
    public struct TelemetryPoint has copy, drop {
        rider: address,
        hr: u32,
        power: u32,
        cadence: u32,
        timestamp: u64,
    }

    /// Event emitted when an AI instructor triggers a story beat.
    public struct StoryBeatTriggered has copy, drop {
        label: String,
        beat_type: String,
        intensity: u8,
    }

    /// Event emitted when the Coach adjusts the environment.
    public struct EnvironmentChanged has copy, drop {
        coach_id: ID,
        tempo: u64,
        resistance: u8,
        strategy_type: u8,
    }

    /// Event emitted when coach strategy is updated.
    public struct StrategyUpdated has copy, drop {
        coach_id: ID,
        strategy_type: u8,
        min_bpm: u64,
        max_bpm: u64,
    }

    /// Event emitted when a new session is created.
    public struct SessionCreated has copy, drop {
        session_id: ID,
        class_id: ID,
        instructor: address,
        duration: u64,
    }

    /// Event emitted when a rider joins a session.
    public struct RiderJoined has copy, drop {
        session_id: ID,
        rider: address,
        stats_id: ID,
    }

    /// Event emitted when a rider anchors a Walrus telemetry blob on-chain.
    public struct TelemetryBlobAttached has copy, drop {
        anchor_id: ID,
        rider: address,
        class_id: String,
        blob_id: String,
        epoch: u64,
    }

    // --- Functions ---

    /// Deploys a new AI Instructor with specific guardrails and cognitive context.
    public entry fun create_coach(
        name: String,
        personality: u8,
        min_bpm: u64,
        max_bpm: u64,
        max_resistance: u8,
        strategy_type: u8,
        inference_model: String,
        system_prompt_cid: String,
        ctx: &mut TxContext
    ) {
        assert!(max_bpm >= min_bpm, EInvalidBoundaries);
        assert!(max_resistance <= 100, EInvalidBoundaries);

        let coach = Coach {
            id: object::new(ctx),
            owner: tx_context::sender(ctx),
            name,
            personality,
            current_tempo: min_bpm,
            resistance_level: 0,
            session_active: false,
            min_bpm,
            max_bpm,
            max_resistance,
            strategy_type,
            inference_model,
            system_prompt_cid,
            last_thought_epoch: 0,
            balance_manager_id: std::option::none(),
        };
        transfer::share_object(coach);
    }

    /// Updates the coach's operational boundaries and strategy.
    public entry fun update_strategy(
        coach: &mut Coach,
        min_bpm: u64,
        max_bpm: u64,
        max_resistance: u8,
        strategy_type: u8,
        ctx: &mut TxContext
    ) {
        assert!(tx_context::sender(ctx) == coach.owner, ENotOwner);
        assert!(max_bpm >= min_bpm, EInvalidBoundaries);

        coach.min_bpm = min_bpm;
        coach.max_bpm = max_bpm;
        coach.max_resistance = max_resistance;
        coach.strategy_type = strategy_type;

        event::emit(StrategyUpdated {
            coach_id: object::id(coach),
            strategy_type,
            min_bpm,
            max_bpm,
        });
    }

    /// Updates the AI model and behavioral logic CID.
    public entry fun update_cognitive_layer(
        coach: &mut Coach,
        inference_model: String,
        system_prompt_cid: String,
        ctx: &mut TxContext
    ) {
        assert!(tx_context::sender(ctx) == coach.owner, ENotOwner);
        coach.inference_model = inference_model;
        coach.system_prompt_cid = system_prompt_cid;
    }

    /// Creates a new fitness session.
    /// Called by instructor to initialize the performance layer.
    public entry fun create_session(class_id: ID, duration: u64, ctx: &mut TxContext) {
        let session = Session {
            id: object::new(ctx),
            class_id,
            instructor: tx_context::sender(ctx),
            duration,
            is_active: true,
        };

        let session_id = object::id(&session);
        transfer::share_object(session);

        event::emit(SessionCreated {
            session_id,
            class_id,
            instructor: tx_context::sender(ctx),
            duration,
        });
    }

    /// Allows a rider to join an active session.
    /// Creates a RiderStats object owned by the rider.
    public entry fun join_session(session: &Session, ctx: &mut TxContext) {
        assert!(session.is_active, ESessionNotActive);

        let stats = RiderStats {
            id: object::new(ctx),
            session_id: object::id(session),
            rider: tx_context::sender(ctx),
            hr: 0,
            power: 0,
            cadence: 0,
            last_update: 0,
        };

        let stats_id = object::id(&stats);
        transfer::transfer(stats, tx_context::sender(ctx));

        event::emit(RiderJoined {
            session_id: object::id(session),
            rider: tx_context::sender(ctx),
            stats_id,
        });
    }

    /// Updates telemetry data for a rider.
    /// Can be called by the rider or an authorized oracle.
    public entry fun update_telemetry(
        session: &Session,
        stats: &mut RiderStats,
        hr: u32,
        power: u32,
        cadence: u32,
        timestamp: u64,
        ctx: &mut TxContext
    ) {
        assert!(session.is_active, ESessionNotActive);
        assert!(stats.session_id == object::id(session), EInvalidBoundaries);
        assert!(stats.rider == tx_context::sender(ctx), ENotOwner);

        stats.hr = hr;
        stats.power = power;
        stats.cadence = cadence;
        stats.last_update = timestamp;

        event::emit(TelemetryPoint {
            rider: stats.rider,
            hr,
            power,
            cadence,
            timestamp,
        });
    }

    /// Anchors a Walrus telemetry blob on-chain ("Walrus-as-memory").
    /// The ride's full time-series lives off-chain on Walrus; this mints an
    /// owned TelemetryAnchor pointing at the blob and emits TelemetryBlobAttached.
    /// Standalone (no Session/RiderStats refs) so it works for any completed ride.
    public entry fun anchor_telemetry_blob(
        class_id: String,
        blob_id: String,
        epoch: u64,
        point_count: u64,
        timestamp: u64,
        ctx: &mut TxContext
    ) {
        let rider = tx_context::sender(ctx);
        let anchor = TelemetryAnchor {
            id: object::new(ctx),
            rider,
            class_id,
            blob_id,
            epoch,
            point_count,
            anchored_at: timestamp,
        };

        event::emit(TelemetryBlobAttached {
            anchor_id: object::id(&anchor),
            rider,
            class_id: anchor.class_id,
            blob_id: anchor.blob_id,
            epoch,
        });

        transfer::transfer(anchor, rider);
    }

    /// Triggers a story beat event.
    /// Can be called by the instructor, coach, or authorized agent.
    public entry fun trigger_beat(
        session: &Session,
        label: String,
        beat_type: String,
        intensity: u8,
        ctx: &mut TxContext
    ) {
        assert!(session.is_active, ESessionNotActive);
        // Only instructor or session owner can trigger beats
        // In production, add coach/agent authorization
        assert!(
            tx_context::sender(ctx) == session.instructor,
            ENotInstructor
        );
        assert!(intensity <= 100, EValueOutOfBounds);

        event::emit(StoryBeatTriggered {
            label,
            beat_type,
            intensity,
        });
    }

    /// Updates the coach's operational state during an active session.
    public entry fun update_coach_state(
        coach: &mut Coach,
        tempo: u64,
        resistance: u8,
        ctx: &mut TxContext
    ) {
        assert!(tx_context::sender(ctx) == coach.owner, ENotOwner);
        assert!(resistance <= 100, EValueOutOfBounds);
        assert!(tempo >= coach.min_bpm && tempo <= coach.max_bpm, EInvalidBoundaries);

        coach.current_tempo = tempo;
        coach.resistance_level = resistance;

        event::emit(EnvironmentChanged {
            coach_id: object::id(coach),
            tempo,
            resistance,
            strategy_type: coach.strategy_type,
        });
    }

    /// Closes a session. Only the instructor can close their session.
    public entry fun close_session(session: &mut Session, ctx: &mut TxContext) {
        assert!(tx_context::sender(ctx) == session.instructor, ENotInstructor);
        session.is_active = false;
    }

    // --- DeepBook Liquidity Management ---
    //
    // Deferred: the `framework/testnet` revision of DeepBook has been
    // restructured (modules are now `clob_v2` / `custodian_v2` / etc.) and
    // there is no top-level `balance_manager` or `pool` module. Re-introducing
    // a real DeepBook integration is post-hackathon work. The `Coach` struct
    // keeps the `balance_manager_id: Option<ID>` field so a future upgrade
    // can populate it without a struct-layout migration.

    // --- View Functions ---

    /// Get session details (for off-chain queries)
    public fun get_session_details(session: &Session): (ID, address, u64, bool) {
        (session.class_id, session.instructor, session.duration, session.is_active)
    }

    /// Get rider stats (for off-chain queries)
    public fun get_rider_stats(stats: &RiderStats): (ID, address, u32, u32, u32, u64) {
        (stats.session_id, stats.rider, stats.hr, stats.power, stats.cadence, stats.last_update)
    }

    /// Get coach configuration (for off-chain queries)
    public fun get_coach_config(coach: &Coach): (String, u8, u64, u64, u8, u8) {
        (
            coach.name,
            coach.personality,
            coach.min_bpm,
            coach.max_bpm,
            coach.max_resistance,
            coach.strategy_type
        )
    }
}
