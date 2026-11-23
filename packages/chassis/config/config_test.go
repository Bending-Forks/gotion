package config_test

import (
	"testing"

	"github.com/Bending-Forks/gotion/packages/chassis/config"
)

func TestHTTPAddr(t *testing.T) {
	for _, tt := range []struct {
		name string
		port string
		want string
	}{
		{name: "default port", want: ":8080"},
		{name: "configured port", port: "9090", want: ":9090"},
		{name: "ephemeral port", port: "0", want: ":0"},
		{name: "non-numeric port", port: "http"},
		{name: "out of range", port: "65536"},
	} {
		t.Run(tt.name, func(t *testing.T) {
			t.Setenv("PORT", tt.port)
			addr, err := config.HTTPAddr()
			if tt.want == "" {
				if err == nil {
					t.Fatalf("HTTPAddr with PORT=%q succeeded", tt.port)
				}
				return
			}
			if err != nil || addr != tt.want {
				t.Fatalf("HTTPAddr = %q, %v; want %q", addr, err, tt.want)
			}
		})
	}
}
