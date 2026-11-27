package config

import (
	"errors"
	"os"
	"strings"
)

// KafkaBrokers reads the Kafka brokers from KAFKA_BROKERS, separated by commas, which has no default.
func KafkaBrokers() ([]string, error) {
	brokers := os.Getenv("KAFKA_BROKERS")
	if brokers == "" {
		return nil, errors.New("KAFKA_BROKERS is not set")
	}
	return strings.Split(brokers, ","), nil
}
