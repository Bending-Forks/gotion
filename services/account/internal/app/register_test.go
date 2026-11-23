package app_test

import (
	"context"
	"errors"
	"testing"

	"github.com/Bending-Forks/gotion/services/account/internal/app"
	"github.com/Bending-Forks/gotion/services/account/internal/domain"
)

func TestRegistration(t *testing.T) {
	t.Parallel()

	t.Run("Register with an unused email address", func(t *testing.T) {
		t.Parallel()
		ctx := t.Context()
		users := userStore{}
		workspaces := workspaceStore{}
		publisher := &workspacePublisher{}
		hasher := &passwordHasher{}
		register := app.NewRegister(users, users, hasher)
		firstWorkspace := app.NewCreateFirstWorkspace(users, workspaces, publisher)

		registered, err := register.Handle(ctx, "alice@example.com", "a valid password")
		if err != nil {
			t.Fatal(err)
		}
		user := users[registered.UserID]
		if len(users) != 1 || user == nil || user.Email().String() != "alice@example.com" ||
			user.PasswordHash().String() != "encoded-hash" {
			t.Fatalf("expected Alice's account with its password hash, found %d accounts", len(users))
		}

		if err := firstWorkspace.Handle(ctx, registered); err != nil {
			t.Fatal(err)
		}
		if len(workspaces) != 1 || len(publisher.events) != 1 {
			t.Fatalf("got %d workspaces and %d events, want one each", len(workspaces), len(publisher.events))
		}
		created := publisher.events[0]
		workspace := workspaces[created.WorkspaceID]
		if workspace == nil || workspace.Name().String() == "" || created.CreatorID != user.ID() {
			t.Fatalf("expected the workspace and its creator for Membership, got %+v", created)
		}
	})

	t.Run("Refuse an email address already in use", func(t *testing.T) {
		t.Parallel()
		ctx := t.Context()
		users := userStore{}
		hasher := &passwordHasher{}
		register := app.NewRegister(users, users, hasher)

		alice, err := register.Handle(ctx, "alice@example.com", "Alice's password")
		if err != nil {
			t.Fatal(err)
		}
		original := users[alice.UserID]
		duplicate, err := register.Handle(ctx, "alice@example.com", "another password")

		if !errors.Is(err, domain.ErrEmailInUse) || duplicate != (domain.UserRegistered{}) {
			t.Fatalf("got (%+v, %v), want no event and an email already in use error", duplicate, err)
		}
		if len(users) != 1 || users[alice.UserID] != original ||
			original.PasswordHash().String() != "encoded-hash" || hasher.calls != 1 {
			t.Fatal("the refused registration changed the stored account or hashed another password")
		}
	})
}

type userStore map[domain.UserID]*domain.User

func (s userStore) IsAvailable(_ context.Context, email domain.Email) (bool, error) {
	for _, user := range s {
		if user.Email() == email {
			return false, nil
		}
	}
	return true, nil
}

func (s userStore) FindByID(_ context.Context, id domain.UserID) (*domain.User, error) {
	user, ok := s[id]
	if !ok {
		return nil, errors.New("user not found")
	}
	return user, nil
}

func (s userStore) Save(_ context.Context, user *domain.User) error {
	s[user.ID()] = user
	return nil
}

type workspaceStore map[domain.WorkspaceID]*domain.Workspace

func (s workspaceStore) Save(_ context.Context, workspace *domain.Workspace) error {
	s[workspace.ID()] = workspace
	return nil
}

type workspacePublisher struct {
	events []domain.WorkspaceCreated
}

func (p *workspacePublisher) Publish(_ context.Context, event domain.WorkspaceCreated) error {
	p.events = append(p.events, event)
	return nil
}

type passwordHasher struct {
	calls int
}

func (h *passwordHasher) Hash(_ context.Context, _ string) (domain.PasswordHash, error) {
	h.calls++
	return domain.NewPasswordHash("encoded-hash")
}
