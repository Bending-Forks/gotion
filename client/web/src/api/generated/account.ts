export interface paths {
    "/v1/users": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Register
         * @description Creates the user, then a policy creates their first workspace (US-01).
         */
        post: operations["register"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/sessions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Sign in
         * @description Sets the sign-in token, a JWT signed with Ed25519, in an HttpOnly, SameSite=Strict cookie that lasts 8 h (ADR-09). More than 5 failed attempts per account in 15 minutes are throttled (QA-07).
         */
        post: operations["signIn"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/workspaces": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Create workspace */
        post: operations["createWorkspace"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/workspaces/{workspaceId}": {
        parameters: {
            query?: never;
            header: {
                /** @description The signed-in user, set by the API gateway from the sign-in token */
                "X-User-Id": components["parameters"]["XUserId"];
            };
            path: {
                workspaceId: components["parameters"]["WorkspaceId"];
            };
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /**
         * Delete workspace
         * @description Only an Admin of the workspace, as Membership answers.
         */
        delete: operations["deleteWorkspace"];
        options?: never;
        head?: never;
        /**
         * Rename workspace
         * @description Only an Admin of the workspace, as Membership answers.
         */
        patch: operations["renameWorkspace"];
        trace?: never;
    };
    "/v1/workspaces/{workspaceId}/open": {
        parameters: {
            query?: never;
            header: {
                /** @description The signed-in user, set by the API gateway from the sign-in token */
                "X-User-Id": components["parameters"]["XUserId"];
            };
            path: {
                workspaceId: components["parameters"]["WorkspaceId"];
            };
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Open workspace
         * @description Saves the workspace as the main workspace of the user, who must be a member of it.
         */
        post: operations["openWorkspace"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/internal/v1/users": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** The UserId registered with an email address, for Membership */
        get: operations["findUserByEmail"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/internal/v1/workspaces": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * The names of a batch of workspaces, for the gateway
         * @description A workspace that does not exist, or is deleted, is left out of the answer.
         */
        get: operations["getWorkspaceNames"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/internal/v1/users/{userId}/main-workspace": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** The main workspace of a user, for the gateway */
        get: operations["getMainWorkspace"];
        put?: never;
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
        Id: string;
        /** Format: email */
        Email: string;
        Credentials: {
            email: components["schemas"]["Email"];
            password: string;
        };
        RegisteredUser: {
            userId: components["schemas"]["Id"];
        };
        /** @description Never blank */
        WorkspaceName: string;
        WorkspaceNameBody: {
            name: components["schemas"]["WorkspaceName"];
        };
        Workspace: {
            workspaceId: components["schemas"]["Id"];
            name: components["schemas"]["WorkspaceName"];
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
        /** @description The user is a member of the workspace but not an Admin */
        NotAdmin: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/problem+json": components["schemas"]["Problem"];
            };
        };
        /** @description The workspace does not exist or the user is not a member of it; the two are answered alike (QA-06) */
        NotFound: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/problem+json": components["schemas"]["Problem"];
            };
        };
        /** @description Membership did not answer, so the command is refused (fail closed) */
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
        XUserId: components["schemas"]["Id"];
        WorkspaceId: components["schemas"]["Id"];
    };
    requestBodies: never;
    headers: never;
    pathItems: never;
}
export type $defs = Record<string, never>;
export interface operations {
    register: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["Credentials"];
            };
        };
        responses: {
            /** @description The user is registered */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["RegisteredUser"];
                };
            };
            400: components["responses"]["BadRequest"];
            /** @description The email address is already in use */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    signIn: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["Credentials"];
            };
        };
        responses: {
            /** @description Signed in */
            204: {
                headers: {
                    /** @description The sign-in token */
                    "Set-Cookie"?: string;
                    [name: string]: unknown;
                };
                content?: never;
            };
            400: components["responses"]["BadRequest"];
            /** @description Unknown email address or wrong password, not told apart */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Too many failed attempts for this account */
            429: {
                headers: {
                    /** @description Seconds to wait before the next attempt */
                    "Retry-After"?: number;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    createWorkspace: {
        parameters: {
            query?: never;
            header: {
                /** @description The signed-in user, set by the API gateway from the sign-in token */
                "X-User-Id": components["parameters"]["XUserId"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["WorkspaceNameBody"];
            };
        };
        responses: {
            /** @description The workspace is created, with the user as its creator */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Workspace"];
                };
            };
            400: components["responses"]["BadRequest"];
        };
    };
    deleteWorkspace: {
        parameters: {
            query?: never;
            header: {
                /** @description The signed-in user, set by the API gateway from the sign-in token */
                "X-User-Id": components["parameters"]["XUserId"];
            };
            path: {
                workspaceId: components["parameters"]["WorkspaceId"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Deleted */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            403: components["responses"]["NotAdmin"];
            404: components["responses"]["NotFound"];
            503: components["responses"]["Unavailable"];
        };
    };
    renameWorkspace: {
        parameters: {
            query?: never;
            header: {
                /** @description The signed-in user, set by the API gateway from the sign-in token */
                "X-User-Id": components["parameters"]["XUserId"];
            };
            path: {
                workspaceId: components["parameters"]["WorkspaceId"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["WorkspaceNameBody"];
            };
        };
        responses: {
            /** @description Renamed */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            400: components["responses"]["BadRequest"];
            403: components["responses"]["NotAdmin"];
            404: components["responses"]["NotFound"];
            503: components["responses"]["Unavailable"];
        };
    };
    openWorkspace: {
        parameters: {
            query?: never;
            header: {
                /** @description The signed-in user, set by the API gateway from the sign-in token */
                "X-User-Id": components["parameters"]["XUserId"];
            };
            path: {
                workspaceId: components["parameters"]["WorkspaceId"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description The workspace is the main workspace of the user */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            404: components["responses"]["NotFound"];
            503: components["responses"]["Unavailable"];
        };
    };
    findUserByEmail: {
        parameters: {
            query: {
                email: components["schemas"]["Email"];
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description The user registered with the address */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["RegisteredUser"];
                };
            };
            /** @description No user is registered with the address */
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
    getWorkspaceNames: {
        parameters: {
            query: {
                id: components["schemas"]["Id"][];
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description The workspaces found */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        workspaces: components["schemas"]["Workspace"][];
                    };
                };
            };
            400: components["responses"]["BadRequest"];
        };
    };
    getMainWorkspace: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                userId: components["schemas"]["Id"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description The main workspace, absent when unset */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        workspaceId?: components["schemas"]["Id"];
                    };
                };
            };
            /** @description No such user */
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
}
