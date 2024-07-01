import "onsenui/esm/elements/ons-button";
import "onsenui/esm/elements/ons-card";
import "onsenui/esm/elements/ons-input";
import "onsenui/esm/elements/ons-page";
import "onsenui/esm/elements/ons-toolbar";

import { Component, onMounted, onWillDestroy, onWillUnmount, useState } from "@odoo/owl";

import { Settings, type Db } from "./db";
import * as utils from "./utils";
import { Page, Toolbar, Card } from "./onsenowl";
import { GoPage } from "./go";
import { SettingsPage } from "./settings";
import { SessionsPage } from "./sessions";

function useSettings(db: Db): Settings {
    const settings = useState(new Settings());
    const doUpdate = (s: Settings): void => {
        settings.numberOfLaps = s.numberOfLaps;
        settings.poolMeters = s.poolMeters;
        settings.seconds100m = s.seconds100m;
        settings.startDelaySeconds = s.startDelaySeconds;
    };
    db.addActiveSettingsChangeListener(doUpdate);
    onWillDestroy(() => {
        db.removeActiveSettingsChangeListener(doUpdate);
    });
    db.txn()
        .getActiveSetting()
        .then(doUpdate, (err) => {
            console.error(["MainPage could not load settings", err]);
            // :TODO: show message to the user
        });
    return settings;
}

export class MainPage extends Component {
    static template = "main-page";
    static components = { Page, Toolbar, Card };
    settings = new Settings();
    page: Page;

    setup(): void {
        (window as any).db = this.env.db;
        const keydownHandler = (evt: KeyboardEvent): void => {
            console.log("main-page keydown");
            if (evt.key === "ArrowRight") {
                this.showGo(true);
            }
        };
        onMounted(() => {
            console.log(["main-page mounted", this.page, this.page?.root.el]);
            this.page?.root.el?.addEventListener("keydown", keydownHandler);
        });
        onWillUnmount(() => {
            this.page?.root.el?.removeEventListener("keydown", keydownHandler);
        });
        this.settings = useSettings(this.env.db);
        this.notifyPage = this.notifyPage.bind(this);
    }

    notifyPage(page: Page): void {
        console.log(["main-page notifyPage", page]);
        this.page = page;
    }

    showGo(ignoreClicks: boolean): void {
        void utils.wakeLock();
        this.env.navigator.pushPage(GoPage, { ignoreClicks });
    }

    showSessions(): void {
        this.env.navigator.pushPage(SessionsPage);
    }

    showSettings(): void {
        this.env.navigator.pushPage(SettingsPage);
    }

    get message(): string {
        const totalDistance = this.settings.totalDistance;
        const [minutes100m, seconds100m] = this.settings.minutesSeconds100m;
        const [minutesLap, secondsLap] = this.settings.minutesSecondsLap;
        const numberOfLaps = this.settings.numberOfLaps;
        return `When you are ready to swim for ${totalDistance} at ${minutes100m}'${seconds100m}" / 100m, that is, ${numberOfLaps} laps at ${minutesLap}'${secondsLap}" / lap in this swimming pool, just click "Go!". If you would rather change the settings click "Settings".`;
    }
}
