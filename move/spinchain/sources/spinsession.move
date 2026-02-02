module spinchain::spinsession {
    use sui::object::{Self, UID, ID};
    use sui::tx_context::{Self, TxContext};
    use sui::transfer;
    use sui::event;
    use std::string::{String};
    use sui::dynamic_field as df;

    /// Represents a live fitness session on Sui.
    struct Session has key, store {
        id: UID,
        class_id: ID, // Reference to the Base class ID
        instructor: address,
        duration: u64,
        is_active: bool,
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
