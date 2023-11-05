// @ts-expect-error This module lacks correct type definitions
import ons from "onsenui/esm";
import "onsenui/esm/elements/ons-toast";
import "onsenui/esm/elements/ons-alert-dialog";
import "onsenui/esm/elements/ons-alert-dialog-button";

export async function wakeLock(): Promise<void> {
    try {
        if ("wakeLock" in navigator) {
            await navigator.wakeLock.request("screen");
        } else {
            await ons.notification.toast("Screen might darken", { timeout: 2000 });
        }
    } catch (err) {
        await ons.notification.alert(`${err.name}, ${err.message}`);
    }
}

// https://onsen.io/v2/guide/pwa/advanced.html#advanced-pwa-usage
async function onUpdateFound(): Promise<void> {
    const buttonIndex = await ons.notification.confirm(
        "A new update is ready. Do you want to update now?",
    );
    if (buttonIndex === 1) {
        location.reload();
    }
}
export async function registerSw(sw: string): Promise<void> {
    if ("serviceWorker" in navigator) {
        console.log("registerSw");
        const registration = await navigator.serviceWorker.register(sw);
        if (registration === null) {
            console.log("registerSw registration failed");
            return;
        }
        // We don't want to check for updates on first load or we will
        // get a false positive. registration.active will be falsy on
        // first load.
        if (registration.active == null) {
            console.log("registerSw first load");
            return;
        }
        // Check if an updated sw.js was found
        registration.addEventListener("updatefound", () => {
            console.log("registerSw update found. Waiting for install to complete.");
            const installingWorker = registration.installing;
            if (installingWorker == null) {
                console.log("service worker no update found");
                return;
            }
            // Watch for changes to the worker's state. Once it is
            // "installed", our cache has been updated with our
            // new files, so we can prompt the user to instantly
            // reload.
            installingWorker.addEventListener("statechange", () => {
                if (installingWorker.state === "installed") {
                    console.log("Install complete. Triggering update prompt.");
                    void onUpdateFound();
                }
            });
        });
    }
}

export function formatTsShort(ts: number): string {
    const sign = ts < 0 ? "-" : "";
    ts = Math.abs(ts);
    const elapsedSeconds = ts / 1000.0;
    const h = Math.floor(elapsedSeconds / 60 / 60);
    const m = Math.floor(elapsedSeconds / 60);
    const s = Math.floor(elapsedSeconds % 60);
    const ds = Math.floor((elapsedSeconds * 10) % 10);
    let padLen = 0;
    let hs = "";
    let ms = "";
    let ss = "";
    if (h !== 0) {
        hs = h.toString() + "h";
        padLen = 2;
    }
    if (m !== 0 || padLen !== 0) {
        ms = m.toString().padStart(padLen, "0") + "'";
        padLen = 2;
    }
    ss = s.toString().padStart(padLen, "0") + '"' + ds;
    return `${sign}${hs}${ms}${ss}`;
}

export function formatTsShortSigned(ms: number): string {
    let sign = "";
    if (ms === 0) {
        sign = " ";
    } else if (ms > 0) {
        sign = "+";
    }
    return sign + formatTsShort(ms);
}

export function formatTsFull(ms: number): string {
    const sign = ms < 0 ? "-" : "";
    ms = Math.abs(ms);
    const elapsedSeconds = ms / 1000.0;
    const h = Math.floor(elapsedSeconds / 60 / 60);
    const m = Math.floor(elapsedSeconds / 60)
        .toString()
        .padStart(2, "0");
    const s = Math.floor(elapsedSeconds % 60)
        .toString()
        .padStart(2, "0");
    const ds = Math.floor((elapsedSeconds * 10) % 10);
    return `${sign}${h}h${m}'${s}"${ds}`;
}
