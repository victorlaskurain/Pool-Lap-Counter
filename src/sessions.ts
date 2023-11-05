import "onsenui/esm/elements/ons-button";
import "onsenui/esm/elements/ons-list";
import "onsenui/esm/elements/ons-list-item";
import "onsenui/esm/elements/ons-page";
import "onsenui/esm/elements/ons-toolbar";
import "onsenui/esm/elements/ons-toolbar-button";

import { Component, useState } from "@odoo/owl";

import type * as db from "./db";
import { formatTsShort, formatTsShortSigned } from "./utils";
import { BackButton, List, ListItem, Page, Toolbar, ToolbarButton } from "./onsenowl";
import { SessionPage } from "./session";

export class SessionsPage extends Component {
    static template = "sessions-page";
    static components = { BackButton, List, ListItem, Page, Toolbar, ToolbarButton };
    state: {
        sessions: db.SessionDetailed[];
    };

    formatTsShort = formatTsShort;
    formatTsShortSigned = formatTsShortSigned;

    setup(): void {
        this.state = useState({
            sessions: [],
        });
        const db: db.Db = this.env.db;
        void (async () => {
            const sessions = await db.txn().getSessionsSortedDate();
            this.state.sessions = sessions.reverse();
        })();
    }

    showSession(sessionId: string): void {
        this.env.navigator.pushPage(SessionPage, { sessionId });
    }
}
