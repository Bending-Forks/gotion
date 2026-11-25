package token_test

import (
	"crypto/ed25519"
	"crypto/x509"
	"encoding/base64"
	"encoding/json"
	"encoding/pem"
	"strings"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"

	"github.com/Bending-Forks/gotion/packages/chassis/token"
)

// keyPair returns a new Ed25519 key pair in PEM, as the installation writes it, and the raw private key.
func keyPair(t *testing.T) (privPEM, pubPEM []byte, priv ed25519.PrivateKey) {
	t.Helper()
	pub, priv, err := ed25519.GenerateKey(nil)
	if err != nil {
		t.Fatal(err)
	}
	privDER, err := x509.MarshalPKCS8PrivateKey(priv)
	if err != nil {
		t.Fatal(err)
	}
	pubDER, err := x509.MarshalPKIXPublicKey(pub)
	if err != nil {
		t.Fatal(err)
	}
	return pem.EncodeToMemory(&pem.Block{Type: "PRIVATE KEY", Bytes: privDER}),
		pem.EncodeToMemory(&pem.Block{Type: "PUBLIC KEY", Bytes: pubDER}), priv
}

func newSigner(t *testing.T, privPEM []byte) *token.Signer {
	t.Helper()
	s, err := token.NewSigner(privPEM)
	if err != nil {
		t.Fatal(err)
	}
	return s
}

func newVerifier(t *testing.T, pubPEM []byte) *token.Verifier {
	t.Helper()
	v, err := token.NewVerifier(pubPEM)
	if err != nil {
		t.Fatal(err)
	}
	return v
}

func TestSignedTokenCarriesOnlySubIatAndExpEightHoursLater(t *testing.T) {
	t.Parallel()
	privPEM, pubPEM, _ := keyPair(t)
	now := time.Now().Truncate(time.Second)

	signed, err := newSigner(t, privPEM).Sign("user-1", now)
	if err != nil {
		t.Fatal(err)
	}

	parts := strings.Split(signed, ".")
	if len(parts) != 3 {
		t.Fatalf("token has %d parts, want 3", len(parts))
	}
	var header map[string]any
	decodePart(t, parts[0], &header)
	if header["alg"] != "EdDSA" {
		t.Errorf("alg = %v, want EdDSA", header["alg"])
	}
	var claims map[string]any
	decodePart(t, parts[1], &claims)
	want := map[string]any{"sub": "user-1", "iat": float64(now.Unix()), "exp": float64(now.Add(8 * time.Hour).Unix())}
	if len(claims) != len(want) {
		t.Errorf("claims = %v, want only %v", claims, want)
	}
	for k, v := range want {
		if claims[k] != v {
			t.Errorf("claim %s = %v, want %v", k, claims[k], v)
		}
	}

	sub, err := newVerifier(t, pubPEM).Verify(signed)
	if err != nil || sub != "user-1" {
		t.Fatalf("Verify = %q, %v; want user-1", sub, err)
	}
}

func decodePart(t *testing.T, part string, v any) {
	t.Helper()
	raw, err := base64.RawURLEncoding.DecodeString(part)
	if err != nil {
		t.Fatal(err)
	}
	if err := json.Unmarshal(raw, v); err != nil {
		t.Fatal(err)
	}
}

// renamedEdDSA signs and verifies like EdDSA but calls itself Ed25519, the name RFC 9864 gives the algorithm.
type renamedEdDSA struct{ *jwt.SigningMethodEd25519 }

func (renamedEdDSA) Alg() string { return "Ed25519" }

// The Compliance of ADR-09: the gateway accepts only a token that Account signed with EdDSA and that expires.
func TestVerifyRefuses(t *testing.T) {
	t.Parallel()
	privPEM, pubPEM, priv := keyPair(t)
	otherPrivPEM, _, _ := keyPair(t)
	now := time.Now()
	valid := jwt.MapClaims{"sub": "user-1", "iat": now.Unix(), "exp": now.Add(time.Hour).Unix()}

	sign := func(method jwt.SigningMethod, claims jwt.MapClaims, key any) string {
		t.Helper()
		s, err := jwt.NewWithClaims(method, claims).SignedString(key)
		if err != nil {
			t.Fatal(err)
		}
		return s
	}
	signWith := func(privPEM []byte, at time.Time) string {
		t.Helper()
		s, err := newSigner(t, privPEM).Sign("user-1", at)
		if err != nil {
			t.Fatal(err)
		}
		return s
	}
	good := signWith(privPEM, now)
	parts := strings.Split(good, ".")
	forged := base64.RawURLEncoding.EncodeToString([]byte(`{"sub":"user-2","iat":1,"exp":9999999999}`))
	// The same Ed25519 signature under another alg name: golang-jwt refuses none and HS256 by the type of the key alone, so only this case fails if the verifier stops accepting EdDSA alone.
	renamed := renamedEdDSA{jwt.SigningMethodEdDSA}
	jwt.RegisterSigningMethod(renamed.Alg(), func() jwt.SigningMethod { return renamed })

	for _, tt := range []struct {
		name  string
		token string
	}{
		{"a token with no signature (alg none)", sign(jwt.SigningMethodNone, valid, jwt.UnsafeAllowNoneSignatureType)},
		{"a token signed with HS256 and the public key as secret", sign(jwt.SigningMethodHS256, valid, pubPEM)},
		{"a token signed with the key of Account under another alg name", sign(renamed, valid, priv)},
		{"a token signed with another key", signWith(otherPrivPEM, now)},
		{"an expired token", signWith(privPEM, now.Add(-8*time.Hour-time.Second))},
		{"a token without exp", sign(jwt.SigningMethodEdDSA, jwt.MapClaims{"sub": "user-1", "iat": now.Unix()}, priv)},
		{"a token without sub", sign(jwt.SigningMethodEdDSA, jwt.MapClaims{"iat": now.Unix(), "exp": now.Add(time.Hour).Unix()}, priv)},
		{"a token whose claims were changed", parts[0] + "." + forged + "." + parts[2]},
		{"an empty token", ""},
	} {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			if sub, err := newVerifier(t, pubPEM).Verify(tt.token); err == nil {
				t.Fatalf("Verify accepted it with sub %q", sub)
			}
		})
	}
}

func TestKeysMustBeEd25519InPEM(t *testing.T) {
	t.Parallel()
	privPEM, pubPEM, _ := keyPair(t)
	if _, err := token.NewSigner(pubPEM); err == nil {
		t.Error("NewSigner accepted a public key")
	}
	if _, err := token.NewVerifier(privPEM); err == nil {
		t.Error("NewVerifier accepted a private key")
	}
	if _, err := token.NewSigner([]byte("not a key")); err == nil {
		t.Error("NewSigner accepted a value that is not PEM")
	}
	if _, err := token.NewVerifier(nil); err == nil {
		t.Error("NewVerifier accepted an empty key")
	}
}
