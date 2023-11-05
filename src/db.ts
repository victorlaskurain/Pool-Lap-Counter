import * as uuid from "uuid";

const ACTIVE_SETTING_KEY = 1;

export class Settings {
    id: string = uuid.v4();
    numberOfLaps: number = 10;
    poolMeters: number = 25;
    seconds100m: number = 90;
    startDelaySeconds: number = 5;

    get minutesSeconds100m(): [number, number] {
        return [Math.floor(this.seconds100m / 60), Math.floor(this.seconds100m % 60)];
    }

    get minutesSecondsLap(): [number, number] {
        return [Math.floor(this.secondsLap / 60), Math.floor(this.secondsLap % 60)];
    }

    get secondsLap(): number {
        return (this.seconds100m / 100) * 2 * this.poolMeters;
    }

    get totalTimeSeconds(): number {
        return Math.round((this.seconds100m * this.totalDistance) / 100);
    }

    get totalDistance(): number {
        return this.numberOfLaps * 2 * Number(this.poolMeters);
    }
}

export class Lap {
    id = uuid.v4();
    sessionId: string;
    idx: number;
    poolMeters: number;
    begin: Date;
    seconds: number;
    expectedSeconds: number;
    synced = false;
}

export class LapDetailed extends Lap {
    accMeters: number;
    accSeconds: number;
    accExpectedSeconds: number;
    delaySeconds: number; // this.seconds - this.expectedSeconds
    accDelaySeconds: number; //  this.accSeconds - accExpectedSeconds
}

export class Session {
    id = uuid.v4();
    date = new Date();
    poolMeters: number;
}

export class SessionDetailed extends Session {
    laps: LapDetailed[];

    constructor(source: Partial<SessionDetailed>) {
        super();
        Object.assign(this, source);
    }

    get synced(): boolean {
        return undefined === this.laps.find((lap) => !lap.synced);
    }

    get distance(): number {
        if (this.laps.length === 0) {
            return 0;
        }
        return this.laps[this.laps.length - 1].accMeters;
    }

    get seconds(): number {
        if (this.laps.length === 0) {
            return 0;
        }
        return this.laps[this.laps.length - 1].accSeconds;
    }

    get delaySeconds(): number {
        if (this.laps.length === 0) {
            return 0;
        }
        return this.laps[this.laps.length - 1].delaySeconds;
    }
}

async function getActiveSettingId(txn: IDBTransaction): Promise<string> {
    const activeSettings = txn.objectStore("active_setting");
    const request = activeSettings.get(ACTIVE_SETTING_KEY);
    const settingId = await new Promise<string>((resolve, reject) => {
        request.onsuccess = () => {
            resolve(request.result.settingId);
        };
        request.onerror = () => {
            reject(request.error);
        };
    });
    return settingId;
}

export class Db {
    db: IDBDatabase;
    settingsChangeListeners: Array<(s: Settings) => void>;

    constructor(db: IDBDatabase) {
        this.db = db;
        this.settingsChangeListeners = [];
    }

    addActiveSettingsChangeListener(cb: (s: Settings) => void): void {
        this.settingsChangeListeners.push(cb);
    }

    removeActiveSettingsChangeListener(cb: (s: Settings) => void): void {
        const idx = this.settingsChangeListeners.indexOf(cb);
        if (idx > 0) {
            this.settingsChangeListeners.splice(idx, 1);
        }
    }

    txn(storeNames: string[] = [], mode: IDBTransactionMode = "readwrite"): Txn {
        if (storeNames.length === 0) {
            storeNames = Array.from(this.db.objectStoreNames);
        }
        return new Txn(this.db.transaction(storeNames, mode), this);
    }
}

export class Txn {
    db: Db;
    txn: IDBTransaction;

    constructor(txn: IDBTransaction, db: Db) {
        this.txn = txn;
        this.db = db;
    }

    async getActiveSetting(): Promise<Settings> {
        // ["setting", "active_setting"], "readonly"
        const settingId = await getActiveSettingId(this.txn);
        return await this.get(Settings, "setting", settingId);
    }

    async putSettings(s: Settings): Promise<void> {
        // ["setting", "active_setting"], "readwrite"
        await this.put(s, "setting");
        const activeSettingId = await getActiveSettingId(this.txn);
        if (activeSettingId === s.id) {
            this.db.settingsChangeListeners.forEach((f) => {
                f(s);
            });
        }
    }

    private async put(data: any, storeName: string): Promise<void> {
        const store = this.txn.objectStore(storeName);
        const request = store.put(data);
        await new Promise<void>((resolve, reject) => {
            request.onsuccess = () => {
                resolve();
            };
            request.onerror = () => {
                console.error([`Error storing ${storeName}`, request.error]);
                reject(request.error);
            };
        });
    }

    private async get<Type extends object>(
        C: new () => Type,
        storeName: string,
        key: string | number,
    ): Promise<Type> {
        const store = this.txn.objectStore(storeName);
        const request = store.get(key);
        const obj = await new Promise<any>((resolve, reject) => {
            request.onsuccess = () => {
                resolve(request.result);
            };
            request.onerror = () => {
                reject(request.error);
            };
        });
        return Object.assign(new C(), obj);
    }

    private async getFromIndex<Type extends object>(
        C: new () => Type,
        storeName: string,
        indexName: string,
        key: string | number | null,
    ): Promise<Type[]> {
        const store = this.txn.objectStore(storeName);
        const index = store.index(indexName);
        const request = index.getAll(key);
        const objects = await new Promise<any>((resolve, reject) => {
            request.onsuccess = () => {
                resolve(request.result);
            };
            request.onerror = () => {
                reject(request.error);
            };
        });
        return objects.map((obj: any) => Object.assign(new C(), obj));
    }

    async getSessionLaps(sessionId: string): Promise<Lap[]> {
        return await this.getFromIndex(Lap, "lap", "session_id", sessionId);
    }

    async getSessionDetailed(sessionId: string): Promise<SessionDetailed> {
        // ["session", "lap"], "readonly"
        // let's run the queries in parallel just to prove that we can do it
        const laps = await this.getSessionLaps(sessionId);
        const session = await this.get(Session, "session", sessionId);
        // compute accumulated values
        const lapsDetailed: LapDetailed[] = [];
        if (laps.length > 0) {
            const lap = laps[0];
            const delaySeconds = lap.seconds - lap.expectedSeconds;
            lapsDetailed.push({
                accMeters: session.poolMeters * 2,
                accSeconds: lap.seconds,
                accExpectedSeconds: lap.expectedSeconds,
                delaySeconds,
                accDelaySeconds: delaySeconds,
                ...lap,
            });
            laps.slice(1).forEach((lap) => {
                const last = lapsDetailed.slice(-1)[0];
                const delaySeconds = lap.seconds - lap.expectedSeconds;
                lapsDetailed.push({
                    accMeters: last.accMeters + session.poolMeters * 2,
                    accSeconds: last.accSeconds + lap.seconds,
                    accExpectedSeconds: last.accExpectedSeconds + lap.expectedSeconds,
                    delaySeconds,
                    accDelaySeconds: last.accDelaySeconds + delaySeconds,
                    ...lap,
                });
            });
        }
        return new SessionDetailed({ laps: lapsDetailed, ...session });
    }

    async getSessionsSortedDate(): Promise<SessionDetailed[]> {
        const sessions = await this.getFromIndex(Session, "session", "date", null);
        const detailed: SessionDetailed[] = [];
        for (let i = 0; i < sessions.length; ++i) {
            const s = sessions[i];
            detailed.push(await this.getSessionDetailed(s.id));
        }
        return detailed;
    }

    // Marks the DetailedSession identified by the id as synced and
    // returns this very session as is stood prior to marking it as
    // synced.
    async setSessionSynced(sessionId: string): Promise<SessionDetailed> {
        // ["session", "lap"], "readwrite"
        const session = await this.getSessionDetailed(sessionId);
        for (let i = 0; i < session.laps.length; ++i) {
            const lap = session.laps[i];
            if (!lap.synced) {
                await this.putLap({ ...lap, synced: true });
            }
        }
        return session;
    }

    async putLap(l: Lap): Promise<void> {
        // ["lap"], "readwrite"
        await this.put(l, "lap");
    }

    async newSessionFromActiveSettings(): Promise<[Session, Settings]> {
        // ["setting", "active_setting", "session"], "readwrite"
        const settings = await this.getActiveSetting();
        const session: Session = {
            id: uuid.v4(),
            date: new Date(),
            poolMeters: settings.poolMeters,
        };
        await this.put(session, "session");
        return [session, settings];
    }
}

const migrations = [
    (txn: IDBTransaction) => {
        const db = txn.db;
        const defaultSettingId = uuid.v4();
        const settingStore = db.createObjectStore("setting", { keyPath: "id" });
        settingStore.put({
            id: defaultSettingId,
            numberOfLaps: 10,
            poolMeters: 25,
            seconds100m: 90,
            startDelaySeconds: 5,
        });
        const activeSettingStore = db.createObjectStore("active_setting", { keyPath: "id" });
        activeSettingStore.put({
            id: ACTIVE_SETTING_KEY,
            settingId: defaultSettingId,
        });
        db.createObjectStore("session", { keyPath: "id" });
        /*
           Structure:
           id: string,
           date: Date
         */
        const lapStore = db.createObjectStore("lap", { keyPath: "id" });
        lapStore.createIndex("session_id", "sessionId");
        /*
          Structure:
          id: string,
          sessionId: string
          idx: number,
          poolMeters: number,
          begin: datetime
          seconds: number
        */
    },
    (txn: IDBTransaction) => {
        const sessionStore = txn.objectStore("session");
        sessionStore.createIndex("date", "date");
    },
];

const DB_VERSION = migrations.length;

export async function open(): Promise<Db> {
    const db: IDBDatabase = await new Promise((resolve, reject) => {
        const request = indexedDB.open("AppDb", DB_VERSION);
        request.onerror = () => {
            console.error("Why didn't you allow my web app to use IndexedDB?!");
            reject(new Error("Count not open AppDb"));
        };
        request.onsuccess = () => {
            const db = request.result;
            resolve(db);
        };
        request.onupgradeneeded = (event) => {
            console.log("onupgradeneeded");
            const db = request.result;
            const storeNames = Array.from(db.objectStoreNames);
            const txn = request.transaction ?? db.transaction(storeNames, "readwrite");
            migrations.slice(event.oldVersion).forEach((migrate, idx) => {
                console.log(["onupgradeneeded run migration", event.oldVersion + idx]);
                migrate(txn);
            });
        };
    });
    return new Db(db);
}
