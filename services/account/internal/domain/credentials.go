package domain

import (
	"errors"
	"net/mail"
	"strings"
)

var (
	ErrInvalidEmail        = errors.New("invalid email address")
	ErrEmailInUse          = errors.New("email address already in use")
	ErrInvalidPassword     = errors.New("password must be 8 to 128 characters")
	ErrInvalidPasswordHash = errors.New("password hash must not be blank")
)

type Email struct {
	address string
}

func NewEmail(address string) (Email, error) {
	if len(address) > 254 {
		return Email{}, ErrInvalidEmail
	}
	parsed, err := mail.ParseAddress(address)
	if err != nil || parsed.Name != "" || parsed.Address != address {
		return Email{}, ErrInvalidEmail
	}
	return Email{address: address}, nil
}

func (e Email) String() string { return e.address }

type PasswordHash struct {
	encoded string
}

func NewPasswordHash(encoded string) (PasswordHash, error) {
	if strings.TrimSpace(encoded) == "" {
		return PasswordHash{}, ErrInvalidPasswordHash
	}
	return PasswordHash{encoded: encoded}, nil
}

func (h PasswordHash) String() string { return h.encoded }
