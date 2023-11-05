import "onsenui/esm/elements/ons-button";
import "onsenui/esm/elements/ons-list";
import "onsenui/esm/elements/ons-list-item";
import "onsenui/esm/elements/ons-page";
import "onsenui/esm/elements/ons-toolbar";
import "onsenui/esm/elements/ons-toolbar-button";

import { Component, onWillUpdateProps, onWillStart, useState } from "@odoo/owl";

import * as db from "./db";
import * as sheet from "./lapsheet";
import { syncSession } from "./lapsheetdb";
import { formatTsShort, formatTsShortSigned } from "./utils";
import { BackButton, List, ListItem, Page, Toolbar, ToolbarButton } from "./onsenowl";

export class SessionPage extends Component {
    static template = "session-page";
    static components = { BackButton, List, ListItem, Page, Toolbar, ToolbarButton };
    sessionId: string;
    state = useState({
        session: new db.SessionDetailed({
            laps: [],
            id: "",
            date: new Date(),
            poolMeters: 0,
        }),
    });

    formatTsShort = formatTsShort;
    formatTsShortSigned = formatTsShortSigned;

    setup(): void {
        this.sessionId = this.props.sessionId;
        const loadLaps = async (): Promise<void> => {
            const db: db.Db = this.env.db;
            const session = await db.txn().getSessionDetailed(this.sessionId);
            this.state.session = session;
        };
        syncSession(this.env.db, this.sessionId).then(loadLaps);
        onWillStart(loadLaps);
        onWillUpdateProps(loadLaps);
    }

    async sync(): Promise<boolean> {
        const db: db.Db = this.env.db;
        let syncedOk = await syncSession(db, this.sessionId);
        if (!syncedOk) {
            // try login and repeat
            await sheet.open();
        }
        syncedOk = await syncSession(db, this.sessionId);
        const session = await db.txn().getSessionDetailed(this.sessionId);
        this.state.session = session;
        return syncedOk;
    }
}
