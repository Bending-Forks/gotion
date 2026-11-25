package token

import (
	"crypto/ed25519"
	"errors"
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

// TTL is how long a sign-in token lasts.
const TTL = 8 * time.Hour

// Signer signs sign-in tokens with the private key of Account.
type Signer struct {
	key ed25519.PrivateKey
}

// NewSigner takes the Ed25519 private key in PKCS #8 PEM.
func NewSigner(privPEM []byte) (*Signer, error) {
	key, err := jwt.ParseEdPrivateKeyFromPEM(privPEM)
	if err != nil {
		return nil, fmt.Errorf("parse the private key of the sign-in token: %w", err)
	}
	return &Signer{key: key.(ed25519.PrivateKey)}, nil
}

// Sign returns a JWT signed with EdDSA whose only claims are sub, the user, iat, now, and exp, TTL after now.
func (s *Signer) Sign(userID string, now time.Time) (string, error) {
	claims := jwt.RegisteredClaims{
		Subject:   userID,
		IssuedAt:  jwt.NewNumericDate(now),
		ExpiresAt: jwt.NewNumericDate(now.Add(TTL)),
	}
	return jwt.NewWithClaims(jwt.SigningMethodEdDSA, claims).SignedString(s.key)
}

// Verifier checks sign-in tokens against the public key of Account.
type Verifier struct {
	key    ed25519.PublicKey
	parser *jwt.Parser
}

// NewVerifier takes the Ed25519 public key in PKIX PEM.
func NewVerifier(pubPEM []byte) (*Verifier, error) {
	key, err := jwt.ParseEdPublicKeyFromPEM(pubPEM)
	if err != nil {
		return nil, fmt.Errorf("parse the public key of the sign-in token: %w", err)
	}
	parser := jwt.NewParser(jwt.WithValidMethods([]string{jwt.SigningMethodEdDSA.Alg()}), jwt.WithExpirationRequired())
	return &Verifier{key: key.(ed25519.PublicKey), parser: parser}, nil
}

// Verify accepts only a token signed with EdDSA by the key of Account, with an exp not yet passed and a sub, and returns the sub.
func (v *Verifier) Verify(signed string) (string, error) {
	var claims jwt.RegisteredClaims
	if _, err := v.parser.ParseWithClaims(signed, &claims, func(*jwt.Token) (any, error) { return v.key, nil }); err != nil {
		return "", fmt.Errorf("check the sign-in token: %w", err)
	}
	if claims.Subject == "" {
		return "", errors.New("check the sign-in token: no sub")
	}
	return claims.Subject, nil
}
