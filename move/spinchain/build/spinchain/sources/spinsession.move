module spinchain::spinsession {
    use sui::object::{Self, UID, ID};
    use sui::tx_context::{Self, TxContext};
    use sui::transfer;
    use sui::event;
    use std::string::{String};

    // --- Core Objects ---

    /// Represents a live fitness session on Sui.
    struct Session has key, store {
        id: UID,
        class_id: ID, // Reference to the Base class ID (e.g. on EVM or another Sui object)
        instructor: address,
        duration: u64,
        is_active: bool,
    }

    /// The AI Coach Agent living on Sui.
    /// Acts as a "Smart Object" counterpart to the EVM identity.
    struct Coach has key, store {
        id: UID,
        name: String,
        personality: u8, // 0 = Zen, 1 = Drill Sergeant, 2 = Quant
        current_tempo: u64, // BPM
        resistance_level: u8, // 0-100%
        session_active: bool,
    }

    /// High-frequency telemetry for a rider.
    struct RiderStats has key, store {
        id: UID,
        session_id: ID,
        rider: address,
        hr: u32,
        power: u32,
        cadence: u32,
        last_update: u64,
    }

    // --- Events ---

    /// Event emitted when a telemetry update happens.
    struct TelemetryPoint has copy, drop {
        rider: address,
        hr: u32,
        power: u32,
        cadence: u32,
        timestamp: u64,
    }

    /// Event emitted when an AI instructor triggers a story beat.
    struct StoryBeatTriggered has copy, drop {
        label: String,
        beat_type: String,
        intensity: u8,
    }

    /// Event emitted when the Coach adjusts the environment (Music/Lights/Resistance).
    struct EnvironmentChanged has copy, drop {
        coach_id: ID,
        tempo: u64,
        resistance: u8,
    }

    // --- Functions ---

    public entry fun create_session(class_id: ID, duration: u64, ctx: &mut TxContext) {
        let session = Session {
            id: object::new(ctx),
            class_id,
            instructor: tx_context::sender(ctx),
            duration,
            is_active: true,
        };
        transfer::share_object(session);
    }

    public entry fun create_coach(
        name: String,
        personality: u8,
        ctx: &mut TxContext
    ) {
        let coach = Coach {
            id: object::new(ctx),
            name,
            personality,
            current_tempo: 0,
            resistance_level: 0,
            session_active: false,
        };
        transfer::share_object(coach);
    }

    public entry fun join_session(session: &Session, ctx: &mut TxContext) {
        let stats = RiderStats {
            id: object::new(ctx),
            session_id: object::id(session),
            rider: tx_context::sender(ctx),
            hr: 0,
            power: 0,
            cadence: 0,
            last_update: 0,
        };
        transfer::transfer(stats, tx_context::sender(ctx));
    }

    public entry fun update_telemetry(
        stats: &mut RiderStats,
        hr: u32,
        power: u32,
        cadence: u32,
        timestamp: u64,
        _ctx: &mut TxContext
    ) {
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

    /// Called by the AI Agent (Coach Atlas) to adjust the ride difficulty in real-time.
    public entry fun adjust_environment(
        coach: &mut Coach,
        new_tempo: u64,
        new_resistance: u8,
        _ctx: &mut TxContext
    ) {
        coach.current_tempo = new_tempo;
        coach.resistance_level = new_resistance;

        event::emit(EnvironmentChanged {
            coach_id: object::id(coach),
            tempo: new_tempo,
            resistance: new_resistance
        });
    }

    public entry fun trigger_beat(
        _session: &Session,
        label: String,
        beat_type: String,
        intensity: u8,
        _ctx: &mut TxContext
    ) {
        // Only instructor would ideally call this (check omitted for MVP)
        event::emit(StoryBeatTriggered {
            label,
            beat_type,
            intensity,
        });
    }
}
