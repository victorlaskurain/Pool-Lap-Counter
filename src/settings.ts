import "onsenui/esm/elements/ons-button";
import "onsenui/esm/elements/ons-input";
import "onsenui/esm/elements/ons-page";
import "onsenui/esm/elements/ons-toolbar";

import { Component, useState, toRaw, onWillStart } from "@odoo/owl";

import { Settings, type Db } from "./db";
import { Page, Toolbar, Card } from "./onsenowl";

export class SettingsPage extends Component {
    static template = "settings-page";
    static components = { Page, Toolbar, Card };
    state = useState(new Settings());

    async setup(): Promise<void> {
        onWillStart(async () => {
            const db: Db = this.env.db;
            const settings = await db.txn().getActiveSetting();
            this.state.id = settings.id;
            this.state.numberOfLaps = settings.numberOfLaps;
            this.state.poolMeters = settings.poolMeters;
            this.state.seconds100m = settings.seconds100m;
            this.state.startDelaySeconds = settings.startDelaySeconds;
        });
    }

    get numberOfLaps(): number {
        return this.state.numberOfLaps;
    }

    set numberOfLaps(n: string | number) {
        this.state.numberOfLaps = Number(n);
    }

    get startDelaySeconds(): number {
        return this.state.startDelaySeconds;
    }

    set startDelaySeconds(n: string | number) {
        this.state.startDelaySeconds = Number(n);
    }

    get poolMeters(): number {
        return this.state.poolMeters;
    }

    set poolMeters(n: string | number) {
        this.state.poolMeters = Number(n);
    }

    get minutes100m(): number {
        return Math.floor(this.state.seconds100m / 60);
    }

    set minutes100m(n: string | number) {
        this.state.seconds100m = Number(n) * 60 + this.seconds100m;
    }

    get seconds100m(): number {
        return Math.floor(this.state.seconds100m % 60);
    }

    set seconds100m(n: string | number) {
        this.state.seconds100m = this.minutes100m * 60 + Number(n);
    }

    cancelSettings(): void {
        this.env.navigator.popPage();
    }

    async saveSettings(): Promise<void> {
        const db: Db = this.env.db;
        await db.txn().putSettings(toRaw(this.state));
        this.env.navigator.popPage();
    }

    get lapTimeSeconds(): number {
        return (this.state.seconds100m / 100.0) * this.state.poolMeters * 2;
    }

    get totalTimeSeconds(): number {
        return Math.round(this.lapTimeSeconds * this.state.numberOfLaps);
    }

    get totalDistance(): number {
        return this.state.numberOfLaps * 2 * Number(this.state.poolMeters);
    }
}
