package config

import (
	"errors"
	"os"
)

// TokenPrivateKey reads TOKEN_PRIVATE_KEY, the Ed25519 private key in PEM that signs the sign-in token, set from a Secret. Only Account needs it.
func TokenPrivateKey() ([]byte, error) {
	key := os.Getenv("TOKEN_PRIVATE_KEY")
	if key == "" {
		return nil, errors.New("TOKEN_PRIVATE_KEY is not set")
	}
	return []byte(key), nil
}

// TokenPublicKey reads TOKEN_PUBLIC_KEY, the Ed25519 public key in PEM that checks the sign-in token. Only the gateway needs it.
func TokenPublicKey() ([]byte, error) {
	key := os.Getenv("TOKEN_PUBLIC_KEY")
	if key == "" {
		return nil, errors.New("TOKEN_PUBLIC_KEY is not set")
	}
	return []byte(key), nil
}
