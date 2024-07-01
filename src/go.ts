import "onsenui/esm/elements/ons-back-button";
import "onsenui/esm/elements/ons-button";
import "onsenui/esm/elements/ons-card";
import "onsenui/esm/elements/ons-input";
import "onsenui/esm/elements/ons-page";
import "onsenui/esm/elements/ons-toolbar";

import { Component, onMounted, onWillStart, onWillUnmount, useState, useRef } from "@odoo/owl";
import * as uuid from "uuid";
import { formatTsShort, formatTsFull } from "./utils";
import { syncSession } from "./lapsheetdb";

import { type Db, type Settings, type Session, type Lap } from "./db";
import { BackButton, Card, Page, Toolbar } from "./onsenowl";
import { SessionPage } from "./session";

export class GoPage extends Component {
    static template = "go-page";
    static components = { BackButton, Card, Page, Toolbar };
    content = useRef("content");
    settings: Settings;
    session: Session;
    state = useState({
        sessionId: uuid.v4(),
        running: false,
        beginTime: Date.now(),
        lapBeginTime: Date.now(),
        lapsDone: 0,
        now: Date.now(),
    });

    page: Page;
    db: Db;
    synced = Promise.resolve(true);
    ignoreClicks = false;

    setup(): void {
        this.ignoreClicks = this.props.ignoreClicks;
        this.db = this.env.db;
        const keydownHandler = (evt: KeyboardEvent): void => {
            switch (evt.key) {
                case "ArrowRight":
                    void this.recordLap();
                    break;
                case "ArrowLeft":
                    this.env.navigator.popPage();
                    break;
                default:
                    // do nothing
                    break;
            }
        };
        // we could use useEffect except that newSessionFromActiveSettings is
        // asynchronous and useEffect should be synchronous. We could set
        // only the keydown handler on useEffect but since we are bound
        // to use onWillStart/onWillUnmount we just put everything
        // together.
        onWillStart(async () => {
            [this.session, this.settings] = await this.db.txn().newSessionFromActiveSettings();
            this.state.sessionId = this.session.id;
        });
        onMounted(() => {
            console.log(["go-page mounted", this.page, this.page?.root.el]);
            this.go();
            this.page?.root.el?.addEventListener("keydown", keydownHandler);
        });
        onWillUnmount(() => {
            this.content.el?.removeEventListener("keydown", keydownHandler);
            this.stop();
        });
        this.notifyPage = this.notifyPage.bind(this);
    }

    notifyPage(page: Page): void {
        console.log(["go-page notifyPage", page]);
        this.page = page;
    }

    frameUpdate(): void {
        if (this.state.running) {
            this.state.now = Date.now();
            requestAnimationFrame(() => {
                this.frameUpdate();
            });
        }
    }

    go(): void {
        this.state.running = true;
        this.state.now = Date.now();
        this.state.beginTime = this.state.now;
        this.state.lapBeginTime = this.state.now;
        requestAnimationFrame(() => {
            this.frameUpdate();
        });
    }

    showSession(): void {
        this.env.navigator.pushPage(SessionPage, {
            sessionId: this.session.id,
        });
    }

    stop(): void {
        this.state.running = false;
    }

    estimateLapsDone(): number {
        const currentLapSeconds = (Date.now() - this.state.lapBeginTime) / 1000;
        const laps = currentLapSeconds / this.settings.secondsLap;
        return Math.round(laps);
    }

    async click(): Promise<void> {
        if (this.ignoreClicks) {
            return;
        }
        await this.recordLap();
    }

    async recordLap(): Promise<void> {
        if (!this.state.running) {
            return;
        }
        const incLaps = this.estimateLapsDone();
        if (incLaps === 0) {
            return;
        }
        const doneLap: Lap = {
            id: uuid.v4(),
            sessionId: this.session.id,
            idx: this.state.lapsDone + incLaps,
            poolMeters: this.settings.poolMeters,
            begin: new Date(this.state.lapBeginTime),
            seconds: (Date.now() - this.state.lapBeginTime) / 1000,
            expectedSeconds: this.settings.secondsLap,
            synced: false,
        };
        await this.db.txn().putLap(doneLap);
        this.synced = this.synced.then(async () => await syncSession(this.db, this.session.id));

        this.state.lapsDone = doneLap.idx;
        this.state.lapBeginTime = Date.now();
        if (this.state.lapsDone >= this.settings.numberOfLaps) {
            this.stop();
            this.showSession();
        }
    }

    formatTimeFull(ts: number): string {
        return formatTsFull(ts);
    }

    formatTimeShort(ts: number): string {
        return formatTsShort(ts);
    }

    elapsedTime(): string {
        return this.formatTimeFull(this.state.now - this.state.beginTime);
    }

    isLate(): boolean {
        return this.settings.secondsLap * 1000 < this.state.now - this.state.lapBeginTime;
    }

    elapsedLapTime(): string {
        return this.formatTimeShort(
            this.settings.secondsLap * 1000 - (this.state.now - this.state.lapBeginTime),
        );
    }
}
