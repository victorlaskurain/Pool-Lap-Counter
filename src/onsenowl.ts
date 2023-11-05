import "onsenui/esm/elements/ons-navigator";
import { Component, mount, onMounted, onWillUnmount, useRef, useState, xml } from "@odoo/owl";
import { open as openDb } from "./db";

export class Card extends Component {
    static template = xml`
<ons-card t-att-class="props.class">
    <t t-slot="default"/>
</ons-card>
`;
}

export class Toolbar extends Component {
    static template = xml`
<ons-toolbar t-att-class="props.class">
    <div class="left"><t t-slot="left"/></div>
    <div class="center"><t t-slot="center"/></div>
    <div class="right"><t t-slot="right"/></div>
</ons-toolbar>
`;
}

export class BottomToolbar extends Component {
    static template = xml`
<ons-bottom-toolbar t-att-class="props.class" t-att-modifier="props.modifier">
    <t t-slot="default"/>
</ons-bottom-toolbar>
`;
}

export class ToolbarButton extends Component {
    static template = xml`
<ons-toolbar-button t-att-class="props.class">
    <t t-slot="default"/>
</ons-toolbar-button>
`;
}

export class List extends Component {
    static template = xml`
<ons-list t-att-class="props.class">
    <t t-slot="default"/>
</ons-list>
`;
}

export class ListItem extends Component {
    static template = xml`
<ons-list-item t-att-class="props.class">
    <div class="center"><t t-slot="center"/></div>
    <div class="left"><t t-slot="left"/></div>
    <div class="right"><t t-slot="right"/></div>
</ons-list-item>
`;
}

export class Page extends Component {
    static template = xml`
<ons-page tabindex="1" t-ref="root" t-att-page-stack-class="props.pageStackClass || ''">
    <t t-slot="toolbar"/>
    <div><t t-slot="default"/></div>
    <t t-slot="bottom-toolbar"/>
</ons-page>
`;

    static defaultProps = {
        notifyPage: function (page: Page): void {},
    };

    root = useRef("root");

    setup(): void {
        this.props.notifyPage(this);
    }
}

export class BackButton extends Component {
    static template = xml`
<ons-back-button t-att-class="props.class" t-on-click="onClick">
    <t t-slot="default"/>
</ons-back-button>
`;

    onClick(evt: Event): void {
        this.env.navigator.popPage();
    }
}

class ComponentAndProps {
    component: typeof Component;
    props: any;
}

const VISIBLE_PAGE_SELECTOR =
    'ons-page[page-stack-class="page-stack-popped-in"],ons-page[page-stack-class="page-stack-pushed-in"';
class PageStack extends Component {
    static template = xml`
<div class="page-stack" t-ref="root">
    <t t-foreach="state.pages" t-as="page" t-key="page_index">
        <t t-component="page.component" t-props="page.props" />
    </t>
</div>
`;

    state = useState({
        pages: [] as ComponentAndProps[],
    });

    root = useRef("root");

    setup(): void {
        this.env.navigator.delegate = this;
        const discardPoppedOutPage = (evt: AnimationEvent): void => {
            if (!evt.animationName.startsWith("page-stack-")) {
                return;
            }
            if (evt.animationName === "page-stack-popped-out") {
                this.state.pages.pop();
            }
            const pages = this.root.el?.querySelectorAll(VISIBLE_PAGE_SELECTOR);
            if (pages !== undefined && pages.length > 0) {
                (pages[pages.length - 1] as HTMLElement).focus();
            }
        };
        onMounted(() => {
            this.root.el?.addEventListener("animationend", discardPoppedOutPage);
        });
        onWillUnmount(() => {
            this.root.el?.removeEventListener("animationend", discardPoppedOutPage);
        });
    }

    push(C: typeof Component, args: any): void {
        this.state.pages.push({
            component: C,
            props: args,
        });
        // set tags, only the last three items might need changes
        // last item -> pushed-in
        // before last item -> pushed-out
        // before before last item -> hidden
        this.state.pages.slice(-1).forEach((item) => {
            item.props.pageStackClass = "page-stack-pushed-in";
        });
        this.state.pages.slice(-2, -1).forEach((item) => {
            item.props.pageStackClass = "page-stack-pushed-out";
        });
        this.state.pages.slice(-3, -2).forEach((item) => {
            item.props.pageStackClass = "page-stack-hidden";
        });
    }

    pop(): void {
        if (this.state.pages.length === 0) {
            return;
        }
        // We keep the last item (we need it for transitions). It will
        // be remove by the animationend handler.
        // Set tags, only the last two items might need changes
        // last item -> popped-out
        // before last item -> popped-in
        this.state.pages.slice(-1).forEach((item) => {
            item.props.pageStackClass = "page-stack-popped-out";
        });
        this.state.pages.slice(-2, -1).forEach((item) => {
            item.props.pageStackClass = "page-stack-popped-in";
        });
    }
}

class Navigator {
    delegate: PageStack;
    pushPage(C: typeof Component, args: any = {}): void {
        this.delegate.push(C, args);
    }

    popPage(): void {
        this.delegate.pop();
    }
}

export async function main(
    Root: typeof Component,
    rootElement: HTMLElement,
    templates: string | XMLDocument,
): Promise<void> {
    const navigator = new Navigator();
    (window as any).pageNavigator = navigator;
    const db = await openDb();
    const dev = false;
    await mount(PageStack, rootElement, { env: { navigator, db }, templates, dev });
    navigator.pushPage(Root);
}
