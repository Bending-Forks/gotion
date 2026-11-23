package domain_test

import (
	"errors"
	"testing"

	"github.com/Bending-Forks/gotion/services/account/internal/domain"
)

func TestCreateWorkspaceRejectsInvalidNames(t *testing.T) {
	t.Parallel()
	email, err := domain.NewEmail("alice@example.com")
	if err != nil {
		t.Fatal(err)
	}
	hash, err := domain.NewPasswordHash("encoded-hash")
	if err != nil {
		t.Fatal(err)
	}
	user, _, err := domain.RegisterUser("user-id", email, hash)
	if err != nil {
		t.Fatal(err)
	}

	for _, name := range []string{"", " \t\n\u00a0"} {
		workspace, event, err := user.CreateWorkspace("workspace-id", name)
		if !errors.Is(err, domain.ErrInvalidWorkspaceName) || workspace != nil || event != (domain.WorkspaceCreated{}) {
			t.Fatalf("CreateWorkspace with name %q returned (%v, %+v, %v)", name, workspace, event, err)
		}
	}
}
