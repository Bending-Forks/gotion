package domain

import (
	"errors"
	"strings"
	"unicode/utf8"
)

type WorkspaceID string

var (
	ErrInvalidWorkspaceID   = errors.New("workspace ID must not be empty")
	ErrInvalidWorkspaceName = errors.New("workspace name must not be blank and must be at most 100 characters")
)

type WorkspaceName struct {
	value string
}

func NewWorkspaceName(name string) (WorkspaceName, error) {
	if !utf8.ValidString(name) || utf8.RuneCountInString(name) > 100 || strings.TrimSpace(name) == "" {
		return WorkspaceName{}, ErrInvalidWorkspaceName
	}
	return WorkspaceName{value: name}, nil
}

func (n WorkspaceName) String() string { return n.value }

type Workspace struct {
	id   WorkspaceID
	name WorkspaceName
}

func (w *Workspace) ID() WorkspaceID     { return w.id }
func (w *Workspace) Name() WorkspaceName { return w.name }

type WorkspaceCreated struct {
	WorkspaceID WorkspaceID
	CreatorID   UserID
}
