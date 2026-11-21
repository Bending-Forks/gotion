export interface paths {
    "/v1/workspaces/{workspaceId}/members": {
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
        /** The members of a workspace */
        get: operations["listMembers"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/workspaces/{workspaceId}/members/{memberId}": {
        parameters: {
            query?: never;
            header: {
                /** @description The signed-in user, set by the API gateway from the sign-in token */
                "X-User-Id": components["parameters"]["XUserId"];
            };
            path: {
                workspaceId: components["parameters"]["WorkspaceId"];
                /** @description The UserId of the member */
                memberId: components["parameters"]["MemberId"];
            };
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /**
         * Remove member
         * @description Only an Admin; refused if it would leave the workspace with no Admin.
         */
        delete: operations["removeMember"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/workspaces/{workspaceId}/members/{memberId}/role": {
        parameters: {
            query?: never;
            header: {
                /** @description The signed-in user, set by the API gateway from the sign-in token */
                "X-User-Id": components["parameters"]["XUserId"];
            };
            path: {
                workspaceId: components["parameters"]["WorkspaceId"];
                /** @description The UserId of the member */
                memberId: components["parameters"]["MemberId"];
            };
            cookie?: never;
        };
        get?: never;
        /**
         * Change member role
         * @description Only an Admin; refused if it would leave the workspace with no Admin.
         */
        put: operations["changeMemberRole"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/workspaces/{workspaceId}/leave": {
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
         * Leave workspace
         * @description Refused if the user is the last Admin.
         */
        post: operations["leaveWorkspace"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/workspaces/{workspaceId}/invitations": {
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
        /** The pending invitations of a workspace */
        get: operations["listInvitations"];
        put?: never;
        /**
         * Invite member
         * @description Only an Admin. Membership asks Account for the UserId of the email address first; the invitee must be registered, and neither a member nor already invited.
         */
        post: operations["inviteMember"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/workspaces/{workspaceId}/invitations/{inviteeId}/accept": {
        parameters: {
            query?: never;
            header: {
                /** @description The signed-in user, set by the API gateway from the sign-in token */
                "X-User-Id": components["parameters"]["XUserId"];
            };
            path: {
                workspaceId: components["parameters"]["WorkspaceId"];
                /** @description The UserId of the invitee, who must be the signed-in user */
                inviteeId: components["parameters"]["InviteeId"];
            };
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Accept invitation
         * @description Only the invitee, who becomes a member with the role of the invitation.
         */
        post: operations["acceptInvitation"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/workspaces/{workspaceId}/invitations/{inviteeId}/decline": {
        parameters: {
            query?: never;
            header: {
                /** @description The signed-in user, set by the API gateway from the sign-in token */
                "X-User-Id": components["parameters"]["XUserId"];
            };
            path: {
                workspaceId: components["parameters"]["WorkspaceId"];
                /** @description The UserId of the invitee, who must be the signed-in user */
                inviteeId: components["parameters"]["InviteeId"];
            };
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Decline invitation
         * @description Only the invitee; the invitation ends.
         */
        post: operations["declineInvitation"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/internal/v1/workspaces/{workspaceId}/members/{memberId}/role": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                workspaceId: components["parameters"]["WorkspaceId"];
                /** @description The UserId of the member */
                memberId: components["parameters"]["MemberId"];
            };
            cookie?: never;
        };
        /** The role of a user in a workspace, for Account and Editing */
        get: operations["getRole"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/internal/v1/workspaces/{workspaceId}/members": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                workspaceId: components["parameters"]["WorkspaceId"];
            };
            cookie?: never;
        };
        /**
         * Which of a set of users are members of a workspace, for Discussion
         * @description Answers the users of the set that are members, with their role; the others, and every user of a workspace that does not exist, are left out.
         */
        get: operations["findMembers"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/internal/v1/users/{userId}/workspaces": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                userId: components["schemas"]["Id"];
            };
            cookie?: never;
        };
        /** The workspaces of a user with the role in each, for the gateway */
        get: operations["getUserWorkspaces"];
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
        /** @enum {string} */
        Role: "Admin" | "Editor" | "Viewer";
        RoleBody: {
            role: components["schemas"]["Role"];
        };
        Member: {
            userId: components["schemas"]["Id"];
            role: components["schemas"]["Role"];
        };
        Members: {
            members: components["schemas"]["Member"][];
        };
        Invitation: {
            inviteeId: components["schemas"]["Id"];
            role: components["schemas"]["Role"];
            invitedBy: components["schemas"]["Id"];
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
        /** @description The workspace does not exist, the user is not a member of it, or the member is not found; a non-member cannot tell these apart (QA-06) */
        NotFound: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/problem+json": components["schemas"]["Problem"];
            };
        };
        /** @description The workspace would be left with no Admin */
        LastAdmin: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/problem+json": components["schemas"]["Problem"];
            };
        };
        /** @description The signed-in user has no pending invitation to the workspace, including when the invitee is someone else */
        NoInvitation: {
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
        /** @description The UserId of the member */
        MemberId: components["schemas"]["Id"];
        /** @description The UserId of the invitee, who must be the signed-in user */
        InviteeId: components["schemas"]["Id"];
    };
    requestBodies: never;
    headers: never;
    pathItems: never;
}
export type $defs = Record<string, never>;
export interface operations {
    listMembers: {
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
            /** @description Every member, with their role */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Members"];
                };
            };
            404: components["responses"]["NotFound"];
        };
    };
    removeMember: {
        parameters: {
            query?: never;
            header: {
                /** @description The signed-in user, set by the API gateway from the sign-in token */
                "X-User-Id": components["parameters"]["XUserId"];
            };
            path: {
                workspaceId: components["parameters"]["WorkspaceId"];
                /** @description The UserId of the member */
                memberId: components["parameters"]["MemberId"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Removed */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            403: components["responses"]["NotAdmin"];
            404: components["responses"]["NotFound"];
            409: components["responses"]["LastAdmin"];
        };
    };
    changeMemberRole: {
        parameters: {
            query?: never;
            header: {
                /** @description The signed-in user, set by the API gateway from the sign-in token */
                "X-User-Id": components["parameters"]["XUserId"];
            };
            path: {
                workspaceId: components["parameters"]["WorkspaceId"];
                /** @description The UserId of the member */
                memberId: components["parameters"]["MemberId"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["RoleBody"];
            };
        };
        responses: {
            /** @description The member has the new role */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            400: components["responses"]["BadRequest"];
            403: components["responses"]["NotAdmin"];
            404: components["responses"]["NotFound"];
            409: components["responses"]["LastAdmin"];
        };
    };
    leaveWorkspace: {
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
            /** @description The user is no longer a member */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            404: components["responses"]["NotFound"];
            409: components["responses"]["LastAdmin"];
        };
    };
    listInvitations: {
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
            /** @description Every pending invitation */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        invitations: components["schemas"]["Invitation"][];
                    };
                };
            };
            404: components["responses"]["NotFound"];
        };
    };
    inviteMember: {
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
                "application/json": {
                    /** Format: email */
                    email: string;
                    role: components["schemas"]["Role"];
                };
            };
        };
        responses: {
            /** @description The invitation is pending */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Invitation"];
                };
            };
            400: components["responses"]["BadRequest"];
            403: components["responses"]["NotAdmin"];
            404: components["responses"]["NotFound"];
            /** @description The invitee is already a member or already invited */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description No user is registered with the email address */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Account did not answer, so the command is refused (fail closed) */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    acceptInvitation: {
        parameters: {
            query?: never;
            header: {
                /** @description The signed-in user, set by the API gateway from the sign-in token */
                "X-User-Id": components["parameters"]["XUserId"];
            };
            path: {
                workspaceId: components["parameters"]["WorkspaceId"];
                /** @description The UserId of the invitee, who must be the signed-in user */
                inviteeId: components["parameters"]["InviteeId"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description The invitee is a member */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            404: components["responses"]["NoInvitation"];
        };
    };
    declineInvitation: {
        parameters: {
            query?: never;
            header: {
                /** @description The signed-in user, set by the API gateway from the sign-in token */
                "X-User-Id": components["parameters"]["XUserId"];
            };
            path: {
                workspaceId: components["parameters"]["WorkspaceId"];
                /** @description The UserId of the invitee, who must be the signed-in user */
                inviteeId: components["parameters"]["InviteeId"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description The invitation has ended */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            404: components["responses"]["NoInvitation"];
        };
    };
    getRole: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                workspaceId: components["parameters"]["WorkspaceId"];
                /** @description The UserId of the member */
                memberId: components["parameters"]["MemberId"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description The role of the member */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["RoleBody"];
                };
            };
            /** @description The user is not a member, or the workspace does not exist */
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
    findMembers: {
        parameters: {
            query: {
                userId: components["schemas"]["Id"][];
            };
            header?: never;
            path: {
                workspaceId: components["parameters"]["WorkspaceId"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description The members among the users asked */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Members"];
                };
            };
            400: components["responses"]["BadRequest"];
        };
    };
    getUserWorkspaces: {
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
            /** @description Every workspace the user is a member of, empty if none */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        workspaces: {
                            workspaceId: components["schemas"]["Id"];
                            role: components["schemas"]["Role"];
                        }[];
                    };
                };
            };
        };
    };
}
