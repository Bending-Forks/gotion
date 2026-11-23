export interface paths {
    "/internal/v1/pages/{pageId}/workspace": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                pageId: components["parameters"]["PageId"];
            };
            cookie?: never;
        };
        /**
         * The workspace of a page, for Discussion
         * @description A PageId does not tell its workspace, so Discussion asks it when it opens a thread on the page and keeps it with the thread: a page never changes workspace.
         */
        get: operations["getPageWorkspace"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/pages/{pageId}/metadata": {
        parameters: {
            query?: never;
            header: {
                /** @description The signed-in user, set by the API gateway from the sign-in token */
                "X-User-Id": components["parameters"]["XUserId"];
            };
            path: {
                pageId: components["parameters"]["PageId"];
            };
            cookie?: never;
        };
        get?: never;
        /**
         * Set title, icon, cover
         * @description Replaces the metadata of the page; leaving out the icon or the cover removes it (US-05). Only a role that may change the content: Editing reads its local copy of the roles, and asks Membership only when the copy has no row for the user (ADR-03).
         */
        put: operations["setPageMetadata"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
}
export type webhooks = Record<string, never>;
export interface components {
    schemas: {
        /** Format: uuid */
        PageId: string;
        PageMetadata: {
            /** @description Plain text on one line; a new page has an empty title until one is set */
            title: string;
            /**
             * @description The name of an icon of the Lucide set, which the client draws, so the page stores no image
             * @example FlaskConical
             */
            icon?: string;
            /**
             * Format: uri
             * @description A link to an image; no user story uploads files
             */
            cover?: string;
        };
        /** @description An error, as in RFC 9457 */
        Problem: {
            /** Format: uri-reference */
            type?: string;
            title: string;
            status: number;
            detail?: string;
        };
    };
    responses: {
        /** @description The request does not match its schema */
        BadRequest: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/problem+json": components["schemas"]["Problem"];
            };
        };
        /** @description The user is a member of the workspace, with a role that may only read the content */
        ReadOnly: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/problem+json": components["schemas"]["Problem"];
            };
        };
        /** @description The page does not exist or the user is not a member of its workspace; the two are answered alike (QA-06) */
        NotFound: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/problem+json": components["schemas"]["Problem"];
            };
        };
        /** @description The local copy of the roles has no row for the user and Membership did not answer, so the command is refused (fail closed) */
        Unavailable: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/problem+json": components["schemas"]["Problem"];
            };
        };
    };
    parameters: {
        /** @description The signed-in user, set by the API gateway from the sign-in token */
        XUserId: string;
        PageId: components["schemas"]["PageId"];
    };
    requestBodies: never;
    headers: never;
    pathItems: never;
}
export type $defs = Record<string, never>;
export interface operations {
    getPageWorkspace: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                pageId: components["parameters"]["PageId"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description The workspace of the page */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        /** Format: uuid */
                        workspaceId: string;
                    };
                };
            };
            /** @description The page does not exist */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    setPageMetadata: {
        parameters: {
            query?: never;
            header: {
                /** @description The signed-in user, set by the API gateway from the sign-in token */
                "X-User-Id": components["parameters"]["XUserId"];
            };
            path: {
                pageId: components["parameters"]["PageId"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["PageMetadata"];
            };
        };
        responses: {
            /** @description The page has the new metadata */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            400: components["responses"]["BadRequest"];
            403: components["responses"]["ReadOnly"];
            404: components["responses"]["NotFound"];
            503: components["responses"]["Unavailable"];
        };
    };
}
