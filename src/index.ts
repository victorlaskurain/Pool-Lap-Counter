// @ts-expect-error This module lacks correct type definitions
import ons from "onsenui/esm";

import { main } from "./onsenowl";
import { MainPage } from "./main";
import { registerSw } from "./utils";

console.log(ons);
void registerSw("sw.js");
const templates =
    "<templates>" +
    Array.from(document.querySelectorAll('script[type="qweb"]'))
        .map((e) => e.innerHTML)
        .join("") +
    "</templates>";

void main(MainPage, document.body, templates);
