## Strategic Design

### Subdomains

### Bounded Contexts

### Context Map

The policies of the board that cross the boundaries of the bounded contexts are their integration
points, and those of the future microservices:

| From | Event | Policy | To |
|---|---|---|---|
| Account | Workspace Created | Accept the creator as Admin | Membership |
| Account | Workspace Created | Create its root page | Editing |
| Account | Workspace Deleted | Delete its root page | Editing |
| Membership | Member Invited | Send the invitation | Notification |
| Discussion | Comment Posted | Notify the mentioned user | Notification |

<!-- TODO context map: upstream/downstream relation and integration pattern of each pair of
contexts, and how the roles reach the other contexts (PP-04). -->
