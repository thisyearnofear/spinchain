// Effort Threshold Circuit
// Proves: rider maintained heart rate above threshold for minimum duration
// Without revealing: actual heart rate values

// Fixed-size arrays for Noir (using max 60 data points = 1 minute at 1Hz)
global MAX_DATA_POINTS: u32 = 60;

// Circuit inputs
pub struct EffortInput {
    // Private inputs (hidden)
    heart_rates: [u16; MAX_DATA_POINTS],
    num_points: u32,  // Actual number of data points used
    
    // Public inputs (revealed)
    threshold: u16,      // Target heart rate (e.g., 150)
    min_duration: u32,   // Minimum seconds above threshold (e.g., 300 = 5 min)
}

// Circuit outputs
pub struct EffortOutput {
    threshold_met: bool,
    seconds_above: u32,
    effort_score: u16,   // 0-1000 scale
}

// Main circuit function
pub fn main(
    input: EffortInput
) -> pub EffortOutput {
    // Count seconds above threshold
    let mut seconds_above: u32 = 0;
    let mut total_effort: u32 = 0;
    
    for i in 0..MAX_DATA_POINTS {
        // Only count up to num_points (rest are padded with 0)
        if i < input.num_points {
            let hr = input.heart_rates[i];
            
            // Check if above threshold
            if hr > input.threshold {
                seconds_above += 1;
            }
            
            // Calculate effort contribution (capped at 2x threshold)
            let effort = if hr > (input.threshold * 2) {
                input.threshold * 2
            } else {
                hr
            };
            
            total_effort += effort as u32;
        }
    }
    
    // Calculate effort score (0-1000)
    // Formula: (avg_effort / threshold) * 500
    let avg_effort = if input.num_points > 0 {
        total_effort / input.num_points
    } else {
        0
    };
    
    let effort_score = if input.threshold > 0 {
        let threshold_u32 = input.threshold as u32;
        let score = (avg_effort * 1000) / threshold_u32;
        if score > 1000 {
            1000
        } else {
            score as u16
        }
    } else {
        0
    };
    
    // Determine if threshold was met
    let threshold_met = seconds_above >= input.min_duration;
    
    EffortOutput {
        threshold_met,
        seconds_above,
        effort_score,
    }
}

// Constraint: threshold must be reasonable (50-250 BPM)
fn validate_threshold(threshold: u16) -> bool {
    threshold >= 50 & threshold <= 250
}

// Constraint: num_points must not exceed MAX_DATA_POINTS
fn validate_num_points(num_points: u32) -> bool {
    num_points <= MAX_DATA_POINTS
}

#[test]
fn test_effort_threshold_met() {
    let mut hrs: [u16; MAX_DATA_POINTS] = [0; MAX_DATA_POINTS];
    
    // Fill with HR > 150 for 45 seconds
    for i in 0..45 {
        hrs[i] = 160;
    }
    
    let input = EffortInput {
        heart_rates: hrs,
        num_points: 45,
        threshold: 150,
        min_duration: 30,
    };
    
    let output = main(input);
    
    assert(output.threshold_met == true);
    assert(output.seconds_above == 45);
    assert(output.effort_score > 1000);
}

#[test]
fn test_effort_threshold_not_met() {
    let mut hrs: [u16; MAX_DATA_POINTS] = [0; MAX_DATA_POINTS];
    
    // Fill with HR < 150
    for i in 0..60 {
        hrs[i] = 140;
    }
    
    let input = EffortInput {
        heart_rates: hrs,
        num_points: 60,
        threshold: 150,
        min_duration: 30,
    };
    
    let output = main(input);
    
    assert(output.threshold_met == false);
    assert(output.seconds_above == 0);
}
