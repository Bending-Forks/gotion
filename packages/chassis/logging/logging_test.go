package logging_test

import (
	"encoding/json"
	"os"
	"testing"

	"github.com/Bending-Forks/gotion/packages/chassis/logging"
)

func TestNewWritesJSONToStdout(t *testing.T) {
	reader, writer, err := os.Pipe()
	if err != nil {
		t.Fatal(err)
	}
	defer reader.Close()
	defer writer.Close()
	stdout := os.Stdout
	os.Stdout = writer
	defer func() { os.Stdout = stdout }()

	logging.New("example").Info("listening", "addr", ":8080")
	if err := writer.Close(); err != nil {
		t.Fatal(err)
	}

	var record map[string]any
	if err := json.NewDecoder(reader).Decode(&record); err != nil {
		t.Fatal(err)
	}
	for key, want := range map[string]string{"service": "example", "level": "INFO", "msg": "listening", "addr": ":8080"} {
		if record[key] != want {
			t.Errorf("%s = %v; want %q", key, record[key], want)
		}
	}
}
