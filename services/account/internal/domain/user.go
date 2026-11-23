package domain

import "errors"

type UserID string

var ErrInvalidUserID = errors.New("user ID must not be empty")

type User struct {
	id           UserID
	email        Email
	passwordHash PasswordHash
}

type UserRegistered struct {
	UserID UserID
}

func RegisterUser(id UserID, email Email, hash PasswordHash) (*User, UserRegistered, error) {
	switch {
	case id == "":
		return nil, UserRegistered{}, ErrInvalidUserID
	case email == (Email{}):
		return nil, UserRegistered{}, ErrInvalidEmail
	case hash == (PasswordHash{}):
		return nil, UserRegistered{}, ErrInvalidPasswordHash
	}
	return &User{id: id, email: email, passwordHash: hash}, UserRegistered{UserID: id}, nil
}

func (u *User) ID() UserID                 { return u.id }
func (u *User) Email() Email               { return u.email }
func (u *User) PasswordHash() PasswordHash { return u.passwordHash }

func (u *User) CreateWorkspace(id WorkspaceID, name string) (*Workspace, WorkspaceCreated, error) {
	switch {
	case u.id == "":
		return nil, WorkspaceCreated{}, ErrInvalidUserID
	case id == "":
		return nil, WorkspaceCreated{}, ErrInvalidWorkspaceID
	}
	workspaceName, err := NewWorkspaceName(name)
	if err != nil {
		return nil, WorkspaceCreated{}, err
	}
	return &Workspace{id: id, name: workspaceName}, WorkspaceCreated{WorkspaceID: id, CreatorID: u.id}, nil
}
