// https://developers.google.com/identity/protocols/oauth2/scopes#sheets
// See, edit, create, and delete only the specific Google Drive files you use with this app
import { type LapDetailed } from "./db";

const SHEETS_API_SCOPE = "https://www.googleapis.com/auth/drive.file";
const CLIENT_ID = "1047352595352-f1h18q2l2ctpm5as5ou0eiclv2k81jf6.apps.googleusercontent.com";
const GSI_TOKEN_KEY = "gsi_token";
const SPREADSHEET_ID_KEY = "spreadsheet_id";
const SPREADSHEET_TITLE = "VLaps DB";
const DISCOVERY_DOC = "https://sheets.googleapis.com/$discovery/rest?version=v4";

async function getAccessToken(): Promise<google.accounts.oauth2.TokenResponse | null> {
    return await new Promise((resolve, reject) => {
        function initTokenClientCallback(
            tokenResponse: google.accounts.oauth2.TokenResponse,
        ): void {
            resolve(tokenResponse);
        }

        const client = google.accounts.oauth2.initTokenClient({
            client_id: CLIENT_ID,
            scope: SHEETS_API_SCOPE,
            callback: initTokenClientCallback,
        });
        client.requestAccessToken();
    });
}

function loadToken(): google.accounts.oauth2.TokenResponse | null {
    const data = localStorage.getItem(GSI_TOKEN_KEY);
    if (data === null) {
        return null;
    }
    return JSON.parse(data) as google.accounts.oauth2.TokenResponse;
}

function removeToken(): void {
    localStorage.removeItem(GSI_TOKEN_KEY);
}

function saveToken(token: google.accounts.oauth2.TokenResponse): void {
    localStorage.setItem(GSI_TOKEN_KEY, JSON.stringify(token));
}

async function loadGapi(): Promise<void> {
    await new Promise((resolve, reject) => {
        gapi.load("client", () => {
            gapi.client
                .init({
                    clientId: CLIENT_ID,
                    discoveryDocs: [DISCOVERY_DOC],
                })
                .then(resolve, reject);
        });
    });
}

export class LapSpreadsheet {
    private readonly spreadsheetId: string;
    constructor(spreadsheetId: string) {
        this.spreadsheetId = spreadsheetId;
    }

    async addLap(lap: LapDetailed): Promise<void> {
        const values = (
            await gapi.client.sheets.spreadsheets.values.get({
                spreadsheetId: this.spreadsheetId,
                range: "A1:A1",
                valueRenderOption: "UNFORMATTED_VALUE",
            })
        ).result.values;
        if (undefined === values) {
            throw new Error("Bad row count");
        }
        const nextRowCount = values[0][0] + 1;
        const nextRowIdx = nextRowCount + 1;
        await gapi.client.sheets.spreadsheets.values.batchUpdate({
            spreadsheetId: this.spreadsheetId,
            resource: {
                valueInputOption: "RAW",
                data: [
                    {
                        // Update row counter, used to make appending rows simple
                        range: "A1:A1",
                        values: [[nextRowCount]],
                    },
                    {
                        // add new Lap data
                        range: ["B", nextRowIdx, ":I", nextRowIdx].join(""),
                        values: [
                            [
                                lap.id,
                                lap.sessionId,
                                lap.idx,
                                lap.poolMeters,
                                lap.poolMeters * 2,
                                lap.begin,
                                lap.seconds,
                                lap.delaySeconds,
                            ],
                        ],
                    },
                ],
            },
        });
    }
}

export async function open(): Promise<LapSpreadsheet> {
    const d = {
        resolve: (s: LapSpreadsheet): void => {},
        reject: (e: Error): void => {},
    };
    const res = new Promise<LapSpreadsheet>((resolve, reject) => {
        d.resolve = resolve;
        d.reject = reject;
    });
    await loadGapi();
    // type of gapi.client.sheets.spreadsheets.create does not match
    // documentation from
    // https://developers.google.com/sheets/api/guides/create so use
    // explicit cast to get around the bogus compiler error.
    const createSpreadsheet: any = gapi.client.sheets.spreadsheets.create;
    const getSpreadsheet: any = gapi.client.sheets.spreadsheets.get;
    const token = loadToken() ?? (await getAccessToken());
    if (token === null) {
        d.reject(new Error("Error getting access token")); // :TODO: encode error information
        return await res;
    }
    saveToken(token); // it is save to overrite the token
    gapi.client.setToken(token);
    let spreadsheetId = localStorage.getItem(SPREADSHEET_ID_KEY) ?? "";
    if (spreadsheetId === "") {
        spreadsheetId = (
            await createSpreadsheet({
                properties: {
                    title: SPREADSHEET_TITLE,
                },
            })
        ).result.spreadsheetId;
        await gapi.client.sheets.spreadsheets.values.batchUpdate({
            spreadsheetId,
            resource: {
                valueInputOption: "RAW",
                data: [
                    {
                        // Update row counter, used to make appending rows simple
                        range: "A1:A1",
                        values: [[0]],
                    },
                    {
                        range: "B1:I1",
                        values: [
                            [
                                "id",
                                "sessionId",
                                "idx",
                                "poolMeters",
                                "lapMeters",
                                "begin",
                                "seconds",
                                "lapDelay",
                            ],
                        ],
                    },
                ],
            },
        });
    }
    localStorage.setItem(SPREADSHEET_ID_KEY, spreadsheetId);
    try {
        await getSpreadsheet({ spreadsheetId });
    } catch (err) {
        if (err.status === 401) {
            // access denied, try removing the token and restarting
            removeToken();
            return await open();
        } else {
            d.reject(new Error("Spreadsheet not available"));
            return await res;
        }
    }
    d.resolve(new LapSpreadsheet(spreadsheetId));
    return await res;
}

export async function openWithCurrentToken(): Promise<LapSpreadsheet> {
    const spreadsheetId = localStorage.getItem(SPREADSHEET_ID_KEY);
    if (spreadsheetId == null) {
        return await new Promise<LapSpreadsheet>((resolve, reject) => {
            reject(new Error("Create spreadsheet first!"));
        });
    }
    await loadGapi();
    const getSpreadsheet: any = gapi.client.sheets.spreadsheets.get;
    const token = loadToken();
    if (token === null) {
        return await new Promise<LapSpreadsheet>((resolve, reject) => {
            reject(new Error("Error getting access token"));
        });
    }
    gapi.client.setToken(token);
    try {
        await getSpreadsheet({ spreadsheetId });
        return await new Promise((resolve, reject) => {
            resolve(new LapSpreadsheet(spreadsheetId));
        });
    } catch (err) {
        if (err.status === 401) {
            // access denied, try removing the token and restarting
            removeToken();
        }
        return await new Promise<LapSpreadsheet>((resolve, reject) => {
            reject(new Error("Access error"));
        });
    }
}
