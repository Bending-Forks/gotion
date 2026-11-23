package app

import (
	"context"
	"fmt"

	"github.com/Bending-Forks/gotion/services/account/internal/domain"
)

const firstWorkspaceName = "My workspace"

type WorkspaceRepository interface {
	Save(ctx context.Context, workspace *domain.Workspace) error
}

type WorkspaceCreatedPublisher interface {
	Publish(ctx context.Context, event domain.WorkspaceCreated) error
}

type CreateFirstWorkspace struct {
	users      UserRepository
	workspaces WorkspaceRepository
	publisher  WorkspaceCreatedPublisher
}

func NewCreateFirstWorkspace(users UserRepository, workspaces WorkspaceRepository, publisher WorkspaceCreatedPublisher) *CreateFirstWorkspace {
	return &CreateFirstWorkspace{users: users, workspaces: workspaces, publisher: publisher}
}

// Handle runs in the caller's workspace transaction, shared by the repository and publisher.
// When redelivering UserRegistered, the caller deduplicates by UserID in that transaction.
func (p *CreateFirstWorkspace) Handle(ctx context.Context, registered domain.UserRegistered) error {
	user, err := p.users.FindByID(ctx, registered.UserID)
	if err != nil {
		return fmt.Errorf("find registered user %s: %w", registered.UserID, err)
	}

	workspace, created, err := user.CreateWorkspace(domain.WorkspaceID(newID()), firstWorkspaceName)
	if err != nil {
		return err
	}
	if err := p.workspaces.Save(ctx, workspace); err != nil {
		return fmt.Errorf("save first workspace: %w", err)
	}
	if err := p.publisher.Publish(ctx, created); err != nil {
		return fmt.Errorf("publish Workspace Created: %w", err)
	}
	return nil
}
