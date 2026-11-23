package app

import (
	"context"
	"errors"
	"fmt"
	"unicode/utf8"

	"github.com/Bending-Forks/gotion/services/account/internal/domain"
)

type EmailAvailability interface {
	IsAvailable(ctx context.Context, email domain.Email) (bool, error)
}

type PasswordHasher interface {
	Hash(ctx context.Context, password string) (domain.PasswordHash, error)
}

type UserRepository interface {
	FindByID(ctx context.Context, id domain.UserID) (*domain.User, error)
	// Save returns domain.ErrEmailInUse when the store rejects a duplicate email.
	Save(ctx context.Context, user *domain.User) error
}

type Register struct {
	users  UserRepository
	emails EmailAvailability
	hasher PasswordHasher
}

func NewRegister(users UserRepository, emails EmailAvailability, hasher PasswordHasher) *Register {
	return &Register{users: users, emails: emails, hasher: hasher}
}

// Handle returns the local UserRegistered event for dispatch after the user transaction commits.
func (r *Register) Handle(ctx context.Context, address, password string) (domain.UserRegistered, error) {
	email, err := domain.NewEmail(address)
	if err != nil {
		return domain.UserRegistered{}, err
	}
	if length := utf8.RuneCountInString(password); !utf8.ValidString(password) || length < 8 || length > 128 {
		return domain.UserRegistered{}, domain.ErrInvalidPassword
	}
	available, err := r.emails.IsAvailable(ctx, email)
	if err != nil {
		return domain.UserRegistered{}, fmt.Errorf("check email availability: %w", err)
	}
	if !available {
		return domain.UserRegistered{}, domain.ErrEmailInUse
	}

	hash, err := r.hasher.Hash(ctx, password)
	if err != nil {
		return domain.UserRegistered{}, fmt.Errorf("hash password: %w", err)
	}
	user, registered, err := domain.RegisterUser(domain.UserID(newID()), email, hash)
	if err != nil {
		return domain.UserRegistered{}, err
	}
	if err := r.users.Save(ctx, user); err != nil {
		if errors.Is(err, domain.ErrEmailInUse) {
			return domain.UserRegistered{}, err
		}
		return domain.UserRegistered{}, fmt.Errorf("save registered user: %w", err)
	}
	return registered, nil
}
