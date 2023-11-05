import { openWithCurrentToken } from "./lapsheet";
import { type Db } from "./db";

export async function syncSession(db: Db, sessionId: string): Promise<boolean> {
    const session = await db.txn().setSessionSynced(sessionId);
    const toSync = session.laps.filter((lap) => {
        return !lap.synced;
    });
    try {
        const sheet = await openWithCurrentToken();
        for (let i = 0; i < toSync.length; ++i) {
            const lap = toSync[i];
            await sheet.addLap(lap);
            lap.synced = true;
        }
    } catch (e) {
        // on error store the "unsyced" flag back into the DB.
        for (let i = 0; i < toSync.length; ++i) {
            const lap = toSync[i];
            if (!lap.synced) {
                await db.txn().putLap(lap);
            }
        }
        return false;
    }
    return true;
}
