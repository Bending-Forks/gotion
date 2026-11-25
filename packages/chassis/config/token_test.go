package config_test

import (
	"testing"

	"github.com/Bending-Forks/gotion/packages/chassis/config"
)

func TestTokenKeys(t *testing.T) {
	for _, tt := range []struct {
		name string
		env  string
		read func() ([]byte, error)
	}{
		{name: "private key", env: "TOKEN_PRIVATE_KEY", read: config.TokenPrivateKey},
		{name: "public key", env: "TOKEN_PUBLIC_KEY", read: config.TokenPublicKey},
	} {
		t.Run(tt.name, func(t *testing.T) {
			t.Setenv(tt.env, "-----BEGIN KEY-----")
			if key, err := tt.read(); err != nil || string(key) != "-----BEGIN KEY-----" {
				t.Fatalf("with %s set: %q, %v", tt.env, key, err)
			}
			t.Setenv(tt.env, "")
			if _, err := tt.read(); err == nil {
				t.Fatalf("with %s unset: no error", tt.env)
			}
		})
	}
}
