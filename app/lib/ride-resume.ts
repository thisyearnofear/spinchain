/**
 * Decide whether stored ride state represents a resumable interruption or
 * stale residue.
 *
 * The ride store persists `session` + `elapsedTime` across page loads so a
 * tab reload mid-ride can resume. But that state also survives rides that
 * ENDED properly (completion screen, End button), and it knows nothing
 * about which class it belongs to. Without a precise check, the next ride
 * — any ride — inherited the old clock: new demo rides started at the
 * previous ride's final time, skipping the warmup and every interval cue.
 *
 * Resumable means: the stored session is for THIS class, and its clock
 * stopped mid-ride (strictly inside the class duration). Anything else
 * (different class, no session, clock at/past the end) starts fresh.
 */

export interface ResumableSession {
  classId: string;
  /** Class duration in minutes (RideSession.duration). */
  duration: number;
}

export function isResumableRide(
  session: ResumableSession | null,
  elapsedTime: number,
  classId: string,
): boolean {
  if (!session || session.classId !== classId) return false;
  if (!Number.isFinite(elapsedTime) || elapsedTime <= 0) return false;
  return elapsedTime < session.duration * 60;
}
