package config

import (
	"errors"
	"os"
	"strconv"
)

// HTTPAddr reads the listen port from PORT. The default is 8080.
func HTTPAddr() (string, error) {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	if _, err := strconv.ParseUint(port, 10, 16); err != nil {
		return "", errors.New("PORT must be a decimal number between 0 and 65535")
	}
	return ":" + port, nil
}
